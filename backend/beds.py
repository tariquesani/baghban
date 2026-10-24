"""Beds named by the saved garden plan.

The plan document stays the whole scene. This table keeps the id, name,
kind, and square feet the calendar can read. A bed that leaves the plan
stays here, marked removed, so older entries can still find it.
"""

from contextlib import closing

from fastapi import APIRouter

router = APIRouter()


def create_bed_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS bed (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL DEFAULT '',
            kind       TEXT NOT NULL DEFAULT '',
            area_sqft  REAL NOT NULL DEFAULT 0,
            removed    INTEGER NOT NULL DEFAULT 0 CHECK (removed IN (0, 1))
        )
        """
    )


def _number(value) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _shoelace(points: list) -> float | None:
    total = 0.0
    count = len(points)
    for index, point in enumerate(points):
        nxt = points[(index + 1) % count]
        if not isinstance(point, dict) or not isinstance(nxt, dict):
            return None
        x1 = _number(point.get("x"))
        y1 = _number(point.get("y"))
        x2 = _number(nxt.get("x"))
        y2 = _number(nxt.get("y"))
        if None in (x1, y1, x2, y2):
            return None
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def bed_area(bed: dict) -> float:
    """Square feet, using the same rule as the canvas."""
    points = bed.get("points")
    if (
        bed.get("shape") == "polygon"
        and isinstance(points, list)
        and len(points) >= 3
    ):
        area = _shoelace(points)
        if area is not None:
            return round(area, 4)
    width = _number(bed.get("w")) or 0.0
    height = _number(bed.get("h")) or 0.0
    return round(width * height, 4)


def beds_in(plan: dict) -> list[dict]:
    raw = plan.get("beds")
    if not isinstance(raw, list):
        return []
    found = {}
    for bed in raw:
        if not isinstance(bed, dict):
            continue
        bed_id = bed.get("id")
        if not isinstance(bed_id, str) or bed_id == "":
            continue
        name = bed.get("name")
        kind = bed.get("type")
        found[bed_id] = {
            "id": bed_id,
            "name": name if isinstance(name, str) else "",
            "kind": kind if isinstance(kind, str) else "",
            "area_sqft": bed_area(bed),
        }
    return list(found.values())


def sync_beds(connection, plan: dict) -> None:
    """Match the bed table to the beds in this plan. Missing beds stay, marked removed."""
    if not isinstance(plan.get("beds"), list):
        return
    rows = beds_in(plan)
    for row in rows:
        connection.execute(
            """
            INSERT INTO bed (id, name, kind, area_sqft, removed)
            VALUES (?, ?, ?, ?, 0)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                kind = excluded.kind,
                area_sqft = excluded.area_sqft,
                removed = 0
            """,
            (row["id"], row["name"], row["kind"], row["area_sqft"]),
        )
    kept = [row["id"] for row in rows]
    if kept:
        marks = ",".join("?" for _ in kept)
        connection.execute(
            f"UPDATE bed SET removed = 1 WHERE id NOT IN ({marks})",
            kept,
        )
    else:
        connection.execute("UPDATE bed SET removed = 1")


def _json_area(value) -> int | float:
    number = float(value)
    if number.is_integer():
        return int(number)
    return number


def bed_json(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "kind": row["kind"],
        "areaSqFt": _json_area(row["area_sqft"]),
        "removed": bool(row["removed"]),
    }


def list_beds() -> list[dict]:
    from app import connect

    with closing(connect()) as connection:
        rows = connection.execute(
            """
            SELECT id, name, kind, area_sqft, removed
            FROM bed
            ORDER BY removed, id
            """
        ).fetchall()
    return [bed_json(row) for row in rows]


@router.get("/beds")
def get_beds() -> list:
    return list_beds()
