"""Baghban garden plan API.

One garden, one row. Garden size and the plot live in columns on that row.
Crop assignments live in beds_crops. A garden read also
assembles the bed and obstacle rows. Run from this directory:

    uvicorn app:app --host 127.0.0.1 --port 8000

When frontend/dist contains index.html, this process also serves that build.
"""

import json
import math
import os
import re
import sqlite3
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from auth import (
    bootstrap_credentials,
    create_auth_table,
    ensure_auth_secrets,
    require_auth,
    router as auth_router,
)
from beds import create_scene_tables, drop_plant_grid, garden_contents, router as beds_router
from beds_crops import (
    archive_all_crops,
    archive_bed_crops,
    copy_document_plants,
    create_beds_crops,
)
from calendar_entries import create_calendar_tables, router as calendar_router
from care_rules import router as care_rules_router
from crops import create_crop_tables, seed_crops, router as crops_router
from migrate import migrate
import sky

MAX_BYTES = 2 * 1024 * 1024
MAX_PHOTO_BYTES = 15 * 1024 * 1024
PHOTO_CACHE_CONTROL = "public, max-age=31536000"
SCENE_FIELDS = ("beds", "obstacles", "nextId")
DEFAULT_DB = Path(__file__).resolve().parent / "data" / "baghban.db"


def database_path() -> Path:
    override = os.environ.get("BAGHBAN_DB")
    if override:
        return Path(override)
    return DEFAULT_DB


PHOTO_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,80}")
PHOTO_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def photos_dir() -> Path:
    path = database_path().parent / "photos"
    path.mkdir(parents=True, exist_ok=True)
    return path


def image_media_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def require_photo_id(photo_id: str) -> str:
    if not PHOTO_ID.fullmatch(photo_id):
        raise HTTPException(status_code=400, detail="Invalid photo id")
    return photo_id


def find_photo(photo_id: str) -> Path | None:
    folder = photos_dir()
    for suffix in PHOTO_EXTENSIONS.values():
        candidate = folder / f"{photo_id}{suffix}"
        if candidate.is_file():
            return candidate
    return None


