"""Session cookie and API-token auth for the garden API.

Username and password live in SQLite (default admin/admin on first boot).
Session secret and API token are generated beside the database on first boot
(or taken from BAGHBAN_SESSION_SECRET / BAGHBAN_API_TOKEN when set). Login and
logout stay public; every other /api route uses require_auth.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from http_util import read_json_body

COOKIE_NAME = "baghban_session"
COOKIE_MAX_AGE = 30 * 24 * 60 * 60
SESSION_SALT = "baghban-session"
SESSION_SECRET_FILE = "session.secret"
API_TOKEN_FILE = "api.token"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("baghban.auth")

_session_secret: str | None = None
_api_token: str | None = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def auth_data_dir() -> Path:
    from app import database_path

    path = database_path().parent
    path.mkdir(parents=True, exist_ok=True)
    return path


def _env_nonempty(name: str) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _read_or_create_secret(path: Path, *, nbytes: int, label: str) -> str:
    if path.is_file():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    value = secrets.token_urlsafe(nbytes)
    path.write_text(value + "\n", encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    logger.warning(
        "Generated %s at %s. Keep this file private. "
        "Override with the matching BAGHBAN_* env var if you prefer.",
        label,
        path,
    )
    if label == "API token":
        logger.warning("API token for scripts: %s", value)
    return value


def reset_auth_secrets_cache() -> None:
    """Clear in-memory secrets (tests)."""
    global _session_secret, _api_token
    _session_secret = None
    _api_token = None


def ensure_auth_secrets() -> tuple[str, str]:
    """Load or create session secret and API token; env wins when non-empty."""
    global _session_secret, _api_token

    session = _env_nonempty("BAGHBAN_SESSION_SECRET")
    if session is None:
        if _session_secret is None:
            _session_secret = _read_or_create_secret(
                auth_data_dir() / SESSION_SECRET_FILE,
                nbytes=32,
                label="session secret",
            )
        session = _session_secret
    else:
        _session_secret = session

    token = _env_nonempty("BAGHBAN_API_TOKEN")
    if token is None:
        if _api_token is None:
            _api_token = _read_or_create_secret(
                auth_data_dir() / API_TOKEN_FILE,
                nbytes=32,
                label="API token",
            )
        token = _api_token
    else:
        _api_token = token

    return session, token


def session_secret() -> str:
    secret, _ = ensure_auth_secrets()
    return secret


def api_token() -> str:
    _, token = ensure_auth_secrets()
    return token


def api_token_managed_by_env() -> bool:
    return _env_nonempty("BAGHBAN_API_TOKEN") is not None


def regenerate_api_token_file() -> str:
    """Write a new api.token beside the database. Refuses when env owns the token."""
    global _api_token
    if api_token_managed_by_env():
        raise HTTPException(
            status_code=400,
            detail=(
                "API token is set by BAGHBAN_API_TOKEN. "
                "Unset that environment variable to regenerate the file token."
            ),
        )
    path = auth_data_dir() / API_TOKEN_FILE
    value = secrets.token_urlsafe(32)
    path.write_text(value + "\n", encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    _api_token = value
    logger.warning("Regenerated API token at %s", path)
    return value


def create_auth_table(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS app_auth (
            id              INTEGER PRIMARY KEY CHECK (id = 1),
            username        TEXT NOT NULL,
            password_hash   TEXT NOT NULL,
            session_version INTEGER NOT NULL DEFAULT 1,
            updated_at      TEXT NOT NULL
        )
        """
    )


def hash_password(password: str, salt: bytes | None = None) -> str:
    if salt is None:
        salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return f"scrypt${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt_hex, hash_hex = stored.split("$", 2)
    except ValueError:
        return False
    if algorithm != "scrypt":
        return False
    try:
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
    except ValueError:
        return False
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=len(expected),
    )
    return hmac.compare_digest(derived, expected)


def bootstrap_credentials(connection) -> None:
    create_auth_table(connection)
    row = connection.execute("SELECT id FROM app_auth WHERE id = 1").fetchone()
    if row is not None:
        return
    username = _env_nonempty("BAGHBAN_USERNAME") or DEFAULT_USERNAME
    password = _env_nonempty("BAGHBAN_PASSWORD") or DEFAULT_PASSWORD
    connection.execute(
        """
        INSERT INTO app_auth (id, username, password_hash, session_version, updated_at)
        VALUES (1, ?, ?, 1, ?)
        """,
        (username, hash_password(password), _utc_now()),
    )
    if username == DEFAULT_USERNAME and password == DEFAULT_PASSWORD:
        logger.warning(
            "Bootstrapped login as %s / %s — change this in Settings → Account.",
            DEFAULT_USERNAME,
            DEFAULT_PASSWORD,
        )


def read_auth_row(connection):
    return connection.execute(
        """
        SELECT username, password_hash, session_version
        FROM app_auth
        WHERE id = 1
        """
    ).fetchone()


def credentials_ready(connection) -> bool:
    return read_auth_row(connection) is not None


