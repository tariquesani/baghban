"""Standing care schedules.

A care_rule is the template. python-dateutil rrule expands due dates. Matching
calendar_entry rows (kind care, with rule_id) are the occurrences. Completing
one occurrence does not change the rule.
"""

from __future__ import annotations

import json
from contextlib import closing
from datetime import date, timedelta

from dateutil.rrule import DAILY, WEEKLY, YEARLY, rrule
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from catalogue import CARE_ACTIONS
from http_util import (
    bed_id_field,
    crop_id_field,
    json_number,
    number_field,
    read_json_body,
    require_date,
    text_field,
)

FREQS = ("daily", "weekly", "yearly")
HORIZON_DAYS = 365
WEEKDAY_MIN = 0
WEEKDAY_MAX = 6

router = APIRouter()


def care_rule_table_sql(name: str = "care_rule", if_not_exists: bool = False) -> str:
    clause = "IF NOT EXISTS " if if_not_exists else ""
    return f"""
        CREATE TABLE {clause}{name} (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            bed_id       INTEGER REFERENCES bed(id),
            crop_id      INTEGER REFERENCES crop(id),
            action       TEXT NOT NULL,
            product      TEXT NOT NULL DEFAULT '',
            amount       REAL,
            unit         TEXT NOT NULL DEFAULT '',
            note         TEXT NOT NULL DEFAULT '',
            freq         TEXT NOT NULL CHECK (freq IN ('daily', 'weekly', 'yearly')),
            interval     INTEGER NOT NULL DEFAULT 1 CHECK (interval >= 1),
            weekdays     TEXT NOT NULL DEFAULT '[]',
            anchor_date  TEXT NOT NULL,
            ends_on      TEXT,
            active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
        )
    """


def create_care_rule_table(connection) -> None:
    connection.execute(care_rule_table_sql(if_not_exists=True))


def care_recurrence(connection) -> None:
    """Add care_rule and calendar_entry.rule_id for standing care schedules."""
    create_care_rule_table(connection)
    calendar = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'calendar_entry'"
    ).fetchone()
    if calendar is None:
        return
    columns = {info[1] for info in connection.execute("PRAGMA table_info(calendar_entry)")}
    if "rule_id" in columns:
        return
    connection.execute(
        "ALTER TABLE calendar_entry ADD COLUMN rule_id INTEGER REFERENCES care_rule(id)"
    )


def connect():
    from app import connect as open_db

    return open_db()


def require_rule_id(rule_id: str) -> int:
    if not rule_id.isdigit() or rule_id.startswith("0"):
        raise HTTPException(status_code=404, detail="Rule not found")
    return int(rule_id)


def weekdays_field(body: dict, freq: str) -> list[int]:
    raw = body.get("weekdays", [])
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="weekdays must be a list of integers")
    days: list[int] = []
    for item in raw:
        if isinstance(item, bool) or not isinstance(item, int) or item < WEEKDAY_MIN or item > WEEKDAY_MAX:
            raise HTTPException(status_code=400, detail="weekdays must be 0 (Mon) through 6 (Sun)")
        if item not in days:
            days.append(item)
    days.sort()
    if freq == "weekly" and not days:
        raise HTTPException(status_code=400, detail="weekly rules need at least one weekday")
    if freq != "weekly" and days:
        raise HTTPException(status_code=400, detail="weekdays are only for weekly rules")
    return days


def interval_field(body: dict, freq: str) -> int:
    value = body.get("interval", 1)
    if value is None:
        value = 1
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise HTTPException(status_code=400, detail="interval must be a positive integer")
    if freq == "yearly" and value != 1:
        raise HTTPException(status_code=400, detail="yearly interval must be 1")
    if freq == "weekly" and value > 3:
        raise HTTPException(status_code=400, detail="weekly interval must be 1, 2, or 3")
    return value


def entry_id_field(body: dict) -> int | None:
    """Optional calendar entry to attach when creating a rule from a one-off care."""
    if "entryId" not in body or body["entryId"] is None or body["entryId"] == "":
        return None
    value = body["entryId"]
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise HTTPException(status_code=400, detail="entryId must be an integer")
    return value


