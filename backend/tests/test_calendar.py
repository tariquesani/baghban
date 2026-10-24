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


def sowing():
    return {
        "id": "sow-7",
        "kind": "sowing",
        "date": "2026-10-24",
        "bedId": "bed-2",
        "crop": "Coriander",
        "status": "planned",
        "note": "Second sowing of the month",
        "photoUrl": "",
    }


def watering():
    return {
        "id": "care-9",
        "kind": "care",
        "date": "2026-10-23",
        "bedId": "bed-4",
        "crop": "Tomato",
        "status": "done",
        "note": "",
        "photoUrl": "",
        "action": "watering",
        "product": "",
        "problem": "",
        "amount": 10,
        "unit": "L",
    }


def fertilising(entry_id="care-10", date="2026-10-18", amount=50):
    return {
        "id": entry_id,
        "kind": "care",
        "date": date,
        "bedId": "bed-4",
        "crop": "Tomato",
        "status": "done",
        "note": "",
        "photoUrl": "",
        "action": "fertilising",
        "product": "Neem cake",
        "problem": "",
        "amount": amount,
        "unit": "g",
    }


def harvest(entry_id="evt-18", date="2026-10-23", status="done", weight=840, crop="Tomato"):
    return {
        "id": entry_id,
        "kind": "harvest",
        "date": date,
        "bedId": "bed-4",
        "crop": crop,
        "status": status,
        "note": "",
        "photoUrl": "",
        "quantity": 12,
        "unit": "fruit",
        "weightGrams": weight,
    }


def diary():
    return {
        "id": "note-19",
        "kind": "diary",
        "date": "2026-10-22",
        "bedId": "bed-4",
        "crop": "Tomato",
        "status": "done",
        "note": "First fruit split after the rain.",
        "photoUrl": "",
    }


