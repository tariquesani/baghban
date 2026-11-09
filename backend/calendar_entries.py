"""Calendar entries: sowing, care, pest, harvest, diary, and uproot.

POST /api/calendar inserts a row and returns its integer id.
PUT /api/calendar/{id} replaces that entry. Care, pest, and harvest rows are
written with the calendar row, and replaced when a new body drops them.
Photos stay on /api/photos/{id}. An entry stores a bed id, or none for the
whole garden. The bed's name lives on the bed table. A crop is stored by id;
reads join crop.name so renames stay on the calendar. A done uproot finishes
the matching beds_crops assignment on the entry date.
"""

import json
import re
from contextlib import closing
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from catalogue import CARE_ACTIONS

PHOTO_URL = re.compile(r"/api/photos/([A-Za-z0-9][A-Za-z0-9_-]{0,80})")
KINDS = ("sowing", "care", "pest", "harvest", "uproot", "diary")
STATUSES = ("planned", "done")


def care_table_sql(name: str = "care", if_not_exists: bool = False) -> str:
    clause = "IF NOT EXISTS " if if_not_exists else ""
    return f"""
        CREATE TABLE {clause}{name} (
            entry_id  INTEGER PRIMARY KEY REFERENCES calendar_entry(id),
            action    TEXT NOT NULL,
            product   TEXT,
            amount    REAL,
            unit      TEXT
        )
    """
SHARED_FIELDS = {
    "id",
    "kind",
    "date",
    "bedId",
    "cropId",
    "status",
    "note",
    "photoUrl",
}
FIELDS = {
    "sowing": SHARED_FIELDS,
    "diary": SHARED_FIELDS,
    "uproot": SHARED_FIELDS,
    "care": SHARED_FIELDS | {"action", "product", "amount", "unit"},
    "pest": SHARED_FIELDS | {"problem", "product", "amount", "unit"},
    "harvest": SHARED_FIELDS | {"quantity", "unit", "weightGrams"},
}

SELECT_ENTRIES = """
SELECT
    calendar_entry.id,
    calendar_entry.kind,
    calendar_entry.date,
    calendar_entry.bed_id,
    calendar_entry.crop_id,
    crop.name AS crop,
    calendar_entry.status,
    calendar_entry.note,
    calendar_entry.photo_url,
    calendar_entry.rule_id,
    care_rule.active AS rule_active,
    harvest.quantity AS quantity,
    harvest.unit AS harvest_unit,
    harvest.weight_grams AS weight_grams,
    care.action AS action,
    care.product AS care_product,
    care.amount AS care_amount,
    care.unit AS care_unit,
    pest.problem AS problem,
    pest.product AS pest_product,
    pest.amount AS pest_amount,
    pest.unit AS pest_unit
FROM calendar_entry
LEFT JOIN crop ON crop.id = calendar_entry.crop_id
LEFT JOIN care_rule ON care_rule.id = calendar_entry.rule_id
LEFT JOIN harvest ON harvest.entry_id = calendar_entry.id
LEFT JOIN care ON care.entry_id = calendar_entry.id
LEFT JOIN pest ON pest.entry_id = calendar_entry.id
"""

router = APIRouter()


def entry_table_sql(
    name: str = "calendar_entry",
    if_not_exists: bool = False,
    with_rule_id: bool = True,
) -> str:
    clause = "IF NOT EXISTS " if if_not_exists else ""
    rule_column = (
        ",\n            rule_id   INTEGER REFERENCES care_rule(id)" if with_rule_id else ""
    )
    return f"""
        CREATE TABLE {clause}{name} (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            kind      TEXT NOT NULL CHECK (kind IN ('sowing', 'care', 'pest', 'harvest', 'diary', 'uproot')),
            date      TEXT NOT NULL,
            bed_id    INTEGER REFERENCES bed(id),
            crop_id   INTEGER REFERENCES crop(id),
            status    TEXT NOT NULL CHECK (status IN ('planned', 'done')),
            note      TEXT NOT NULL DEFAULT '',
            photo_url TEXT{rule_column}
        )
    """


