"""Beds and obstacles on the map.

Each bed and obstacle is its own row. A bed that leaves the map stays,
marked removed, so the calendar can still name it. An obstacle is deleted.
Plant names are the active rows in beds_crops, copied onto active beds
when the garden is read.
"""

import json
from contextlib import closing

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

BED_KINDS = ("bed", "planter", "pot")
BED_FIELDS = {
    "id",
    "name",
    "kind",
    "x",
    "y",
    "w",
    "h",
    "diam",
    "rotation",
    "color",
    "notes",
    "outline",
}
OBSTACLE_FIELDS = {"id", "name", "x", "y", "w", "h", "rotation", "color"}

router = APIRouter()


def drop_plant_grid(connection) -> None:
    """Discard a square-foot layout left on an older bed table."""
    columns = {row[1] for row in connection.execute("PRAGMA table_info(bed)")}
    if "plant_grid" in columns:
        connection.execute("ALTER TABLE bed DROP COLUMN plant_grid")


def create_scene_tables(connection) -> None:
    """Integer bed and obstacle rows used by the live API."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS bed (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL DEFAULT '',
            kind       TEXT NOT NULL CHECK (kind IN ('bed', 'planter', 'pot')),
            x          REAL NOT NULL DEFAULT 0,
            y          REAL NOT NULL DEFAULT 0,
            w          REAL NOT NULL DEFAULT 0,
            h          REAL NOT NULL DEFAULT 0,
            diam       REAL,
            rotation   REAL NOT NULL DEFAULT 0,
            color      TEXT NOT NULL DEFAULT '',
            notes      TEXT NOT NULL DEFAULT '',
            area_sqft  REAL NOT NULL DEFAULT 0,
            outline    TEXT,
            removed    INTEGER NOT NULL DEFAULT 0 CHECK (removed IN (0, 1))
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS obstacle (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT NOT NULL DEFAULT '',
            x         REAL NOT NULL DEFAULT 0,
            y         REAL NOT NULL DEFAULT 0,
            w         REAL NOT NULL DEFAULT 0,
            h         REAL NOT NULL DEFAULT 0,
            rotation  REAL NOT NULL DEFAULT 0,
            color     TEXT NOT NULL DEFAULT ''
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


def _outline_points(bed: dict) -> list | None:
    outline = bed.get("outline")
    if isinstance(outline, dict):
        points = outline.get("points")
        if isinstance(points, list) and len(points) >= 3:
            return points
    if bed.get("shape") == "polygon":
        points = bed.get("points")
        if isinstance(points, list) and len(points) >= 3:
            return points
    return None


def bed_area(bed: dict) -> float:
    """Square feet, using the same rule as the canvas.

    A polygon uses the shoelace of its outline. Anything else is width times
    height. The legacy document still passes ``shape`` and ``points``.
    """
    points = _outline_points(bed)
    if points is not None:
        area = _shoelace(points)
        if area is not None:
            return round(area, 4)
    width = _number(bed.get("w")) or 0.0
    height = _number(bed.get("h")) or 0.0
    return round(width * height, 4)


def json_number(value):
    if value is None:
        return None
    number = float(value)
    if number.is_integer():
        return int(number)
    return number


def _dump(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _load(raw):
    if raw is None or raw == "":
        return None
    return json.loads(raw)


def connect():
    from app import connect as open_db

    return open_db()


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


def require_row_id(value: str, missing: str) -> int:
    if not value.isdigit() or value.startswith("0"):
        raise HTTPException(status_code=404, detail=missing)
    return int(value)


def _reject_unknown(body: dict, fields: set, label: str) -> None:
    unknown = set(body) - fields
    if unknown:
        name = sorted(unknown)[0]
        raise HTTPException(status_code=400, detail=f"{name} is not part of a {label}")


def _check_id(body: dict, item_id: int | None) -> None:
    if item_id is None:
        if body.get("id") is not None:
            raise HTTPException(status_code=400, detail="id is assigned by the server")
        return
    if "id" in body and body.get("id") != item_id:
        raise HTTPException(status_code=400, detail="id must match the URL")


def _text(body: dict, key: str) -> str:
    if key not in body or body[key] is None:
        return ""
    value = body[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be text")
    return value


def _real(body: dict, key: str, default: float = 0.0) -> float:
    if key not in body or body[key] is None:
        return default
    number = _number(body[key])
    if number is None:
        raise HTTPException(status_code=400, detail=f"{key} must be a number")
    return number


def _optional_real(body: dict, key: str) -> float | None:
    if key not in body or body[key] is None:
        return None
    number = _number(body[key])
    if number is None:
        raise HTTPException(status_code=400, detail=f"{key} must be a number")
    return number


def _plain_number(value, label: str):
    number = _number(value)
    if number is None:
        raise HTTPException(status_code=400, detail=f"{label} must be a number")
    return json_number(number)


def _point(value, label: str) -> dict:
    if not isinstance(value, dict) or set(value) != {"x", "y"}:
        raise HTTPException(status_code=400, detail=f"{label} needs x and y")
    return {
        "x": _plain_number(value["x"], f"{label} x"),
        "y": _plain_number(value["y"], f"{label} y"),
    }


def _outline(body: dict) -> dict | None:
    if "outline" not in body or body["outline"] is None:
        return None
    outline = body["outline"]
    if not isinstance(outline, dict):
        raise HTTPException(status_code=400, detail="outline must be an object")
    if set(outline) - {"points", "pivot"}:
        raise HTTPException(
            status_code=400,
            detail="outline must be points and an optional pivot",
        )
    points = outline.get("points")
    if not isinstance(points, list) or len(points) < 3:
        raise HTTPException(status_code=400, detail="outline needs at least 3 points")
    cleaned = {"points": [_point(point, "A point") for point in points]}
    if "pivot" in outline and outline["pivot"] is not None:
        cleaned["pivot"] = _point(outline["pivot"], "pivot")
    return cleaned


def _kind(body: dict) -> str:
    if "kind" not in body or body["kind"] in (None, ""):
        raise HTTPException(status_code=400, detail="kind is required")
    kind = body["kind"]
    if not isinstance(kind, str) or kind not in BED_KINDS:
        raise HTTPException(status_code=400, detail="Invalid kind")
    return kind


def parse_bed(body: dict, bed_id: int | None) -> dict:
    _reject_unknown(body, BED_FIELDS, "bed")
    _check_id(body, bed_id)
    kind = _kind(body)
    diam = _optional_real(body, "diam")
    if kind != "pot":
        if diam is not None:
            raise HTTPException(status_code=400, detail="diam is only for a pot")
        diam = None
    outline = _outline(body)
    parsed = {
        "name": _text(body, "name"),
        "kind": kind,
        "x": _real(body, "x"),
        "y": _real(body, "y"),
        "w": _real(body, "w"),
        "h": _real(body, "h"),
        "diam": diam,
        "rotation": _real(body, "rotation"),
        "color": _text(body, "color"),
        "notes": _text(body, "notes"),
        "outline": outline,
    }
    parsed["area_sqft"] = bed_area(
        {"w": parsed["w"], "h": parsed["h"], "outline": outline}
    )
    return parsed


def parse_obstacle(body: dict, obstacle_id: int | None) -> dict:
    _reject_unknown(body, OBSTACLE_FIELDS, "obstacle")
    _check_id(body, obstacle_id)
    return {
        "name": _text(body, "name"),
        "x": _real(body, "x"),
        "y": _real(body, "y"),
        "w": _real(body, "w"),
        "h": _real(body, "h"),
        "rotation": _real(body, "rotation"),
        "color": _text(body, "color"),
    }


def bed_summary(row) -> dict:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "kind": row["kind"],
        "areaSqFt": json_number(row["area_sqft"]),
        "removed": bool(row["removed"]),
    }


def bed_scene(row, plants: list | None = None) -> dict:
    body = {
        "id": int(row["id"]),
        "name": row["name"],
        "kind": row["kind"],
        "x": json_number(row["x"]),
        "y": json_number(row["y"]),
        "w": json_number(row["w"]),
        "h": json_number(row["h"]),
        "diam": json_number(row["diam"]),
        "rotation": json_number(row["rotation"]),
        "color": row["color"],
        "notes": row["notes"],
        "areaSqFt": json_number(row["area_sqft"]),
        "outline": _load(row["outline"]),
        "removed": bool(row["removed"]),
    }
    if plants is not None:
        body["plants"] = plants
    return body


def obstacle_scene(row) -> dict:
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "x": json_number(row["x"]),
        "y": json_number(row["y"]),
        "w": json_number(row["w"]),
        "h": json_number(row["h"]),
        "rotation": json_number(row["rotation"]),
        "color": row["color"],
    }


def _bed_values(bed: dict) -> tuple:
    outline = None if bed["outline"] is None else _dump(bed["outline"])
    return (
        bed["name"],
        bed["kind"],
        bed["x"],
        bed["y"],
        bed["w"],
        bed["h"],
        bed["diam"],
        bed["rotation"],
        bed["color"],
        bed["notes"],
        bed["area_sqft"],
        outline,
    )


def _fetch_bed(connection, bed_id: int):
    return connection.execute("SELECT * FROM bed WHERE id = ?", (bed_id,)).fetchone()


def _fetch_obstacle(connection, obstacle_id: int):
    return connection.execute(
        "SELECT * FROM obstacle WHERE id = ?",
        (obstacle_id,),
    ).fetchone()


def list_beds() -> list[dict]:
    with closing(connect()) as connection:
        rows = connection.execute(
            """
            SELECT id, name, kind, area_sqft, removed
            FROM bed
            ORDER BY removed, id
            """
        ).fetchall()
    return [bed_summary(row) for row in rows]


def create_bed(body: dict) -> dict:
    bed = parse_bed(body, None)
    with closing(connect()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO bed (
                name, kind, x, y, w, h, diam, rotation, color, notes,
                area_sqft, outline
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            _bed_values(bed),
        )
        row = _fetch_bed(connection, cursor.lastrowid)
        connection.commit()
    return bed_scene(row)


def update_bed(bed_id: int, body: dict) -> dict:
    bed = parse_bed(body, bed_id)
    with closing(connect()) as connection:
        cursor = connection.execute(
            """
            UPDATE bed SET
                name = ?,
                kind = ?,
                x = ?,
                y = ?,
                w = ?,
                h = ?,
                diam = ?,
                rotation = ?,
                color = ?,
                notes = ?,
                area_sqft = ?,
                outline = ?
            WHERE id = ?
            """,
            (*_bed_values(bed), bed_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Bed not found")
        row = _fetch_bed(connection, bed_id)
        connection.commit()
    return bed_scene(row)


def hide_bed(bed_id: int) -> None:
    from beds_crops import archive_bed_crops

    with closing(connect()) as connection:
        cursor = connection.execute(
            "UPDATE bed SET removed = 1 WHERE id = ?",
            (bed_id,),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Bed not found")
        archive_bed_crops(connection, bed_id)
        connection.commit()


def create_obstacle(body: dict) -> dict:
    obstacle = parse_obstacle(body, None)
    with closing(connect()) as connection:
        cursor = connection.execute(
            """
            INSERT INTO obstacle (name, x, y, w, h, rotation, color)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                obstacle["name"],
                obstacle["x"],
                obstacle["y"],
                obstacle["w"],
                obstacle["h"],
                obstacle["rotation"],
                obstacle["color"],
            ),
        )
        row = _fetch_obstacle(connection, cursor.lastrowid)
        connection.commit()
    return obstacle_scene(row)


