from fastapi.testclient import TestClient

from app import app


def plan_with(*beds):
    return {
        "version": 2,
        "garden": {"width": 20, "height": 18},
        "beds": list(beds),
        "obstacles": [],
    }


def herbs():
    return {
        "id": "bed1",
        "name": "Herbs",
        "type": "bed",
        "x": 1,
        "y": 2,
        "w": 4,
        "h": 8,
    }


def patch():
    return {
        "id": "area2",
        "name": "Patch",
        "type": "bed",
        "shape": "polygon",
        "points": [
            {"x": 0, "y": 0},
            {"x": 4, "y": 0},
            {"x": 0, "y": 3},
        ],
        "x": 0,
        "y": 0,
        "w": 4,
        "h": 3,
    }


def diary():
    return {
        "id": "note-1",
        "kind": "diary",
        "date": "2026-10-22",
        "bedId": "bed1",
        "crop": "Mint",
        "status": "done",
        "note": "Filled in after rain.",
        "photoUrl": "",
    }


def test_save_refreshes_area_and_keeps_a_removed_bed(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        assert client.get("/api/beds").json() == []

        saved = client.put("/api/garden", json=plan_with(herbs(), patch()))
        assert saved.status_code == 200
        assert saved.json()["beds"][1]["points"] == patch()["points"]
        assert client.get("/api/beds").json() == [
            {
                "id": "area2",
                "name": "Patch",
                "kind": "bed",
                "areaSqFt": 6,
                "removed": False,
            },
            {
                "id": "bed1",
                "name": "Herbs",
                "kind": "bed",
                "areaSqFt": 32,
                "removed": False,
            },
        ]

        assert client.put("/api/calendar/note-1", json=diary()).json()["bedId"] == "bed1"
        assert "bedName" not in client.get("/api/calendar/note-1").json()

        renamed = herbs()
        renamed["name"] = "Mint"
        renamed["w"] = 3
        renamed["h"] = 3
        client.put("/api/garden", json=plan_with(renamed))
        assert client.get("/api/beds").json() == [
            {
                "id": "bed1",
                "name": "Mint",
                "kind": "bed",
                "areaSqFt": 9,
                "removed": False,
            },
            {
                "id": "area2",
                "name": "Patch",
                "kind": "bed",
                "areaSqFt": 6,
                "removed": True,
            },
        ]
        entry = client.get("/api/calendar/note-1").json()
        assert entry["bedId"] == "bed1"
        assert "bedName" not in entry

        brought_back = {
            "id": "area2",
            "name": "Lawn",
            "type": "bed",
            "w": 2,
            "h": 5,
        }
        client.put("/api/garden", json=plan_with(renamed, brought_back))
        assert client.get("/api/beds").json() == [
            {
                "id": "area2",
                "name": "Lawn",
                "kind": "bed",
                "areaSqFt": 10,
                "removed": False,
            },
            {
                "id": "bed1",
                "name": "Mint",
                "kind": "bed",
                "areaSqFt": 9,
                "removed": False,
            },
        ]