def write_photo(photo_id: str, data: bytes) -> str:
    media_type = image_media_type(data)
    if media_type is None:
        raise HTTPException(status_code=400, detail="Photo must be a JPEG, PNG, or WebP")
    suffix = PHOTO_EXTENSIONS[media_type]
    folder = photos_dir()
    for other in PHOTO_EXTENSIONS.values():
        if other == suffix:
            continue
        stale = folder / f"{photo_id}{other}"
        if stale.is_file():
            stale.unlink()
    destination = folder / f"{photo_id}{suffix}"
    temporary = destination.with_name(destination.name + ".tmp")
    temporary.write_bytes(data)
    temporary.replace(destination)
    return f"/api/photos/{photo_id}"


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    migrate(path)
    with closing(connect()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS garden_plan (
                id              INTEGER PRIMARY KEY CHECK (id = 1),
                width           REAL,
                height          REAL,
                scale           TEXT,
                width_text      TEXT NOT NULL DEFAULT '',
                height_text     TEXT NOT NULL DEFAULT '',
                plot_id         TEXT,
                photo_url       TEXT,
                width_px        INTEGER,
                height_px       INTEGER,
                feet_per_pixel  REAL,
                calibration     TEXT,
                name            TEXT NOT NULL DEFAULT '',
                subtitle        TEXT NOT NULL DEFAULT '',
                latitude        REAL,
                longitude       REAL,
                timezone        TEXT NOT NULL DEFAULT '',
                saved_at        TEXT NOT NULL
            )
            """
        )
        ensure_garden_identity(connection)
        create_scene_tables(connection)
        create_calendar_tables(connection)
        create_crop_tables(connection)
        seed_crops(connection)
        create_beds_crops(connection)
        drop_plant_grid(connection)
        copy_document_plants(connection)
        create_auth_table(connection)
        bootstrap_credentials(connection)
        connection.commit()
    ensure_auth_secrets()


def ensure_garden_identity(connection) -> None:
    """Add name and place columns to a garden row created before them."""
    columns = {row[1] for row in connection.execute("PRAGMA table_info(garden_plan)")}
    additions = (
        ("name", "TEXT NOT NULL DEFAULT ''"),
        ("subtitle", "TEXT NOT NULL DEFAULT ''"),
        ("latitude", "REAL"),
        ("longitude", "REAL"),
        ("timezone", "TEXT NOT NULL DEFAULT ''"),
    )
    for name, declaration in additions:
        if name not in columns:
            connection.execute(f"ALTER TABLE garden_plan ADD COLUMN {name} {declaration}")


def json_real(value):
    """Return a whole number as an int so a saved 20 comes back as 20."""
    if value is None:
        return None
    number = float(value)
    if number.is_integer():
        return int(number)
    return number


def calibration_value(raw):
    if raw is None or raw == "":
        return None
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        return None
    return parsed


def assemble(connection, row) -> dict:
    beds, obstacles = garden_contents(connection)
    return {
        "garden": {
            "width": json_real(row["width"]),
            "height": json_real(row["height"]),
            "scale": row["scale"],
            "widthText": row["width_text"],
            "heightText": row["height_text"],
            "name": row["name"] or "",
            "subtitle": row["subtitle"] or "",
            "latitude": json_real(row["latitude"]),
            "longitude": json_real(row["longitude"]),
            "timezone": row["timezone"] or "",
        },
        "plot": {
            "plotId": row["plot_id"],
            "photoUrl": row["photo_url"],
            "widthPx": row["width_px"],
            "heightPx": row["height_px"],
            "feetPerPixel": json_real(row["feet_per_pixel"]),
            "calibration": calibration_value(row["calibration"]),
        },
        "beds": beds,
        "obstacles": obstacles,
    }


def fetch_garden(connection):
    return connection.execute(
        """
        SELECT width, height, scale, width_text, height_text,
               plot_id, photo_url, width_px, height_px, feet_per_pixel,
               calibration, name, subtitle, latitude, longitude, timezone
        FROM garden_plan
        WHERE id = 1
        """
    ).fetchone()


def empty_garden() -> dict:
    """Settings before the one garden row has been saved."""
    return {
        "width": None,
        "height": None,
        "scale": None,
        "width_text": "",
        "height_text": "",
        "plot_id": None,
        "photo_url": None,
        "width_px": None,
        "height_px": None,
        "feet_per_pixel": None,
        "calibration": None,
        "name": "",
        "subtitle": "",
        "latitude": None,
        "longitude": None,
        "timezone": "",
    }


def read_garden() -> dict | None:
    with closing(connect()) as connection:
        row = fetch_garden(connection)
        if row is None:
            beds, obstacles = garden_contents(connection)
            if not beds and not obstacles:
                return None
            row = empty_garden()
        return assemble(connection, row)


def read_json_object(raw: bytes) -> dict:
    if not raw:
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Body must be JSON") from None
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    return body


def optional_real(mapping: dict, key: str):
    if key not in mapping or mapping[key] is None:
        return None
    value = mapping[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail=f"{key} must be a number")
    return float(value)


def optional_int(mapping: dict, key: str):
    if key not in mapping or mapping[key] is None:
        return None
    value = mapping[key]
    if isinstance(value, bool) or not isinstance(value, int):
        raise HTTPException(status_code=400, detail=f"{key} must be an integer")
    return value


def text_field(mapping: dict, key: str) -> str:
    if key not in mapping or mapping[key] is None:
        return ""
    value = mapping[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be text")
    return value


def blank_text(mapping: dict, key: str) -> str | None:
    if key not in mapping or mapping[key] is None or mapping[key] == "":
        return None
    value = mapping[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be text")
    return value


def garden_columns(garden) -> tuple:
    if garden is None:
        garden = {}
    if not isinstance(garden, dict):
        raise HTTPException(status_code=400, detail="garden must be an object")
    scale = garden.get("scale")
    if scale is None or scale == "":
        scale = None
    elif not isinstance(scale, str):
        raise HTTPException(status_code=400, detail="scale must be text")
    return (
        optional_real(garden, "width"),
        optional_real(garden, "height"),
        scale,
        text_field(garden, "widthText"),
        text_field(garden, "heightText"),
    )


def calibration_text(value) -> str | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="calibration must be an object")
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def plot_columns(plot) -> tuple:
    empty = (None, None, None, None, None, None)
    if plot is None:
        plot = {}
    if not isinstance(plot, dict):
        raise HTTPException(status_code=400, detail="plot must be an object")
    plot_id = blank_text(plot, "plotId")
    if plot_id is None:
        return empty
    return (
        plot_id,
        blank_text(plot, "photoUrl"),
        optional_int(plot, "widthPx"),
        optional_int(plot, "heightPx"),
        optional_real(plot, "feetPerPixel"),
        calibration_text(plot.get("calibration") if "calibration" in plot else None),
    )


def parse_settings(body: dict) -> tuple:
    if any(field in body for field in SCENE_FIELDS):
        raise HTTPException(
            status_code=400,
            detail="Garden save cannot include beds, obstacles, or nextId",
        )
    extra = [key for key in body if key not in ("garden", "plot")]
    if extra:
        raise HTTPException(
            status_code=400,
            detail="Garden save accepts garden and plot only",
        )
    return garden_columns(body.get("garden")), plot_columns(body.get("plot"))


def identity_text(body: dict, key: str, limit: int) -> str:
    if key not in body or body[key] is None:
        return ""
    value = body[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be text")
    value = value.strip()
    if len(value) > limit:
        raise HTTPException(status_code=400, detail=f"{key} is too long")
    return value


def coordinate_field(value, name: str, low: float, high: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail=f"{name} must be a number")
    number = float(value)
    if not math.isfinite(number) or number < low or number > high:
        raise HTTPException(
            status_code=400,
            detail=f"{name} must be between {low:g} and {high:g}",
        )
    return number


_timezone_finder = None


def known_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="timezone is not a known IANA name") from None
    return value


def timezone_for_coordinates(latitude: float, longitude: float) -> str:
    """IANA name for a point. The client does not choose it."""
    global _timezone_finder
    if _timezone_finder is None:
        from timezonefinder import TimezoneFinder

        _timezone_finder = TimezoneFinder()
    name = _timezone_finder.timezone_at(lng=longitude, lat=latitude)
    if not name:
        raise HTTPException(status_code=400, detail="No timezone matches this place")
    return known_timezone(name)


def parse_identity(body: dict) -> dict:
    required = {"name", "subtitle", "latitude", "longitude"}
    allowed = required | {"timezone"}
    if any(key not in body for key in required):
        raise HTTPException(
            status_code=400,
            detail="Garden identity needs name, subtitle, latitude, and longitude",
        )
    extra = [key for key in body if key not in allowed]
    if extra:
        raise HTTPException(
            status_code=400,
            detail="Garden identity accepts name, subtitle, latitude, and longitude only",
        )
    name = identity_text(body, "name", 80)
    subtitle = identity_text(body, "subtitle", 160)
    latitude = body.get("latitude")
    longitude = body.get("longitude")
    if latitude is None and longitude is None:
        return {
            "name": name,
            "subtitle": subtitle,
            "latitude": None,
            "longitude": None,
            "timezone": "",
        }
    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=400,
            detail="A place needs a latitude and a longitude",
        )
    lat = coordinate_field(latitude, "latitude", -90, 90)
    lon = coordinate_field(longitude, "longitude", -180, 180)
    return {
        "name": name,
        "subtitle": subtitle,
        "latitude": lat,
        "longitude": lon,
        "timezone": timezone_for_coordinates(lat, lon),
    }


def save_identity(body: dict) -> dict:
    identity = parse_identity(body)
    saved_at = datetime.now(timezone.utc).isoformat()
    values = (
        identity["name"],
        identity["subtitle"],
        identity["latitude"],
        identity["longitude"],
        identity["timezone"],
        saved_at,
    )
    with closing(connect()) as connection:
        existing = connection.execute("SELECT id FROM garden_plan WHERE id = 1").fetchone()
        if existing is None:
            connection.execute(
                """
                INSERT INTO garden_plan (
                    id, name, subtitle, latitude, longitude, timezone, saved_at
                ) VALUES (1, ?, ?, ?, ?, ?, ?)
                """,
                values,
            )
        else:
            connection.execute(
                """
                UPDATE garden_plan SET
                    name = ?,
                    subtitle = ?,
                    latitude = ?,
                    longitude = ?,
                    timezone = ?,
                    saved_at = ?
                WHERE id = 1
                """,
                values,
            )
        row = fetch_garden(connection)
        payload = assemble(connection, row)
        connection.commit()
    return payload


def discard_plot_photo(plot_id: str | None) -> None:
    if not plot_id or not PHOTO_ID.fullmatch(plot_id):
        return
    found = find_photo(plot_id)
    if found is not None:
        found.unlink()


def reset_garden() -> dict | None:
    """Clear the plan and its scale. The name and place stay."""
    saved_at = datetime.now(timezone.utc).isoformat()
    plot_id = None
    with closing(connect()) as connection:
        row = connection.execute(
            "SELECT plot_id FROM garden_plan WHERE id = 1"
        ).fetchone()
        if row is not None:
            plot_id = row["plot_id"]
            connection.execute(
                """
                UPDATE garden_plan SET
                    width = NULL,
                    height = NULL,
                    scale = NULL,
                    width_text = '',
                    height_text = '',
                    plot_id = NULL,
                    photo_url = NULL,
                    width_px = NULL,
                    height_px = NULL,
                    feet_per_pixel = NULL,
                    calibration = NULL,
                    saved_at = ?
                WHERE id = 1
                """,
                (saved_at,),
            )
        for bed in connection.execute("SELECT id FROM bed WHERE removed = 0"):
            connection.execute("UPDATE bed SET removed = 1 WHERE id = ?", (bed["id"],))
            archive_bed_crops(connection, int(bed["id"]))
        connection.execute("DELETE FROM obstacle")
        connection.commit()
    discard_plot_photo(plot_id)
    return read_garden()


def uproot_all_plants() -> dict | None:
    """Clear every active crop from every bed. Layout and scale stay."""
    with closing(connect()) as connection:
        archive_all_crops(connection)
        connection.commit()
    return read_garden()


def save_settings(garden: tuple, plot: tuple) -> dict:
    saved_at = datetime.now(timezone.utc).isoformat()
    with closing(connect()) as connection:
        connection.execute(
            """
            INSERT INTO garden_plan (
                id, width, height, scale, width_text, height_text,
                plot_id, photo_url, width_px, height_px, feet_per_pixel,
                calibration, saved_at
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                width = excluded.width,
                height = excluded.height,
                scale = excluded.scale,
                width_text = excluded.width_text,
                height_text = excluded.height_text,
                plot_id = excluded.plot_id,
                photo_url = excluded.photo_url,
                width_px = excluded.width_px,
                height_px = excluded.height_px,
                feet_per_pixel = excluded.feet_per_pixel,
                calibration = excluded.calibration,
                saved_at = excluded.saved_at
            """,
            (*garden, *plot, saved_at),
        )
        row = fetch_garden(connection)
        payload = assemble(connection, row)
        connection.commit()
    return payload


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.include_router(auth_router, prefix="/api")
_api_auth = [Depends(require_auth)]
app.include_router(beds_router, prefix="/api", dependencies=_api_auth)
app.include_router(calendar_router, prefix="/api", dependencies=_api_auth)
app.include_router(care_rules_router, prefix="/api", dependencies=_api_auth)
app.include_router(crops_router, prefix="/api", dependencies=_api_auth)


async def limited_body(request: Request, limit: int, too_big: str) -> bytes:
    announced = request.headers.get("content-length")
    if announced is not None:
        try:
            announced_size = int(announced)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length") from None
        if announced_size > limit:
            raise HTTPException(status_code=413, detail=too_big)
    raw = await request.body()
    if len(raw) > limit:
        raise HTTPException(status_code=413, detail=too_big)
    return raw


@app.get("/api/sky", dependencies=_api_auth)
def get_sky(timezone: str = "") -> dict:
    payload = read_garden()
    garden = payload["garden"] if payload else {}
    return sky.sky_reading(garden, timezone, sky.fetch_yr)


@app.get("/api/garden", dependencies=_api_auth)
def get_garden() -> Response:
    payload = read_garden()
    if payload is None:
        return Response(status_code=204)
    return JSONResponse(payload)


@app.put("/api/garden", dependencies=_api_auth)
async def put_garden(request: Request) -> dict:
    raw = await limited_body(request, MAX_BYTES, "Plan is larger than 2 MB")
    garden, plot = parse_settings(read_json_object(raw))
    return save_settings(garden, plot)


@app.put("/api/garden/identity", dependencies=_api_auth)
async def put_garden_identity(request: Request) -> dict:
    raw = await limited_body(request, MAX_BYTES, "Plan is larger than 2 MB")
    return save_identity(read_json_object(raw))


@app.post("/api/garden/reset", dependencies=_api_auth)
def post_garden_reset() -> Response:
    payload = reset_garden()
    if payload is None:
        return Response(status_code=204)
    return JSONResponse(payload)


@app.post("/api/garden/uproot-plants", dependencies=_api_auth)
def post_garden_uproot_plants() -> Response:
    payload = uproot_all_plants()
    if payload is None:
        return Response(status_code=204)
    return JSONResponse(payload)


def reject_oversized(request: Request, raw: bytes, limit: int, message: str) -> None:
    announced = request.headers.get("content-length")
    if announced is not None:
        try:
            announced_size = int(announced)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length") from None
        if announced_size > limit:
            raise HTTPException(status_code=413, detail=message)
    if len(raw) > limit:
        raise HTTPException(status_code=413, detail=message)


@app.put("/api/photos/{photo_id}", dependencies=_api_auth)
async def put_photo(photo_id: str, request: Request) -> dict:
    require_photo_id(photo_id)
    raw = await request.body()
    reject_oversized(request, raw, MAX_PHOTO_BYTES, "Photo is larger than 15 MB")
    if not raw:
        raise HTTPException(status_code=400, detail="Photo is empty")
    return {"url": write_photo(photo_id, raw)}


@app.delete("/api/photos/{photo_id}", dependencies=_api_auth)
def delete_photo(photo_id: str) -> Response:
    require_photo_id(photo_id)
    found = find_photo(photo_id)
    if found is not None:
        found.unlink()
    return Response(status_code=204)


@app.get("/api/photos/{photo_id}", dependencies=_api_auth)
def get_photo(photo_id: str) -> FileResponse:
    require_photo_id(photo_id)
    path = find_photo(photo_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    media_type = {
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }[path.suffix]
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": PHOTO_CACHE_CONTROL},
    )


def frontend_dist() -> Path | None:
    override = os.environ.get("BAGHBAN_DIST")
    path = Path(override) if override else Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if (path / "index.html").is_file():
        return path.resolve()
    return None


def frontend_file(full_path: str) -> Path:
    """Return a built file, or index.html for a client-side route."""
    root = frontend_dist()
    if root is None:
        raise HTTPException(status_code=404, detail="Not found")
    relative = full_path.strip("/")
    if relative == "api" or relative.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    if relative:
        candidate = (root / relative).resolve()
        if candidate != root and root not in candidate.parents:
            raise HTTPException(status_code=404, detail="Not found")
        if candidate.is_file():
            return candidate
        if Path(relative).suffix:
            raise HTTPException(status_code=404, detail="Not found")
    return root / "index.html"


@app.get("/", include_in_schema=False)
def frontend_index() -> FileResponse:
    return FileResponse(frontend_file(""))


@app.get("/{full_path:path}", include_in_schema=False)
def frontend_path(full_path: str) -> FileResponse:
    return FileResponse(frontend_file(full_path))
