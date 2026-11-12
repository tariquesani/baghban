import json
from contextlib import closing
from datetime import datetime

import httpx
from authed_client import TestClient
from zoneinfo import ZoneInfo

from app import app, connect
import sky

FORECAST = {
    "properties": {
        "timeseries": [
            {
                "data": {
                    "instant": {
                        "details": {
                            "air_temperature": 28.6,
                            "wind_speed": 1.34,
                        }
                    },
                    "next_1_hours": {"summary": {"symbol_code": "partlycloudy_day"}},
                }
            }
        ]
    }
}

READING = {
    "weather": {"temperature": 29, "phrase": "Partly cloudy", "icon": "partly-cloudy-day"},
    "wind": {"speed": 1.3, "icon": "wind"},
}


def freeze(monkeypatch):
    monkeypatch.setattr(
        sky,
        "moment",
        lambda zone: datetime(2026, 10, 31, 8, 0, tzinfo=zone),
    )


def test_symbol_phrases_follow_the_header_table():
    assert sky.describe_symbol("clearsky_day") == ("Clear", "clear-day")
    assert sky.describe_symbol("fair_night") == ("Mainly clear", "partly-cloudy-night")
    assert sky.describe_symbol("partlycloudy_polartwilight") == (
        "Partly cloudy",
        "partly-cloudy-day",
    )
    assert sky.describe_symbol("cloudy") == ("Overcast", "overcast-day")
    assert sky.describe_symbol("fog") == ("Fog", "fog-day")
    assert sky.describe_symbol("lightrain") == ("Drizzle", "rain")
    assert sky.describe_symbol("heavyrain") == ("Rain", "rain")
    assert sky.describe_symbol("lightrainshowers_night") == (
        "Showers",
        "partly-cloudy-night-rain",
    )
    assert sky.describe_symbol("snowshowers_night") == ("Snow", "snow")
    assert sky.describe_symbol("lightsleet_day") == ("Snow", "sleet")
    assert sky.describe_symbol("heavyrainandthunder") == (
        "Thunderstorm",
        "thunderstorms-day-rain",
    )
    assert sky.describe_symbol("snowshowersandthunder_night") == (
        "Thunderstorm",
        "thunderstorms-night-rain",
    )
    assert sky.describe_symbol("not-a-symbol") == ("Weather", "not-available")


def test_moon_bins_match_birdnet_and_round_to_a_whole_percent():
    assert sky.describe_phase(0) == {
        "name": "New moon",
        "illumination": 0,
        "icon": "moon-new",
    }
    assert sky.describe_phase(1.749)["name"] == "New moon"
    assert sky.describe_phase(1.75)["name"] == "Waxing crescent"
    assert sky.describe_phase(7)["name"] == "First quarter"
    assert sky.describe_phase(7)["illumination"] == 50
    assert sky.describe_phase(14) == {
        "name": "Full moon",
        "illumination": 100,
        "icon": "moon-full",
    }
    assert sky.describe_phase(19.249)["name"] == "Waning gibbous"
    assert sky.describe_phase(19.25)["name"] == "Last quarter"
    assert sky.describe_phase(19.555666666666667) == {
        "name": "Last quarter",
        "illumination": 66,
        "icon": "moon-last-quarter",
    }
    assert sky.describe_phase(26.249)["name"] == "Waning crescent"
    assert sky.describe_phase(26.25)["name"] == "New moon"


def test_sun_times_use_the_garden_timezone():
    zone = ZoneInfo("Asia/Kolkata")
    rise, sets = sky.sun_clock(21.15, 79.09, zone, datetime(2026, 10, 31).date())
    assert rise == "06:15"
    assert sets == "17:38"


