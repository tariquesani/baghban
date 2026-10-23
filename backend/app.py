"""Baghban garden plan API.

One garden, one row. Run from this directory:

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
from fastapi.responses import FileResponse, Response

MAX_BYTES = 2 * 1024 * 1024
MAX_PHOTO_BYTES = 15 * 1024 * 1024
REQUIRED_FIELDS = ("version", "garden", "beds", "obstacles")
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


def legacy_photo_path() -> Path:
    return database_path().parent / "plot-photo"


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


def migrate_legacy_photo() -> None:
    legacy = legacy_photo_path()
    if not legacy.is_file():
        return
    raw = read_plan()
    if not raw:
        return
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        return
    plot = plan.get("plot")
    photo_id = plot.get("plotId") if isinstance(plot, dict) else None
    if not isinstance(photo_id, str) or not PHOTO_ID.fullmatch(photo_id):
        return
    data = legacy.read_bytes()
    if image_media_type(data) is None:
        return
    url = write_photo(photo_id, data)
    if plot.get("photoUrl") != url:
        plot["photoUrl"] = url
        plan["plot"] = plot
        write_plan(json.dumps(plan, ensure_ascii=False, separators=(",", ":")))
    legacy.unlink()


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS garden_plan (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                document TEXT NOT NULL,
                saved_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def read_plan() -> str | None:
    with closing(connect()) as connection:
        row = connection.execute(
            "SELECT document FROM garden_plan WHERE id = 1"
        ).fetchone()
    if row is None:
        return None
    return row["document"]


def write_plan(document: str) -> None:
    saved_at = datetime.now(timezone.utc).isoformat()
    with closing(connect()) as connection:
        connection.execute(
            """
            INSERT INTO garden_plan (id, document, saved_at)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                document = excluded.document,
                saved_at = excluded.saved_at
            """,
            (document, saved_at),
        )
        connection.commit()


def parse_plan(raw: bytes) -> dict:
    if not raw:
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Body must be JSON") from None
    if not isinstance(plan, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    missing = [field for field in REQUIRED_FIELDS if field not in plan]
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Plan must include version, garden, beds, and obstacles",
        )
    if not isinstance(plan["garden"], dict):
        raise HTTPException(status_code=400, detail="garden must be an object")
    if not isinstance(plan["beds"], list) or not isinstance(plan["obstacles"], list):
        raise HTTPException(
            status_code=400,
            detail="beds and obstacles must be arrays",
        )
    return plan


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    migrate_legacy_photo()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/api/garden")
def get_garden() -> Response:
    document = read_plan()
    if document is None:
        return Response(status_code=204)
    return Response(content=document, media_type="application/json")


@app.put("/api/garden")
async def put_garden(request: Request) -> Response:
    announced = request.headers.get("content-length")
    if announced is not None:
        try:
            announced_size = int(announced)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length") from None
        if announced_size > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Plan is larger than 2 MB")

    raw = await request.body()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Plan is larger than 2 MB")

    plan = parse_plan(raw)
    document = json.dumps(plan, ensure_ascii=False, separators=(",", ":"))
    write_plan(document)
    return Response(content=document, media_type="application/json")


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