def update_obstacle(obstacle_id: int, body: dict) -> dict:
    obstacle = parse_obstacle(body, obstacle_id)
    with closing(connect()) as connection:
        cursor = connection.execute(
            """
            UPDATE obstacle SET
                name = ?,
                x = ?,
                y = ?,
                w = ?,
                h = ?,
                rotation = ?,
                color = ?
            WHERE id = ?
            """,
            (
                obstacle["name"],
                obstacle["x"],
                obstacle["y"],
                obstacle["w"],
                obstacle["h"],
                obstacle["rotation"],
                obstacle["color"],
                obstacle_id,
            ),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Obstacle not found")
        row = _fetch_obstacle(connection, obstacle_id)
        connection.commit()
    return obstacle_scene(row)


def delete_obstacle(obstacle_id: int) -> None:
    with closing(connect()) as connection:
        cursor = connection.execute(
            "DELETE FROM obstacle WHERE id = ?",
            (obstacle_id,),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Obstacle not found")
        connection.commit()


def garden_contents(connection) -> tuple[list, list]:
    """Active beds, with that bed's crop names copied on, and every obstacle."""
    from beds_crops import active_names

    names = active_names(connection)
    beds = []
    rows = connection.execute(
        "SELECT * FROM bed WHERE removed = 0 ORDER BY id"
    ).fetchall()
    for row in rows:
        beds.append(bed_scene(row, names.get(int(row["id"]), [])))
    obstacles = [
        obstacle_scene(row)
        for row in connection.execute("SELECT * FROM obstacle ORDER BY id")
    ]
    return beds, obstacles


@router.get("/beds")
def get_beds() -> list:
    return list_beds()


@router.get("/beds/crops")
def get_bed_crops() -> list:
    from beds_crops import list_active_assignments

    return list_active_assignments()


@router.put("/beds")
async def put_bed(request: Request) -> dict:
    return create_bed(parse_body(await request.body()))


def crop_name(body: dict) -> str:
    if set(body) != {"name"} or not isinstance(body.get("name"), str) or not body["name"].strip():
        raise HTTPException(status_code=400, detail="Crop assignment needs a name")
    return body["name"].strip()


@router.put("/beds/{bed_id}/crops")
async def put_bed_crop(bed_id: str, request: Request) -> dict:
    from beds_crops import assign_crop

    return assign_crop(
        require_row_id(bed_id, "Bed not found"),
        crop_name(parse_body(await request.body())),
    )


@router.put("/beds/{bed_id}/crops/archive")
async def put_bed_crop_archive(bed_id: str, request: Request) -> Response:
    from beds_crops import archive_crop

    archive_crop(
        require_row_id(bed_id, "Bed not found"),
        crop_name(parse_body(await request.body())),
    )
    return Response(status_code=204)


@router.put("/beds/{bed_id}")
async def put_bed_id(bed_id: str, request: Request) -> dict:
    return update_bed(require_row_id(bed_id, "Bed not found"), parse_body(await request.body()))


@router.delete("/beds/{bed_id}")
def delete_bed(bed_id: str) -> Response:
    hide_bed(require_row_id(bed_id, "Bed not found"))
    return Response(status_code=204)


@router.put("/obstacles")
async def put_obstacle(request: Request) -> dict:
    return create_obstacle(parse_body(await request.body()))


@router.put("/obstacles/{obstacle_id}")
async def put_obstacle_id(obstacle_id: str, request: Request) -> dict:
    return update_obstacle(
        require_row_id(obstacle_id, "Obstacle not found"),
        parse_body(await request.body()),
    )


@router.delete("/obstacles/{obstacle_id}")
def delete_obstacle_route(obstacle_id: str) -> Response:
    delete_obstacle(require_row_id(obstacle_id, "Obstacle not found"))
    return Response(status_code=204)
