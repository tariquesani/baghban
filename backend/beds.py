"""Beds and obstacles on the map.

Each bed and obstacle is its own row. A bed that leaves the map stays,
marked removed, so the calendar can still name it. An obstacle is deleted.
Plant names are the active rows in beds_crops, copied onto active beds
when the garden is read.
"""

import json
import math
from contextlib import closing

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from http_util import read_json_body

BED_KINDS = ("bed", "planter", "pot", "tree")
CIRCLE_KINDS = ("pot", "tree")
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


def bed_table_sql(name: str = "bed", if_not_exists: bool = False) -> str:
    clause = "IF NOT EXISTS " if if_not_exists else ""
    kinds = ", ".join(f"'{kind}'" for kind in BED_KINDS)
    return f"""
        CREATE TABLE {clause}{name} (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL DEFAULT '',
            kind       TEXT NOT NULL CHECK (kind IN ({kinds})),
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


def allow_tree_kind(connection) -> None:
    """Let bed.kind store tree. Older files only allowed bed, planter, and pot."""
    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'bed'"
    ).fetchone()
    if row is None:
        return
    sql = row[0] or ""
    if "'tree'" in sql:
        return
    connection.execute("DROP TABLE IF EXISTS bed_next")
    connection.execute(bed_table_sql("bed_next"))
    connection.execute(
        """
        INSERT INTO bed_next (
            id, name, kind, x, y, w, h, diam, rotation, color, notes,
            area_sqft, outline, removed
        )
        SELECT
            id, name, kind, x, y, w, h, diam, rotation, color, notes,
            area_sqft, outline, removed
        FROM bed
        """
    )
    connection.execute("DROP TABLE bed")
    connection.execute("ALTER TABLE bed_next RENAME TO bed")
    sequence = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'"
    ).fetchone()
    max_id = connection.execute("SELECT MAX(id) FROM bed").fetchone()[0]
    if sequence is not None and max_id is not None:
        connection.execute("DELETE FROM sqlite_sequence WHERE name = 'bed_next'")
        found = connection.execute(
            "SELECT 1 FROM sqlite_sequence WHERE name = 'bed'"
        ).fetchone()
        if found is None:
            connection.execute(
                "INSERT INTO sqlite_sequence (name, seq) VALUES ('bed', ?)",
                (max_id,),
            )
        else:
            connection.execute(
                "UPDATE sqlite_sequence SET seq = ? WHERE name = 'bed'",
                (max_id,),
            )


def create_scene_tables(connection) -> None:
    """Integer bed and obstacle rows used by the live API."""
    connection.execute(bed_table_sql(if_not_exists=True))
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


def _bulge(point: dict) -> float:
    if not isinstance(point, dict):
        return 0.0
    value = _number(point.get("bulge"))
    return 0.0 if value is None else value


def _sample_edge(start: dict, end: dict) -> list | None:
    """Points along one side, matching the canvas curve sampler."""
    if not isinstance(start, dict) or not isinstance(end, dict):
        return None
    x0, y0 = _number(start.get("x")), _number(start.get("y"))
    x1, y1 = _number(end.get("x")), _number(end.get("y"))
    if None in (x0, y0, x1, y1):
        return None
    bulge = _bulge(start)
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    if length < 1e-9 or bulge == 0.0:
        return [{"x": x1, "y": y1}]
    nx, ny = -dy / length, dx / length
    cx = (x0 + x1) / 2 + 2 * bulge * nx
    cy = (y0 + y1) / 2 + 2 * bulge * ny
    steps = min(64, max(4, math.ceil((length + 2 * abs(bulge)) / (1 / 12))))
    samples = []
    for step in range(1, steps + 1):
        t = step / steps
        u = 1 - t
        samples.append({
            "x": u * u * x0 + 2 * u * t * cx + t * t * x1,
            "y": u * u * y0 + 2 * u * t * cy + t * t * y1,
        })
    return samples


def _sample_outline(points: list) -> list | None:
    if not points or not isinstance(points[0], dict):
        return None
    x0, y0 = _number(points[0].get("x")), _number(points[0].get("y"))
    if x0 is None or y0 is None:
        return None
    outline = [{"x": x0, "y": y0}]
    count = len(points)
    for index, start in enumerate(points):
        samples = _sample_edge(start, points[(index + 1) % count])
        if samples is None:
            return None
        outline.extend(samples)
    if (
        len(outline) > 1
        and outline[-1]["x"] == outline[0]["x"]
        and outline[-1]["y"] == outline[0]["y"]
    ):
        outline.pop()
    return outline


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

    A polygon uses the shoelace of its outline. A side with a bulge is sampled
    along that curve first, about an inch apart. A tree uses the circle from
    its diameter. Anything else is width times height. The legacy document
    still passes ``shape`` and ``points``.
    """
    points = _outline_points(bed)
    if points is not None:
        sampled = _sample_outline(points)
        area = _shoelace(sampled) if sampled is not None else None
        if area is not None:
            return round(area, 4)
    kind = bed.get("kind") or bed.get("type")
    if kind == "tree":
        diam = _number(bed.get("diam"))
        if diam is None:
            diam = _number(bed.get("w")) or 0.0
        return round(math.pi * (diam / 2) ** 2, 4)
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


