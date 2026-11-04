"""Label lists shared with the frontend.

`shared/catalogue.json` is the only copy. The API rejects a new value that
is not in the file. SQLite stores the text without a check, so a later edit
to the file does not need a schema change, and an older row still loads.
"""

import json
from pathlib import Path


def catalogue_path() -> Path:
    return Path(__file__).resolve().parent.parent / "shared" / "catalogue.json"


def _pairs(items, name: str, allow_blank: bool) -> tuple[str, ...]:
    if not isinstance(items, list) or not items:
        raise RuntimeError(f"{name} is missing from the catalogue")
    values: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            raise RuntimeError(f"{name} entries are a value and a label")
        value = item.get("value")
        label = item.get("label")
        if not isinstance(value, str) or not isinstance(label, str) or not label.strip():
            raise RuntimeError(f"{name} entries are a value and a label")
        if value == "" and not allow_blank:
            raise RuntimeError(f"{name} values cannot be blank")
        if value != value.strip():
            raise RuntimeError(f"{name} values cannot have surrounding space")
        if value in values:
            raise RuntimeError(f"{name} repeats {value!r}")
        values.append(value)
    if allow_blank and "" not in values:
        raise RuntimeError(f"{name} includes a blank value for an unset choice")
    return tuple(values)


def _names(items, name: str) -> tuple[str, ...]:
    if not isinstance(items, list) or not items:
        raise RuntimeError(f"{name} is missing from the catalogue")
    values: list[str] = []
    for item in items:
        if not isinstance(item, str) or not item.strip() or item != item.strip():
            raise RuntimeError(f"{name} entries are non-empty text")
        if item in values:
            raise RuntimeError(f"{name} repeats {item!r}")
        values.append(item)
    return tuple(values)


def load_catalogue() -> dict[str, tuple[str, ...]]:
    data = json.loads(catalogue_path().read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise RuntimeError("Catalogue must be a JSON object")
    return {
        "care_actions": _pairs(data.get("careActions"), "careActions", allow_blank=False),
        "categories": _names(data.get("cropCategories"), "cropCategories"),
        "suns": _pairs(data.get("sun"), "sun", allow_blank=True),
        "waters": _pairs(data.get("water"), "water", allow_blank=True),
    }


CATALOGUE = load_catalogue()
CARE_ACTIONS = CATALOGUE["care_actions"]
CATEGORIES = CATALOGUE["categories"]
SUNS = CATALOGUE["suns"]
WATERS = CATALOGUE["waters"]
