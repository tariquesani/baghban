"""Crop catalogue.

The planner file is the seed. init_db reads it once, when the crop table
is empty, and copies every plant. Later saves stay as the gardener left them.
Ids are integers assigned on insert. A text id is rewritten at startup.
"""

import json
from contextlib import closing
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response

from catalogue import CATEGORIES, SUNS, WATERS
FIELDS = {
    "id",
    "name",
    "category",
    "emoji",
    "icon",
    "sqft",
    "spacing",
    "depthIn",
    "sowingDepthMm",
    "daysToMaturity",
    "sun",
    "water",
    "trellis",
    "notes",
    "archived",
    "aliases",
    "companions",
    "avoid",
}
router = APIRouter()
MAX_ICON_BYTES = 1024 * 1024
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def catalog_file() -> Path:
    return (
        Path(__file__).resolve().parent.parent
        / "frontend"
        / "src"
        / "lib"
        / "planner"
        / "js"
        / "catalog.js"
    )


def read_catalog() -> list:
    text = catalog_file().read_text(encoding="utf-8")
    start = text.index("[")
    end = text.rindex("]") + 1
    plants = json.loads(text[start:end])
    if not isinstance(plants, list) or not plants:
        raise RuntimeError("Plant catalogue is empty")
    return plants


def display_name(plant: dict) -> str:
    name = plant["name"]
    emoji = plant.get("emoji") or ""
    prefix = f"{emoji} "
    if emoji and isinstance(name, str) and name.startswith(prefix):
        return name[len(prefix):]
    if not isinstance(name, str):
        raise RuntimeError("Catalogue plant is missing a name")
    return name


