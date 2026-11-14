from authed_client import TestClient

from app import app


def fresh(monkeypatch, tmp_path):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))


def sample(**overrides):
    body = {
        "name": "Shriram Poshak NPK 19:19:19",
        "description": "1 kg bag",
        "quantity": 1,
        "manufacturer": "Shriram",
        "modelNumber": "NPK 19:19:19",
        "purchaseFrom": "",
        "purchasePrice": None,
        "purchaseDate": None,
        "locationPath": "Outhouse / Almirah",
        "tags": ["Fertilizer"],
        "archived": False,
        "notes": "Keep dry",
    }
    body.update(overrides)
    return body


def test_create_list_update_delete(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        assert client.get("/api/inventory").json() == []

        created = client.post("/api/inventory", json=sample())
        assert created.status_code == 200
        item = created.json()
        assert item["id"] == 1
        assert item["name"] == "Shriram Poshak NPK 19:19:19"
        assert item["locationPath"] == "Outhouse / Almirah"
        assert item["tags"] == ["Fertilizer"]
        assert item["notes"] == "Keep dry"
        assert "homeboxId" not in item

        listed = client.get("/api/inventory").json()
        assert [row["id"] for row in listed] == [1]

        by_tag = client.get("/api/inventory", params={"tag": "fertilizer"}).json()
        assert [row["id"] for row in by_tag] == [1]

        updated = client.put(
            "/api/inventory/1",
            json=sample(name="Shriram Poshak", quantity=2, notes=""),
        )
        assert updated.status_code == 200
        saved = updated.json()
        assert saved["id"] == 1
        assert saved["name"] == "Shriram Poshak"
        assert saved["quantity"] == 2
        assert saved["notes"] == ""

        got = client.get("/api/inventory/1").json()
        assert got["name"] == "Shriram Poshak"

        deleted = client.delete("/api/inventory/1")
        assert deleted.status_code == 204
        assert client.get("/api/inventory").json() == []
        assert client.get("/api/inventory/1").status_code == 404


def test_reject_unknown_field(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        body = sample()
        body["homeboxId"] = "nope"
        response = client.post("/api/inventory", json=body)
        assert response.status_code == 400
        assert "homeboxId" in response.json()["detail"]


def test_sync_style_overwrite_replaces_notes(tmp_path, monkeypatch):
    fresh(monkeypatch, tmp_path)
    with TestClient(app) as client:
        created = client.post("/api/inventory", json=sample(notes="Local note")).json()
        again = client.put(
            f"/api/inventory/{created['id']}",
            json=sample(notes="From import"),
        )
        assert again.status_code == 200
        assert again.json()["notes"] == "From import"