def parse_rule(body: dict, rule_id: int | None) -> dict:
    if rule_id is None:
        if body.get("id") is not None:
            raise HTTPException(status_code=400, detail="id is assigned by the server")
    elif body.get("id") != rule_id:
        raise HTTPException(status_code=400, detail="id must match the URL")
    freq = body.get("freq")
    if freq not in FREQS:
        raise HTTPException(status_code=400, detail="Invalid freq")
    action = body.get("action")
    if action not in CARE_ACTIONS:
        raise HTTPException(status_code=400, detail="Invalid action")
    active = body.get("active", True)
    if not isinstance(active, bool):
        raise HTTPException(status_code=400, detail="active must be a boolean")
    ends = body.get("endsOn")
    if ends is not None and ends != "":
        ends_on = require_date(ends, "endsOn")
    else:
        ends_on = None
    anchor = require_date(body.get("anchorDate"), "anchorDate")
    if ends_on is not None and ends_on < anchor:
        raise HTTPException(status_code=400, detail="endsOn must be on or after anchorDate")
    parsed = {
        "bed_id": bed_id_field(body),
        "crop_id": crop_id_field(body),
        "action": action,
        "product": text_field(body, "product"),
        "amount": number_field(body, "amount"),
        "unit": text_field(body, "unit"),
        "note": text_field(body, "note"),
        "freq": freq,
        "interval": interval_field(body, freq),
        "weekdays": weekdays_field(body, freq),
        "anchor_date": anchor,
        "ends_on": ends_on,
        "active": 1 if active else 0,
    }
    if rule_id is None:
        parsed["entry_id"] = entry_id_field(body)
    return parsed


def rule_json(row) -> dict:
    weekdays = json.loads(row["weekdays"] or "[]")
    return {
        "id": int(row["id"]),
        "bedId": None if row["bed_id"] in (None, "") else int(row["bed_id"]),
        "cropId": None if row["crop_id"] in (None, "") else int(row["crop_id"]),
        "action": row["action"],
        "product": row["product"] or "",
        "amount": json_number(row["amount"]),
        "unit": row["unit"] or "",
        "note": row["note"] or "",
        "freq": row["freq"],
        "interval": int(row["interval"]),
        "weekdays": weekdays,
        "anchorDate": row["anchor_date"],
        "endsOn": row["ends_on"],
        "active": bool(row["active"]),
    }


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


def fetch_rule(connection, rule_id: int):
    return connection.execute("SELECT * FROM care_rule WHERE id = ?", (rule_id,)).fetchone()


def due_dates(rule: dict, start: date, end: date) -> list[str]:
    """Dates the rule is due on, inclusive of start and end when they match."""
    anchor = date.fromisoformat(rule["anchor_date"])
    until = end
    if rule.get("ends_on"):
        ends = date.fromisoformat(rule["ends_on"])
        if ends < until:
            until = ends
    if until < start or until < anchor:
        return []
    freq = rule["freq"]
    interval = int(rule["interval"])
    if freq == "daily":
        series = rrule(DAILY, interval=interval, dtstart=anchor, until=until)
    elif freq == "weekly":
        series = rrule(
            WEEKLY,
            interval=interval,
            byweekday=tuple(rule["weekdays"]),
            dtstart=anchor,
            until=until,
        )
    else:
        series = rrule(YEARLY, interval=1, dtstart=anchor, until=until)
    dates = []
    for moment in series:
        day = moment.date()
        if day < start:
            continue
        if day > until:
            break
        dates.append(day.isoformat())
    return dates


def rule_row_as_dict(row) -> dict:
    return {
        "id": int(row["id"]),
        "bed_id": None if row["bed_id"] in (None, "") else int(row["bed_id"]),
        "crop_id": None if row["crop_id"] in (None, "") else int(row["crop_id"]),
        "action": row["action"],
        "product": row["product"] or "",
        "amount": row["amount"],
        "unit": row["unit"] or "",
        "note": row["note"] or "",
        "freq": row["freq"],
        "interval": int(row["interval"]),
        "weekdays": json.loads(row["weekdays"] or "[]"),
        "anchor_date": row["anchor_date"],
        "ends_on": row["ends_on"],
        "active": int(row["active"]),
    }


