from fastapi.testclient import TestClient

from app import app


def test_gzip_compresses_large_static_assets(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Baghban</title>", encoding="utf-8")
    payload = ("console.log(1);\n" * 80).encode("utf-8")
    assert len(payload) > 500
    (dist / "assets" / "app.js").write_bytes(payload)
    monkeypatch.setenv("BAGHBAN_DIST", str(dist))

    with TestClient(app) as client:
        response = client.get("/assets/app.js", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    assert response.headers.get("content-encoding") == "gzip"
    assert response.content == payload
    assert int(response.headers["content-length"]) < len(payload)


def test_gzip_skips_small_responses(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>Baghban</title>", encoding="utf-8")
    payload = b"console.log(1);\n"
    assert len(payload) < 500
    (dist / "assets" / "tiny.js").write_bytes(payload)
    monkeypatch.setenv("BAGHBAN_DIST", str(dist))

    with TestClient(app) as client:
        response = client.get("/assets/tiny.js", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    assert response.headers.get("content-encoding") is None
    assert response.content == payload
