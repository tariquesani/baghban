"""JSON write bodies are capped before parse."""

from authed_client import TestClient

from app import app
from http_util import JSON_TOO_BIG, MAX_JSON_BYTES


def test_json_write_rejects_oversized_content_length(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    monkeypatch.setattr("http_util.MAX_JSON_BYTES", 64)

    with TestClient(app) as client:
        too_big = client.put(
            "/api/beds",
            content=b'{"name":"x","kind":"bed","x":0,"y":0,"w":1,"h":1,"rotation":0,"color":"","notes":""}',
            headers={
                "Content-Type": "application/json",
                "Content-Length": "128",
            },
        )
        assert too_big.status_code == 413
        assert too_big.json()["detail"] == JSON_TOO_BIG


def test_json_write_rejects_oversized_payload(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    limit = 200
    monkeypatch.setattr("http_util.MAX_JSON_BYTES", limit)

    with TestClient(app) as client:
        note = "n" * (limit + 50)
        payload = (
            '{"name":"Bed","kind":"bed","x":0,"y":0,"w":1,"h":1,'
            f'"rotation":0,"color":"","notes":"{note}"}}'
        ).encode()
        assert len(payload) > limit
        too_big = client.put(
            "/api/beds",
            content=payload,
            headers={"Content-Type": "application/json"},
        )
        assert too_big.status_code == 413
        assert too_big.json()["detail"] == JSON_TOO_BIG


def test_default_json_cap_is_two_megabytes():
    assert MAX_JSON_BYTES == 2 * 1024 * 1024
