import logging
import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from app import app, connect

CALIBRATION = {"x1": 10, "y1": 20, "x2": 110, "y2": 20, "lengthFt": 8}


def settings():
    return {
        "garden": {
            "width": 40,
            "height": 22,
            "scale": "dimensions",
            "widthText": "40",
            "heightText": "22 ft",
        },
        "plot": {
            "plotId": "plot-9",
            "photoUrl": "/api/photos/plot-9",
            "widthPx": 1200,
            "heightPx": 800,
            "feetPerPixel": 0.25,
            "calibration": CALIBRATION,
        },
    }


def empty_plot():
    return {
        "plotId": None,
        "photoUrl": None,
        "widthPx": None,
        "heightPx": None,
        "feetPerPixel": None,
        "calibration": None,
    }


def add_bed(bed_id):
    with closing(connect()) as connection:
        connection.execute(
            """
            INSERT INTO bed (id, name, kind, area_sqft, removed)
            VALUES (?, 'Herbs', 'bed', 32, 0)
            """,
            (str(bed_id),),
        )
        connection.commit()


def test_garden_settings_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    body = settings()
    partial = {
        "garden": {"width": 20, "height": 18},
        "plot": {"plotId": "plot-1"},
    }

    with TestClient(app) as client:
        empty = client.get("/api/garden")
        assert empty.status_code == 204
        assert empty.content == b""

        rejected = client.put(
            "/api/garden",
            json={
                "garden": {"width": 20, "height": 18},
                "beds": [],
                "obstacles": [],
                "nextId": 2,
            },
        )
        assert rejected.status_code == 400
        assert client.get("/api/garden").status_code == 204

        saved = client.put("/api/garden", json=body)
        assert saved.status_code == 200
        assert saved.json() == {**body, "beds": [], "obstacles": []}
        assert saved.json()["plot"]["calibration"] == CALIBRATION

        loaded = client.get("/api/garden")
        assert loaded.status_code == 200
        assert loaded.json() == {**body, "beds": [], "obstacles": []}

        replaced = client.put("/api/garden", json=partial)
        assert replaced.status_code == 200
        loaded = client.get("/api/garden").json()
        assert loaded["garden"] == {
            "width": 20,
            "height": 18,
            "scale": None,
            "widthText": "",
            "heightText": "",
        }
        assert loaded["plot"] == {**empty_plot(), "plotId": "plot-1"}
        assert "plants" not in loaded

        for field, value in (("beds", []), ("obstacles", []), ("nextId", 3)):
            again = client.put("/api/garden", json={**partial, field: value})
            assert again.status_code == 400
        assert client.get("/api/garden").json() == loaded

    connection = sqlite3.connect(tmp_path / "baghban.db")
    connection.row_factory = sqlite3.Row
    rows = connection.execute("SELECT * FROM garden_plan").fetchall()
    assert len(rows) == 1
    row = rows[0]
    assert row["id"] == 1
    assert row["width"] == 20
    assert row["height"] == 18
    assert row["scale"] is None
    assert row["width_text"] == ""
    assert row["height_text"] == ""
    assert row["plot_id"] == "plot-1"
    assert row["photo_url"] is None
    assert row["width_px"] is None
    assert row["height_px"] is None
    assert row["feet_per_pixel"] is None
    assert row["calibration"] is None
    columns = [info[1] for info in connection.execute("PRAGMA table_info(garden_plan)")]
    assert "document" not in columns
    try:
        connection.execute(
            "INSERT INTO garden_plan (id, saved_at) VALUES (2, 't')"
        )
        raise AssertionError("a second garden row was inserted")
    except sqlite3.IntegrityError:
        pass
    connection.close()