def create_crop_tables(connection) -> None:
    connection.execute(crop_table_sql(if_not_exists=True))
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS crop_alias (
            crop_id  INTEGER NOT NULL REFERENCES crop(id),
            alias    TEXT NOT NULL,
            PRIMARY KEY (crop_id, alias)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS crop_link (
            crop_id   INTEGER NOT NULL REFERENCES crop(id),
            other_id  INTEGER NOT NULL REFERENCES crop(id),
            relation  TEXT NOT NULL CHECK (relation IN ('companion', 'avoid')),
            PRIMARY KEY (crop_id, other_id, relation),
            CHECK (crop_id != other_id)
        )
        """
    )


def crop_table_sql(name: str = "crop", if_not_exists: bool = False) -> str:
    clause = "IF NOT EXISTS " if if_not_exists else ""
    return f"""
        CREATE TABLE {clause}{name} (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            name              TEXT NOT NULL,
            category          TEXT NOT NULL,
            emoji             TEXT NOT NULL DEFAULT '',
            icon              TEXT NOT NULL DEFAULT '',
            sqft              REAL,
            spacing           REAL,
            depth_in          REAL,
            sowing_depth_mm   REAL,
            days_to_maturity  INTEGER,
            sun               TEXT NOT NULL DEFAULT '',
            water             TEXT NOT NULL DEFAULT '',
            trellis           INTEGER NOT NULL DEFAULT 0 CHECK (trellis IN (0, 1)),
            notes             TEXT NOT NULL DEFAULT '',
            archived          INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
        )
    """


def add_crop_icon(connection) -> None:
    """Add an empty icon name. No crop is given a file."""
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'crop'"
    ).fetchone()
    if row is None:
        return
    columns = {info[1] for info in connection.execute("PRAGMA table_info(crop)")}
    if "icon" in columns:
        return
    connection.execute("ALTER TABLE crop ADD COLUMN icon TEXT NOT NULL DEFAULT ''")


def drop_crop_label_checks(connection) -> None:
    """Store any category, sun, and water. The API checks the catalogue."""
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'crop'"
    ).fetchone()
    if row is None:
        return
    stored = row[0] or ""
    if not any(marker in stored for marker in ("CHECK (category", "CHECK (sun", "CHECK (water")):
        return
    connection.execute("DROP TABLE IF EXISTS crop_next")
    connection.execute(crop_table_sql("crop_next"))
    connection.execute(
        """
        INSERT INTO crop_next (
            id, name, category, emoji, sqft, spacing, depth_in, sowing_depth_mm,
            days_to_maturity, sun, water, trellis, notes, archived
        )
        SELECT
            id, name, category, emoji, sqft, spacing, depth_in, sowing_depth_mm,
            days_to_maturity, sun, water, trellis, notes, archived
        FROM crop
        """
    )
    connection.execute("DROP TABLE crop")
    connection.execute("ALTER TABLE crop_next RENAME TO crop")
    sequence = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
    ).fetchone()
    max_id = connection.execute("SELECT MAX(id) FROM crop").fetchone()[0]
    if sequence is None or max_id is None:
        return
    connection.execute("DELETE FROM sqlite_sequence WHERE name = 'crop_next'")
    found = connection.execute(
        "SELECT 1 FROM sqlite_sequence WHERE name = 'crop'"
    ).fetchone()
    if found is None:
        connection.execute(
            "INSERT INTO sqlite_sequence (name, seq) VALUES ('crop', ?)",
            (max_id,),
        )
        return
    connection.execute(
        "UPDATE sqlite_sequence SET seq = ? WHERE name = 'crop'",
        (max_id,),
    )


def seed_crops(connection) -> None:
    """Copy the planner catalogue when no crops have been stored yet."""
    count = connection.execute("SELECT COUNT(*) FROM crop").fetchone()[0]
    if count:
        return
    plants = read_catalog()
    prepared = []
    ids = {}
    for plant in plants:
        name = display_name(plant)
        if plant["name"] in ids:
            raise RuntimeError(f"Could not seed a crop id for {name}")
        cursor = connection.execute(
            """
            INSERT INTO crop (
                name, category, emoji, sqft, spacing, depth_in,
                sun, water, trellis, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                plant["category"],
                plant.get("emoji") or "",
                plant.get("sqft"),
                plant.get("spacing"),
                plant.get("depthIn"),
                plant.get("sun") or "",
                plant.get("water") or "",
                1 if plant.get("trellis") else 0,
                plant.get("notes") or "",
            ),
        )
        ids[plant["name"]] = cursor.lastrowid
        prepared.append((name, plant))
    for name, plant in prepared:
        crop_id = ids[plant["name"]]
        for relation, key in (("companion", "companions"), ("avoid", "avoid")):
            for other_name in plant.get(key) or []:
                other_id = ids.get(other_name)
                if other_id is None:
                    raise RuntimeError(f"{name} lists unknown {relation} {other_name}")
                connection.execute(
                    """
                    INSERT INTO crop_link (crop_id, other_id, relation)
                    VALUES (?, ?, ?)
                    """,
                    (crop_id, other_id, relation),
                )


def connect():
    from app import connect as open_db

    return open_db()


def require_crop_id(crop_id: str) -> int:
    if not crop_id.isdigit() or crop_id.startswith("0"):
        raise HTTPException(status_code=404, detail="Crop not found")
    return int(crop_id)


def parse_body(raw: bytes) -> dict:
    if not raw:
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Body must be JSON") from None
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    return body


def json_number(value):
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def text_field(body: dict, key: str) -> str:
    if key not in body or body[key] is None:
        return ""
    value = body[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be a string")
    return value.strip()


def number_field(body: dict, key: str, whole: bool = False):
    if key not in body or body[key] is None:
        return None
    value = body[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail=f"{key} must be a number")
    if value < 0:
        raise HTTPException(status_code=400, detail=f"{key} must be zero or more")
    if whole and not float(value).is_integer():
        raise HTTPException(status_code=400, detail=f"{key} must be a whole number")
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def bool_field(body: dict, key: str) -> bool:
    if key not in body or body[key] is None:
        return False
    value = body[key]
    if not isinstance(value, bool):
        raise HTTPException(status_code=400, detail=f"{key} must be true or false")
    return value


def string_list(body: dict, key: str, noun: str) -> list[str]:
    if key not in body or body[key] is None:
        return []
    value = body[key]
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise HTTPException(status_code=400, detail=f"{key} must be a list of strings")
    cleaned = []
    seen = set()
    for item in value:
        text = item.strip()
        if text == "":
            raise HTTPException(status_code=400, detail=f"A {noun} cannot be blank")
        folded = text.casefold()
        if folded in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate {noun}")
        seen.add(folded)
        cleaned.append(text)
    return cleaned


def id_list(body: dict, key: str, noun: str) -> list[int]:
    if key not in body or body[key] is None:
        return []
    value = body[key]
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail=f"{key} must be a list of crop ids")
    cleaned = []
    seen = set()
    for item in value:
        if isinstance(item, bool) or not isinstance(item, int) or item < 1:
            raise HTTPException(status_code=400, detail="Invalid crop id")
        if item in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate {noun}")
        seen.add(item)
        cleaned.append(item)
    return cleaned


