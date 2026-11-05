from fastapi.testclient import TestClient

from app import app

TRIANGLE = [
    {"x": 0, "y": 0},
    {"x": 4, "y": 0},
    {"x": 0, "y": 3},
]
PIVOT = {"x": 1, "y": 1}
TOMATO = "🍅 Tomatoes"
BASIL = "🌿 Basil"


def herbs():
    return {
        "name": "Herbs",
        "kind": "bed",
        "x": 1,
        "y": 2,
        "w": 4,
        "h": 8,
        "rotation": 0,
        "color": "#2d6a30",
        "notes": "Morning sun",
    }


def diary(bed_id):
    return {
        "kind": "diary",
        "date": "2026-10-22",
        "bedId": bed_id,
        "crop": "Mint",
        "status": "done",
        "note": "Filled in after rain.",
        "photoUrl": "",
    }


def test_rows_save_one_at_a_time(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        assert client.get("/api/beds").json() == []
        assert client.get("/api/garden").status_code == 204

        created = client.put("/api/beds", json=herbs())
        assert created.status_code == 200
        bed = created.json()
        bed_id = bed["id"]
        assert isinstance(bed_id, int)
        assert "plants" not in bed
        assert bed["areaSqFt"] == 32
        assert bed["diam"] is None
        assert bed["outline"] is None
        assert "plantGrid" not in bed
        assert bed["removed"] is False
        assert bed["name"] == "Herbs"

        opened = client.get("/api/garden")
        assert opened.status_code == 200
        scene = opened.json()
        assert scene["garden"]["width"] is None
        assert scene["garden"]["widthText"] == ""
        assert scene["plot"]["plotId"] is None
        assert "plants" not in scene
        assert scene["obstacles"] == []
        assert [item["id"] for item in scene["beds"]] == [bed_id]
        assert scene["beds"][0]["plants"] == []
        assert scene["beds"][0]["areaSqFt"] == 32

        rejected = client.put("/api/beds", json={"id": 9, "kind": "bed"})
        assert rejected.status_code == 400
        assert client.put("/api/beds", json={"kind": "greenhouse"}).status_code == 400

        moved = {
            "id": bed_id,
            "name": "Mint",
            "kind": "bed",
            "x": 5,
            "y": 6,
            "w": 3,
            "h": 3,
            "color": "#2d6a30",
            "notes": "Morning sun",
        }
        updated = client.put(f"/api/beds/{bed_id}", json=moved)
        assert updated.status_code == 200
        assert updated.json()["id"] == bed_id
        assert updated.json()["name"] == "Mint"
        assert updated.json()["areaSqFt"] == 9
        assert updated.json()["x"] == 5
        assert "plantGrid" not in updated.json()
        assert client.put("/api/beds/99", json={**moved, "id": 99}).status_code == 404

        polygon = client.put(
            "/api/beds",
            json={
                "name": "Patch",
                "kind": "bed",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 3,
                "outline": {"points": TRIANGLE, "pivot": PIVOT},
            },
        )
        assert polygon.status_code == 200
        patch = polygon.json()
        assert patch["areaSqFt"] == 6
        assert patch["areaSqFt"] != 4 * 3
        assert patch["outline"] == {"points": TRIANGLE, "pivot": PIVOT}
        assert "shape" not in patch

        pot = client.put(
            "/api/beds",
            json={
                "name": "Patio",
                "kind": "pot",
                "x": 8,
                "y": 1,
                "w": 1.5,
                "h": 1.5,
                "diam": 1.5,
                "color": "#c1440e",
                "notes": "By the door",
            },
        )
        assert pot.status_code == 200
        patio = pot.json()
        assert patio["kind"] == "pot"
        assert patio["diam"] == 1.5
        assert patio["areaSqFt"] == 2.25
        assert client.put(
            "/api/beds",
            json={"name": "Nope", "kind": "bed", "diam": 2},
        ).status_code == 400

        named = client.put(f"/api/beds/{bed_id}/crops", json={"name": TOMATO})
        assert named.status_code == 200
        assert client.put(f"/api/beds/{bed_id}/crops", json={"name": BASIL}).status_code == 200
        shifted = client.put(
            f"/api/beds/{bed_id}",
            json={**moved, "x": 7},
        )
        assert shifted.status_code == 200
        assert shifted.json()["x"] == 7
        assert "plants" not in shifted.json()

        loaded = client.get("/api/garden").json()
        assert "plants" not in loaded
        by_id = {item["id"]: item for item in loaded["beds"]}
        assert set(by_id) == {bed_id, patch["id"], patio["id"]}
        assert by_id[bed_id]["plants"] == [TOMATO, BASIL]
        assert by_id[bed_id]["x"] == 7
        assert "plantGrid" not in by_id[bed_id]
        assert by_id[bed_id]["removed"] is False
        assert by_id[patch["id"]]["plants"] == []
        assert by_id[patio["id"]]["diam"] == 1.5
        assert loaded["obstacles"] == []

        removed = client.delete(f"/api/beds/{patch['id']}")
        assert removed.status_code == 204
        loaded = client.get("/api/garden").json()
        assert patch["id"] not in {item["id"] for item in loaded["beds"]}
        herbs_row = next(item for item in loaded["beds"] if item["id"] == bed_id)
        assert herbs_row["plants"] == [TOMATO, BASIL]
        listed = client.get("/api/beds").json()
        assert listed == [
            {
                "id": bed_id,
                "name": "Mint",
                "kind": "bed",
                "areaSqFt": 9,
                "removed": False,
            },
            {
                "id": patio["id"],
                "name": "Patio",
                "kind": "pot",
                "areaSqFt": 2.25,
                "removed": False,
            },
            {
                "id": patch["id"],
                "name": "Patch",
                "kind": "bed",
                "areaSqFt": 6,
                "removed": True,
            },
        ]

        obstacle = client.put(
            "/api/obstacles",
            json={
                "name": "Shed",
                "x": 4,
                "y": 4.5,
                "w": 4,
                "h": 3,
                "rotation": 1.25,
                "color": "#888",
            },
        )
        assert obstacle.status_code == 200
        shed = obstacle.json()
        assert isinstance(shed["id"], int)
        assert shed["id"] == bed_id
        renamed = client.put(
            f"/api/obstacles/{shed['id']}",
            json={"id": shed["id"], "name": "Fence", "x": 1, "y": 1, "w": 2, "h": 2},
        )
        assert renamed.status_code == 200
        assert renamed.json() == {
            "id": shed["id"],
            "name": "Fence",
            "x": 1,
            "y": 1,
            "w": 2,
            "h": 2,
            "rotation": 0,
            "color": "",
        }
        assert client.get("/api/garden").json()["obstacles"] == [renamed.json()]

        gone = client.delete(f"/api/obstacles/{shed['id']}")
        assert gone.status_code == 204
        assert client.get("/api/garden").json()["obstacles"] == []
        assert client.delete(f"/api/obstacles/{shed['id']}").status_code == 404
        assert client.put(
            f"/api/obstacles/{shed['id']}",
            json={"name": "Fence"},
        ).status_code == 404

        saved = client.post("/api/calendar", json=diary(bed_id))
        assert saved.status_code == 200
        assert isinstance(saved.json()["id"], int)
        assert saved.json()["bedId"] == bed_id
        assert "bedName" not in client.get(f"/api/calendar/{saved.json()['id']}").json()
        assert client.get("/api/beds").json()[0]["name"] == "Mint"


def test_a_bent_side_is_stored_and_changes_the_area(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    points = [
        {"x": 0, "y": 0, "bulge": 1},
        {"x": 4, "y": 0},
        {"x": 0, "y": 3},
    ]
    with TestClient(app) as client:
        saved = client.put(
            "/api/beds",
            json={
                "name": "Bowed",
                "kind": "bed",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 3,
                "outline": {"points": points, "pivot": PIVOT},
            },
        )
        assert saved.status_code == 200
        body = saved.json()
        assert body["outline"]["points"] == points
        assert body["outline"]["pivot"] == PIVOT
        assert body["areaSqFt"] == 3.334
        assert client.put(
            "/api/beds",
            json={
                "name": "Bowed",
                "kind": "bed",
                "outline": {"points": [*TRIANGLE[:1], {"x": 4, "y": 0, "bulge": 1, "z": 2}, TRIANGLE[2]]},
            },
        ).status_code == 400


def test_saving_a_removed_bed_puts_it_back_on_the_map(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with TestClient(app) as client:
        created = client.put("/api/beds", json=herbs())
        bed_id = created.json()["id"]
        assert client.delete(f"/api/beds/{bed_id}").status_code == 204
        assert client.get("/api/garden").status_code == 204

        restored = client.put(f"/api/beds/{bed_id}", json={**herbs(), "id": bed_id})
        assert restored.status_code == 200
        assert restored.json()["removed"] is False
        visible = client.get("/api/garden").json()
        assert [bed["id"] for bed in visible["beds"]] == [bed_id]


def test_active_assignments_keep_the_crop_date_and_maturity(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    with TestClient(app) as client:
        bed = client.put("/api/beds", json=herbs()).json()
        assigned = client.put(f"/api/beds/{bed['id']}/crops", json={"name": TOMATO})
        assert assigned.status_code == 200
        rows = client.get("/api/beds/crops").json()
        assert len(rows) == 1
        assert rows[0]["bedId"] == bed["id"]
        assert rows[0]["bedName"] == "Herbs"
        assert rows[0]["name"] == "Tomatoes"
        assert rows[0]["emoji"] == "🍅"
        assert rows[0]["icon"] == ""
        assert isinstance(rows[0]["cropId"], int)
        assert rows[0]["createdOn"]
        assert "daysToMaturity" in rows[0]
