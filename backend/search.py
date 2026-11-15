"""App-wide full-text search over the garden database.

One FTS5 table holds a document per searchable entity. Domain write paths
call the index_* helpers in the same transaction. migrate / init_db run
reindex_all() for a full rebuild.
"""

from __future__ import annotations

import re
from contextlib import closing

from fastapi import APIRouter, Depends, Query

from auth import require_auth

router = APIRouter(dependencies=[Depends(require_auth)])

ENTITY_GROUPS = {
    "crop": "Crops",
    "bed": "Beds",
    "obstacle": "Obstacles",
    "calendar": "Calendar",
    "care_rule": "Care schedules",
    "inventory": "Inventory",
    "garden": "Garden",
}

INACTIVE_LABELS = {
    "crop": "Archived",
    "bed": "Removed",
    "care_rule": "Inactive",
    "inventory": "Archived",
}

_TOKEN = re.compile(r"[\w]+", re.UNICODE)


def connect():
    from app import connect as open_db

    return open_db()


def create_search_tables(connection) -> None:
    connection.execute(
        """
        CREATE VIRTUAL TABLE IF NOT EXISTS search_doc USING fts5(
            entity UNINDEXED,
            entity_id UNINDEXED,
            title,
            body,
            meta,
            href UNINDEXED,
            inactive UNINDEXED,
            tokenize = 'unicode61'
        )
        """
    )


def _join_parts(*parts: str | None) -> str:
    return " ".join(part.strip() for part in parts if part and str(part).strip())


def _table_exists(connection, name: str) -> bool:
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?",
        (name,),
    ).fetchone()
    return row is not None


def remove_doc(connection, entity: str, entity_id: str) -> None:
    if not _table_exists(connection, "search_doc"):
        return
    rows = connection.execute(
        "SELECT rowid FROM search_doc WHERE entity = ? AND entity_id = ?",
        (entity, str(entity_id)),
    ).fetchall()
    for row in rows:
        connection.execute("DELETE FROM search_doc WHERE rowid = ?", (row[0],))


