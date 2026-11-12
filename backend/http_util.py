"""Shared HTTP body helpers for the garden API.

Routers parse JSON and field values here. Domain rules (entry kinds, crop
fields, identity) stay in their modules. Errors stay HTTP 400 with a short
string detail, matching the rest of the API.
"""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import HTTPException, Request

# Default cap for JSON write bodies (garden plan, beds, calendar, auth, …).
MAX_JSON_BYTES = 2 * 1024 * 1024
JSON_TOO_BIG = "Request body is larger than 2 MB"


def read_json_object(raw: bytes) -> dict:
    """Parse a JSON object body. Empty or non-object bodies are rejected."""
    if not raw:
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Body must be JSON") from None
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    return body


# Older call sites used this name.
parse_body = read_json_object


def text_field(mapping: dict, key: str, *, strip: bool = False) -> str:
    if key not in mapping or mapping[key] is None:
        return ""
    value = mapping[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be a string")
    return value.strip() if strip else value


def blank_text(mapping: dict, key: str) -> str | None:
    if key not in mapping or mapping[key] is None or mapping[key] == "":
        return None
    value = mapping[key]
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{key} must be a string")
    return value


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


def number_field(
    body: dict,
    key: str,
    *,
    whole: bool = False,
    non_negative: bool = False,
):
    if key not in body or body[key] is None:
        return None
    value = body[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HTTPException(status_code=400, detail=f"{key} must be a number")
    if non_negative and value < 0:
        raise HTTPException(status_code=400, detail=f"{key} must be zero or more")
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


async def read_json_body(
    request: Request,
    *,
    limit: int | None = None,
    too_big: str = JSON_TOO_BIG,
) -> dict:
    """Read a JSON object body, rejecting payloads over the size limit."""
    cap = MAX_JSON_BYTES if limit is None else limit
    return read_json_object(await limited_body(request, cap, too_big))


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
