import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import app
from migrate import apply_pending, migrate


def test_a_new_database_is_stamped_at_the_current_version(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))

    with TestClient(app):
        pass

    connection = sqlite3.connect(db)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    care = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'care'"
    ).fetchone()[0]
    assert "CHECK" not in care.upper()
    crop = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'crop'"
    ).fetchone()[0]
    assert "icon" in crop
    calendar = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'calendar_entry'"
    ).fetchone()[0]
    assert "crop_id" in calendar
    assert "crop TEXT" not in calendar
    assert "rule_id" in calendar
    assert (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE name = 'care_rule'"
        ).fetchone()
        is not None
    )
    connection.close()


def test_a_database_already_at_this_version_keeps_its_checks(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    connection = sqlite3.connect(db)
    connection.execute("PRAGMA user_version = 4")
    connection.execute(
        """
        CREATE TABLE care (
            entry_id INTEGER PRIMARY KEY,
            action TEXT NOT NULL CHECK (action IN ('watering', 'fertilising')),
            product TEXT,
            amount REAL,
            unit TEXT
        )
        """
    )
    connection.commit()
    connection.close()

    with TestClient(app):
        pass

    connection = sqlite3.connect(db)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    sql = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'care'"
    ).fetchone()[0]
    assert "CHECK" in sql.upper()
    connection.close()


def test_a_failed_step_rolls_back_the_version_and_the_change(tmp_path):
    db = tmp_path / "baghban.db"
    connection = sqlite3.connect(db)
    connection.isolation_level = None

    def boom(conn):
        conn.execute("CREATE TABLE marker (id INTEGER)")
        raise RuntimeError("nope")

    with pytest.raises(RuntimeError):
        apply_pending(connection, (boom,))
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 0
    assert (
        connection.execute(
            "SELECT name FROM sqlite_master WHERE name = 'marker'"
        ).fetchone()
        is None
    )
    connection.close()
    migrate(db)
    connection = sqlite3.connect(db)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    connection.close()


def test_an_existing_crop_gains_an_empty_icon(tmp_path):
    db = tmp_path / "baghban.db"
    connection = sqlite3.connect(db)
    connection.execute("PRAGMA user_version = 1")
    connection.execute(
        """
        CREATE TABLE crop (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute("INSERT INTO crop (name, emoji) VALUES ('Mint', '🌿')")
    connection.commit()
    connection.close()

    migrate(db)

    connection = sqlite3.connect(db)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    assert connection.execute("SELECT name, emoji, icon FROM crop").fetchone() == (
        "Mint",
        "🌿",
        "",
    )
    connection.close()


def test_calendar_crop_text_becomes_crop_id(tmp_path):
    db = tmp_path / "baghban.db"
    connection = sqlite3.connect(db)
    connection.execute("PRAGMA user_version = 2")
    connection.execute(
        """
        CREATE TABLE crop (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            emoji TEXT NOT NULL DEFAULT '',
            icon TEXT NOT NULL DEFAULT ''
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE crop_alias (
            crop_id INTEGER NOT NULL REFERENCES crop(id),
            alias TEXT NOT NULL,
            PRIMARY KEY (crop_id, alias)
        )
        """
    )
    connection.execute("INSERT INTO crop (id, name, emoji) VALUES (7, 'Seeta Phal', '')")
    connection.execute(
        "INSERT INTO crop_alias (crop_id, alias) VALUES (7, 'Custard apple')"
    )
    connection.execute(
        """
        CREATE TABLE calendar_entry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            date TEXT NOT NULL,
            bed_id INTEGER,
            crop TEXT,
            status TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            photo_url TEXT
        )
        """
    )
    connection.execute(
        """
        INSERT INTO calendar_entry (kind, date, crop, status, note)
        VALUES
            ('harvest', '2026-10-01', 'Custard apple', 'done', ''),
            ('diary', '2026-10-02', '', 'done', 'Garden note'),
            ('care', '2026-10-03', 'Seeta Phal', 'done', '')
        """
    )
    connection.commit()
    connection.close()

    migrate(db)

    connection = sqlite3.connect(db)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    rows = connection.execute(
        "SELECT id, crop_id FROM calendar_entry ORDER BY id"
    ).fetchall()
    assert rows == [(1, 7), (2, None), (3, 7)]
    columns = {info[1] for info in connection.execute("PRAGMA table_info(calendar_entry)")}
    assert "crop_id" in columns
    assert "crop" not in columns
    assert "rule_id" in columns
    assert (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE name = 'care_rule'"
        ).fetchone()
        is not None
    )
    connection.close()


def test_care_recurrence_adds_rule_table_and_rule_id(tmp_path):
    db = tmp_path / "baghban.db"
    connection = sqlite3.connect(db)
    connection.execute("PRAGMA user_version = 3")
    connection.execute(
        """
        CREATE TABLE calendar_entry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            date TEXT NOT NULL,
            bed_id INTEGER,
            crop_id INTEGER,
            status TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            photo_url TEXT
        )
        """
    )
    connection.commit()
    connection.close()

    migrate(db)

    connection = sqlite3.connect(db)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 4
    columns = {info[1] for info in connection.execute("PRAGMA table_info(calendar_entry)")}
    assert "rule_id" in columns
    assert (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE name = 'care_rule'"
        ).fetchone()
        is not None
    )
    connection.close()
