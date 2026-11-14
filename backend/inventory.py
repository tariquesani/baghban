"""Garden inventory items.

Items stand alone: no crop foreign keys. Tags are a JSON list of names.
"""

from __future__ import annotations

import json
from contextlib import closing
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from http_util import (
    json_number,
    optional_real,
    read_json_body,
    text_field,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])

ITEM_FIELDS = frozenset(
    {
        "id",
        "name",
        "description",
        "quantity",
        "manufacturer",
        "modelNumber",
        "purchaseFrom",
        "purchasePrice",
        "purchaseDate",
        "locationPath",
        "tags",
        "archived",
        "notes",
    }
)


def inventory_table_sql(name: str = "inventory_item", if_not_exists: bool = False) -> str:
    clause = "IF NOT EXISTS " if if_not_exists else ""
    return f"""
        CREATE TABLE {clause}{name} (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            name             TEXT NOT NULL,
            description      TEXT NOT NULL DEFAULT '',
            quantity         REAL NOT NULL DEFAULT 1,
            manufacturer     TEXT NOT NULL DEFAULT '',
            model_number     TEXT NOT NULL DEFAULT '',
            purchase_from    TEXT NOT NULL DEFAULT '',
            purchase_price   REAL,
            purchase_date    TEXT,
            location_path    TEXT NOT NULL DEFAULT '',
            tags             TEXT NOT NULL DEFAULT '[]',
            archived         INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
            notes            TEXT NOT NULL DEFAULT ''
        )
    """


def create_inventory_tables(connection) -> None:
    connection.execute(inventory_table_sql(if_not_exists=True))


def strip_homebox_columns(connection) -> None:
    """Rebuild inventory_item without legacy HomeBox columns.

    While rewriting, write scripts/homebox_map.json so an existing local sync
    keeps the same Baghban ids. New installs never hit this path.
    """
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'inventory_item'"
    ).fetchone()
    if row is None:
        return
    columns = {info[1] for info in connection.execute("PRAGMA table_info(inventory_item)")}
    if "homebox_id" not in columns:
        return

    # migrate() uses a plain sqlite3 connection (tuples), not Row.
    mapping = {
        str(homebox_id): int(item_id)
        for item_id, homebox_id in connection.execute(
            "SELECT id, homebox_id FROM inventory_item WHERE homebox_id IS NOT NULL AND homebox_id != ''"
        )
    }
    connection.execute("DROP TABLE IF EXISTS inventory_item_next")
    connection.execute(inventory_table_sql("inventory_item_next"))
    connection.execute(
        """
        INSERT INTO inventory_item_next (
            id, name, description, quantity, manufacturer, model_number,
            purchase_from, purchase_price, purchase_date, location_path, tags,
            archived, notes
        )
        SELECT
            id, name, description, quantity, manufacturer, model_number,
            purchase_from, purchase_price, purchase_date, location_path, tags,
            archived, notes
        FROM inventory_item
        """
    )
    connection.execute("DROP TABLE inventory_item")
    connection.execute("ALTER TABLE inventory_item_next RENAME TO inventory_item")
    sequence = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
    ).fetchone()
    max_id = connection.execute("SELECT MAX(id) FROM inventory_item").fetchone()[0]
    if sequence is not None and max_id is not None:
        found = connection.execute(
            "SELECT 1 FROM sqlite_sequence WHERE name = 'inventory_item'"
        ).fetchone()
        if found is None:
            connection.execute(
                "INSERT INTO sqlite_sequence (name, seq) VALUES ('inventory_item', ?)",
                (max_id,),
            )
        else:
            connection.execute(
                "UPDATE sqlite_sequence SET seq = ? WHERE name = 'inventory_item'",
                (max_id,),
            )
    if mapping:
        _write_legacy_sync_map(mapping)


def _write_legacy_sync_map(mapping: dict[str, int]) -> None:
    scripts = Path(__file__).resolve().parents[1] / "scripts"
    try:
        scripts.mkdir(parents=True, exist_ok=True)
        path = scripts / "homebox_map.json"
        path.write_text(json.dumps(mapping, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except OSError:
        pass


def connect():
    from app import connect as open_db

    return open_db()


def encode_tags(tags: list[str]) -> str:
    return json.dumps(tags, ensure_ascii=False)


def decode_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        if isinstance(item, str) and item.strip():
            cleaned.append(item.strip())
    return cleaned


def item_json(row) -> dict:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "description": row["description"] or "",
        "quantity": json_number(row["quantity"]),
        "manufacturer": row["manufacturer"] or "",
        "modelNumber": row["model_number"] or "",
        "purchaseFrom": row["purchase_from"] or "",
        "purchasePrice": json_number(row["purchase_price"]),
        "purchaseDate": row["purchase_date"],
        "locationPath": row["location_path"] or "",
        "tags": decode_tags(row["tags"]),
        "archived": bool(row["archived"]),
        "notes": row["notes"] or "",
    }


def tag_list(body: dict) -> list[str]:
    if "tags" not in body or body["tags"] is None:
        return []
    value = body["tags"]
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise HTTPException(status_code=400, detail="tags must be a list of strings")
    cleaned = []
    seen = set()
    for item in value:
        text = item.strip()
        if text == "":
            raise HTTPException(status_code=400, detail="A tag cannot be blank")
        folded = text.casefold()
        if folded in seen:
            continue
        seen.add(folded)
        cleaned.append(text)
    return cleaned


def bool_field(body: dict, key: str) -> bool:
    if key not in body or body[key] is None:
        return False
    value = body[key]
    if not isinstance(value, bool):
        raise HTTPException(status_code=400, detail=f"{key} must be true or false")
    return value


def quantity_field(body: dict) -> float:
    if "quantity" not in body or body["quantity"] is None:
        return 1.0
    value = body["quantity"]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail="quantity must be a number")
    number = float(value)
    if number < 0:
        raise HTTPException(status_code=400, detail="quantity cannot be negative")
    return number