def ensure_ready() -> None:
    ensure_auth_secrets()
    from app import connect

    with closing(connect()) as connection:
        bootstrap_credentials(connection)
        connection.commit()
        if not credentials_ready(connection):
            raise HTTPException(
                status_code=503,
                detail="Auth credentials missing",
            )


def serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(session_secret(), salt=SESSION_SALT)


def make_session_token(username: str, session_version: int) -> str:
    return serializer().dumps({"u": username, "v": int(session_version)})


def read_session_cookie(request: Request) -> dict | None:
    raw = request.cookies.get(COOKIE_NAME)
    if not raw:
        return None
    try:
        payload = serializer().loads(raw, max_age=COOKIE_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    if not isinstance(payload, dict):
        return None
    username = payload.get("u")
    version = payload.get("v")
    if not isinstance(username, str) or not isinstance(version, int):
        return None
    return {"username": username, "session_version": version}


def session_still_valid(username: str, session_version: int) -> bool:
    from app import connect

    with closing(connect()) as connection:
        row = read_auth_row(connection)
    if row is None:
        return False
    return row["username"] == username and int(row["session_version"]) == int(session_version)


def bearer_ok(request: Request) -> bool:
    expected = api_token()
    if not expected:
        return False
    header = request.headers.get("authorization") or ""
    if not header.lower().startswith("bearer "):
        return False
    offered = header[7:].strip()
    if not offered:
        return False
    return hmac.compare_digest(offered, expected)


def set_session_cookie(response: Response, username: str, session_version: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=make_session_token(username, session_version),
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def require_auth(request: Request) -> dict:
    ensure_ready()
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        offered = header[7:].strip()
        if not offered:
            raise HTTPException(
                status_code=401,
                detail="Empty API token. Use the token from api.token beside the database, or set BAGHBAN_API_TOKEN.",
            )
        if bearer_ok(request):
            from app import connect

            with closing(connect()) as connection:
                row = read_auth_row(connection)
            username = row["username"] if row else ""
            return {"username": username, "via": "bearer"}
        raise HTTPException(status_code=401, detail="Unauthorized")
    session = read_session_cookie(request)
    if session and session_still_valid(session["username"], session["session_version"]):
        return {"username": session["username"], "via": "cookie"}
    raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/login")
async def login(request: Request) -> Response:
    ensure_ready()
    body = await read_json_body(request)
    username = body.get("username")
    password = body.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        raise HTTPException(status_code=400, detail="username and password are required")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password are required")

    from app import connect

    with closing(connect()) as connection:
        row = read_auth_row(connection)
    if row is None or row["username"] != username or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    response = JSONResponse({"ok": True})
    set_session_cookie(response, row["username"], int(row["session_version"]))
    return response


@router.post("/logout")
def logout() -> Response:
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


@router.get("/me")
def me(auth: dict = Depends(require_auth)) -> dict:
    return {"authenticated": True, "username": auth["username"]}


@router.get("/token")
def read_token(_auth: dict = Depends(require_auth)) -> dict:
    ensure_ready()
    return {
        "token": api_token(),
        "managedByEnv": api_token_managed_by_env(),
    }


@router.post("/token/regenerate")
def regenerate_token(_auth: dict = Depends(require_auth)) -> dict:
    ensure_ready()
    token = regenerate_api_token_file()
    return {"token": token, "managedByEnv": False}


@router.put("/credentials")
async def update_credentials(
    request: Request,
    _auth: dict = Depends(require_auth),
) -> Response:
    body = await read_json_body(request)
    current_password = body.get("currentPassword")
    if not isinstance(current_password, str) or not current_password:
        raise HTTPException(status_code=400, detail="currentPassword is required")

    new_username = body.get("username")
    new_password = body.get("newPassword")
    if new_username is not None and (not isinstance(new_username, str) or not new_username.strip()):
        raise HTTPException(status_code=400, detail="username must be a non-empty string")
    if new_password is not None and (not isinstance(new_password, str) or not new_password):
        raise HTTPException(status_code=400, detail="newPassword must be a non-empty string")
    if new_username is None and new_password is None:
        raise HTTPException(status_code=400, detail="Provide username and/or newPassword")

    from app import connect

    with closing(connect()) as connection:
        row = read_auth_row(connection)
        if row is None or not verify_password(current_password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        username = new_username.strip() if isinstance(new_username, str) else row["username"]
        password_hash = hash_password(new_password) if new_password else row["password_hash"]
        session_version = int(row["session_version"])
        if new_password:
            session_version += 1

        connection.execute(
            """
            UPDATE app_auth
            SET username = ?, password_hash = ?, session_version = ?, updated_at = ?
            WHERE id = 1
            """,
            (username, password_hash, session_version, _utc_now()),
        )
        connection.commit()

    response = JSONResponse({"ok": True, "username": username})
    # Keep this browser session valid; bump invalidates other cookies when password changed.
    set_session_cookie(response, username, session_version)
    return response
