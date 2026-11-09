"""Which crop is in which bed, and when.

One row is one assignment. The same crop can return to the same bed later,
so bed and crop are not the primary key. An empty archived_on means the
crop is still in the bed. Taking it out sets that date and keeps the row.
"""

import json
import logging
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def connect():
    from app import connect as open_db

    return open_db()


def create_beds_crops(connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS beds_crops (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            bed_id       INTEGER NOT NULL REFERENCES bed(id),
            crop_id      INTEGER NOT NULL REFERENCES crop(id),
            created_on   TEXT NOT NULL,
            archived_on  TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS beds_crops_one_active
        ON beds_crops (bed_id, crop_id)
        WHERE archived_on IS NULL
        """
    )


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def canvas_name(name: str, emoji: str) -> str:
    """The catalogue string the map already uses, such as '🍅 Tomatoes'."""
    if emoji:
        return f"{emoji} {name}"
    return name


def _crop_rows(connection):
    return connection.execute("SELECT id, name, emoji FROM crop").fetchall()


def match_crop(crops, raw: str):
    if not isinstance(raw, str):
        return None
    wanted = raw.strip().casefold()
    if not wanted:
        return None
    for crop in crops:
        emoji = crop["emoji"] or ""
        plain = crop["name"].casefold()
        labeled = canvas_name(crop["name"], emoji).casefold()
        if wanted in (plain, labeled):
            return crop
    return None


def _require_bed(connection, bed_id: int):
    row = connection.execute("SELECT id FROM bed WHERE id = ?", (bed_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Bed not found")


def _require_crop(connection, name: str):
    crop = match_crop(_crop_rows(connection), name)
    if crop is None:
        raise HTTPException(status_code=400, detail="Unknown crop")
    return crop


def _assignment(row, crop) -> dict:
    return {
        "id": int(row["id"]),
        "bedId": int(row["bed_id"]),
        "cropId": int(row["crop_id"]),
        "name": canvas_name(crop["name"], crop["emoji"] or ""),
        "createdOn": row["created_on"],
        "archivedOn": row["archived_on"],
    }


def list_active_assignments() -> list:
    """Crops still in a bed, with the date and maturity the home page reads."""
    with closing(connect()) as connection:
        rows = connection.execute(
            """
            SELECT
                beds_crops.id,
                beds_crops.bed_id,
                beds_crops.created_on,
                bed.name AS bed_name,
                crop.id AS crop_id,
                crop.name AS crop_name,
                crop.emoji,
                crop.icon,
                crop.days_to_maturity
            FROM beds_crops
            JOIN bed ON bed.id = beds_crops.bed_id
            JOIN crop ON crop.id = beds_crops.crop_id
            WHERE beds_crops.archived_on IS NULL
              AND bed.removed = 0
            ORDER BY beds_crops.id
            """
        ).fetchall()
    assignments = []
    for row in rows:
        maturity = row["days_to_maturity"]
        assignments.append(
            {
                "id": int(row["id"]),
                "bedId": int(row["bed_id"]),
                "bedName": row["bed_name"] or "",
                "cropId": int(row["crop_id"]),
                "name": row["crop_name"],
                "emoji": row["emoji"] or "",
                "icon": row["icon"] or "",
                "createdOn": row["created_on"],
                "daysToMaturity": None if maturity is None else int(maturity),
            }
        )
    return assignments


def active_names(connection) -> dict[int, list[str]]:
    """Catalogue names of crops still in each bed, in the order they were added."""
    grouped: dict[int, list[str]] = {}
    rows = connection.execute(
        """
        SELECT beds_crops.bed_id, crop.name, crop.emoji
        FROM beds_crops
        JOIN crop ON crop.id = beds_crops.crop_id
        WHERE beds_crops.archived_on IS NULL
        ORDER BY beds_crops.id
        """
    ).fetchall()
    for row in rows:
        grouped.setdefault(int(row["bed_id"]), []).append(
            canvas_name(row["name"], row["emoji"] or "")
        )
    return grouped


def assign_crop(bed_id: int, name: str) -> dict:
    """Put a crop in a bed. An active row for that pair is left as it is."""
    with closing(connect()) as connection:
        _require_bed(connection, bed_id)
        crop = _require_crop(connection, name)
        active = connection.execute(
            """
            SELECT id, bed_id, crop_id, created_on, archived_on
            FROM beds_crops
            WHERE bed_id = ? AND crop_id = ? AND archived_on IS NULL
            """,
            (bed_id, int(crop["id"])),
        ).fetchone()
        if active is None:
            when = today()
            cursor = connection.execute(
                """
                INSERT INTO beds_crops (bed_id, crop_id, created_on)
                VALUES (?, ?, ?)
                """,
                (bed_id, int(crop["id"]), when),
            )
            connection.commit()
            active = connection.execute(
                """
                SELECT id, bed_id, crop_id, created_on, archived_on
                FROM beds_crops
                WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
        return _assignment(active, crop)


def place_crop_id(connection, bed_id: int, crop_id: int, when: str) -> None:
    """Give a bed an active crop on `when`. An active row for that pair stays."""
    found = connection.execute("SELECT id FROM crop WHERE id = ?", (crop_id,)).fetchone()
    if found is None:
        raise HTTPException(status_code=400, detail="Unknown crop")
    active = connection.execute(
        """
        SELECT 1
        FROM beds_crops
        WHERE bed_id = ? AND crop_id = ? AND archived_on IS NULL
        """,
        (bed_id, crop_id),
    ).fetchone()
    if active is not None:
        return
    try:
        connection.execute(
            """
            INSERT INTO beds_crops (bed_id, crop_id, created_on)
            VALUES (?, ?, ?)
            """,
            (bed_id, crop_id, when),
        )
    except sqlite3.IntegrityError:
        return


def place_crop(connection, bed_id: int, name: str, when: str) -> None:
    """Give a bed an active crop on `when`. An active row for that pair stays."""
    crop = match_crop(_crop_rows(connection), name)
    if crop is None:
        raise HTTPException(status_code=400, detail="Unknown crop")
    place_crop_id(connection, bed_id, int(crop["id"]), when)


def archive_crop_id(connection, bed_id: int, crop_id: int, when: str) -> None:
    """Finish the active assignment on `when`. A missing active row stays finished."""
    connection.execute(
        """
        UPDATE beds_crops
        SET archived_on = ?
        WHERE bed_id = ? AND crop_id = ? AND archived_on IS NULL
        """,
        (when, bed_id, crop_id),
    )


def archive_crop(bed_id: int, name: str) -> None:
    """Mark the active assignment finished. A missing active row stays finished."""
    with closing(connect()) as connection:
        _require_bed(connection, bed_id)
        crop = _require_crop(connection, name)
        archive_crop_id(connection, bed_id, int(crop["id"]), today())
        connection.commit()


def archive_bed_crops(connection, bed_id: int) -> None:
    """Finish every crop still in a bed that is leaving the map."""
    connection.execute(
        """
        UPDATE beds_crops
        SET archived_on = ?
        WHERE bed_id = ? AND archived_on IS NULL
        """,
        (today(), bed_id),
    )


def copy_document_plants(connection) -> None:
    """Move plant names out of garden_plan.document, then drop that column.

    A name that matches no crop, or a bed id that is not in bed, is left out
    and written to the log. New databases never have the column.
    """
    columns = {
        row[1] for row in connection.execute("PRAGMA table_info(garden_plan)")
    }
    if "document" not in columns:
        return
    stored = connection.execute(
        "SELECT document FROM garden_plan WHERE id = 1"
    ).fetchone()
    skipped: list[str] = []
    if stored is not None and stored["document"]:
        skipped.extend(_copy_names(connection, stored["document"]))
    if skipped:
        logger.warning("Plant names left out of beds_crops: %s", ", ".join(skipped))
    connection.execute("ALTER TABLE garden_plan DROP COLUMN document")


def _copy_names(connection, raw: str) -> list[str]:
    skipped: list[str] = []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return ["unreadable document"]
    plants = parsed.get("plants", {}) if isinstance(parsed, dict) else {}
    if not isinstance(plants, dict):
        return ["unreadable document"]
    crops = _crop_rows(connection)
    when = today()
    for key, names in plants.items():
        try:
            bed_id = int(key)
        except (TypeError, ValueError):
            skipped.append(str(key))
            continue
        found = connection.execute(
            "SELECT 1 FROM bed WHERE id = ?",
            (bed_id,),
        ).fetchone()
        if found is None:
            skipped.append(f"bed {key}")
            continue
        if not isinstance(names, list):
            skipped.append(f"bed {key}")
            continue
        for name in names:
            if not isinstance(name, str) or not name.strip():
                continue
            crop = match_crop(crops, name)
            if crop is None:
                skipped.append(name)
                continue
            active = connection.execute(
                """
                SELECT 1 FROM beds_crops
                WHERE bed_id = ? AND crop_id = ? AND archived_on IS NULL
                """,
                (bed_id, int(crop["id"])),
            ).fetchone()
            if active is None:
                connection.execute(
                    """
                    INSERT INTO beds_crops (bed_id, crop_id, created_on)
                    VALUES (?, ?, ?)
                    """,
                    (bed_id, int(crop["id"]), when),
                )
    return skipped
