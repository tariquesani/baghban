"""Baghban garden plan API.

One garden, one row. Garden size and the plot live in columns on that row.
Crop assignments live in beds_crops. A garden read also
assembles the bed and obstacle rows. Run from this directory:

    uvicorn app:app --host 127.0.0.1 --port 8000
"""

import json
import os
import re
import sqlite3
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response

from beds import create_scene_tables, drop_plant_grid, garden_contents, router as beds_router
from beds_crops import copy_document_plants, create_beds_crops
from calendar_entries import create_calendar_tables, router as calendar_router
from crops import create_crop_tables, seed_crops, router as crops_router

MAX_BYTES = 2 * 1024 * 1024
MAX_PHOTO_BYTES = 15 * 1024 * 1024
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
                saved_at        TEXT NOT NULL
            )
            """
        )
        create_scene_tables(connection)
        create_calendar_tables(connection)
        create_crop_tables(connection)
        seed_crops(connection)
        create_beds_crops(connection)
        drop_plant_grid(connection)
        copy_document_plants(connection)
        connection.commit()


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
               calibration
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
app.include_router(beds_router, prefix="/api")
app.include_router(calendar_router, prefix="/api")
app.include_router(crops_router, prefix="/api")


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


@app.get("/api/garden")
def get_garden() -> Response:
    payload = read_garden()
    if payload is None:
        return Response(status_code=204)
    return JSONResponse(payload)


@app.put("/api/garden")
async def put_garden(request: Request) -> dict:
    raw = await limited_body(request, MAX_BYTES, "Plan is larger than 2 MB")
    garden, plot = parse_settings(read_json_object(raw))
    return save_settings(garden, plot)


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


@app.put("/api/photos/{photo_id}")
async def put_photo(photo_id: str, request: Request) -> dict:
    require_photo_id(photo_id)
    raw = await request.body()
    reject_oversized(request, raw, MAX_PHOTO_BYTES, "Photo is larger than 15 MB")
    if not raw:
        raise HTTPException(status_code=400, detail="Photo is empty")
    return {"url": write_photo(photo_id, raw)}


@app.delete("/api/photos/{photo_id}")
def delete_photo(photo_id: str) -> Response:
    require_photo_id(photo_id)
    found = find_photo(photo_id)
    if found is not None:
        found.unlink()
    return Response(status_code=204)


@app.get("/api/photos/{photo_id}")
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
    return FileResponse(path, media_type=media_type)
