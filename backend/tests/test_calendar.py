import sqlite3
import struct
import zlib

from fastapi.testclient import TestClient

from app import app


def png_bytes() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = b"\x00\xff\x00\x00"
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def add_bed(client, name="Herbs"):
    saved = client.put(
        "/api/beds",
        json={"name": name, "kind": "bed", "x": 1, "y": 2, "w": 4, "h": 8},
    )
    assert saved.status_code == 200
    bed_id = saved.json()["id"]
    assert isinstance(bed_id, int)
    return bed_id


def sowing(bed_id, entry_id=None):
    body = {
        "kind": "sowing",
        "date": "2026-10-24",
        "bedId": bed_id,
        "crop": "Coriander",
        "status": "planned",
        "note": "Second sowing of the month",
        "photoUrl": "",
    }
    if entry_id is not None:
        body["id"] = entry_id
    return body


def watering(bed_id, entry_id=None):
    body = {
        "kind": "care",
        "date": "2026-10-23",
        "bedId": bed_id,
        "crop": "Tomato",
        "status": "done",
        "note": "",
        "photoUrl": "",
        "action": "watering",
        "product": "",
        "amount": 10,
        "unit": "L",
    }
    if entry_id is not None:
        body["id"] = entry_id
    return body


def fertilising(bed_id, entry_id=None, date="2026-10-18", amount=50):
    body = {
        "kind": "care",
        "date": date,
        "bedId": bed_id,
        "crop": "Tomato",
        "status": "done",
        "note": "",
        "photoUrl": "",
        "action": "fertilising",
        "product": "Neem cake",
        "amount": amount,
        "unit": "g",
    }
    if entry_id is not None:
        body["id"] = entry_id
    return body


def pest(bed_id, entry_id=None, date="2026-10-21"):
    body = {
        "kind": "pest",
        "date": date,
        "bedId": bed_id,
        "crop": "Tomato",
        "status": "done",
        "note": "",
        "photoUrl": "",
        "problem": "Whitefly",
        "product": "Neem oil",
        "amount": 15,
        "unit": "ml",
    }
    if entry_id is not None:
        body["id"] = entry_id
    return body


def harvest(bed_id, entry_id=None, date="2026-10-23", status="done", weight=840, crop="Tomato"):
    body = {
        "kind": "harvest",
        "date": date,
        "bedId": bed_id,
        "crop": crop,
        "status": status,
        "note": "",
        "photoUrl": "",
        "quantity": 12,
        "unit": "fruit",
        "weightGrams": weight,
    }
    if entry_id is not None:
        body["id"] = entry_id
    return body


def diary(bed_id, entry_id=None):
    body = {
        "kind": "diary",
        "date": "2026-10-22",
        "bedId": bed_id,
        "crop": "Tomato",
        "status": "done",
        "note": "First fruit split after the rain.",
        "photoUrl": "",
    }
    if entry_id is not None:
        body["id"] = entry_id
    return body


