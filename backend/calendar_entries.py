"""Calendar entries: sowing, care, harvest, and diary.

The client uses /api/calendar/{id} for every kind. Care and harvest rows
are written with the calendar row. Photos stay on /api/photos/{id}.
An entry stores a bed id. The bed's name lives on the bed table.
"""

import json
import re
from contextlib import closing
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

ENTRY_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,80}")
PHOTO_URL = re.compile(r"/api/photos/([A-Za-z0-9][A-Za-z0-9_-]{0,80})")
KINDS = ("sowing", "care", "harvest", "diary")
STATUSES = ("planned", "done")
ACTIONS = ("watering", "fertilising", "pest_control")
SHARED_FIELDS = {
    "id",
    "kind",
    "date",
    "bedId",
    "crop",
    "status",
    "note",
    "photoUrl",
}
FIELDS = {
    "sowing": SHARED_FIELDS,
    "diary": SHARED_FIELDS,
    "care": SHARED_FIELDS | {"action", "product", "problem", "amount", "unit"},
    "harvest": SHARED_FIELDS | {"quantity", "unit", "weightGrams"},
}

SELECT_ENTRIES = """
SELECT
    calendar_entry.id,
    calendar_entry.kind,
    calendar_entry.date,
    calendar_entry.bed_id,
    calendar_entry.crop,
    calendar_entry.status,
    calendar_entry.note,
    calendar_entry.photo_url,
    harvest.quantity AS quantity,
    harvest.unit AS harvest_unit,
    harvest.weight_grams AS weight_grams,
    care.action AS action,
    care.product AS product,
    care.problem AS problem,
    care.amount AS amount,
    care.unit AS care_unit
FROM calendar_entry
LEFT JOIN harvest ON harvest.entry_id = calendar_entry.id
LEFT JOIN care ON care.entry_id = calendar_entry.id
"""

router = APIRouter()