def delete_future_planned(connection, rule_id: int, today: str) -> None:
    rows = connection.execute(
        """
        SELECT id FROM calendar_entry
        WHERE rule_id = ? AND kind = 'care' AND status = 'planned' AND date >= ?
        """,
        (rule_id, today),
    ).fetchall()
    for row in rows:
        entry_id = int(row["id"])
        connection.execute("DELETE FROM care WHERE entry_id = ?", (entry_id,))
        connection.execute("DELETE FROM calendar_entry WHERE id = ?", (entry_id,))


def materialize_until(today: date, until: date | None = None) -> date:
    """End date for generation: at least today+HORIZON and the end of next calendar year.

    Yearly cares (e.g. 2 Dec) must appear when browsing the following year without
    relying only on a client `through` param.
    """
    end = today + timedelta(days=HORIZON_DAYS)
    next_year_end = date(today.year + 1, 12, 31)
    if next_year_end > end:
        end = next_year_end
    if until is not None and until > end:
        end = until
    return end


def materialize_rule(
    connection,
    rule: dict,
    today: date | None = None,
    until: date | None = None,
) -> int:
    """Insert missing planned care rows for one active rule. Returns how many were added.

    Covers today through materialize_until(). Pass `until` (e.g. end of the visible
    calendar year) to reach further ahead.
    """
    if not rule["active"]:
        return 0
    if today is None:
        today = date.today()
    start = today
    end = materialize_until(today, until)
    existing = {
        row["date"]
        for row in connection.execute(
            """
            SELECT date FROM calendar_entry
            WHERE rule_id = ? AND kind = 'care'
            """,
            (rule["id"],),
        )
    }
    added = 0
    for due in due_dates(rule, start, end):
        if due in existing:
            continue
        cursor = connection.execute(
            """
            INSERT INTO calendar_entry (
                kind, date, bed_id, crop_id, status, note, photo_url, rule_id
            ) VALUES ('care', ?, ?, ?, 'planned', ?, NULL, ?)
            """,
            (due, rule["bed_id"], rule["crop_id"], rule["note"], rule["id"]),
        )
        entry_id = cursor.lastrowid
        connection.execute(
            """
            INSERT INTO care (entry_id, action, product, amount, unit)
            VALUES (?, ?, ?, ?, ?)
            """,
            (entry_id, rule["action"], rule["product"], rule["amount"], rule["unit"]),
        )
        existing.add(due)
        added += 1
    return added


def materialize_all(
    connection,
    today: date | None = None,
    until: date | None = None,
) -> int:
    rows = connection.execute("SELECT * FROM care_rule WHERE active = 1").fetchall()
    total = 0
    for row in rows:
        total += materialize_rule(connection, rule_row_as_dict(row), today, until)
    return total