def test_creates_each_kind_through_one_url(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        assert client.get("/api/calendar").json() == []
        assert client.get("/api/calendar/missing").status_code == 404

        saved_sowing = client.put("/api/calendar/sow-7", json=sowing())
        assert saved_sowing.status_code == 200
        assert saved_sowing.json() == sowing()
        assert "action" not in saved_sowing.json()
        assert "weightGrams" not in saved_sowing.json()

        assert client.put("/api/calendar/care-9", json=watering()).json()["action"] == "watering"
        assert client.put("/api/calendar/care-10", json=fertilising()).json()["amount"] == 50
        pest = {
            **watering(),
            "id": "care-11",
            "date": "2026-10-21",
            "action": "pest_control",
            "product": "Neem oil",
            "problem": "Whitefly",
            "amount": 15,
            "unit": "ml",
        }
        assert client.put("/api/calendar/care-11", json=pest).json()["problem"] == "Whitefly"
        assert client.put("/api/calendar/evt-18", json=harvest()).json()["weightGrams"] == 840
        assert client.put("/api/calendar/note-19", json=diary()).json()["kind"] == "diary"

        listed = client.get("/api/calendar?from=2026-10-01&to=2026-10-31").json()
        assert [entry["id"] for entry in listed] == [
            "care-10",
            "care-11",
            "note-19",
            "care-9",
            "evt-18",
            "sow-7",
        ]
        assert client.get("/api/calendar/evt-18").json()["unit"] == "fruit"

    connection = sqlite3.connect(tmp_path / "baghban.db")
    assert connection.execute("SELECT COUNT(*) FROM calendar_entry").fetchone()[0] == 6
    assert connection.execute("SELECT action FROM care WHERE entry_id = 'care-9'").fetchone()[0] == "watering"
    assert connection.execute("SELECT weight_grams FROM harvest WHERE entry_id = 'evt-18'").fetchone()[0] == 840
    assert connection.execute("SELECT COUNT(*) FROM harvest WHERE entry_id = 'sow-7'").fetchone()[0] == 0
    connection.close()


def test_filters_and_replaces_without_changing_kind(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        client.put("/api/calendar/sow-7", json=sowing())
        client.put("/api/calendar/care-9", json=watering())
        client.put("/api/calendar/evt-18", json=harvest())
        client.put("/api/calendar/evt-20", json=harvest("evt-20", "2026-10-30", "planned", 100))

        sowings = client.get("/api/calendar?kind=sowing&status=planned&crop=Coriander")
        assert [entry["id"] for entry in sowings.json()] == ["sow-7"]
        care = client.get("/api/calendar?kind=care&action=watering&bedId=bed-4")
        assert [entry["id"] for entry in care.json()] == ["care-9"]
        done = client.get("/api/calendar?kind=harvest&status=done&from=2026-10-23&to=2026-10-23")
        assert [entry["id"] for entry in done.json()] == ["evt-18"]

        rejected = client.put("/api/calendar/evt-18", json={**watering(), "id": "evt-18"})
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "kind cannot change"
        assert client.get("/api/calendar/evt-18").json()["weightGrams"] == 840

        changed = harvest()
        changed["weightGrams"] = 900
        assert client.put("/api/calendar/evt-18", json=changed).json()["weightGrams"] == 900

        extra = {**sowing(), "quantity": 3}
        assert client.put("/api/calendar/sow-7", json=extra).status_code == 400
        named = {**sowing(), "bedName": "Herb bed"}
        rejected_name = client.put("/api/calendar/sow-7", json=named)
        assert rejected_name.status_code == 400
        assert rejected_name.json()["detail"] == "bedName is not part of a sowing entry"
        planned_diary = {**diary(), "status": "planned"}
        assert client.put("/api/calendar/note-19", json=planned_diary).status_code == 400
        mismatch = sowing()
        mismatch["id"] = "other"
        assert client.put("/api/calendar/sow-7", json=mismatch).status_code == 400
        assert client.put("/api/calendar/bad id", json=sowing()).status_code == 400
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

        client.put("/api/calendar/evt-18", json=harvest())
        client.put("/api/calendar/evt-20", json=harvest("evt-20", "2026-10-30", "planned", 500))
        client.put("/api/calendar/evt-21", json=harvest("evt-21", "2026-10-12", "done", 120, "Coriander"))
        client.put("/api/calendar/evt-22", json=harvest("evt-22", "2026-09-01", "done", 50))
        client.put("/api/calendar/care-10", json=fertilising())
        client.put("/api/calendar/care-12", json=fertilising("care-12", "2026-10-19", 25))
        client.put("/api/calendar/care-9", json=watering())

        tomato = client.get(
            "/api/calendar/totals/harvest?crop=Tomato&from=2026-09-23&to=2026-10-23"
        )
        assert tomato.json() == {"crop": "Tomato", "weightGrams": 840}
        bed = client.get(
            "/api/calendar/totals/harvest?crop=Tomato&bedId=bed-4&from=2026-09-23&to=2026-10-23"
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
            "/api/calendar/totals/care?action=watering&unit=L&bedId=bed-4&from=2026-10-01&to=2026-10-31"
        )
        assert water.json() == {"action": "watering", "unit": "L", "amount": 10}


def test_delete_removes_child_row_and_photo(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    photo = png_bytes()

    with TestClient(app) as client:
        assert client.delete("/api/calendar/evt-18").status_code == 204

        stored = client.put(
            "/api/photos/evt-18",
            content=photo,
            headers={"Content-Type": "image/png"},
        )
        assert stored.json() == {"url": "/api/photos/evt-18"}
        body = harvest()
        body["photoUrl"] = "/api/photos/evt-18"
        assert client.put("/api/calendar/evt-18", json=body).json()["photoUrl"] == "/api/photos/evt-18"

        cleared = harvest()
        cleared["photoUrl"] = ""
        cleared["weightGrams"] = 900
        assert client.put("/api/calendar/evt-18", json=cleared).json()["photoUrl"] == ""
        assert client.get("/api/photos/evt-18").status_code == 404

        client.put(
            "/api/photos/evt-18",
            content=photo,
            headers={"Content-Type": "image/png"},
        )
        replaced = harvest()
        replaced["photoUrl"] = "/api/photos/evt-18"
        client.put("/api/calendar/evt-18", json=replaced)
        removed = client.delete("/api/calendar/evt-18")
        assert removed.status_code == 204
        assert client.get("/api/calendar/evt-18").status_code == 404
        assert client.get("/api/photos/evt-18").status_code == 404

    assert (tmp_path / "photos" / "evt-18.png").exists() is False
    connection = sqlite3.connect(tmp_path / "baghban.db")
    assert connection.execute("SELECT COUNT(*) FROM calendar_entry").fetchone()[0] == 0
    assert connection.execute("SELECT COUNT(*) FROM harvest").fetchone()[0] == 0
    connection.close()