def test_forecast_span_uses_today_and_rain_until_morning():
    zone = ZoneInfo("Asia/Kolkata")
    now = datetime(2026, 11, 1, 15, 0, tzinfo=zone)
    until = datetime(2026, 11, 2, 6, 15, tzinfo=zone)
    series = [
        {
            "time": "2026-11-01T10:00:00Z",
            "data": {
                "instant": {"details": {"air_temperature": 29}},
                "next_1_hours": {"details": {"precipitation_amount": 1.2}},
                "next_6_hours": {"details": {"air_temperature_max": 31, "air_temperature_min": 22}},
            },
        },
        {
            "time": "2026-11-01T12:00:00Z",
            "data": {
                "instant": {"details": {"air_temperature": 24}},
                "next_1_hours": {"details": {"precipitation_amount": 2.8}},
            },
        },
        {
            "time": "2026-11-02T02:30:00Z",
            "data": {"next_1_hours": {"details": {"precipitation_amount": 9}}},
        },
    ]
    assert sky.forecast_span(series, now, zone, until) == {
        "high": 31,
        "low": 22,
        "rainMm": 4.0,
    }


def test_forecast_reading_rounds_temperature_and_wind():
    assert sky.weather_from_forecast(FORECAST) == READING
    assert sky.weather_from_forecast({"properties": {"timeseries": []}}) is None


def test_yr_sends_a_named_agent_and_reuses_a_not_modified_body():
    sky.reset_cache()
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.headers.get("If-Modified-Since"):
            return httpx.Response(304)
        return httpx.Response(
            200,
            json=FORECAST,
            headers={"Last-Modified": "Sat, 31 Oct 2026 07:00:00 GMT"},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        first = sky.fetch_yr(21.1458, 79.0882, client=client)
        second = sky.fetch_yr(21.1458, 79.0882, client=client)

    assert first["weather"] == READING["weather"]
    assert first["wind"] == READING["wind"]
    assert second["weather"] == READING["weather"]
    assert second["wind"] == READING["wind"]
    assert second["series"] == FORECAST["properties"]["timeseries"]
    assert seen[0].headers["User-Agent"] == sky.USER_AGENT
    assert "gzip" in seen[0].headers["Accept-Encoding"]
    assert seen[0].url.params["lat"] == "21.146"
    assert seen[0].url.params["lon"] == "79.088"
    assert seen[1].headers["If-Modified-Since"] == "Sat, 31 Oct 2026 07:00:00 GMT"


def test_sky_without_a_place_still_returns_the_moon(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    freeze(monkeypatch)
    with TestClient(app) as client:
        body = client.get("/api/sky", params={"timezone": "Asia/Kolkata"}).json()
    assert body["located"] is False
    assert body["weather"] is None
    assert body["sunrise"] is None
    assert body["moon"] == {
        "name": "Last quarter",
        "illumination": 66,
        "icon": "moon-last-quarter",
    }


def place_garden():
    with closing(connect()) as connection:
        connection.execute(
            """
            INSERT INTO garden_plan (
                id, name, subtitle, latitude, longitude, timezone, saved_at
            ) VALUES (1, 'Plot', 'Home', 21.15, 79.09, 'Asia/Kolkata', 't')
            """
        )
        connection.commit()


def test_sky_keeps_the_sun_and_moon_when_yr_fails(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    freeze(monkeypatch)
    monkeypatch.setattr(sky, "fetch_yr", lambda _lat, _lon: None)
    with TestClient(app) as client:
        place_garden()
        body = client.get("/api/sky").json()
    assert body["located"] is True
    assert body["weatherUnavailable"] is True
    assert body["weather"] is None
    assert body["sunrise"] == "06:15"
    assert body["sunset"] == "17:38"
    assert body["moon"]["name"] == "Last quarter"
    assert body["moon"]["illumination"] == 66


def test_sky_returns_the_current_reading(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    freeze(monkeypatch)
    monkeypatch.setattr(sky, "fetch_yr", lambda _lat, _lon: READING)
    with TestClient(app) as client:
        place_garden()
        body = client.get("/api/sky").json()
    assert body["weatherUnavailable"] is False
    assert body["weather"] == READING["weather"]
    assert body["wind"] == READING["wind"]
    assert json.dumps(body)
