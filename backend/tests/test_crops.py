import sqlite3

from fastapi.testclient import TestClient

from app import app
from crops import display_name, read_catalog


def fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))


def crops_by_name(client):
    return {crop["name"]: crop for crop in client.get("/api/crops").json()}


def crop_named(client, name):
    found = crops_by_name(client)[name]
    assert isinstance(found["id"], int)
    return found


def test_init_db_seeds_every_catalogue_plant(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        saved = crops_by_name(client)
        plants = read_catalog()
        ids = {}
        for plant in plants:
            name = display_name(plant)
            crop = saved[name]
            assert isinstance(crop["id"], int)
            ids[plant["name"]] = crop["id"]
        assert len(saved) == len(plants)
        assert len({crop["id"] for crop in saved.values()}) == len(plants)
        for plant in plants:
            crop = saved[display_name(plant)]
            assert crop["category"] == plant["category"]
            assert crop["emoji"] == plant["emoji"]
            assert crop["sqft"] == plant["sqft"]
            assert crop["spacing"] == plant["spacing"]
            assert crop["depthIn"] == plant["depthIn"]
            assert crop["sun"] == plant["sun"]
            assert crop["water"] == plant["water"]
            assert crop["trellis"] is plant["trellis"]
            assert crop["notes"] == plant["notes"]
            assert crop["companions"] == sorted(ids[item] for item in plant["companions"])
            assert crop["avoid"] == sorted(ids[item] for item in plant["avoid"])
            assert crop["aliases"] == []
            assert crop["sowingDepthMm"] is None
            assert crop["daysToMaturity"] is None
            assert crop["archived"] is False
        assert saved["Tomatoes"]["name"] == "Tomatoes"
        assert "Cilantro" in saved
        assert "Mint" in saved
        assert "Vegetable" in saved
        assert "Herb" in saved
        assert "Bhindi" not in saved


def test_second_init_leaves_a_renamed_crop(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        tomatoes = crop_named(client, "Tomatoes")
        tomatoes["name"] = "Tomato"
        saved = client.put(f"/api/crops/{tomatoes['id']}", json=tomatoes)
        assert saved.status_code == 200
        assert saved.json()["id"] == tomatoes["id"]
        assert saved.json()["name"] == "Tomato"
        assert saved.json()["companions"] == tomatoes["companions"]
        tomato_id = tomatoes["id"]
    with TestClient(app) as client:
        again = client.get(f"/api/crops/{tomato_id}").json()
        assert again["id"] == tomato_id
        assert again["name"] == "Tomato"
        assert len(client.get("/api/crops").json()) == len(read_catalog())


def test_alias_search_and_companion_round_trip(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        cilantro = crop_named(client, "Cilantro")
        cilantro["aliases"] = ["Dhaniya"]
        saved = client.put(f"/api/crops/{cilantro['id']}", json=cilantro)
        assert saved.status_code == 200
        found = client.get("/api/crops", params={"q": "dhaniya"}).json()
        assert [crop["id"] for crop in found] == [cilantro["id"]]
        herbs = client.get("/api/crops", params={"category": "Herbs"}).json()
        assert herbs
        assert all(crop["category"] == "Herbs" for crop in herbs)
        assert any(crop["id"] == cilantro["id"] for crop in herbs)

        tomatoes = crop_named(client, "Tomatoes")
        basil = crop_named(client, "Basil")
        chives = crop_named(client, "Chives")
        tomatoes["companions"] = [basil["id"], chives["id"]]
        saved = client.put(f"/api/crops/{tomatoes['id']}", json=tomatoes)
        assert saved.status_code == 200
        assert saved.json()["companions"] == sorted([basil["id"], chives["id"]])
        assert saved.json()["avoid"] == tomatoes["avoid"]


def test_archive_hides_and_restore_returns(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        mint = crop_named(client, "Mint")
        removed = client.delete(f"/api/crops/{mint['id']}")
        assert removed.status_code == 204
        listed = client.get("/api/crops").json()
        assert all(crop["id"] != mint["id"] for crop in listed)
        archived = client.get("/api/crops", params={"archived": "1"}).json()
        assert [crop["id"] for crop in archived] == [mint["id"]]
        stored = client.get(f"/api/crops/{mint['id']}").json()
        assert stored["archived"] is True
        stored["archived"] = False
        restored = client.put(f"/api/crops/{mint['id']}", json=stored)
        assert restored.status_code == 200
        assert any(crop["id"] == mint["id"] for crop in client.get("/api/crops").json())
        assert client.get("/api/crops", params={"archived": "1"}).json() == []


def test_put_rejects_bad_crops(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        tomatoes = crop_named(client, "Tomatoes")
        basil = crop_named(client, "Basil")

        mismatch = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "id": basil["id"]},
        )
        assert mismatch.status_code == 400

        selfish = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "companions": [tomatoes["id"]]},
        )
        assert selfish.status_code == 400

        both = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "companions": [basil["id"]], "avoid": [basil["id"]]},
        )
        assert both.status_code == 400

        missing = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "companions": [999999]},
        )
        assert missing.status_code == 400

        text_id = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "companions": ["no-such-crop"]},
        )
        assert text_id.status_code == 400

        named = client.put(
            f"/api/crops/{basil['id']}",
            json={**basil, "name": "Tomatoes"},
        )
        assert named.status_code == 400

        alias = client.put(
            f"/api/crops/{basil['id']}",
            json={**basil, "aliases": ["Tomatoes"]},
        )
        assert alias.status_code == 400

        same_name = client.put(
            f"/api/crops/{basil['id']}",
            json={**basil, "aliases": ["Basil"]},
        )
        assert same_name.status_code == 400

        negative = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "sqft": -1},
        )
        assert negative.status_code == 400

        fraction = client.put(
            f"/api/crops/{tomatoes['id']}",
            json={**tomatoes, "daysToMaturity": 1.5},
        )
        assert fraction.status_code == 400

        chosen = client.post(
            "/api/crops",
            json={"id": 4, "name": "Bhindi", "category": "Vegetables"},
        )
        assert chosen.status_code == 400

        absent = client.put(
            "/api/crops/999999",
            json={"id": 999999, "name": "Bhindi", "category": "Vegetables"},
        )
        assert absent.status_code == 404

        created = client.post(
            "/api/crops",
            json={"name": "Bhindi", "category": "Vegetables"},
        )
        assert created.status_code == 200
        body = created.json()
        assert isinstance(body["id"], int)
        assert body["name"] == "Bhindi"
        assert body["sqft"] is None
        assert body["aliases"] == []
        assert body["companions"] == []
        assert body["avoid"] == []
        assert crop_named(client, "Bhindi")["id"] == body["id"]

        renamed = client.put(
            f"/api/crops/{body['id']}",
            json={**body, "name": "Okra"},
        )
        assert renamed.status_code == 200
        assert renamed.json()["id"] == body["id"]
        assert renamed.json()["name"] == "Okra"


