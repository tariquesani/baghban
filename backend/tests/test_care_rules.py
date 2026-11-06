from datetime import date, timedelta

from fastapi.testclient import TestClient

from app import app
from care_rules import due_dates


def add_bed(client, name="Herbs"):
    saved = client.put(
        "/api/beds",
        json={"name": name, "kind": "bed", "x": 1, "y": 2, "w": 4, "h": 8},
    )
    assert saved.status_code == 200
    return saved.json()["id"]


def crop_id(client, name):
    for crop in client.get("/api/crops").json():
        if crop["name"] == name:
            return crop["id"]
    raise AssertionError(f"Missing crop {name}")


def test_due_dates_every_three_days():
    rule = {
        "freq": "daily",
        "interval": 3,
        "weekdays": [],
        "anchor_date": "2026-11-06",
        "ends_on": None,
    }
    assert due_dates(rule, date(2026, 11, 6), date(2026, 11, 15)) == [
        "2026-11-06",
        "2026-11-09",
        "2026-11-12",
        "2026-11-15",
    ]


def test_due_dates_every_second_week_on_monday():
    rule = {
        "freq": "weekly",
        "interval": 2,
        "weekdays": [0],
        "anchor_date": "2026-11-02",
        "ends_on": None,
    }
    assert due_dates(rule, date(2026, 11, 2), date(2026, 12, 1)) == [
        "2026-11-02",
        "2026-11-16",
        "2026-11-30",
    ]


def test_due_dates_yearly():
    rule = {
        "freq": "yearly",
        "interval": 1,
        "weekdays": [],
        "anchor_date": "2026-03-01",
        "ends_on": None,
    }
    assert due_dates(rule, date(2026, 1, 1), date(2027, 12, 31)) == [
        "2026-03-01",
        "2027-03-01",
    ]


