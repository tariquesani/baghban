from fastapi.testclient import TestClient

from app import app
from crops import crop_slug, display_name, read_catalog


def fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))


def expected_plants():
    plants = read_catalog()
    ids = {plant["name"]: crop_slug(display_name(plant)) for plant in plants}
    expected = []
    for plant in plants:
        name = display_name(plant)
        expected.append(
            {
                "id": ids[plant["name"]],
                "name": name,
                "category": plant["category"],
                "emoji": plant["emoji"],
                "sqft": plant["sqft"],
                "spacing": plant["spacing"],
                "depthIn": plant["depthIn"],
                "sun": plant["sun"],
                "water": plant["water"],
                "trellis": plant["trellis"],
                "notes": plant["notes"],
                "companions": sorted(ids[item] for item in plant["companions"]),
                "avoid": sorted(ids[item] for item in plant["avoid"]),
            }
        )
    return expected


def test_init_db_seeds_every_catalogue_plant(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        crops = client.get("/api/crops").json()
        by_id = {crop["id"]: crop for crop in crops}
        expected = expected_plants()
        assert len(by_id) == len(expected)
        for plant in expected:
            saved = by_id[plant["id"]]
            assert saved["name"] == plant["name"]
            assert saved["category"] == plant["category"]
            assert saved["emoji"] == plant["emoji"]
            assert saved["sqft"] == plant["sqft"]
            assert saved["spacing"] == plant["spacing"]
            assert saved["depthIn"] == plant["depthIn"]
            assert saved["sun"] == plant["sun"]
            assert saved["water"] == plant["water"]
            assert saved["trellis"] is plant["trellis"]
            assert saved["notes"] == plant["notes"]
            assert saved["companions"] == plant["companions"]
            assert saved["avoid"] == plant["avoid"]
            assert saved["aliases"] == []
            assert saved["sowingDepthMm"] is None
            assert saved["daysToMaturity"] is None
            assert saved["archived"] is False
        assert by_id["tomatoes"]["name"] == "Tomatoes"
        assert by_id["cilantro"]["name"] == "Cilantro"
        assert by_id["mint"]["name"] == "Mint"
        assert "vegetable" in by_id
        assert "herb" in by_id
        assert "bhindi" not in by_id


def test_second_init_leaves_a_renamed_crop(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        tomatoes = client.get("/api/crops/tomatoes").json()
        tomatoes["name"] = "Tomato"
        saved = client.put("/api/crops/tomatoes", json=tomatoes)
        assert saved.status_code == 200
        assert saved.json()["id"] == "tomatoes"
        assert saved.json()["name"] == "Tomato"
        assert saved.json()["companions"] == tomatoes["companions"]
    with TestClient(app) as client:
        again = client.get("/api/crops/tomatoes").json()
        assert again["name"] == "Tomato"
        assert len(client.get("/api/crops").json()) == len(read_catalog())


def test_alias_search_and_companion_round_trip(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        cilantro = client.get("/api/crops/cilantro").json()
        cilantro["aliases"] = ["Dhaniya"]
        saved = client.put("/api/crops/cilantro", json=cilantro)
        assert saved.status_code == 200
        found = client.get("/api/crops", params={"q": "dhaniya"}).json()
        assert [crop["id"] for crop in found] == ["cilantro"]
        herbs = client.get("/api/crops", params={"category": "Herbs"}).json()
        assert herbs
        assert all(crop["category"] == "Herbs" for crop in herbs)
        assert any(crop["id"] == "cilantro" for crop in herbs)

        tomatoes = client.get("/api/crops/tomatoes").json()
        tomatoes["companions"] = ["basil", "chives"]
        saved = client.put("/api/crops/tomatoes", json=tomatoes)
        assert saved.status_code == 200
        assert saved.json()["companions"] == ["basil", "chives"]
        assert saved.json()["avoid"] == ["broccoli"]


def test_archive_hides_and_restore_returns(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        removed = client.delete("/api/crops/mint")
        assert removed.status_code == 204
        listed = client.get("/api/crops").json()
        assert all(crop["id"] != "mint" for crop in listed)
        archived = client.get("/api/crops", params={"archived": "1"}).json()
        assert [crop["id"] for crop in archived] == ["mint"]
        stored = client.get("/api/crops/mint").json()
        assert stored["archived"] is True
        stored["archived"] = False
        restored = client.put("/api/crops/mint", json=stored)
        assert restored.status_code == 200
        assert any(crop["id"] == "mint" for crop in client.get("/api/crops").json())
        assert client.get("/api/crops", params={"archived": "1"}).json() == []


def test_put_rejects_bad_crops(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        tomatoes = client.get("/api/crops/tomatoes").json()

        mismatch = client.put("/api/crops/tomatoes", json={**tomatoes, "id": "basil"})
        assert mismatch.status_code == 400

        selfish = client.put(
            "/api/crops/tomatoes",
            json={**tomatoes, "companions": ["tomatoes"]},
        )
        assert selfish.status_code == 400

        both = client.put(
            "/api/crops/tomatoes",
            json={**tomatoes, "companions": ["basil"], "avoid": ["basil"]},
        )
        assert both.status_code == 400

        missing = client.put(
            "/api/crops/tomatoes",
            json={**tomatoes, "companions": ["no-such-crop"]},
        )
        assert missing.status_code == 400

        named = client.put("/api/crops/basil", json={**client.get("/api/crops/basil").json(), "name": "Tomatoes"})
        assert named.status_code == 400

        alias = client.put(
            "/api/crops/basil",
            json={**client.get("/api/crops/basil").json(), "aliases": ["Tomatoes"]},
        )
        assert alias.status_code == 400

        same_name = client.put(
            "/api/crops/basil",
            json={**client.get("/api/crops/basil").json(), "aliases": ["Basil"]},
        )
        assert same_name.status_code == 400

        negative = client.put("/api/crops/tomatoes", json={**tomatoes, "sqft": -1})
        assert negative.status_code == 400

        fraction = client.put("/api/crops/tomatoes", json={**tomatoes, "daysToMaturity": 1.5})
        assert fraction.status_code == 400

        created = client.put(
            "/api/crops/bhindi",
            json={"id": "bhindi", "name": "Bhindi", "category": "Vegetables"},
        )
        assert created.status_code == 200
        body = created.json()
        assert body["id"] == "bhindi"
        assert body["sqft"] is None
        assert body["aliases"] == []
        assert any(crop["id"] == "bhindi" for crop in client.get("/api/crops").json())
