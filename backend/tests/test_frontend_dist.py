from fastapi import HTTPException
from authed_client import TestClient

from app import app, frontend_file


def test_missing_build_is_not_found(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    monkeypatch.setenv("BAGHBAN_DIST", str(tmp_path / "empty"))

    with TestClient(app) as client:
        assert client.get("/").status_code == 404
        assert client.get("/planner").status_code == 404


def test_build_serves_the_app_and_leaves_api_routes_alone(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Baghban</title>", encoding="utf-8")
    (dist / "assets" / "app.js").write_text("console.log(1)\n", encoding="utf-8")
    monkeypatch.setenv("BAGHBAN_DIST", str(dist))

    with TestClient(app) as client:
        home = client.get("/")
        assert home.status_code == 200
        assert "Baghban" in home.text

        calendar = client.get("/calendar")
        assert calendar.status_code == 200
        assert "Baghban" in calendar.text

        asset = client.get("/assets/app.js")
        assert asset.status_code == 200
        assert "console.log" in asset.text

        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/garden").status_code == 204
        assert client.get("/api/does-not-exist").status_code == 404


def test_frontend_file_rejects_paths_outside_the_build(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("ok", encoding="utf-8")
    monkeypatch.setenv("BAGHBAN_DIST", str(dist))

    try:
        frontend_file("../../backend/app.py")
    except HTTPException as exc:
        assert exc.status_code == 404
    else:
        raise AssertionError("path escaped the build directory")