def parse_item(body: dict, item_id: int | None) -> dict:
    unknown = set(body) - ITEM_FIELDS
    if unknown:
        name = sorted(unknown)[0]
        raise HTTPException(status_code=400, detail=f"{name} is not part of an inventory item")
    if item_id is None:
        if body.get("id") is not None:
            raise HTTPException(status_code=400, detail="id is assigned by the server")
    elif body.get("id") is not None and body.get("id") != item_id:
        raise HTTPException(status_code=400, detail="id must match the URL")
    name = text_field(body, "name", strip=True)
    if name == "":
        raise HTTPException(status_code=400, detail="name is required")
    purchase_date = text_field(body, "purchaseDate", strip=True)
    return {
        "id": item_id,
        "name": name,
        "description": text_field(body, "description"),
        "quantity": quantity_field(body),
        "manufacturer": text_field(body, "manufacturer", strip=True),
        "model_number": text_field(body, "modelNumber", strip=True),
        "purchase_from": text_field(body, "purchaseFrom", strip=True),
        "purchase_price": optional_real(body, "purchasePrice"),
        "purchase_date": purchase_date or None,
        "location_path": text_field(body, "locationPath", strip=True),
        "tags": tag_list(body),
        "archived": bool_field(body, "archived"),
        "notes": text_field(body, "notes"),
    }


def require_item_id(item_id: str) -> int:
    if not item_id.isdigit() or item_id.startswith("0"):
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return int(item_id)


def fetch_item(connection, item_id: int):
    return connection.execute(
        "SELECT * FROM inventory_item WHERE id = ?",
        (item_id,),
    ).fetchone()


def insert_item(connection, fields: dict) -> dict:
    cursor = connection.execute(
        """
        INSERT INTO inventory_item (
            name, description, quantity, manufacturer, model_number,
            purchase_from, purchase_price, purchase_date, location_path, tags,
            archived, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            fields["name"],
            fields["description"],
            fields["quantity"],
            fields["manufacturer"],
            fields["model_number"],
            fields["purchase_from"],
            fields["purchase_price"],
            fields["purchase_date"],
            fields["location_path"],
            encode_tags(fields["tags"]),
            1 if fields["archived"] else 0,
            fields["notes"],
        ),
    )
    row = fetch_item(connection, cursor.lastrowid)
    return item_json(row)


def update_item(connection, fields: dict) -> dict:
    item_id = fields["id"]
    existing = fetch_item(connection, item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    connection.execute(
        """
        UPDATE inventory_item
        SET name = ?,
            description = ?,
            quantity = ?,
            manufacturer = ?,
            model_number = ?,
            purchase_from = ?,
            purchase_price = ?,
            purchase_date = ?,
            location_path = ?,
            tags = ?,
            archived = ?,
            notes = ?
        WHERE id = ?
        """,
        (
            fields["name"],
            fields["description"],
            fields["quantity"],
            fields["manufacturer"],
            fields["model_number"],
            fields["purchase_from"],
            fields["purchase_price"],
            fields["purchase_date"],
            fields["location_path"],
            encode_tags(fields["tags"]),
            1 if fields["archived"] else 0,
            fields["notes"],
            item_id,
        ),
    )
    row = fetch_item(connection, item_id)
    return item_json(row)


def delete_item(connection, item_id: int) -> None:
    existing = fetch_item(connection, item_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    connection.execute("DELETE FROM inventory_item WHERE id = ?", (item_id,))


def list_items(connection, *, tag: str = "", archived: bool = False) -> list[dict]:
    rows = connection.execute(
        """
        SELECT *
        FROM inventory_item
        WHERE archived = ?
        ORDER BY name COLLATE NOCASE, id
        """,
        (1 if archived else 0,),
    ).fetchall()
    items = [item_json(row) for row in rows]
    if not tag:
        return items
    needle = tag.casefold()
    return [
        item
        for item in items
        if any(name.casefold() == needle for name in item["tags"])
    ]


@router.get("")
def get_inventory(tag: str = "", archived: str = "") -> list[dict]:
    show_archived = archived in ("1", "true", "yes")
    with closing(connect()) as connection:
        return list_items(connection, tag=tag.strip(), archived=show_archived)


@router.get("/{item_id}")
def get_inventory_item(item_id: str) -> dict:
    key = require_item_id(item_id)
    with closing(connect()) as connection:
        row = fetch_item(connection, key)
        if row is None:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        return item_json(row)


@router.post("")
async def post_inventory_item(request: Request) -> dict:
    body = await read_json_body(request)
    fields = parse_item(body, None)
    with closing(connect()) as connection:
        item = insert_item(connection, fields)
        connection.commit()
        return item


@router.put("/{item_id}")
async def put_inventory_item(item_id: str, request: Request) -> dict:
    key = require_item_id(item_id)
    body = await read_json_body(request)
    fields = parse_item(body, key)
    with closing(connect()) as connection:
        item = update_item(connection, fields)
        connection.commit()
        return item


@router.delete("/{item_id}")
def remove_inventory_item(item_id: str) -> Response:
    key = require_item_id(item_id)
    with closing(connect()) as connection:
        delete_item(connection, key)
        connection.commit()
    return Response(status_code=204)