def test_crops_follow_existing_beds(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    tomato = "🍅 Tomatoes"
    basil = "🌿 Basil"
    body = {
        "garden": {
            "width": 20,
            "height": 18,
            "scale": "plan",
            "widthText": "",
            "heightText": "",
        },
        "plot": None,
    }

    with TestClient(app) as client:
        assert client.put("/api/garden", json=body).status_code == 200
        assert client.get("/api/garden").json()["plot"] == empty_plot()
        add_bed(4)

        missing = client.put("/api/beds/9/crops", json={"name": tomato})
        assert missing.status_code == 404
        unknown = client.put("/api/beds/4/crops", json={"name": "Not a crop"})
        assert unknown.status_code == 400

        first = client.put("/api/beds/4/crops", json={"name": tomato})
        assert first.status_code == 200
        second = client.put("/api/beds/4/crops", json={"name": basil})
        assert second.status_code == 200
        again = client.put("/api/beds/4/crops", json={"name": tomato})
        assert again.status_code == 200
        assert again.json()["id"] == first.json()["id"]
        assert again.json()["archivedOn"] is None

        resized = {
            "garden": {
                "width": 12,
                "height": 10,
                "scale": "dimensions",
                "widthText": "12",
                "heightText": "10",
            },
        }
        assert client.put("/api/garden", json=resized).status_code == 200
        loaded = client.get("/api/garden").json()
        assert "plants" not in loaded
        assert loaded["beds"][0]["plants"] == [tomato, basil]
        assert loaded["garden"]["width"] == 12
        assert loaded["garden"]["widthText"] == "12"

        assert client.put(
            "/api/beds/4/crops/archive",
            json={"name": tomato},
        ).status_code == 204
        loaded = client.get("/api/garden").json()
        assert loaded["beds"][0]["plants"] == [basil]
        assert loaded["garden"]["width"] == 12
        assert loaded["plot"] == empty_plot()

        replanted = client.put("/api/beds/4/crops", json={"name": tomato})
        assert replanted.status_code == 200
        assert replanted.json()["id"] != first.json()["id"]
        loaded = client.get("/api/garden").json()
        assert loaded["beds"][0]["plants"] == [basil, tomato]

        assert client.delete("/api/beds/4").status_code == 204
        assert client.get("/api/garden").json()["beds"] == []

    connection = sqlite3.connect(tmp_path / "baghban.db")
    rows = connection.execute(
        """
        SELECT crop.name, beds_crops.archived_on
        FROM beds_crops
        JOIN crop ON crop.id = beds_crops.crop_id
        ORDER BY beds_crops.id
        """
    ).fetchall()
    assert [row[0] for row in rows] == ["Tomatoes", "Basil", "Tomatoes"]
    assert all(row[1] for row in rows)
    connection.close()


def test_document_plants_move_into_beds_crops(tmp_path, monkeypatch, caplog):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    connection = sqlite3.connect(db)
    connection.execute(
        """
        CREATE TABLE garden_plan (
            id              INTEGER PRIMARY KEY CHECK (id = 1),
            width           REAL,
            height          REAL,
            scale           TEXT,
            width_text      TEXT NOT NULL DEFAULT '',
            height_text     TEXT NOT NULL DEFAULT '',
            plot_id         TEXT,
            photo_url       TEXT,
            width_px        INTEGER,
            height_px       INTEGER,
            feet_per_pixel  REAL,
            calibration     TEXT,
            document        TEXT NOT NULL DEFAULT '{"plants":{}}',
            saved_at        TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE bed (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL DEFAULT '',
            kind       TEXT NOT NULL,
            x          REAL NOT NULL DEFAULT 0,
            y          REAL NOT NULL DEFAULT 0,
            w          REAL NOT NULL DEFAULT 0,
            h          REAL NOT NULL DEFAULT 0,
            diam       REAL,
            rotation   REAL NOT NULL DEFAULT 0,
            color      TEXT NOT NULL DEFAULT '',
            notes      TEXT NOT NULL DEFAULT '',
            area_sqft  REAL NOT NULL DEFAULT 0,
            outline    TEXT,
            plant_grid TEXT,
            removed    INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    connection.execute(
        "INSERT INTO bed (id, name, kind, w, h, area_sqft, plant_grid) VALUES (4, 'Herbs', 'bed', 4, 8, 32, '[]')"
    )
    connection.execute(
        "INSERT INTO garden_plan (id, width, height, saved_at, document) VALUES (1, 20, 10, 't', ?)",
        ('{"plants":{"4":["🍅 Tomatoes","Missing herb"]}}',),
    )
    connection.commit()
    connection.close()

    caplog.set_level(logging.WARNING)
    with TestClient(app) as client:
        loaded = client.get("/api/garden").json()
        assert loaded["beds"][0]["plants"] == ["🍅 Tomatoes"]
        assert "plantGrid" not in loaded["beds"][0]
    assert "Missing herb" in caplog.text

    connection = sqlite3.connect(db)
    garden_columns = [info[1] for info in connection.execute("PRAGMA table_info(garden_plan)")]
    bed_columns = [info[1] for info in connection.execute("PRAGMA table_info(bed)")]
    assert "document" not in garden_columns
    assert "plant_grid" not in bed_columns
    stored = connection.execute(
        """
        SELECT crop.name FROM beds_crops
        JOIN crop ON crop.id = beds_crops.crop_id
        """
    ).fetchall()
    assert [row[0] for row in stored] == ["Tomatoes"]
    connection.close()