def upsert_doc(
    connection,
    *,
    entity: str,
    entity_id: str | int,
    title: str,
    body: str = "",
    meta: str = "",
    href: str,
    inactive: bool = False,
) -> None:
    if not _table_exists(connection, "search_doc"):
        return
    key = str(entity_id)
    remove_doc(connection, entity, key)
    connection.execute(
        """
        INSERT INTO search_doc (entity, entity_id, title, body, meta, href, inactive)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            entity,
            key,
            title or "",
            body or "",
            meta or "",
            href,
            "1" if inactive else "0",
        ),
    )


def index_crop(connection, crop_id: int) -> None:
    if not _table_exists(connection, "crop"):
        return
    row = connection.execute("SELECT * FROM crop WHERE id = ?", (crop_id,)).fetchone()
    if row is None:
        remove_doc(connection, "crop", str(crop_id))
        return
    aliases = []
    if _table_exists(connection, "crop_alias"):
        aliases = [
            item[0]
            for item in connection.execute(
                "SELECT alias FROM crop_alias WHERE crop_id = ?",
                (crop_id,),
            )
        ]
    upsert_doc(
        connection,
        entity="crop",
        entity_id=crop_id,
        title=row["name"] or "",
        body=_join_parts(
            " ".join(aliases),
            row["category"],
            row["notes"],
            row["sun"],
            row["water"],
            row["emoji"],
        ),
        meta=_join_parts(row["category"], "archived" if row["archived"] else ""),
        href="/crops",
        inactive=bool(row["archived"]),
    )


def index_bed(connection, bed_id: int) -> None:
    if not _table_exists(connection, "bed"):
        return
    row = connection.execute("SELECT * FROM bed WHERE id = ?", (bed_id,)).fetchone()
    if row is None:
        remove_doc(connection, "bed", str(bed_id))
        return
    name = (row["name"] or "").strip() or (row["kind"] or "Bed")
    upsert_doc(
        connection,
        entity="bed",
        entity_id=bed_id,
        title=name,
        body=_join_parts(row["notes"], row["kind"]),
        meta=_join_parts(row["kind"], "removed" if row["removed"] else ""),
        href="/planner",
        inactive=bool(row["removed"]),
    )


def index_obstacle(connection, obstacle_id: int) -> None:
    if not _table_exists(connection, "obstacle"):
        return
    row = connection.execute(
        "SELECT * FROM obstacle WHERE id = ?",
        (obstacle_id,),
    ).fetchone()
    if row is None:
        remove_doc(connection, "obstacle", str(obstacle_id))
        return
    upsert_doc(
        connection,
        entity="obstacle",
        entity_id=obstacle_id,
        title=(row["name"] or "").strip() or "Obstacle",
        body="",
        meta="",
        href="/planner",
        inactive=False,
    )


def _harvest_grams_label(weight) -> str:
    if weight is None:
        return ""
    try:
        grams = float(weight)
    except (TypeError, ValueError):
        return ""
    if grams <= 0:
        return ""
    if grams.is_integer():
        return f"{int(grams)} g"
    return f"{grams} g"


def index_calendar_entry(connection, entry_id: int) -> None:
    if not _table_exists(connection, "calendar_entry"):
        return
    row = connection.execute(
        """
        SELECT
            calendar_entry.id,
            calendar_entry.kind,
            calendar_entry.date,
            calendar_entry.status,
            calendar_entry.note,
            crop.name AS crop_name,
            bed.name AS bed_name,
            care.action AS care_action,
            care.product AS care_product,
            care.unit AS care_unit,
            pest.problem AS pest_problem,
            pest.product AS pest_product,
            pest.unit AS pest_unit,
            harvest.quantity AS harvest_quantity,
            harvest.unit AS harvest_unit,
            harvest.weight_grams AS weight_grams
        FROM calendar_entry
        LEFT JOIN crop ON crop.id = calendar_entry.crop_id
        LEFT JOIN bed ON bed.id = calendar_entry.bed_id
        LEFT JOIN care ON care.entry_id = calendar_entry.id
        LEFT JOIN pest ON pest.entry_id = calendar_entry.id
        LEFT JOIN harvest ON harvest.entry_id = calendar_entry.id
        WHERE calendar_entry.id = ?
        """,
        (entry_id,),
    ).fetchone()
    if row is None:
        remove_doc(connection, "calendar", str(entry_id))
        return
    kind = row["kind"] or ""
    entry_date = row["date"] or ""
    crop_name = row["crop_name"] or ""
    bed_name = row["bed_name"] or ""
    note = row["note"] or ""
    grams_label = _harvest_grams_label(row["weight_grams"]) if kind == "harvest" else ""
    title_bits = []
    if entry_date:
        title_bits.append(entry_date)
    title_bits.append(kind)
    if crop_name:
        title_bits.append(crop_name)
    elif bed_name:
        title_bits.append(bed_name)
    elif note:
        title_bits.append(note[:60])
    if grams_label:
        title_bits.append(grams_label)
    upsert_doc(
        connection,
        entity="calendar",
        entity_id=entry_id,
        title=" · ".join(title_bits),
        body=_join_parts(
            note,
            bed_name,
            crop_name,
            row["care_action"],
            row["care_product"],
            row["care_unit"],
            row["pest_problem"],
            row["pest_product"],
            row["pest_unit"],
            str(row["harvest_quantity"] or ""),
            row["harvest_unit"],
            grams_label,
        ),
        meta=_join_parts(kind, entry_date, row["status"]),
        href=f"/calendar?date={entry_date}" if entry_date else "/calendar",
        inactive=False,
    )


def index_care_rule(connection, rule_id: int) -> None:
    if not _table_exists(connection, "care_rule"):
        return
    row = connection.execute(
        """
        SELECT
            care_rule.*,
            crop.name AS crop_name,
            bed.name AS bed_name
        FROM care_rule
        LEFT JOIN crop ON crop.id = care_rule.crop_id
        LEFT JOIN bed ON bed.id = care_rule.bed_id
        WHERE care_rule.id = ?
        """,
        (rule_id,),
    ).fetchone()
    if row is None:
        remove_doc(connection, "care_rule", str(rule_id))
        return
    action = row["action"] or ""
    product = row["product"] or ""
    title = _join_parts(action, product) or "Care schedule"
    upsert_doc(
        connection,
        entity="care_rule",
        entity_id=rule_id,
        title=title,
        body=_join_parts(
            row["note"],
            row["crop_name"],
            row["bed_name"],
            row["unit"],
            row["freq"],
        ),
        meta=_join_parts(row["freq"], "inactive" if not row["active"] else ""),
        href="/calendar",
        inactive=not bool(row["active"]),
    )


def index_inventory(connection, item_id: int) -> None:
    if not _table_exists(connection, "inventory_item"):
        return
    row = connection.execute(
        "SELECT * FROM inventory_item WHERE id = ?",
        (item_id,),
    ).fetchone()
    if row is None:
        remove_doc(connection, "inventory", str(item_id))
        return
    from inventory import decode_tags

    tags = decode_tags(row["tags"])
    upsert_doc(
        connection,
        entity="inventory",
        entity_id=item_id,
        title=row["name"] or "",
        body=_join_parts(
            row["description"],
            " ".join(tags),
            row["manufacturer"],
            row["model_number"],
            row["purchase_from"],
            row["location_path"],
            row["notes"],
        ),
        meta=_join_parts(" ".join(tags), "archived" if row["archived"] else ""),
        href="/inventory",
        inactive=bool(row["archived"]),
    )


def index_garden(connection) -> None:
    if not _table_exists(connection, "garden_plan"):
        return
    row = connection.execute(
        "SELECT name, subtitle FROM garden_plan WHERE id = 1"
    ).fetchone()
    if row is None:
        remove_doc(connection, "garden", "1")
        return
    name = (row["name"] or "").strip()
    subtitle = (row["subtitle"] or "").strip()
    if not name and not subtitle:
        remove_doc(connection, "garden", "1")
        return
    upsert_doc(
        connection,
        entity="garden",
        entity_id=1,
        title=name or "Garden",
        body=subtitle,
        meta="",
        href="/settings",
        inactive=False,
    )


def reindex_calendars_for_crop(connection, crop_id: int) -> None:
    if not _table_exists(connection, "calendar_entry"):
        return
    rows = connection.execute(
        "SELECT id FROM calendar_entry WHERE crop_id = ?",
        (crop_id,),
    ).fetchall()
    for row in rows:
        index_calendar_entry(connection, int(row["id"]))


def reindex_calendars_for_bed(connection, bed_id: int) -> None:
    if not _table_exists(connection, "calendar_entry"):
        return
    rows = connection.execute(
        "SELECT id FROM calendar_entry WHERE bed_id = ?",
        (bed_id,),
    ).fetchall()
    for row in rows:
        index_calendar_entry(connection, int(row["id"]))


def reindex_rules_for_crop(connection, crop_id: int) -> None:
    if not _table_exists(connection, "care_rule"):
        return
    rows = connection.execute(
        "SELECT id FROM care_rule WHERE crop_id = ?",
        (crop_id,),
    ).fetchall()
    for row in rows:
        index_care_rule(connection, int(row["id"]))


def reindex_rules_for_bed(connection, bed_id: int) -> None:
    if not _table_exists(connection, "care_rule"):
        return
    rows = connection.execute(
        "SELECT id FROM care_rule WHERE bed_id = ?",
        (bed_id,),
    ).fetchall()
    for row in rows:
        index_care_rule(connection, int(row["id"]))


def _row_id(row) -> int:
    """Accept sqlite3.Row or a plain tuple from migrate connections."""
    try:
        return int(row["id"])
    except (TypeError, KeyError, IndexError):
        return int(row[0])


def reindex_all(connection) -> None:
    """Wipe and rebuild every search document from source tables."""
    create_search_tables(connection)
    connection.execute("DELETE FROM search_doc")
    if _table_exists(connection, "crop"):
        for row in connection.execute("SELECT id FROM crop"):
            index_crop(connection, _row_id(row))
    if _table_exists(connection, "bed"):
        for row in connection.execute("SELECT id FROM bed"):
            index_bed(connection, _row_id(row))
    if _table_exists(connection, "obstacle"):
        for row in connection.execute("SELECT id FROM obstacle"):
            index_obstacle(connection, _row_id(row))
    if _table_exists(connection, "calendar_entry"):
        for row in connection.execute("SELECT id FROM calendar_entry"):
            index_calendar_entry(connection, _row_id(row))
    if _table_exists(connection, "care_rule"):
        for row in connection.execute("SELECT id FROM care_rule"):
            index_care_rule(connection, _row_id(row))
    if _table_exists(connection, "inventory_item"):
        for row in connection.execute("SELECT id FROM inventory_item"):
            index_inventory(connection, _row_id(row))
    index_garden(connection)


def install_search_index(connection) -> None:
    """Migration step: create the FTS table. init_db runs the full backfill."""
    create_search_tables(connection)


def fts_match_query(raw: str) -> str | None:
    """Turn free text into a safe FTS5 MATCH expression with prefix terms."""
    tokens = _TOKEN.findall(raw.casefold())
    parts = [f"{token}*" for token in tokens if token]
    if not parts:
        return None
    return " AND ".join(parts)


def _calendar_date(href: str, title: str) -> str:
    """ISO date from a calendar hit href or title prefix."""
    if "date=" in (href or ""):
        value = href.split("date=", 1)[1][:10]
        if len(value) == 10 and value[4] == "-" and value[7] == "-":
            return value
    prefix = (title or "")[:10]
    if len(prefix) == 10 and prefix[4] == "-" and prefix[7] == "-":
        return prefix
    return ""


def search_docs(query: str, *, limit: int = 20) -> list[dict]:
    match = fts_match_query(query)
    if match is None:
        return []
    capped = max(1, min(limit, 50))
    with closing(connect()) as connection:
        if not _table_exists(connection, "search_doc"):
            return []
        rows = connection.execute(
            """
            SELECT
                entity,
                entity_id,
                title,
                href,
                inactive,
                snippet(search_doc, 2, '', '', '…', 10) AS title_snip,
                snippet(search_doc, 3, '', '', '…', 14) AS body_snip,
                bm25(search_doc) AS score
            FROM search_doc
            WHERE search_doc MATCH ?
            ORDER BY inactive ASC, bm25(search_doc), entity, title
            LIMIT ?
            """,
            (match, capped),
        ).fetchall()
    results = []
    for row in rows:
        entity = row["entity"]
        inactive = str(row["inactive"]) == "1"
        snippet = (row["body_snip"] or row["title_snip"] or "").strip()
        href = row["href"] or "/"
        title = row["title"] or ""
        item = {
            "entity": entity,
            "id": row["entity_id"],
            "title": title,
            "snippet": snippet,
            "href": href,
            "inactive": inactive,
            "inactiveLabel": INACTIVE_LABELS.get(entity, "") if inactive else "",
            "group": ENTITY_GROUPS.get(entity, entity),
        }
        if entity == "calendar":
            item["date"] = _calendar_date(href, title)
        results.append(item)
    others = [item for item in results if item["entity"] != "calendar"]
    calendar = [item for item in results if item["entity"] == "calendar"]
    calendar.sort(key=lambda item: item.get("date") or "", reverse=True)
    return others + calendar


@router.get("/search")
def get_search(
    q: str = Query(""),
    limit: int = Query(20, ge=1, le=50),
) -> dict:
    query = q.strip() if isinstance(q, str) else ""
    return {"q": query, "results": search_docs(query, limit=limit)}
