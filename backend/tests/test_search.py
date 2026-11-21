import sqlite3

from authed_client import TestClient

from app import app


def fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))


def crop_named(client, name):
    for crop in client.get("/api/crops").json():
        if crop["name"] == name:
            return crop
    raise AssertionError(f"missing crop {name}")


def test_search_finds_seeded_crops(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        found = client.get("/api/search", params={"q": "tomato"}).json()
        assert found["q"] == "tomato"
        titles = [hit["title"] for hit in found["results"] if hit["entity"] == "crop"]
        assert any("Tomato" in title for title in titles)


def test_search_updates_when_crop_renamed(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        crop = crop_named(client, "Basil")
        crop["name"] = "Sweet Basil"
        assert client.put(f"/api/crops/{crop['id']}", json=crop).status_code == 200
        found = client.get("/api/search", params={"q": "sweet"}).json()["results"]
        assert any(
            hit["entity"] == "crop" and hit["id"] == str(crop["id"]) for hit in found
        )
        old = client.get("/api/search", params={"q": "basil"}).json()["results"]
        assert any(hit["id"] == str(crop["id"]) for hit in old)


def test_search_marks_archived_crops(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        crop = crop_named(client, "Mint")
        assert client.delete(f"/api/crops/{crop['id']}").status_code == 204
        found = client.get("/api/search", params={"q": "mint"}).json()["results"]
        hit = next(item for item in found if item["entity"] == "crop")
        assert hit["inactive"] is True
        assert hit["inactiveLabel"] == "Archived"


def test_search_indexes_inventory_and_alias(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        item = client.post(
            "/api/inventory",
            json={
                "name": "Pruning shears",
                "description": "Bypass blades",
                "quantity": 1,
                "tags": ["tools"],
                "archived": False,
                "notes": "",
                "manufacturer": "",
                "modelNumber": "",
                "purchaseFrom": "",
                "purchasePrice": None,
                "purchaseDate": None,
                "locationPath": "Shed",
            },
        ).json()
        found = client.get("/api/search", params={"q": "shears"}).json()["results"]
        assert any(
            hit["entity"] == "inventory" and hit["id"] == str(item["id"])
            for hit in found
        )

        cilantro = crop_named(client, "Cilantro")
        cilantro["aliases"] = ["Dhaniya"]
        assert client.put(f"/api/crops/{cilantro['id']}", json=cilantro).status_code == 200
        alias_hits = client.get("/api/search", params={"q": "dhaniya"}).json()["results"]
        assert any(
            hit["entity"] == "crop" and hit["id"] == str(cilantro["id"])
            for hit in alias_hits
        )


def test_search_index_exists_after_migrate(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app):
        pass
    connection = sqlite3.connect(tmp_path / "baghban.db")
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 10
    assert (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE name = 'search_doc'"
        ).fetchone()
        is not None
    )
    count = connection.execute("SELECT COUNT(*) FROM search_doc").fetchone()[0]
    assert count > 0
    connection.close()


def test_search_harvest_shows_grams_date_and_recency(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        bed = client.put(
            "/api/beds",
            json={
                "name": "Patch",
                "kind": "bed",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 4,
                "rotation": 0,
                "color": "#2d6a30",
                "notes": "",
            },
        ).json()
        tomatoes = crop_named(client, "Tomatoes")

        def harvest(day, grams, note):
            body = {
                "kind": "harvest",
                "date": day,
                "bedId": bed["id"],
                "cropId": tomatoes["id"],
                "status": "done",
                "note": note,
                "photoUrl": "",
                "quantity": 1,
                "unit": "kg",
                "weightGrams": grams,
            }
            saved = client.post("/api/calendar", json=body)
            assert saved.status_code == 200
            return saved.json()

        older = harvest("2026-01-10", 200, "early pick")
        newer = harvest("2026-10-23", 840, "late pick")

        found = client.get("/api/search", params={"q": "pick"}).json()["results"]
        calendar = [hit for hit in found if hit["entity"] == "calendar"]
        assert [hit["id"] for hit in calendar] == [str(newer["id"]), str(older["id"])]
        assert calendar[0]["date"] == "2026-10-23"
        assert "2026-10-23" in calendar[0]["title"]
        assert "840 g" in calendar[0]["title"]
        assert calendar[1]["date"] == "2026-01-10"
        assert "200 g" in calendar[1]["title"]
