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
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
    care = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'care'"
    ).fetchone()[0]
    assert "CHECK" not in care.upper()
    crop = connection.execute(
        "SELECT sql FROM sqlite_master WHERE name = 'crop'"
    ).fetchone()[0]
    assert "icon" in crop
    connection.close()


def test_a_database_already_at_this_version_keeps_its_checks(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    connection = sqlite3.connect(db)
    connection.execute("PRAGMA user_version = 2")
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
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
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
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
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
    assert connection.execute("PRAGMA user_version").fetchone()[0] == 2
    assert connection.execute("SELECT name, emoji, icon FROM crop").fetchone() == (
        "Mint",
        "🌿",
        "",
    )
    connection.close()