def test_old_crop_checks_follow_the_catalogue(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    connection = sqlite3.connect(db)
    connection.execute(
        """
        CREATE TABLE crop (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            name              TEXT NOT NULL,
            category          TEXT NOT NULL CHECK (category IN ('Vegetables', 'Herbs', 'Flowers', 'Fruit')),
            emoji             TEXT NOT NULL DEFAULT '',
            sqft              REAL,
            spacing           REAL,
            depth_in          REAL,
            sowing_depth_mm   REAL,
            days_to_maturity  INTEGER,
            sun               TEXT NOT NULL DEFAULT '' CHECK (sun IN ('', 'Full', 'Full/Part')),
            water             TEXT NOT NULL DEFAULT '' CHECK (water IN ('', 'Low', 'Medium', 'High')),
            trellis           INTEGER NOT NULL DEFAULT 0 CHECK (trellis IN (0, 1)),
            notes             TEXT NOT NULL DEFAULT '',
            archived          INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE crop_alias (
            crop_id  INTEGER NOT NULL REFERENCES crop(id),
            alias    TEXT NOT NULL,
            PRIMARY KEY (crop_id, alias)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO crop (name, category, sun, water)
        VALUES ('Custard apple', 'Fruit', 'Full', 'Low')
        """
    )
    connection.execute(
        "INSERT INTO crop_alias (crop_id, alias) VALUES (1, 'Seeta phal')"
    )
    connection.commit()
    connection.close()

    with TestClient(app) as client:
        kept = client.get("/api/crops?q=Custard")
        assert kept.status_code == 200
        assert kept.json()[0]["name"] == "Custard apple"
        assert kept.json()[0]["aliases"] == ["Seeta phal"]
        rejected = client.post(
            "/api/crops",
            json={"name": "Neem", "category": "Trees"},
        )
        assert rejected.status_code == 400
        created = client.post(
            "/api/crops",
            json={"name": "Bhindi", "category": "Vegetables"},
        )
        assert created.status_code == 200
        assert created.json()["id"] == 2

    connection = sqlite3.connect(db)
    sql = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'crop'"
    ).fetchone()[0]
    assert "CHECK (category" not in sql
    assert "CHECK (sun" not in sql
    assert "CHECK (water" not in sql
    assert "CHECK (trellis" in sql
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 3
    assert connection.execute(
        "SELECT icon FROM crop WHERE name = 'Custard apple'"
    ).fetchone()[0] == ""
    connection.execute(
        "UPDATE crop SET category = 'Trees' WHERE name = 'Custard apple'"
    )
    connection.commit()
    connection.close()