def choice_field(body: dict, key: str, choices: tuple, label: str) -> str:
    value = text_field(body, key)
    if value not in choices:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")
    return value


def parse_crop(body: dict, crop_id: int | None) -> dict:
    body = {key: value for key, value in body.items() if key != "iconRev"}
    unknown = set(body) - FIELDS
    if unknown:
        name = sorted(unknown)[0]
        raise HTTPException(status_code=400, detail=f"{name} is not part of a crop")
    if crop_id is None:
        if body.get("id") is not None:
            raise HTTPException(status_code=400, detail="id is assigned by the server")
    elif body.get("id") != crop_id:
        raise HTTPException(status_code=400, detail="id must match the URL")
    name = text_field(body, "name")
    if name == "":
        raise HTTPException(status_code=400, detail="name is required")
    if "category" not in body or body.get("category") in (None, ""):
        raise HTTPException(status_code=400, detail="category is required")
    category = text_field(body, "category")
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    days = number_field(body, "daysToMaturity", whole=True)
    crop = {
        "id": crop_id,
        "name": name,
        "category": category,
        "emoji": text_field(body, "emoji"),
        "sqft": number_field(body, "sqft"),
        "spacing": number_field(body, "spacing"),
        "depth_in": number_field(body, "depthIn"),
        "sowing_depth_mm": number_field(body, "sowingDepthMm"),
        "days_to_maturity": days,
        "sun": choice_field(body, "sun", SUNS, "sun"),
        "water": choice_field(body, "water", WATERS, "water"),
        "trellis": bool_field(body, "trellis"),
        "notes": text_field(body, "notes"),
        "archived": bool_field(body, "archived"),
        "aliases": string_list(body, "aliases", "alias"),
        "companions": id_list(body, "companions", "companion"),
        "avoid": id_list(body, "avoid", "plant to avoid"),
    }
    folded_name = name.casefold()
    for alias in crop["aliases"]:
        if alias.casefold() == folded_name:
            raise HTTPException(status_code=400, detail="An alias cannot match the crop name")
    if crop_id is not None and (crop_id in crop["companions"] or crop_id in crop["avoid"]):
        raise HTTPException(status_code=400, detail="A crop cannot link to itself")
    if set(crop["companions"]) & set(crop["avoid"]):
        raise HTTPException(
            status_code=400,
            detail="A crop cannot be both a companion and a plant to avoid",
        )
    return crop


def crop_json(row, aliases, companions, avoid) -> dict:
    crop_id = int(row["id"])
    icon = row["icon"] or ""
    return {
        "id": crop_id,
        "name": row["name"],
        "category": row["category"],
        "emoji": row["emoji"] or "",
        "icon": icon,
        "iconRev": icon_revision(crop_id) if icon else None,
        "sqft": json_number(row["sqft"]),
        "spacing": json_number(row["spacing"]),
        "depthIn": json_number(row["depth_in"]),
        "sowingDepthMm": json_number(row["sowing_depth_mm"]),
        "daysToMaturity": json_number(row["days_to_maturity"]),
        "sun": row["sun"] or "",
        "water": row["water"] or "",
        "trellis": bool(row["trellis"]),
        "notes": row["notes"] or "",
        "archived": bool(row["archived"]),
        "aliases": aliases,
        "companions": companions,
        "avoid": avoid,
    }


