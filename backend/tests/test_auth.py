from authed_client import TestClient
from fastapi.testclient import TestClient as RawTestClient

from app import app
from auth import API_TOKEN_FILE, SESSION_SECRET_FILE, reset_auth_secrets_cache


def test_unauthenticated_api_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with RawTestClient(app) as client:
        response = client.get("/api/garden")
        assert response.status_code == 401


def test_secrets_are_generated_beside_database(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    monkeypatch.delenv("BAGHBAN_API_TOKEN", raising=False)
    monkeypatch.delenv("BAGHBAN_SESSION_SECRET", raising=False)
    monkeypatch.delenv("BAGHBAN_USERNAME", raising=False)
    monkeypatch.delenv("BAGHBAN_PASSWORD", raising=False)
    reset_auth_secrets_cache()

    with RawTestClient(app) as client:
        login = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin"},
        )
        assert login.status_code == 200
        assert client.get("/api/garden").status_code == 204

    assert (tmp_path / SESSION_SECRET_FILE).is_file()
    assert (tmp_path / API_TOKEN_FILE).is_file()
    token = (tmp_path / API_TOKEN_FILE).read_text(encoding="utf-8").strip()
    assert token

    with RawTestClient(app) as client:
        empty = client.get("/api/garden", headers={"Authorization": "Bearer "})
        assert empty.status_code == 401
        assert "Empty API token" in empty.json()["detail"]

        ok = client.get("/api/garden", headers={"Authorization": f"Bearer {token}"})
        assert ok.status_code == 204


def test_login_cookie_unlocks_api(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with RawTestClient(app) as client:
        bad = client.post(
            "/api/auth/login",
            json={"username": "gardener", "password": "wrong"},
        )
        assert bad.status_code == 401

        login = client.post(
            "/api/auth/login",
            json={"username": "gardener", "password": "secret"},
        )
        assert login.status_code == 200
        assert "baghban_session" in login.cookies

        me = client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json() == {"authenticated": True, "username": "gardener"}

        garden = client.get("/api/garden")
        assert garden.status_code == 204


def test_bearer_token_unlocks_api(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with TestClient(app) as client:
        response = client.get("/api/garden")
        assert response.status_code == 204


def test_logout_clears_session(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with RawTestClient(app) as client:
        login = client.post(
            "/api/auth/login",
            json={"username": "gardener", "password": "secret"},
        )
        assert login.status_code == 200
        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200
        me = client.get("/api/auth/me")
        assert me.status_code == 401


def test_change_credentials(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with RawTestClient(app) as client:
        login = client.post(
            "/api/auth/login",
            json={"username": "gardener", "password": "secret"},
        )
        assert login.status_code == 200

        wrong = client.put(
            "/api/auth/credentials",
            json={"currentPassword": "nope", "username": "keeper"},
        )
        assert wrong.status_code == 401

        updated = client.put(
            "/api/auth/credentials",
            json={
                "currentPassword": "secret",
                "username": "keeper",
                "newPassword": "new-secret",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["username"] == "keeper"

        me = client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["username"] == "keeper"

    with RawTestClient(app) as other:
        denied = other.post(
            "/api/auth/login",
            json={"username": "gardener", "password": "secret"},
        )
        assert denied.status_code == 401
        ok = other.post(
            "/api/auth/login",
            json={"username": "keeper", "password": "new-secret"},
        )
        assert ok.status_code == 200