def insert_rule(connection, rule: dict) -> int:
    cursor = connection.execute(
        """
        INSERT INTO care_rule (
            bed_id, crop_id, action, product, amount, unit, note,
            freq, interval, weekdays, anchor_date, ends_on, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            rule["bed_id"],
            rule["crop_id"],
            rule["action"],
            rule["product"],
            rule["amount"],
            rule["unit"],
            rule["note"],
            rule["freq"],
            rule["interval"],
            json.dumps(rule["weekdays"]),
            rule["anchor_date"],
            rule["ends_on"],
            rule["active"],
        ),
    )
    return int(cursor.lastrowid)


def update_rule_row(connection, rule_id: int, rule: dict) -> None:
    connection.execute(
        """
        UPDATE care_rule SET
            bed_id = ?,
            crop_id = ?,
            action = ?,
            product = ?,
            amount = ?,
            unit = ?,
            note = ?,
            freq = ?,
            interval = ?,
            weekdays = ?,
            anchor_date = ?,
            ends_on = ?,
            active = ?
        WHERE id = ?
        """,
        (
            rule["bed_id"],
            rule["crop_id"],
            rule["action"],
            rule["product"],
            rule["amount"],
            rule["unit"],
            rule["note"],
            rule["freq"],
            rule["interval"],
            json.dumps(rule["weekdays"]),
            rule["anchor_date"],
            rule["ends_on"],
            rule["active"],
            rule_id,
        ),
    )


def attach_entry(connection, entry_id: int, rule_id: int, rule: dict) -> None:
    """Link a one-off care row to a new rule. Keeps status and photo; syncs care fields."""
    existing = connection.execute(
        """
        SELECT id, kind, rule_id, status, photo_url
        FROM calendar_entry WHERE id = ?
        """,
        (entry_id,),
    ).fetchone()
    if existing is None:
        raise HTTPException(status_code=400, detail="entryId does not exist")
    if existing["kind"] != "care":
        raise HTTPException(status_code=400, detail="entryId must be a care entry")
    if existing["rule_id"] is not None and existing["rule_id"] != "":
        raise HTTPException(status_code=400, detail="entryId already belongs to a schedule")
    connection.execute(
        """
        UPDATE calendar_entry SET
            date = ?,
            bed_id = ?,
            crop_id = ?,
            note = ?,
            rule_id = ?
        WHERE id = ?
        """,
        (
            rule["anchor_date"],
            rule["bed_id"],
            rule["crop_id"],
            rule["note"],
            rule_id,
            entry_id,
        ),
    )
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
            rule["action"],
            rule["product"],
            rule["amount"],
            rule["unit"],
        ),
    )


def create_rule(body: dict) -> dict:
    rule = parse_rule(body, None)
    entry_id = rule.pop("entry_id", None)
    with closing(connect()) as connection:
        require_bed(connection, rule["bed_id"])
        require_crop(connection, rule["crop_id"])
        try:
            rule_id = insert_rule(connection, rule)
            if entry_id is not None:
                attach_entry(connection, entry_id, rule_id, rule)
            stored = rule_row_as_dict(fetch_rule(connection, rule_id))
            materialize_rule(connection, stored)
            connection.commit()
            return rule_json(fetch_rule(connection, rule_id))
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise


def replace_rule(rule_id: int, body: dict) -> dict:
    rule = parse_rule(body, rule_id)
    today = date.today().isoformat()
    with closing(connect()) as connection:
        existing = fetch_rule(connection, rule_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Rule not found")
        require_bed(connection, rule["bed_id"])
        require_crop(connection, rule["crop_id"])
        try:
            update_rule_row(connection, rule_id, rule)
            delete_future_planned(connection, rule_id, today)
            stored = rule_row_as_dict(fetch_rule(connection, rule_id))
            materialize_rule(connection, stored)
            connection.commit()
            return rule_json(fetch_rule(connection, rule_id))
        except HTTPException:
            connection.rollback()
            raise
        except Exception:
            connection.rollback()
            raise


def deactivate_rule(rule_id: int) -> dict:
    today = date.today().isoformat()
    with closing(connect()) as connection:
        existing = fetch_rule(connection, rule_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Rule not found")
        try:
            connection.execute("UPDATE care_rule SET active = 0 WHERE id = ?", (rule_id,))
            delete_future_planned(connection, rule_id, today)
            connection.commit()
            return rule_json(fetch_rule(connection, rule_id))
        except Exception:
            connection.rollback()
            raise


def list_rules() -> list:
    with closing(connect()) as connection:
        rows = connection.execute(
            "SELECT * FROM care_rule ORDER BY id"
        ).fetchall()
    return [rule_json(row) for row in rows]


@router.get("/care-rules")
def get_care_rules() -> list:
    return list_rules()


@router.post("/care-rules")
async def post_care_rule(request: Request) -> dict:
    return create_rule(await read_json_body(request))


@router.get("/care-rules/{rule_id}")
def get_care_rule(rule_id: str) -> dict:
    parsed = require_rule_id(rule_id)
    with closing(connect()) as connection:
        row = fetch_rule(connection, parsed)
    if row is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule_json(row)


@router.put("/care-rules/{rule_id}")
async def put_care_rule(rule_id: str, request: Request) -> dict:
    return replace_rule(require_rule_id(rule_id), await read_json_body(request))


@router.post("/care-rules/{rule_id}/deactivate")
def post_deactivate_care_rule(rule_id: str) -> dict:
    return deactivate_rule(require_rule_id(rule_id))