def children_for(connection, crop_ids: list[int]) -> tuple[dict, dict, dict]:
    if not crop_ids:
        return {}, {}, {}
    marks = ",".join("?" for _ in crop_ids)
    alias_rows = connection.execute(
        f"SELECT crop_id, alias FROM crop_alias WHERE crop_id IN ({marks}) ORDER BY alias",
        crop_ids,
    ).fetchall()
    link_rows = connection.execute(
        f"""
        SELECT crop_id, other_id, relation
        FROM crop_link
        WHERE crop_id IN ({marks})
        ORDER BY other_id
        """,
        crop_ids,
    ).fetchall()
    aliases = {crop_id: [] for crop_id in crop_ids}
    companions = {crop_id: [] for crop_id in crop_ids}
    avoid = {crop_id: [] for crop_id in crop_ids}
    for row in alias_rows:
        aliases[row["crop_id"]].append(row["alias"])
    for row in link_rows:
        target = companions if row["relation"] == "companion" else avoid
        target[row["crop_id"]].append(int(row["other_id"]))
    for crop_id in crop_ids:
        aliases[crop_id].sort(key=str.casefold)
        companions[crop_id].sort()
        avoid[crop_id].sort()
    return aliases, companions, avoid


def rows_json(connection, rows) -> list[dict]:
    crop_ids = [row["id"] for row in rows]
    aliases, companions, avoid = children_for(connection, crop_ids)
    return [
        crop_json(row, aliases[row["id"]], companions[row["id"]], avoid[row["id"]])
        for row in rows
    ]


def fetch_crop(connection, crop_id: int):
    return connection.execute("SELECT * FROM crop WHERE id = ?", (crop_id,)).fetchone()


