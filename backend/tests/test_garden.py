import json
import sqlite3

from fastapi.testclient import TestClient

from app import app


def test_garden_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    plan = {
        "version": 2,
        "garden": {"width": 20, "height": 18},
        "beds": [
            {
                "id": "bed1",
                "name": "Herbs",
                "x": 1,
                "y": 2,
                "w": 4,
                "h": 8,
                "plants": ["basil"],
            }
        ],
        "obstacles": [],
        "nextId": 2,
    }

    with TestClient(app) as client:
        empty = client.get("/api/garden")
        assert empty.status_code == 204
        assert empty.content == b""

        saved = client.put("/api/garden", json=plan)
        assert saved.status_code == 200

        loaded = client.get("/api/garden")
        assert loaded.status_code == 200
        assert loaded.json()["beds"] == plan["beds"]
        assert loaded.json() == plan

        replaced = {
            **plan,
            "beds": [{"id": "bed2", "name": "Tomatoes"}],
            "nextId": 3,
        }
        second = client.put("/api/garden", json=replaced)
        assert second.status_code == 200
        assert client.get("/api/garden").json()["beds"] == replaced["beds"]

    connection = sqlite3.connect(tmp_path / "baghban.db")
    rows = connection.execute("SELECT id, document FROM garden_plan").fetchall()
    assert len(rows) == 1
    assert rows[0][0] == 1
    assert json.loads(rows[0][1])["beds"] == replaced["beds"]
    try:
        connection.execute(
            "INSERT INTO garden_plan (id, document, saved_at) VALUES (2, '{}', 't')"
        )
        raise AssertionError("a second garden row was inserted")
    except sqlite3.IntegrityError:
        pass
    connection.close()