def _point(value, label: str, allow_bulge: bool = False) -> dict:
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail=f"{label} needs x and y")
    allowed = {"x", "y", "bulge"} if allow_bulge else {"x", "y"}
    if set(value) - allowed or "x" not in value or "y" not in value:
        raise HTTPException(status_code=400, detail=f"{label} needs x and y")
    cleaned = {
        "x": _plain_number(value["x"], f"{label} x"),
        "y": _plain_number(value["y"], f"{label} y"),
    }
    if allow_bulge and "bulge" in value and value["bulge"] not in (None, 0):
        bulge = _plain_number(value["bulge"], f"{label} bulge")
        if bulge != 0:
            cleaned["bulge"] = bulge
    return cleaned


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
    cleaned = {"points": [_point(point, "A point", allow_bulge=True) for point in points]}
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
    if kind not in CIRCLE_KINDS:
        if diam is not None:
            raise HTTPException(status_code=400, detail="diam is only for a pot or tree")
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
        {
            "kind": parsed["kind"],
            "w": parsed["w"],
            "h": parsed["h"],
            "diam": parsed["diam"],
            "outline": outline,
        }
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
                outline = ?,
                removed = 0
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


def _orphan_clause() -> str:
    """Removed beds with no crop history and no calendar entries on the bed."""
    return """
        bed.removed = 1
        AND NOT EXISTS (
            SELECT 1 FROM beds_crops WHERE beds_crops.bed_id = bed.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM calendar_entry WHERE calendar_entry.bed_id = bed.id
        )
    """


def list_orphan_beds() -> list[dict]:
    with closing(connect()) as connection:
        rows = connection.execute(
            f"""
            SELECT id, name, kind, area_sqft
            FROM bed
            WHERE {_orphan_clause()}
            ORDER BY id
            """
        ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "name": row["name"] or "",
            "kind": row["kind"],
            "areaSqFt": row["area_sqft"],
        }
        for row in rows
    ]


def purge_orphan_bed(bed_id: int) -> None:
    """Hard-delete a removed bed that has no crop or calendar history."""
    with closing(connect()) as connection:
        row = connection.execute(
            f"SELECT id FROM bed WHERE id = ? AND {_orphan_clause()}",
            (bed_id,),
        ).fetchone()
        if row is None:
            found = connection.execute(
                "SELECT id, removed FROM bed WHERE id = ?",
                (bed_id,),
            ).fetchone()
            if found is None:
                raise HTTPException(status_code=404, detail="Bed not found")
            raise HTTPException(status_code=400, detail="Bed is not an orphan")
        connection.execute(
            "UPDATE care_rule SET bed_id = NULL WHERE bed_id = ?",
            (bed_id,),
        )
        connection.execute("DELETE FROM bed WHERE id = ?", (bed_id,))
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


@router.get("/beds/orphans")
def get_orphan_beds() -> list:
    return list_orphan_beds()


@router.delete("/beds/orphans/{bed_id}")
def delete_orphan_bed(bed_id: str) -> Response:
    purge_orphan_bed(require_row_id(bed_id, "Bed not found"))
    return Response(status_code=204)


@router.put("/beds")
async def put_bed(request: Request) -> dict:
    return create_bed(await read_json_body(request))


def crop_name(body: dict) -> str:
    if set(body) != {"name"} or not isinstance(body.get("name"), str) or not body["name"].strip():
        raise HTTPException(status_code=400, detail="Crop assignment needs a name")
    return body["name"].strip()


@router.put("/beds/{bed_id}/crops")
async def put_bed_crop(bed_id: str, request: Request) -> dict:
    from beds_crops import assign_crop

    return assign_crop(
        require_row_id(bed_id, "Bed not found"),
        crop_name(await read_json_body(request)),
    )


@router.put("/beds/{bed_id}/crops/archive")
async def put_bed_crop_archive(bed_id: str, request: Request) -> Response:
    from beds_crops import archive_crop

    archive_crop(
        require_row_id(bed_id, "Bed not found"),
        crop_name(await read_json_body(request)),
    )
    return Response(status_code=204)


@router.put("/beds/{bed_id}")
async def put_bed_id(bed_id: str, request: Request) -> dict:
    return update_bed(require_row_id(bed_id, "Bed not found"), await read_json_body(request))


@router.delete("/beds/{bed_id}")
def delete_bed(bed_id: str) -> Response:
    hide_bed(require_row_id(bed_id, "Bed not found"))
    return Response(status_code=204)


@router.put("/obstacles")
async def put_obstacle(request: Request) -> dict:
    return create_obstacle(await read_json_body(request))


@router.put("/obstacles/{obstacle_id}")
async def put_obstacle_id(obstacle_id: str, request: Request) -> dict:
    return update_obstacle(
        require_row_id(obstacle_id, "Obstacle not found"),
        await read_json_body(request),
    )


@router.delete("/obstacles/{obstacle_id}")
def delete_obstacle_route(obstacle_id: str) -> Response:
    delete_obstacle(require_row_id(obstacle_id, "Obstacle not found"))
    return Response(status_code=204)