def test_creates_each_kind_through_one_url(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        assert client.get("/api/calendar").json() == []
        assert client.get("/api/calendar/missing").status_code == 404
        bed_id = add_bed(client)

        saved_sowing = client.post("/api/calendar", json=sowing(bed_id))
        assert saved_sowing.status_code == 200
        sowing_id = saved_sowing.json()["id"]
        assert saved_sowing.json() == {**sowing(bed_id), "id": sowing_id}
        assert "action" not in saved_sowing.json()
        assert "weightGrams" not in saved_sowing.json()

        watered = client.post("/api/calendar", json=watering(bed_id))
        assert watered.json()["action"] == "watering"
        assert "problem" not in watered.json()
        fed = client.post("/api/calendar", json=fertilising(bed_id))
        assert fed.json()["amount"] == 50
        folded = watering(bed_id)
        folded["action"] = "pest_control"
        rejected_action = client.post("/api/calendar", json=folded)
        assert rejected_action.status_code == 400
        assert rejected_action.json()["detail"] == "Invalid action"
        sprayed = client.post("/api/calendar", json=pest(bed_id))
        assert sprayed.json() == {**pest(bed_id), "id": sprayed.json()["id"]}
        assert "action" not in sprayed.json()
        picked = client.post("/api/calendar", json=harvest(bed_id))
        assert picked.json()["weightGrams"] == 840
        noted = client.post("/api/calendar", json=diary(bed_id))
        assert noted.json()["kind"] == "diary"

        listed = client.get("/api/calendar?from=2026-10-01&to=2026-10-31").json()
        assert [entry["id"] for entry in listed] == [
            fed.json()["id"],
            sprayed.json()["id"],
            noted.json()["id"],
            watered.json()["id"],
            picked.json()["id"],
            sowing_id,
        ]
        assert client.get(f"/api/calendar/{picked.json()['id']}").json()["unit"] == "fruit"
        watering_id = watered.json()["id"]
        harvest_id = picked.json()["id"]
        sprayed_id = sprayed.json()["id"]

    connection = sqlite3.connect(tmp_path / "baghban.db")
    assert connection.execute("SELECT COUNT(*) FROM calendar_entry").fetchone()[0] == 6
    assert connection.execute(
        "SELECT action FROM care WHERE entry_id = ?",
        (watering_id,),
    ).fetchone()[0] == "watering"
    assert connection.execute(
        "SELECT weight_grams FROM harvest WHERE entry_id = ?",
        (harvest_id,),
    ).fetchone()[0] == 840
    assert connection.execute(
        "SELECT problem, product, amount, unit FROM pest WHERE entry_id = ?",
        (sprayed_id,),
    ).fetchone() == ("Whitefly", "Neem oil", 15, "ml")
    assert connection.execute(
        "SELECT COUNT(*) FROM care WHERE entry_id = ?",
        (sprayed_id,),
    ).fetchone()[0] == 0
    assert connection.execute(
        "SELECT COUNT(*) FROM harvest WHERE entry_id = ?",
        (sowing_id,),
    ).fetchone()[0] == 0
    connection.close()


def test_filters_and_replaces_without_changing_kind(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        bed_id = add_bed(client)
        sown = client.post("/api/calendar", json=sowing(bed_id)).json()
        watered = client.post("/api/calendar", json=watering(bed_id)).json()
        picked = client.post("/api/calendar", json=harvest(bed_id)).json()
        later = client.post(
            "/api/calendar",
            json=harvest(bed_id, date="2026-10-30", status="planned", weight=100),
        ).json()

        sowings = client.get("/api/calendar?kind=sowing&status=planned&crop=Coriander")
        assert [entry["id"] for entry in sowings.json()] == [sown["id"]]
        care = client.get(f"/api/calendar?kind=care&action=watering&bedId={bed_id}")
        assert [entry["id"] for entry in care.json()] == [watered["id"]]
        sprayed = client.post("/api/calendar", json=pest(bed_id)).json()
        pests = client.get("/api/calendar?kind=pest&crop=Tomato")
        assert [entry["id"] for entry in pests.json()] == [sprayed["id"]]
        done = client.get("/api/calendar?kind=harvest&status=done&from=2026-10-23&to=2026-10-23")
        assert [entry["id"] for entry in done.json()] == [picked["id"]]
        assert later["id"] != picked["id"]

        missing_bed = client.post("/api/calendar", json=sowing(999999))
        assert missing_bed.status_code == 400
        assert missing_bed.json()["detail"] == "bedId does not exist"
        text_bed = sowing(bed_id)
        text_bed["bedId"] = "bed-4"
        assert client.post("/api/calendar", json=text_bed).status_code == 400
        chosen = sowing(bed_id)
        chosen["id"] = 4
        assert client.post("/api/calendar", json=chosen).status_code == 400

        whole = sowing(bed_id)
        whole["bedId"] = ""
        whole["note"] = "Whole garden"
        garden = client.post("/api/calendar", json=whole)
        assert garden.status_code == 200
        assert garden.json()["bedId"] is None
        blank = client.get("/api/calendar?bedId=")
        assert [entry["id"] for entry in blank.json()] == [garden.json()["id"]]
        assert client.get("/api/calendar?bedId=bed-4").status_code == 400

        client.delete(f"/api/beds/{bed_id}")
        removed = diary(bed_id)
        removed["note"] = "Still names the bed"
        kept = client.post("/api/calendar", json=removed)
        assert kept.status_code == 200
        assert kept.json()["bedId"] == bed_id

        connection = sqlite3.connect(tmp_path / "baghban.db")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            INSERT INTO care (entry_id, action, product, amount, unit)
            VALUES (?, 'watering', 'left over', 1, 'L')
            """,
            (picked["id"],),
        )
        connection.commit()
        connection.close()

        rejected = client.put(
            f"/api/calendar/{picked['id']}",
            json={**watering(bed_id), "id": picked["id"]},
        )
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "kind cannot change"
        assert client.get(f"/api/calendar/{picked['id']}").json()["weightGrams"] == 840
        connection = sqlite3.connect(tmp_path / "baghban.db")
        assert connection.execute(
            "SELECT COUNT(*) FROM care WHERE entry_id = ?",
            (picked["id"],),
        ).fetchone()[0] == 1
        connection.close()

        changed = harvest(bed_id, picked["id"])
        changed["weightGrams"] = 900
        changed["quantity"] = None
        replaced = client.put(f"/api/calendar/{picked['id']}", json=changed)
        assert replaced.status_code == 200
        assert replaced.json()["weightGrams"] == 900
        assert replaced.json()["quantity"] is None
        connection = sqlite3.connect(tmp_path / "baghban.db")
        assert connection.execute(
            "SELECT COUNT(*) FROM care WHERE entry_id = ?",
            (picked["id"],),
        ).fetchone()[0] == 0
        connection.close()

        extra = {**sowing(bed_id, sown["id"]), "quantity": 3}
        assert client.put(f"/api/calendar/{sown['id']}", json=extra).status_code == 400
        named = {**sowing(bed_id, sown["id"]), "bedName": "Herb bed"}
        rejected_name = client.put(f"/api/calendar/{sown['id']}", json=named)
        assert rejected_name.status_code == 400
        assert rejected_name.json()["detail"] == "bedName is not part of a sowing entry"
        planned_diary = diary(bed_id)
        planned_diary["status"] = "planned"
        assert client.post("/api/calendar", json=planned_diary).status_code == 400
        mismatch = sowing(bed_id, sown["id"])
        mismatch["id"] = sown["id"] + 1
        assert client.put(f"/api/calendar/{sown['id']}", json=mismatch).status_code == 400
        assert client.put(f"/api/calendar/{sown['id'] + 50}", json=sowing(bed_id, sown["id"] + 50)).status_code == 404
        assert client.put("/api/calendar/bad id", json=sowing(bed_id, 1)).status_code == 404
        assert client.get("/api/calendar?from=2026-13-01").status_code == 400


def test_totals_skip_planned_harvests_and_sum_care(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        assert client.get("/api/calendar/totals/harvest").json() == []
        assert client.get("/api/calendar/totals/harvest?crop=Tomato").json() == {
            "crop": "Tomato",
            "weightGrams": 0,
        }
        assert client.get("/api/calendar/totals/care").status_code == 400
        bed_id = add_bed(client)

        client.post("/api/calendar", json=harvest(bed_id))
        client.post("/api/calendar", json=harvest(bed_id, date="2026-10-30", status="planned", weight=500))
        client.post(
            "/api/calendar",
            json=harvest(bed_id, date="2026-10-12", status="done", weight=120, crop="Coriander"),
        )
        client.post("/api/calendar", json=harvest(bed_id, date="2026-09-01", status="done", weight=50))
        client.post("/api/calendar", json=fertilising(bed_id))
        client.post("/api/calendar", json=fertilising(bed_id, date="2026-10-19", amount=25))
        client.post("/api/calendar", json=watering(bed_id))

        tomato = client.get(
            "/api/calendar/totals/harvest?crop=Tomato&from=2026-09-23&to=2026-10-23"
        )
        assert tomato.json() == {"crop": "Tomato", "weightGrams": 840}
        bed = client.get(
            f"/api/calendar/totals/harvest?crop=Tomato&bedId={bed_id}&from=2026-09-23&to=2026-10-23"
        )
        assert bed.json()["weightGrams"] == 840
        crops = client.get("/api/calendar/totals/harvest?from=2026-09-23&to=2026-10-23").json()
        assert crops == [
            {"crop": "Coriander", "weightGrams": 120},
            {"crop": "Tomato", "weightGrams": 840},
        ]

        cake = client.get(
            "/api/calendar/totals/care?action=fertilising&product=Neem%20cake&unit=g&from=2026-09-23&to=2026-10-23"
        )
        assert cake.json() == {
            "action": "fertilising",
            "product": "Neem cake",
            "unit": "g",
            "amount": 75,
        }
        water = client.get(
            f"/api/calendar/totals/care?action=watering&unit=L&bedId={bed_id}&from=2026-10-01&to=2026-10-31"
        )
        assert water.json() == {"action": "watering", "unit": "L", "amount": 10}
        assert client.get("/api/calendar/totals/care?action=pest_control&unit=ml").status_code == 400


def test_delete_removes_child_row_and_photo(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    photo = png_bytes()

    with TestClient(app) as client:
        assert client.delete("/api/calendar/1").status_code == 204
        assert client.delete("/api/calendar/evt-18").status_code == 404
        bed_id = add_bed(client)

        stored = client.put(
            "/api/photos/harvest-1",
            content=photo,
            headers={"Content-Type": "image/png"},
        )
        assert stored.json() == {"url": "/api/photos/harvest-1"}
        body = harvest(bed_id)
        body["photoUrl"] = "/api/photos/harvest-1"
        saved = client.post("/api/calendar", json=body)
        assert saved.status_code == 200
        entry_id = saved.json()["id"]
        assert saved.json()["photoUrl"] == "/api/photos/harvest-1"

        cleared = harvest(bed_id, entry_id)
        cleared["photoUrl"] = ""
        cleared["weightGrams"] = 900
        assert client.put(f"/api/calendar/{entry_id}", json=cleared).json()["photoUrl"] == ""
        assert client.get("/api/photos/harvest-1").status_code == 404

        client.put(
            "/api/photos/harvest-1",
            content=photo,
            headers={"Content-Type": "image/png"},
        )
        replaced = harvest(bed_id, entry_id)
        replaced["photoUrl"] = "/api/photos/harvest-1"
        client.put(f"/api/calendar/{entry_id}", json=replaced)
        removed = client.delete(f"/api/calendar/{entry_id}")
        assert removed.status_code == 204
        assert client.get(f"/api/calendar/{entry_id}").status_code == 404
        assert client.get("/api/photos/harvest-1").status_code == 404

    assert (tmp_path / "photos" / "harvest-1.png").exists() is False
    connection = sqlite3.connect(tmp_path / "baghban.db")
    assert connection.execute("SELECT COUNT(*) FROM calendar_entry").fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM harvest").fetchone()[0] == 0
    connection.close()


def test_done_sowing_occupies_an_empty_bed(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        bed_id = add_bed(client)
        planned = sowing(bed_id)
        assert client.post("/api/calendar", json=planned).status_code == 200

        unplaced = sowing(bed_id)
        unplaced["status"] = "done"
        unplaced["bedId"] = None
        unplaced["crop"] = "Tomatoes"
        unplaced["date"] = "2026-06-01"
        assert client.post("/api/calendar", json=unplaced).status_code == 200

        unknown = sowing(bed_id)
        unknown["status"] = "done"
        unknown["crop"] = "Not a crop"
        rejected = client.post("/api/calendar", json=unknown)
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "Unknown crop"

        placed = sowing(bed_id)
        placed["status"] = "done"
        placed["crop"] = "Tomatoes"
        placed["date"] = "2026-06-08"
        assert client.post("/api/calendar", json=placed).status_code == 200
        again = client.post("/api/calendar", json=placed)
        assert again.status_code == 200

    connection = sqlite3.connect(tmp_path / "baghban.db")
    rows = connection.execute(
        "SELECT created_on, archived_on FROM beds_crops"
    ).fetchall()
    assert rows == [("2026-06-08", None)]
    connection.close()