def allow_uproot_kind(connection) -> None:
    """Let calendar_entry.kind store uproot. Older files stopped at diary."""
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'calendar_entry'"
    ).fetchone()
    if row is None:
        return
    sql = row[0] or ""
    if "'uproot'" in sql:
        return
    columns = {info[1] for info in connection.execute("PRAGMA table_info(calendar_entry)")}
    has_rule = "rule_id" in columns
    connection.execute("DROP TABLE IF EXISTS calendar_entry_next")
    connection.execute(entry_table_sql("calendar_entry_next", with_rule_id=has_rule))
    if has_rule:
        connection.execute(
            """
            INSERT INTO calendar_entry_next (
                id, kind, date, bed_id, crop_id, status, note, photo_url, rule_id
            )
            SELECT
                id, kind, date, bed_id, crop_id, status, note, photo_url, rule_id
            FROM calendar_entry
            """
        )
    else:
        connection.execute(
            """
            INSERT INTO calendar_entry_next (
                id, kind, date, bed_id, crop_id, status, note, photo_url
            )
            SELECT
                id, kind, date, bed_id, crop_id, status, note, photo_url
            FROM calendar_entry
            """
        )
    connection.execute("DROP TABLE calendar_entry")
    connection.execute("ALTER TABLE calendar_entry_next RENAME TO calendar_entry")
    sequence = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
    ).fetchone()
    max_id = connection.execute("SELECT MAX(id) FROM calendar_entry").fetchone()[0]
    if sequence is not None and max_id is not None:
        connection.execute("DELETE FROM sqlite_sequence WHERE name = 'calendar_entry_next'")
        found = connection.execute(
            "SELECT 1 FROM sqlite_sequence WHERE name = 'calendar_entry'"
        ).fetchone()
        if found is None:
            connection.execute(
                "INSERT INTO sqlite_sequence (name, seq) VALUES ('calendar_entry', ?)",
                (max_id,),
            )
        else:
            connection.execute(
                "UPDATE sqlite_sequence SET seq = ? WHERE name = 'calendar_entry'",
                (max_id,),
            )


def create_calendar_tables(connection) -> None:
    from care_rules import create_care_rule_table

    create_care_rule_table(connection)
    connection.execute(entry_table_sql(if_not_exists=True))
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS harvest (
            entry_id      INTEGER PRIMARY KEY REFERENCES calendar_entry(id),
            quantity      REAL,
            unit          TEXT,
            weight_grams  INTEGER
        )
        """
    )
    connection.execute(care_table_sql(if_not_exists=True))
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS pest (
            entry_id  INTEGER PRIMARY KEY REFERENCES calendar_entry(id),
            problem   TEXT,
            product   TEXT,
            amount    REAL,
            unit      TEXT
        )
        """
    )


def drop_care_action_check(connection) -> None:
    """Store any care action. The API, not SQLite, decides which values are current."""
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'care'"
    ).fetchone()
    if row is None or "CHECK" not in (row[0] or "").upper():
        return
    connection.execute("DROP TABLE IF EXISTS care_next")
    connection.execute(care_table_sql("care_next"))
    connection.execute(
        """
        INSERT INTO care_next (entry_id, action, product, amount, unit)
        SELECT entry_id, action, product, amount, unit FROM care
        """
    )
    connection.execute("DROP TABLE care")
    connection.execute("ALTER TABLE care_next RENAME TO care")


def _crop_label_ids(connection) -> dict[str, int]:
    """Map catalogue name, emoji label, and alias (casefolded) to crop id."""
    from beds_crops import canvas_name

    labels: dict[str, int] = {}
    crops = connection.execute("SELECT id, name, emoji FROM crop").fetchall()
    for crop in crops:
        crop_id = int(crop["id"])
        labels[crop["name"].casefold()] = crop_id
        labeled = canvas_name(crop["name"], crop["emoji"] or "").casefold()
        labels[labeled] = crop_id
    aliases = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'crop_alias'"
    ).fetchone()
    if aliases is None:
        return labels
    for row in connection.execute("SELECT crop_id, alias FROM crop_alias"):
        labels[row["alias"].casefold()] = int(row["crop_id"])
    return labels