def test_creating_a_daily_rule_materializes_planned_care(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    today = date.today()
    ends = today + timedelta(days=9)
    expected = due_dates(
        {
            "freq": "daily",
            "interval": 3,
            "weekdays": [],
            "anchor_date": today.isoformat(),
            "ends_on": ends.isoformat(),
        },
        today,
        ends,
    )
    with TestClient(app) as client:
        bed_id = add_bed(client)
        tomatoes = crop_id(client, "Tomatoes")
        saved = client.post(
            "/api/care-rules",
            json={
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "watering",
                "product": "",
                "amount": 10,
                "unit": "L",
                "note": "",
                "freq": "daily",
                "interval": 3,
                "weekdays": [],
                "anchorDate": today.isoformat(),
                "endsOn": ends.isoformat(),
                "active": True,
            },
        )
        assert saved.status_code == 200
        rule = saved.json()
        assert rule["freq"] == "daily"
        assert rule["interval"] == 3
        assert rule["active"] is True

        listed = client.get("/api/calendar?kind=care").json()
        dates = sorted(entry["date"] for entry in listed if entry["ruleId"] == rule["id"])
        assert dates == expected
        assert all(entry["status"] == "planned" for entry in listed if entry["ruleId"] == rule["id"])
        assert all(entry["ruleActive"] is True for entry in listed if entry["ruleId"] == rule["id"])
        assert all(entry["action"] == "watering" for entry in listed if entry["ruleId"] == rule["id"])


def test_completing_one_occurrence_keeps_the_rule(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    today = date.today()
    ends = today + timedelta(days=6)
    with TestClient(app) as client:
        bed_id = add_bed(client)
        tomatoes = crop_id(client, "Tomatoes")
        rule = client.post(
            "/api/care-rules",
            json={
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "watering",
                "product": "",
                "amount": None,
                "unit": "",
                "note": "",
                "freq": "daily",
                "interval": 3,
                "weekdays": [],
                "anchorDate": today.isoformat(),
                "endsOn": ends.isoformat(),
                "active": True,
            },
        ).json()
        entries = client.get("/api/calendar?kind=care").json()
        first = next(entry for entry in entries if entry["date"] == today.isoformat())
        updated = client.put(
            f"/api/calendar/{first['id']}",
            json={
                "kind": "care",
                "date": first["date"],
                "bedId": first["bedId"],
                "cropId": first["cropId"],
                "status": "done",
                "note": first["note"],
                "photoUrl": first.get("photoUrl") or "",
                "action": first["action"],
                "product": first["product"],
                "amount": first["amount"],
                "unit": first["unit"],
                "id": first["id"],
            },
        )
        assert updated.status_code == 200
        assert updated.json()["status"] == "done"
        assert updated.json()["ruleId"] == rule["id"]
        assert client.get(f"/api/care-rules/{rule['id']}").json()["active"] is True
        remaining = client.get("/api/calendar?kind=care").json()
        next_due = (today + timedelta(days=3)).isoformat()
        assert any(
            entry["date"] == next_due and entry["status"] == "planned"
            for entry in remaining
        )


def test_yearly_december_care_is_ready_for_the_next_calendar_year(tmp_path, monkeypatch):
    """A 2 Dec pruning must show when browsing the following year (Baghban case)."""
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    today = date.today()
    anchor = date(today.year, 12, 2)
    if anchor < today:
        anchor = date(today.year + 1, 12, 2)
    next_occurrence = date(anchor.year + 1, 12, 2)
    with TestClient(app) as client:
        bed_id = add_bed(client)
        tomatoes = crop_id(client, "Tomatoes")
        rule = client.post(
            "/api/care-rules",
            json={
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "pruning",
                "product": "",
                "amount": None,
                "unit": "",
                "note": "",
                "freq": "yearly",
                "interval": 1,
                "weekdays": [],
                "anchorDate": anchor.isoformat(),
                "endsOn": None,
                "active": True,
            },
        ).json()
        # Default materialize already reaches end of next calendar year.
        first = client.get("/api/calendar?kind=care").json()
        dates = {entry["date"] for entry in first if entry["ruleId"] == rule["id"]}
        assert anchor.isoformat() in dates
        assert next_occurrence.isoformat() in dates

        # Browsing that year still rematerializes through its Dec 31.
        browsed = client.get(
            f"/api/calendar?kind=care&through={next_occurrence.year}-12-31"
        ).json()
        dates = {entry["date"] for entry in browsed if entry["ruleId"] == rule["id"]}
        assert next_occurrence.isoformat() in dates


def test_materialize_until_covers_next_year_end():
    from care_rules import materialize_until

    assert materialize_until(date(2026, 11, 6)) == date(2027, 12, 31)
    assert materialize_until(date(2026, 11, 6), date(2028, 12, 31)) == date(2028, 12, 31)


def test_creating_a_rule_can_attach_a_one_off_care(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    today = date.today()
    ends = today + timedelta(days=6)
    with TestClient(app) as client:
        bed_id = add_bed(client)
        tomatoes = crop_id(client, "Tomatoes")
        one_off = client.post(
            "/api/calendar",
            json={
                "kind": "care",
                "date": today.isoformat(),
                "bedId": bed_id,
                "cropId": tomatoes,
                "status": "done",
                "note": "First water",
                "photoUrl": "",
                "action": "watering",
                "product": "",
                "amount": 5,
                "unit": "L",
            },
        ).json()
        assert one_off["ruleId"] is None
        rule = client.post(
            "/api/care-rules",
            json={
                "entryId": one_off["id"],
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "watering",
                "product": "",
                "amount": 5,
                "unit": "L",
                "note": "First water",
                "freq": "daily",
                "interval": 3,
                "weekdays": [],
                "anchorDate": today.isoformat(),
                "endsOn": ends.isoformat(),
                "active": True,
            },
        ).json()
        listed = client.get("/api/calendar?kind=care").json()
        attached = next(entry for entry in listed if entry["id"] == one_off["id"])
        assert attached["ruleId"] == rule["id"]
        assert attached["ruleActive"] is True
        assert attached["status"] == "done"
        assert attached["note"] == "First water"
        dates = sorted(entry["date"] for entry in listed if entry["ruleId"] == rule["id"])
        assert dates[0] == today.isoformat()
        assert len(dates) > 1
        assert len([entry for entry in listed if entry["date"] == today.isoformat()]) == 1


def test_attach_rejects_an_entry_already_on_a_schedule(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    today = date.today()
    with TestClient(app) as client:
        bed_id = add_bed(client)
        tomatoes = crop_id(client, "Tomatoes")
        rule = client.post(
            "/api/care-rules",
            json={
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "watering",
                "product": "",
                "amount": None,
                "unit": "",
                "note": "",
                "freq": "daily",
                "interval": 7,
                "weekdays": [],
                "anchorDate": today.isoformat(),
                "endsOn": (today + timedelta(days=7)).isoformat(),
                "active": True,
            },
        ).json()
        entry = next(
            row
            for row in client.get("/api/calendar?kind=care").json()
            if row["ruleId"] == rule["id"]
        )
        rejected = client.post(
            "/api/care-rules",
            json={
                "entryId": entry["id"],
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "watering",
                "product": "",
                "amount": None,
                "unit": "",
                "note": "",
                "freq": "daily",
                "interval": 3,
                "weekdays": [],
                "anchorDate": today.isoformat(),
                "endsOn": None,
                "active": True,
            },
        )
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "entryId already belongs to a schedule"


def test_deactivating_a_rule_removes_future_planned(tmp_path, monkeypatch):
    db = tmp_path / "baghban.db"
    monkeypatch.setenv("BAGHBAN_DB", str(db))
    with TestClient(app) as client:
        bed_id = add_bed(client)
        tomatoes = crop_id(client, "Tomatoes")
        rule = client.post(
            "/api/care-rules",
            json={
                "bedId": bed_id,
                "cropId": tomatoes,
                "action": "watering",
                "product": "",
                "amount": None,
                "unit": "",
                "note": "",
                "freq": "daily",
                "interval": 1,
                "weekdays": [],
                "anchorDate": date.today().isoformat(),
                "endsOn": None,
                "active": True,
            },
        ).json()
        before = client.get("/api/calendar?kind=care").json()
        series = [entry for entry in before if entry["ruleId"] == rule["id"]]
        assert len(series) > 1
        first = next(entry for entry in series if entry["date"] == date.today().isoformat())
        client.put(
            f"/api/calendar/{first['id']}",
            json={
                "kind": "care",
                "date": first["date"],
                "bedId": first["bedId"],
                "cropId": first["cropId"],
                "status": "done",
                "note": first["note"],
                "photoUrl": first.get("photoUrl") or "",
                "action": first["action"],
                "product": first["product"],
                "amount": first["amount"],
                "unit": first["unit"],
                "id": first["id"],
            },
        )
        stopped = client.post(f"/api/care-rules/{rule['id']}/deactivate")
        assert stopped.status_code == 200
        assert stopped.json()["active"] is False
        after = client.get("/api/calendar?kind=care").json()
        future_planned = [
            entry
            for entry in after
            if entry["ruleId"] == rule["id"]
            and entry["status"] == "planned"
            and entry["date"] >= date.today().isoformat()
        ]
        assert future_planned == []
        leftover = [entry for entry in after if entry["ruleId"] == rule["id"]]
        assert len(leftover) == 1
        assert leftover[0]["id"] == first["id"]
        assert leftover[0]["status"] == "done"
        assert leftover[0]["ruleActive"] is False