def create_calendar_tables(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS calendar_entry (
            id        TEXT PRIMARY KEY,
            kind      TEXT NOT NULL CHECK (kind IN ('sowing', 'care', 'harvest', 'diary')),
            date      TEXT NOT NULL,
            bed_id    TEXT,
            crop      TEXT,
            status    TEXT NOT NULL CHECK (status IN ('planned', 'done')),
            note      TEXT NOT NULL DEFAULT '',
            photo_url TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS harvest (
            entry_id      TEXT PRIMARY KEY REFERENCES calendar_entry(id),
            quantity      REAL,
            unit          TEXT,
            weight_grams  INTEGER
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS care (
            entry_id  TEXT PRIMARY KEY REFERENCES calendar_entry(id),
            action    TEXT NOT NULL CHECK (action IN ('watering', 'fertilising', 'pest_control')),
            product   TEXT,
            problem   TEXT,
            amount    REAL,
            unit      TEXT
        )
        """
    )


def require_entry_id(entry_id: str) -> str:
    if not ENTRY_ID.fullmatch(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry id")
    return entry_id


def require_date(value, name: str) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{name} must be YYYY-MM-DD")
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{name} must be YYYY-MM-DD") from None
    if parsed.isoformat() != value:
        raise HTTPException(status_code=400, detail=f"{name} must be YYYY-MM-DD")
    return value


def optional_date(value: str | None, name: str) -> str | None:
    if value is None:
        return None
    return require_date(value, name)


def require_choice(value: str | None, choices: tuple, name: str) -> str | None:
    if value is None:
        return None
    if value not in choices:
        raise HTTPException(status_code=400, detail=f"Invalid {name}")
    return value


def text_field(body: dict, key: str) -> str:
    if key not in body or body[key] is None:
        return ""
    value = body[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be a string")
    return value


def number_field(body: dict, key: str, whole: bool = False):
    if key not in body or body[key] is None:
        return None
    value = body[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail=f"{key} must be a number")
    if whole and not float(value).is_integer():
        raise HTTPException(status_code=400, detail=f"{key} must be a whole number")
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def json_number(value):
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def photo_url_field(body: dict) -> str:
    if "photoUrl" not in body or body["photoUrl"] is None or body["photoUrl"] == "":
        return ""
    value = body["photoUrl"]
    if not isinstance(value, str) or PHOTO_URL.fullmatch(value) is None:
        raise HTTPException(status_code=400, detail="photoUrl must be a photo address")
    return value


def discard_photo(url: str | None) -> None:
    if not url:
        return
    match = PHOTO_URL.fullmatch(url)
    if match is None:
        return
    from app import find_photo

    found = find_photo(match.group(1))
    if found is not None:
        found.unlink()


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


def parse_entry(entry_id: str, body: dict) -> dict:
    if body.get("id") != entry_id:
        raise HTTPException(status_code=400, detail="id must match the URL")
    kind = body.get("kind")
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind")
    unknown = set(body) - FIELDS[kind]
    if unknown:
        name = sorted(unknown)[0]
        raise HTTPException(status_code=400, detail=f"{name} is not part of a {kind} entry")
    status = body.get("status")
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if kind == "diary" and status != "done":
        raise HTTPException(status_code=400, detail="A diary entry is done")

    entry = {
        "id": entry_id,
        "kind": kind,
        "date": require_date(body.get("date"), "date"),
        "bed_id": text_field(body, "bedId") or None,
        "crop": text_field(body, "crop") or None,
        "status": status,
        "note": text_field(body, "note"),
        "photo_url": photo_url_field(body) or None,
    }
    if kind == "care":
        action = body.get("action")
        if action not in ACTIONS:
            raise HTTPException(status_code=400, detail="Invalid action")
        entry["care"] = {
            "action": action,
            "product": text_field(body, "product"),
            "problem": text_field(body, "problem"),
            "amount": number_field(body, "amount"),
            "unit": text_field(body, "unit"),
        }
    if kind == "harvest":
        entry["harvest"] = {
            "quantity": number_field(body, "quantity"),
            "unit": text_field(body, "unit"),
            "weight_grams": number_field(body, "weightGrams", whole=True),
        }
    return entry


def entry_json(row) -> dict:
    body = {
        "id": row["id"],
        "kind": row["kind"],
        "date": row["date"],
        "bedId": row["bed_id"] or "",
        "crop": row["crop"] or "",
        "status": row["status"],
        "note": row["note"] or "",
        "photoUrl": row["photo_url"] or "",
    }
    if row["kind"] == "care":
        body["action"] = row["action"]
        body["product"] = row["product"] or ""
        body["problem"] = row["problem"] or ""
        body["amount"] = json_number(row["amount"])
        body["unit"] = row["care_unit"] or ""
    elif row["kind"] == "harvest":
        body["quantity"] = json_number(row["quantity"])
        body["unit"] = row["harvest_unit"] or ""
        body["weightGrams"] = json_number(row["weight_grams"])
    return body


def fetch_entry(connection, entry_id: str):
    return connection.execute(
        SELECT_ENTRIES + " WHERE calendar_entry.id = ?",
        (entry_id,),
    ).fetchone()


def connect():
    from app import connect as open_db

    return open_db()


def save_entry(entry_id: str, body: dict) -> dict:
    entry = parse_entry(entry_id, body)
    with closing(connect()) as connection:
        existing = connection.execute(
            "SELECT kind, photo_url FROM calendar_entry WHERE id = ?",
            (entry_id,),
        ).fetchone()
        if existing is not None and existing["kind"] != entry["kind"]:
            raise HTTPException(status_code=400, detail="kind cannot change")
        previous_photo = existing["photo_url"] if existing is not None else None
        try:
            connection.execute(
                """
                INSERT INTO calendar_entry (
                    id, kind, date, bed_id, crop, status, note, photo_url
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    date = excluded.date,
                    bed_id = excluded.bed_id,
                    crop = excluded.crop,
                    status = excluded.status,
                    note = excluded.note,
                    photo_url = excluded.photo_url
                """,
                (
                    entry["id"],
                    entry["kind"],
                    entry["date"],
                    entry["bed_id"],
                    entry["crop"],
                    entry["status"],
                    entry["note"],
                    entry["photo_url"],
                ),
            )
            if entry["kind"] == "care":
                care = entry["care"]
                connection.execute(
                    """
                    INSERT INTO care (entry_id, action, product, problem, amount, unit)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(entry_id) DO UPDATE SET
                        action = excluded.action,
                        product = excluded.product,
                        problem = excluded.problem,
                        amount = excluded.amount,
                        unit = excluded.unit
                    """,
                    (
                        entry_id,
                        care["action"],
                        care["product"],
                        care["problem"],
                        care["amount"],
                        care["unit"],
                    ),
                )
            if entry["kind"] == "harvest":
                harvest = entry["harvest"]
                connection.execute(
                    """
                    INSERT INTO harvest (entry_id, quantity, unit, weight_grams)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(entry_id) DO UPDATE SET
                        quantity = excluded.quantity,
                        unit = excluded.unit,
                        weight_grams = excluded.weight_grams
                    """,
                    (
                        entry_id,
                        harvest["quantity"],
                        harvest["unit"],
                        harvest["weight_grams"],
                    ),
                )
            connection.commit()
            saved = entry_json(fetch_entry(connection, entry_id))
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise
    if previous_photo and previous_photo != entry["photo_url"]:
        discard_photo(previous_photo)
    return saved


def remove_entry(entry_id: str) -> None:
    with closing(connect()) as connection:
        existing = connection.execute(
            "SELECT photo_url FROM calendar_entry WHERE id = ?",
            (entry_id,),
        ).fetchone()
        if existing is None:
            return
        photo = existing["photo_url"]
        try:
            connection.execute("DELETE FROM harvest WHERE entry_id = ?", (entry_id,))
            connection.execute("DELETE FROM care WHERE entry_id = ?", (entry_id,))
            connection.execute("DELETE FROM calendar_entry WHERE id = ?", (entry_id,))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    discard_photo(photo)


def list_entries(filters: dict) -> list:
    clauses = []
    params = []
    if filters["date_from"] is not None:
        clauses.append("calendar_entry.date >= ?")
        params.append(filters["date_from"])
    if filters["date_to"] is not None:
        clauses.append("calendar_entry.date <= ?")
        params.append(filters["date_to"])
    if filters["kind"] is not None:
        clauses.append("calendar_entry.kind = ?")
        params.append(filters["kind"])
    if filters["bed_id"] is not None:
        if filters["bed_id"] == "":
            clauses.append("(calendar_entry.bed_id IS NULL OR calendar_entry.bed_id = '')")
        else:
            clauses.append("calendar_entry.bed_id = ?")
            params.append(filters["bed_id"])
    if filters["crop"] is not None:
        if filters["crop"] == "":
            clauses.append("(calendar_entry.crop IS NULL OR calendar_entry.crop = '')")
        else:
            clauses.append("calendar_entry.crop = ?")
            params.append(filters["crop"])
    if filters["status"] is not None:
        clauses.append("calendar_entry.status = ?")
        params.append(filters["status"])
    if filters["action"] is not None:
        clauses.append("care.action = ?")
        params.append(filters["action"])
    sql = SELECT_ENTRIES
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY calendar_entry.date, calendar_entry.id"
    with closing(connect()) as connection:
        rows = connection.execute(sql, params).fetchall()
    return [entry_json(row) for row in rows]


def harvest_total(crop: str | None, bed_id: str | None, date_from: str | None, date_to: str | None):
    clauses = ["calendar_entry.kind = 'harvest'", "calendar_entry.status = 'done'"]
    params = []
    if crop is not None:
        clauses.append("calendar_entry.crop = ?")
        params.append(crop)
    if bed_id is not None:
        clauses.append("calendar_entry.bed_id = ?")
        params.append(bed_id)
    if date_from is not None:
        clauses.append("calendar_entry.date >= ?")
        params.append(date_from)
    if date_to is not None:
        clauses.append("calendar_entry.date <= ?")
        params.append(date_to)
    sql = f"""
        SELECT calendar_entry.crop AS crop, COALESCE(SUM(harvest.weight_grams), 0) AS total
        FROM calendar_entry
        JOIN harvest ON harvest.entry_id = calendar_entry.id
        WHERE {' AND '.join(clauses)}
    """
    with closing(connect()) as connection:
        if crop is not None:
            row = connection.execute(sql, params).fetchone()
            total = 0 if row is None or row["total"] is None else row["total"]
            return {"crop": crop, "weightGrams": json_number(total) or 0}
        rows = connection.execute(sql + " GROUP BY calendar_entry.crop ORDER BY calendar_entry.crop", params).fetchall()
    return [
        {"crop": row["crop"] or "", "weightGrams": json_number(row["total"]) or 0}
        for row in rows
        if row["crop"]
    ]


def care_total(action: str, unit: str, product: str | None, bed_id: str | None, date_from: str | None, date_to: str | None) -> dict:
    clauses = ["care.action = ?", "care.unit = ?"]
    params = [action, unit]
    if product is not None:
        clauses.append("care.product = ?")
        params.append(product)
    if bed_id is not None:
        clauses.append("calendar_entry.bed_id = ?")
        params.append(bed_id)
    if date_from is not None:
        clauses.append("calendar_entry.date >= ?")
        params.append(date_from)
    if date_to is not None:
        clauses.append("calendar_entry.date <= ?")
        params.append(date_to)
    sql = f"""
        SELECT COALESCE(SUM(care.amount), 0) AS total
        FROM calendar_entry
        JOIN care ON care.entry_id = calendar_entry.id
        WHERE {' AND '.join(clauses)}
    """
    with closing(connect()) as connection:
        row = connection.execute(sql, params).fetchone()
    total = 0 if row is None or row["total"] is None else row["total"]
    result = {"action": action, "unit": unit, "amount": json_number(total) or 0}
    if product is not None:
        result = {"action": action, "product": product, "unit": unit, "amount": result["amount"]}
    return result


@router.get("/calendar")
def get_calendar(
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
    kind: str | None = None,
    bed_id: str | None = Query(default=None, alias="bedId"),
    crop: str | None = None,
    status: str | None = None,
    action: str | None = None,
) -> list:
    filters = {
        "date_from": optional_date(date_from, "from"),
        "date_to": optional_date(date_to, "to"),
        "kind": require_choice(kind, KINDS, "kind"),
        "bed_id": bed_id,
        "crop": crop,
        "status": require_choice(status, STATUSES, "status"),
        "action": require_choice(action, ACTIONS, "action"),
    }
    return list_entries(filters)


@router.get("/calendar/totals/harvest")
def get_harvest_total(
    crop: str | None = None,
    bed_id: str | None = Query(default=None, alias="bedId"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
):
    return harvest_total(
        crop,
        bed_id,
        optional_date(date_from, "from"),
        optional_date(date_to, "to"),
    )


@router.get("/calendar/totals/care")
def get_care_total(
    action: str | None = None,
    unit: str | None = None,
    product: str | None = None,
    bed_id: str | None = Query(default=None, alias="bedId"),
    date_from: str | None = Query(default=None, alias="from"),
    date_to: str | None = Query(default=None, alias="to"),
) -> dict:
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail="Invalid action")
    if not unit:
        raise HTTPException(status_code=400, detail="unit is required")
    return care_total(
        action,
        unit,
        product,
        bed_id,
        optional_date(date_from, "from"),
        optional_date(date_to, "to"),
    )


@router.get("/calendar/{entry_id}")
def get_entry(entry_id: str) -> dict:
    require_entry_id(entry_id)
    with closing(connect()) as connection:
        row = fetch_entry(connection, entry_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry_json(row)


@router.put("/calendar/{entry_id}")
async def put_entry(entry_id: str, request: Request) -> dict:
    require_entry_id(entry_id)
    return save_entry(entry_id, parse_body(await request.body()))


@router.delete("/calendar/{entry_id}")
def delete_entry(entry_id: str) -> Response:
    require_entry_id(entry_id)
    remove_entry(entry_id)
    return Response(status_code=204)
