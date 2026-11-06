"""Schema versions for one garden database.

PRAGMA user_version is the number of the last step applied. Each step and its
new number commit together. A new file is created at the current shape by
init_db and stamped with the latest number, so the rebuild steps do not run.

Foreign keys are turned off before a step starts. SQLite will not change that
pragma inside a transaction, and a table rebuild needs it off so renaming a
table does not rewrite aliases and links.
"""

import sqlite3
from pathlib import Path

from calendar_entries import calendar_crop_id, drop_care_action_check
from care_rules import care_recurrence
from crops import add_crop_icon, drop_crop_label_checks


def drop_label_checks(connection) -> None:
    """Copy care and crop when an older file still has list checks."""
    drop_care_action_check(connection)
    drop_crop_label_checks(connection)
    broken = connection.execute("PRAGMA foreign_key_check").fetchone()
    if broken is not None:
        raise RuntimeError("Catalogue migration broke a foreign key")


MIGRATIONS = (drop_label_checks, add_crop_icon, calendar_crop_id, care_recurrence)


def apply_pending(connection, steps=MIGRATIONS) -> None:
    current = connection.execute("PRAGMA user_version").fetchone()[0]
    for number, step in enumerate(steps, start=1):
        if number <= current:
            continue
        connection.execute("PRAGMA foreign_keys = OFF")
        connection.execute("BEGIN")
        try:
            step(connection)
            connection.execute(f"PRAGMA user_version = {number}")
        except Exception:
            connection.execute("ROLLBACK")
            raise
        connection.execute("COMMIT")


def migrate(path: Path) -> None:
    connection = sqlite3.connect(path)
    connection.isolation_level = None
    try:
        apply_pending(connection)
    finally:
        connection.close()