def like_pattern(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def list_crops(query: str | None, category: str | None, archived: int) -> list[dict]:
    clauses = ["archived = ?"]
    params: list = [archived]
    if category:
        clauses.append("category = ?")
        params.append(category)
    if query:
        pattern = like_pattern(query)
        clauses.append(
            """
            (
                lower(name) LIKE lower(?) ESCAPE '\\'
                OR EXISTS (
                    SELECT 1 FROM crop_alias
                    WHERE crop_alias.crop_id = crop.id
                    AND lower(crop_alias.alias) LIKE lower(?) ESCAPE '\\'
                )
            )
            """
        )
        params.extend((pattern, pattern))
    sql = f"""
        SELECT * FROM crop
        WHERE {' AND '.join(clauses)}
        ORDER BY lower(name), id
    """
    with closing(connect()) as connection:
        rows = connection.execute(sql, params).fetchall()
        return rows_json(connection, rows)


def read_crop(crop_id: int) -> dict:
    with closing(connect()) as connection:
        row = fetch_crop(connection, crop_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Crop not found")
        return rows_json(connection, [row])[0]


def labels_used_by_others(connection, crop_id: int | None) -> set[str]:
    if crop_id is None:
        rows = connection.execute("SELECT name FROM crop").fetchall()
        alias_rows = connection.execute("SELECT alias FROM crop_alias").fetchall()
    else:
        rows = connection.execute(
            "SELECT name FROM crop WHERE id != ?",
            (crop_id,),
        ).fetchall()
        alias_rows = connection.execute(
            "SELECT alias FROM crop_alias WHERE crop_id != ?",
            (crop_id,),
        ).fetchall()
    used = {row["name"].casefold() for row in rows}
    used.update(row["alias"].casefold() for row in alias_rows)
    return used


def ensure_available(connection, crop: dict) -> None:
    used = labels_used_by_others(connection, crop["id"])
    if crop["name"].casefold() in used:
        raise HTTPException(status_code=400, detail="Name is already used")
    for alias in crop["aliases"]:
        if alias.casefold() in used:
            raise HTTPException(status_code=400, detail="Alias is already used")
    wanted = set(crop["companions"]) | set(crop["avoid"])
    if not wanted:
        return
    marks = ",".join("?" for _ in wanted)
    found = connection.execute(
        f"SELECT id FROM crop WHERE id IN ({marks})",
        list(wanted),
    ).fetchall()
    found_ids = {row["id"] for row in found}
    missing = sorted(wanted - found_ids)
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown crop {missing[0]}")


def crop_values(crop: dict) -> tuple:
    return (
        crop["name"],
        crop["category"],
        crop["emoji"],
        crop["sqft"],
        crop["spacing"],
        crop["depth_in"],
        crop["sowing_depth_mm"],
        crop["days_to_maturity"],
        crop["sun"],
        crop["water"],
        1 if crop["trellis"] else 0,
        crop["notes"],
        1 if crop["archived"] else 0,
    )


def insert_crop_row(connection, crop: dict) -> int:
    cursor = connection.execute(
        """
        INSERT INTO crop (
            name, category, emoji, sqft, spacing, depth_in, sowing_depth_mm,
            days_to_maturity, sun, water, trellis, notes, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        crop_values(crop),
    )
    return cursor.lastrowid


def replace_children(connection, crop_id: int, crop: dict) -> None:
    connection.execute("DELETE FROM crop_alias WHERE crop_id = ?", (crop_id,))
    connection.execute("DELETE FROM crop_link WHERE crop_id = ?", (crop_id,))
    for alias in crop["aliases"]:
        connection.execute(
            "INSERT INTO crop_alias (crop_id, alias) VALUES (?, ?)",
            (crop_id, alias),
        )
    for other_id in crop["companions"]:
        connection.execute(
            """
            INSERT INTO crop_link (crop_id, other_id, relation)
            VALUES (?, ?, 'companion')
            """,
            (crop_id, other_id),
        )
    for other_id in crop["avoid"]:
        connection.execute(
            """
            INSERT INTO crop_link (crop_id, other_id, relation)
            VALUES (?, ?, 'avoid')
            """,
            (crop_id, other_id),
        )


def insert_crop(connection, crop: dict) -> int:
    crop_id = insert_crop_row(connection, crop)
    replace_children(connection, crop_id, crop)
    return crop_id


def update_crop(connection, crop: dict) -> None:
    connection.execute(
        """
        UPDATE crop SET
            name = ?,
            category = ?,
            emoji = ?,
            sqft = ?,
            spacing = ?,
            depth_in = ?,
            sowing_depth_mm = ?,
            days_to_maturity = ?,
            sun = ?,
            water = ?,
            trellis = ?,
            notes = ?,
            archived = ?
        WHERE id = ?
        """,
        (*crop_values(crop), crop["id"]),
    )
    replace_children(connection, crop["id"], crop)


def create_crop(body: dict) -> dict:
    crop = parse_crop(body, None)
    with closing(connect()) as connection:
        try:
            ensure_available(connection, crop)
            crop_id = insert_crop(connection, crop)
            connection.commit()
            row = fetch_crop(connection, crop_id)
            return rows_json(connection, [row])[0]
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise


def save_crop(crop_id: int, body: dict) -> dict:
    crop = parse_crop(body, crop_id)
    with closing(connect()) as connection:
        try:
            if fetch_crop(connection, crop_id) is None:
                raise HTTPException(status_code=404, detail="Crop not found")
            ensure_available(connection, crop)
            update_crop(connection, crop)
            connection.commit()
            row = fetch_crop(connection, crop_id)
            return rows_json(connection, [row])[0]
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise


def icons_root() -> Path:
    from app import database_path

    return database_path().parent / "icons"


def icons_dir() -> Path:
    path = icons_root()
    path.mkdir(parents=True, exist_ok=True)
    return path


def icon_filename(crop_id: int) -> str:
    return f"{crop_id}.png"


ICON_CACHE_CONTROL = "public, max-age=31536000, immutable"


def icon_revision(crop_id: int) -> int | None:
    """File mtime so clients can bust an immutable icon URL after replace."""
    path = icons_root() / icon_filename(crop_id)
    if not path.is_file():
        return None
    return int(path.stat().st_mtime_ns)


def store_crop_icon(crop_id: int, data: bytes) -> dict:
    """Save a PNG beside the database and remember its file name."""
    if not data.startswith(PNG_MAGIC):
        raise HTTPException(status_code=400, detail="Icon must be a PNG")
    with closing(connect()) as connection:
        if fetch_crop(connection, crop_id) is None:
            raise HTTPException(status_code=404, detail="Crop not found")
    destination = icons_dir() / icon_filename(crop_id)
    temporary = destination.with_name(destination.name + ".tmp")
    temporary.write_bytes(data)
    temporary.replace(destination)
    with closing(connect()) as connection:
        try:
            connection.execute(
                "UPDATE crop SET icon = ? WHERE id = ?",
                (icon_filename(crop_id), crop_id),
            )
            connection.commit()
            row = fetch_crop(connection, crop_id)
            if row is None:
                raise HTTPException(status_code=404, detail="Crop not found")
            return rows_json(connection, [row])[0]
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise


def remove_crop_icon(crop_id: int) -> None:
    with closing(connect()) as connection:
        if fetch_crop(connection, crop_id) is None:
            raise HTTPException(status_code=404, detail="Crop not found")
        connection.execute("UPDATE crop SET icon = '' WHERE id = ?", (crop_id,))
        connection.commit()
    path = icons_root() / icon_filename(crop_id)
    if path.is_file():
        path.unlink()


def read_crop_icon(crop_id: int) -> FileResponse:
    with closing(connect()) as connection:
        row = fetch_crop(connection, crop_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Crop not found")
    if (row["icon"] or "") != icon_filename(crop_id):
        raise HTTPException(status_code=404, detail="Icon not found")
    path = icons_root() / icon_filename(crop_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Icon not found")
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Cache-Control": ICON_CACHE_CONTROL},
    )


def archive_crop(crop_id: int) -> None:
    with closing(connect()) as connection:
        row = fetch_crop(connection, crop_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Crop not found")
        connection.execute("UPDATE crop SET archived = 1 WHERE id = ?", (crop_id,))
        connection.commit()


def archived_filter(value: str | None) -> int:
    if value is None or value == "" or value == "0":
        return 0
    if value == "1":
        return 1
    raise HTTPException(status_code=400, detail="Invalid archived")


def category_filter(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if value not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    return value


@router.get("/crops")
def get_crops(
    q: str | None = None,
    category: str | None = None,
    archived: str | None = None,
) -> list:
    query = q.strip() if isinstance(q, str) else None
    if query == "":
        query = None
    return list_crops(query, category_filter(category), archived_filter(archived))


@router.post("/crops")
async def post_crop(request: Request) -> dict:
    return create_crop(parse_body(await request.body()))


@router.get("/crops/{crop_id}")
def get_crop(crop_id: str) -> dict:
    return read_crop(require_crop_id(crop_id))


@router.put("/crops/{crop_id}")
async def put_crop(crop_id: str, request: Request) -> dict:
    return save_crop(require_crop_id(crop_id), parse_body(await request.body()))


@router.delete("/crops/{crop_id}")
def delete_crop(crop_id: str) -> Response:
    archive_crop(require_crop_id(crop_id))
    return Response(status_code=204)


@router.put("/crops/{crop_id}/icon")
async def put_crop_icon(crop_id: str, request: Request) -> dict:
    from app import reject_oversized

    raw = await request.body()
    reject_oversized(request, raw, MAX_ICON_BYTES, "Icon is larger than 1 MB")
    if not raw:
        raise HTTPException(status_code=400, detail="Icon is empty")
    return store_crop_icon(require_crop_id(crop_id), raw)


@router.delete("/crops/{crop_id}/icon")
def delete_crop_icon(crop_id: str) -> Response:
    remove_crop_icon(require_crop_id(crop_id))
    return Response(status_code=204)


@router.get("/crops/{crop_id}/icon")
def get_crop_icon(crop_id: str) -> FileResponse:
    return read_crop_icon(require_crop_id(crop_id))