def calendar_crop_id(connection) -> None:
    """Replace calendar_entry.crop text with crop_id. Empty text becomes NULL."""
    import sqlite3

    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'calendar_entry'"
    ).fetchone()
    if row is None:
        return
    columns = {info[1] for info in connection.execute("PRAGMA table_info(calendar_entry)")}
    if "crop_id" in columns and "crop" not in columns:
        return
    if "crop" not in columns:
        return
    crop_table = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'crop'"
    ).fetchone()
    if crop_table is None:
        raise RuntimeError("Calendar crop_id migration needs the crop table")

    connection.row_factory = sqlite3.Row
    labels = _crop_label_ids(connection)
    unmatched: set[str] = set()
    rows = connection.execute(
        """
        SELECT id, kind, date, bed_id, crop, status, note, photo_url
        FROM calendar_entry
        """
    ).fetchall()
    prepared = []
    for entry in rows:
        raw = entry["crop"]
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            crop_id = None
        else:
            text = raw.strip() if isinstance(raw, str) else str(raw)
            crop_id = labels.get(text.casefold())
            if crop_id is None:
                unmatched.add(text)
        prepared.append(
            (
                entry["id"],
                entry["kind"],
                entry["date"],
                entry["bed_id"],
                crop_id,
                entry["status"],
                entry["note"] or "",
                entry["photo_url"],
            )
        )
    if unmatched:
        names = ", ".join(sorted(unmatched))
        raise RuntimeError(f"Calendar crop names not in the catalogue: {names}")

    connection.execute("DROP TABLE IF EXISTS calendar_entry_next")
    connection.execute(entry_table_sql("calendar_entry_next", with_rule_id=False))
    connection.executemany(
        """
        INSERT INTO calendar_entry_next (
            id, kind, date, bed_id, crop_id, status, note, photo_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        prepared,
    )
    connection.execute("DROP TABLE calendar_entry")
    connection.execute("ALTER TABLE calendar_entry_next RENAME TO calendar_entry")
    sequence = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
    ).fetchone()
    max_id = connection.execute("SELECT MAX(id) FROM calendar_entry").fetchone()[0]
    if sequence is not None and max_id is not None:
        connection.execute("DELETE FROM sqlite_sequence WHERE name = 'calendar_entry_next'")
        found = connection.execute(
            "SELECT 1 FROM sqlite_sequence WHERE name = 'calendar_entry'"
        ).fetchone()
        if found is None:
            connection.execute(
                "INSERT INTO sqlite_sequence (name, seq) VALUES ('calendar_entry', ?)",
                (max_id,),
            )
        else:
            connection.execute(
                "UPDATE sqlite_sequence SET seq = ? WHERE name = 'calendar_entry'",
                (max_id,),
            )
    broken = connection.execute("PRAGMA foreign_key_check").fetchone()
    if broken is not None:
        raise RuntimeError("Calendar crop_id migration broke a foreign key")


def require_entry_id(entry_id: str) -> int:
    if not entry_id.isdigit() or entry_id.startswith("0"):
        raise HTTPException(status_code=404, detail="Entry not found")
    return int(entry_id)


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


def query_bed_id(value: str | None):
    """None skips the filter. '' means entries with no bed. Otherwise an int."""
    if value is None:
        return None
    if value == "":
        return ""
    if not value.isdigit() or value.startswith("0"):
        raise HTTPException(status_code=400, detail="bedId must be an integer")
    return int(value)


def text_field(body: dict, key: str) -> str:
    if key not in body or body[key] is None:
        return ""
    value = body[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be a string")
    return value


def bed_id_field(body: dict) -> int | None:
    if "bedId" not in body or body["bedId"] is None or body["bedId"] == "":
        return None
    value = body["bedId"]
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise HTTPException(status_code=400, detail="bedId must be an integer")
    return value


def crop_id_field(body: dict) -> int | None:
    if "cropId" not in body or body["cropId"] is None or body["cropId"] == "":
        return None
    value = body["cropId"]
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise HTTPException(status_code=400, detail="cropId must be an integer")
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


def parse_entry(body: dict, entry_id: int | None) -> dict:
    if entry_id is None:
        if body.get("id") is not None:
            raise HTTPException(status_code=400, detail="id is assigned by the server")
    elif body.get("id") != entry_id:
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
    if kind in ("diary", "uproot") and status != "done":
        raise HTTPException(status_code=400, detail=f"A {kind} entry is done")

    entry = {
        "kind": kind,
        "date": require_date(body.get("date"), "date"),
        "bed_id": bed_id_field(body),
        "crop_id": crop_id_field(body),
        "status": status,
        "note": text_field(body, "note"),
        "photo_url": photo_url_field(body) or None,
    }
    if kind == "uproot":
        if entry["bed_id"] is None:
            raise HTTPException(status_code=400, detail="Uproot needs a bed")
        if entry["crop_id"] is None:
            raise HTTPException(status_code=400, detail="Uproot needs a crop")
    if kind == "care":
        action = body.get("action")
        if action not in CARE_ACTIONS:
            raise HTTPException(status_code=400, detail="Invalid action")
        entry["care"] = {
            "action": action,
            "product": text_field(body, "product"),
            "amount": number_field(body, "amount"),
            "unit": text_field(body, "unit"),
        }
    if kind == "pest":
        entry["pest"] = {
            "problem": text_field(body, "problem"),
            "product": text_field(body, "product"),
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
    bed_id = row["bed_id"]
    if bed_id is None or bed_id == "":
        bed_id = None
    else:
        bed_id = int(bed_id)
    crop_id = row["crop_id"]
    if crop_id is None or crop_id == "":
        crop_id = None
    else:
        crop_id = int(crop_id)
    raw_rule = row["rule_id"] if "rule_id" in row.keys() else None
    if raw_rule is None or raw_rule == "":
        rule_id = None
    else:
        rule_id = int(raw_rule)
    raw_active = row["rule_active"] if "rule_active" in row.keys() else None
    if rule_id is None:
        rule_active = None
    else:
        rule_active = bool(raw_active)
    body = {
        "id": int(row["id"]),
        "kind": row["kind"],
        "date": row["date"],
        "bedId": bed_id,
        "cropId": crop_id,
        "crop": row["crop"] or "",
        "status": row["status"],
        "note": row["note"] or "",
        "photoUrl": row["photo_url"] or "",
        "ruleId": rule_id,
        "ruleActive": rule_active,
    }
    if row["kind"] == "care":
        body["action"] = row["action"]
        body["product"] = row["care_product"] or ""
        body["amount"] = json_number(row["care_amount"])
        body["unit"] = row["care_unit"] or ""
    elif row["kind"] == "pest":
        body["problem"] = row["problem"] or ""
        body["product"] = row["pest_product"] or ""
        body["amount"] = json_number(row["pest_amount"])
        body["unit"] = row["pest_unit"] or ""
    elif row["kind"] == "harvest":
        body["quantity"] = json_number(row["quantity"])
        body["unit"] = row["harvest_unit"] or ""
        body["weightGrams"] = json_number(row["weight_grams"])
    return body


def fetch_entry(connection, entry_id: int):
    return connection.execute(
        SELECT_ENTRIES + " WHERE calendar_entry.id = ?",
        (entry_id,),
    ).fetchone()


def connect():
    from app import connect as open_db

    return open_db()


def require_bed(connection, bed_id: int | None) -> None:
    if bed_id is None:
        return
    found = connection.execute("SELECT 1 FROM bed WHERE id = ?", (bed_id,)).fetchone()
    if found is None:
        raise HTTPException(status_code=400, detail="bedId does not exist")


def require_crop(connection, crop_id: int | None) -> None:
    if crop_id is None:
        return
    found = connection.execute("SELECT 1 FROM crop WHERE id = ?", (crop_id,)).fetchone()
    if found is None:
        raise HTTPException(status_code=400, detail="cropId does not exist")


def write_children(connection, entry_id: int, entry: dict) -> None:
    if entry["kind"] == "care":
        care = entry["care"]
        connection.execute(
            """
            INSERT INTO care (entry_id, action, product, amount, unit)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(entry_id) DO UPDATE SET
                action = excluded.action,
                product = excluded.product,
                amount = excluded.amount,
                unit = excluded.unit
            """,
            (
                entry_id,
                care["action"],
                care["product"],
                care["amount"],
                care["unit"],
            ),
        )
    else:
        connection.execute("DELETE FROM care WHERE entry_id = ?", (entry_id,))
    if entry["kind"] == "pest":
        treated = entry["pest"]
        connection.execute(
            """
            INSERT INTO pest (entry_id, problem, product, amount, unit)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(entry_id) DO UPDATE SET
                problem = excluded.problem,
                product = excluded.product,
                amount = excluded.amount,
                unit = excluded.unit
            """,
            (
                entry_id,
                treated["problem"],
                treated["product"],
                treated["amount"],
                treated["unit"],
            ),
        )
    else:
        connection.execute("DELETE FROM pest WHERE entry_id = ?", (entry_id,))
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
    else:
        connection.execute("DELETE FROM harvest WHERE entry_id = ?", (entry_id,))


def occupy_from_sowing(connection, entry: dict) -> None:
    """A done sowing in a bed puts that crop there when the bed does not hold it."""
    if entry["kind"] != "sowing" or entry["status"] != "done":
        return
    if entry["bed_id"] is None or entry["crop_id"] is None:
        return
    from beds_crops import place_crop_id

    place_crop_id(connection, entry["bed_id"], entry["crop_id"], entry["date"])


def vacate_from_uproot(connection, entry: dict) -> None:
    """A done uproot finishes the crop in that bed on the entry date."""
    if entry["kind"] != "uproot" or entry["status"] != "done":
        return
    if entry["bed_id"] is None or entry["crop_id"] is None:
        return
    from beds_crops import archive_crop_id

    archive_crop_id(connection, entry["bed_id"], entry["crop_id"], entry["date"])


def create_entry(body: dict) -> dict:
    entry = parse_entry(body, None)
    with closing(connect()) as connection:
        require_bed(connection, entry["bed_id"])
        require_crop(connection, entry["crop_id"])
        try:
            cursor = connection.execute(
                """
                INSERT INTO calendar_entry (
                    kind, date, bed_id, crop_id, status, note, photo_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry["kind"],
                    entry["date"],
                    entry["bed_id"],
                    entry["crop_id"],
                    entry["status"],
                    entry["note"],
                    entry["photo_url"],
                ),
            )
            entry_id = cursor.lastrowid
            write_children(connection, entry_id, entry)
            occupy_from_sowing(connection, entry)
            vacate_from_uproot(connection, entry)
            connection.commit()
            return entry_json(fetch_entry(connection, entry_id))
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise


def replace_entry(entry_id: int, body: dict) -> dict:
    entry = parse_entry(body, entry_id)
    with closing(connect()) as connection:
        existing = connection.execute(
            "SELECT kind, photo_url FROM calendar_entry WHERE id = ?",
            (entry_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Entry not found")
        if existing["kind"] != entry["kind"]:
            raise HTTPException(status_code=400, detail="kind cannot change")
        require_bed(connection, entry["bed_id"])
        require_crop(connection, entry["crop_id"])
        previous_photo = existing["photo_url"]
        try:
            connection.execute(
                """
                UPDATE calendar_entry SET
                    date = ?,
                    bed_id = ?,
                    crop_id = ?,
                    status = ?,
                    note = ?,
                    photo_url = ?
                WHERE id = ?
                """,
                (
                    entry["date"],
                    entry["bed_id"],
                    entry["crop_id"],
                    entry["status"],
                    entry["note"],
                    entry["photo_url"],
                    entry_id,
                ),
            )
            write_children(connection, entry_id, entry)
            vacate_from_uproot(connection, entry)
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


def remove_entry(entry_id: int) -> None:
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
            connection.execute("DELETE FROM pest WHERE entry_id = ?", (entry_id,))
            connection.execute("DELETE FROM calendar_entry WHERE id = ?", (entry_id,))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    discard_photo(photo)


def bed_clause(bed_id, clauses: list, params: list) -> None:
    if bed_id is None:
        return
    if bed_id == "":
        clauses.append("calendar_entry.bed_id IS NULL")
        return
    clauses.append("calendar_entry.bed_id = ?")
    params.append(bed_id)


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
    bed_clause(filters["bed_id"], clauses, params)
    if filters["crop"] is not None:
        if filters["crop"] == "":
            clauses.append("calendar_entry.crop_id IS NULL")
        else:
            clauses.append("crop.name = ?")
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
    through = filters.get("through")
    until = date.fromisoformat(through) if through else None
    with closing(connect()) as connection:
        from care_rules import materialize_all

        materialize_all(connection, until=until)
        connection.commit()
        rows = connection.execute(sql, params).fetchall()
    return [entry_json(row) for row in rows]


def harvest_total(crop: str | None, bed_id, date_from: str | None, date_to: str | None):
    clauses = ["calendar_entry.kind = 'harvest'", "calendar_entry.status = 'done'"]
    params = []
    if crop is not None:
        clauses.append("crop.name = ?")
        params.append(crop)
    bed_clause(bed_id, clauses, params)
    if date_from is not None:
        clauses.append("calendar_entry.date >= ?")
        params.append(date_from)
    if date_to is not None:
        clauses.append("calendar_entry.date <= ?")
        params.append(date_to)
    sql = f"""
        SELECT crop.name AS crop, COALESCE(SUM(harvest.weight_grams), 0) AS total
        FROM calendar_entry
        JOIN harvest ON harvest.entry_id = calendar_entry.id
        LEFT JOIN crop ON crop.id = calendar_entry.crop_id
        WHERE {' AND '.join(clauses)}
    """
    with closing(connect()) as connection:
        if crop is not None:
            row = connection.execute(sql, params).fetchone()
            total = 0 if row is None or row["total"] is None else row["total"]
            return {"crop": crop, "weightGrams": json_number(total) or 0}
        rows = connection.execute(
            sql + " GROUP BY calendar_entry.crop_id, crop.name ORDER BY crop.name",
            params,
        ).fetchall()
    return [
        {"crop": row["crop"] or "", "weightGrams": json_number(row["total"]) or 0}
        for row in rows
        if row["crop"]
    ]


def care_total(action: str, unit: str, product: str | None, bed_id, date_from: str | None, date_to: str | None) -> dict:
    clauses = ["care.action = ?", "care.unit = ?"]
    params = [action, unit]
    if product is not None:
        clauses.append("care.product = ?")
        params.append(product)
    bed_clause(bed_id, clauses, params)
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
    through: str | None = None,
    kind: str | None = None,
    bed_id: str | None = Query(default=None, alias="bedId"),
    crop: str | None = None,
    status: str | None = None,
    action: str | None = None,
) -> list:
    filters = {
        "date_from": optional_date(date_from, "from"),
        "date_to": optional_date(date_to, "to"),
        "through": optional_date(through, "through"),
        "kind": require_choice(kind, KINDS, "kind"),
        "bed_id": query_bed_id(bed_id),
        "crop": crop,
        "status": require_choice(status, STATUSES, "status"),
        "action": require_choice(action, CARE_ACTIONS, "action"),
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
        query_bed_id(bed_id),
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
    if action not in CARE_ACTIONS:
        raise HTTPException(status_code=400, detail="Invalid action")
    if not unit:
        raise HTTPException(status_code=400, detail="unit is required")
    return care_total(
        action,
        unit,
        product,
        query_bed_id(bed_id),
        optional_date(date_from, "from"),
        optional_date(date_to, "to"),
    )


@router.post("/calendar")
async def post_entry(request: Request) -> dict:
    return create_entry(parse_body(await request.body()))


@router.get("/calendar/{entry_id}")
def get_entry(entry_id: str) -> dict:
    parsed = require_entry_id(entry_id)
    with closing(connect()) as connection:
        row = fetch_entry(connection, parsed)
    if row is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry_json(row)


@router.put("/calendar/{entry_id}")
async def put_entry(entry_id: str, request: Request) -> dict:
    return replace_entry(require_entry_id(entry_id), parse_body(await request.body()))


@router.delete("/calendar/{entry_id}")
def delete_entry(entry_id: str) -> Response:
    remove_entry(require_entry_id(entry_id))
    return Response(status_code=204)
