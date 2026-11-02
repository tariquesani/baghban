"""Current sky for the garden header.

Yr supplies the temperature, wind, and condition. Astral supplies today's
sunrise, sunset, and the moon. The moon bins match BirdNET-Go: eight equal
parts of Astral's 0–28 cycle, with new moon straddling 26.25.
"""

import math
import threading
from datetime import datetime, timedelta, timezone

import httpx
from astral import Observer
from astral.moon import phase as moon_phase
from astral.sun import sunrise, sunset
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

YR_URL = "https://api.met.no/weatherapi/locationforecast/2.0/complete"
USER_AGENT = "Baghban/1.0 (personal garden planner)"

_cache_lock = threading.Lock()
_cache = {}

_NIGHT_ICONS = {
    "clear-day": "clear-night",
    "partly-cloudy-day": "partly-cloudy-night",
    "overcast-day": "overcast-night",
    "fog-day": "fog-night",
    "partly-cloudy-day-rain": "partly-cloudy-night-rain",
    "thunderstorms-day-rain": "thunderstorms-night-rain",
}

# Exclusive upper bounds, in Astral phase units. New moon also covers >= 26.25.
_PHASES = (
    (1.75, "New moon", "moon-new"),
    (5.25, "Waxing crescent", "moon-waxing-crescent"),
    (8.75, "First quarter", "moon-first-quarter"),
    (12.25, "Waxing gibbous", "moon-waxing-gibbous"),
    (15.75, "Full moon", "moon-full"),
    (19.25, "Waning gibbous", "moon-waning-gibbous"),
    (22.75, "Last quarter", "moon-last-quarter"),
    (26.25, "Waning crescent", "moon-waning-crescent"),
)

_SHOWERS = {"lightrainshowers", "rainshowers", "heavyrainshowers"}
_RAIN = {"rain", "heavyrain"}


def reset_cache() -> None:
    with _cache_lock:
        _cache.clear()


def moment(zone: ZoneInfo) -> datetime:
    return datetime.now(zone)


def zone_for(stored: str, requested: str) -> tuple[ZoneInfo, str]:
    for candidate in (stored, requested):
        if not candidate:
            continue
        try:
            return ZoneInfo(candidate), candidate
        except ZoneInfoNotFoundError:
            continue
    return ZoneInfo("UTC"), "UTC"


def describe_symbol(symbol: str) -> tuple[str, str]:
    """Map a Yr symbol code to a short phrase and a weather-icon name."""
    raw = (symbol or "").strip().lower()
    night = raw.endswith("_night")
    base = raw
    for suffix in ("_day", "_night", "_polartwilight"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    if "thunder" in base:
        phrase, icon = "Thunderstorm", "thunderstorms-day-rain"
    elif "sleet" in base:
        phrase, icon = "Snow", "sleet"
    elif "snow" in base:
        phrase, icon = "Snow", "snow"
    elif base in _SHOWERS:
        phrase, icon = "Showers", "partly-cloudy-day-rain"
    elif base in _RAIN:
        phrase, icon = "Rain", "rain"
    elif base == "lightrain":
        phrase, icon = "Drizzle", "rain"
    elif base == "fog":
        phrase, icon = "Fog", "fog-day"
    elif base == "cloudy":
        phrase, icon = "Overcast", "overcast-day"
    elif base == "partlycloudy":
        phrase, icon = "Partly cloudy", "partly-cloudy-day"
    elif base == "fair":
        phrase, icon = "Mainly clear", "partly-cloudy-day"
    elif base == "clearsky":
        phrase, icon = "Clear", "clear-day"
    else:
        return "Weather", "not-available"
    if night:
        icon = _NIGHT_ICONS.get(icon, icon)
    return phrase, icon


def describe_phase(phase: float) -> dict:
    if phase >= 26.25:
        name, icon = "New moon", "moon-new"
    else:
        name, icon = "New moon", "moon-new"
        for limit, phase_name, phase_icon in _PHASES:
            if phase < limit:
                name, icon = phase_name, phase_icon
                break
    raw = (1 - math.cos(phase * 2 * math.pi / 28)) / 2 * 100
    return {"name": name, "illumination": int(round(raw)), "icon": icon}


def moon_report(civil) -> dict:
    return describe_phase(float(moon_phase(civil)))


def sun_clock(latitude: float, longitude: float, zone: ZoneInfo, civil) -> tuple[str | None, str | None]:
    observer = Observer(latitude=latitude, longitude=longitude)

    def one(fn):
        try:
            return fn(observer, date=civil, tzinfo=zone).strftime("%H:%M")
        except ValueError:
            return None

    return one(sunrise), one(sunset)


def _step_time(value: str, zone: ZoneInfo) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    return instant.astimezone(zone)


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def forecast_span(series: list, now: datetime, zone: ZoneInfo, until: datetime) -> dict | None:
    """Today's high and low, and rain from now until tomorrow morning."""
    highs = []
    lows = []
    rain = 0.0
    saw_rain = False
    today = now.astimezone(zone).date()
    for step in series:
        if not isinstance(step, dict):
            continue
        instant = _step_time(step.get("time"), zone)
        if instant is None:
            continue
        data = step.get("data") or {}
        details = ((data.get("instant") or {}).get("details") or {})
        if instant.date() == today:
            temperature = _number(details.get("air_temperature"))
            if temperature is not None:
                highs.append(temperature)
                lows.append(temperature)
            window = ((data.get("next_6_hours") or {}).get("details") or {})
            high = _number(window.get("air_temperature_max"))
            low = _number(window.get("air_temperature_min"))
            if high is not None:
                highs.append(high)
            if low is not None:
                lows.append(low)
        if now <= instant < until:
            hour = ((data.get("next_1_hours") or {}).get("details") or {})
            amount = _number(hour.get("precipitation_amount"))
            if amount is not None:
                rain += amount
                saw_rain = True
    if not highs:
        return None
    return {
        "high": int(round(max(highs))),
        "low": int(round(min(lows))),
        "rainMm": round(rain, 1) if saw_rain else None,
    }


def morning_after(zone: ZoneInfo, civil, latitude: float, longitude: float) -> datetime:
    """Tomorrow's sunrise, or 06:00 when the sun does not rise."""
    tomorrow = civil + timedelta(days=1)
    rise, _sets = sun_clock(latitude, longitude, zone, tomorrow)
    if rise:
        hour, minute = (int(part) for part in rise.split(":"))
        return datetime(tomorrow.year, tomorrow.month, tomorrow.day, hour, minute, tzinfo=zone)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, 6, 0, tzinfo=zone)


def weather_from_forecast(payload: dict) -> dict | None:
    series = (payload.get("properties") or {}).get("timeseries") or []
    if not series:
        return None
    data = (series[0] or {}).get("data") or {}
    instant = ((data.get("instant") or {}).get("details") or {})
    summary = ((data.get("next_1_hours") or {}).get("summary") or {})
    temperature = instant.get("air_temperature")
    speed = instant.get("wind_speed")
    if not isinstance(temperature, (int, float)) or not isinstance(speed, (int, float)):
        return None
    phrase, icon = describe_symbol(summary.get("symbol_code") or "")
    return {
        "weather": {
            "temperature": int(round(temperature)),
            "phrase": phrase,
            "icon": icon,
        },
        "wind": {"speed": round(float(speed), 1), "icon": "wind"},
    }


def _rounded(value: float) -> float:
    return round(float(value), 3)


def fetch_yr(latitude: float, longitude: float, client: httpx.Client | None = None) -> dict | None:
    """Current Yr reading. A 304 reuses the previous body for these coordinates."""
    key = (_rounded(latitude), _rounded(longitude))
    headers = {"User-Agent": USER_AGENT}
    with _cache_lock:
        cached = _cache.get(key)
        if cached and cached.get("last_modified"):
            headers["If-Modified-Since"] = cached["last_modified"]
    owns_client = client is None
    if client is None:
        client = httpx.Client(timeout=10.0)
    try:
        response = client.get(
            YR_URL,
            params={"lat": f"{key[0]:.3f}", "lon": f"{key[1]:.3f}"},
            headers=headers,
        )
    except httpx.HTTPError:
        return None
    finally:
        if owns_client:
            client.close()
    if response.status_code == 304:
        if not cached:
            return None
        return {
            "weather": cached["weather"],
            "wind": cached["wind"],
            "series": cached.get("series") or [],
        }
    if response.status_code != 200:
        return None
    try:
        payload = response.json()
    except ValueError:
        return None
    reading = weather_from_forecast(payload)
    if reading is None:
        return None
    series = (payload.get("properties") or {}).get("timeseries") or []
    with _cache_lock:
        _cache[key] = {
            "weather": reading["weather"],
            "wind": reading["wind"],
            "series": series,
            "last_modified": response.headers.get("last-modified", ""),
        }
    return {**reading, "series": series}


def sky_reading(garden: dict, requested_timezone: str, fetch) -> dict:
    latitude = garden.get("latitude")
    longitude = garden.get("longitude")
    zone, _name = zone_for(garden.get("timezone") or "", requested_timezone or "")
    civil = moment(zone).date()
    moon = moon_report(civil)
    located = isinstance(latitude, (int, float)) and isinstance(longitude, (int, float))
    blank = {
        "located": located,
        "weatherUnavailable": False,
        "weather": None,
        "wind": None,
        "sunrise": None,
        "sunset": None,
        "moon": moon,
        "forecast": None,
    }
    if not located:
        return blank
    rise, sets = sun_clock(float(latitude), float(longitude), zone, civil)
    try:
        fetched = fetch(float(latitude), float(longitude))
    except Exception:
        fetched = None
    if not fetched:
        return {
            **blank,
            "weatherUnavailable": True,
            "sunrise": rise,
            "sunset": sets,
        }
    now = moment(zone)
    until = morning_after(zone, civil, float(latitude), float(longitude))
    return {
        **blank,
        "weather": fetched["weather"],
        "wind": fetched["wind"],
        "sunrise": rise,
        "sunset": sets,
        "forecast": forecast_span(fetched.get("series") or [], now, zone, until),
    }
