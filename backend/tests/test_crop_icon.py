import struct
import zlib

from fastapi.testclient import TestClient

from app import app
from crops import MAX_ICON_BYTES


def png_bytes() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = b"\x00\xff\x00\x00"
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def add_crop(client) -> dict:
    created = client.post("/api/crops", json={"name": "Icon sample", "category": "Herbs"})
    assert created.status_code == 200
    body = created.json()
    assert body["icon"] == ""
    return body


def without_icon(crop: dict) -> dict:
    return {key: value for key, value in crop.items() if key != "icon"}


def test_crop_icon_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    photo = png_bytes()
    replaced = png_bytes() + b"\x00"

    with TestClient(app) as client:
        crop = add_crop(client)
        crop_id = crop["id"]
        missing = client.get(f"/api/crops/{crop_id}/icon")
        assert missing.status_code == 404

        rejected = client.put(f"/api/crops/{crop_id}/icon", content=b"\xff\xd8\xff")
        assert rejected.status_code == 400
        assert rejected.json()["detail"] == "Icon must be a PNG"
        assert client.get(f"/api/crops/{crop_id}/icon").status_code == 404

        saved = client.put(
            f"/api/crops/{crop_id}/icon",
            content=photo,
            headers={"Content-Type": "image/png"},
        )
        assert saved.status_code == 200
        assert saved.json()["icon"] == f"{crop_id}.png"
        assert saved.json()["name"] == "Icon sample"

        loaded = client.get(f"/api/crops/{crop_id}/icon")
        assert loaded.status_code == 200
        assert loaded.content == photo
        assert loaded.headers["content-type"].startswith("image/png")
        assert loaded.headers["cache-control"] == "no-store"

        again = client.put(f"/api/crops/{crop_id}/icon", content=replaced)
        assert again.status_code == 200
        assert client.get(f"/api/crops/{crop_id}/icon").content == replaced

        renamed = client.put(
            f"/api/crops/{crop_id}",
            json={**without_icon(crop), "name": "Spearmint"},
        )
        assert renamed.status_code == 200
        assert renamed.json()["name"] == "Spearmint"
        assert renamed.json()["icon"] == f"{crop_id}.png"

        echoed = client.put(
            f"/api/crops/{crop_id}",
            json={**renamed.json(), "icon": "other.png"},
        )
        assert echoed.status_code == 200
        assert echoed.json()["icon"] == f"{crop_id}.png"
        assert client.get(f"/api/crops/{crop_id}/icon").content == replaced

        monkeypatch.setattr("crops.MAX_ICON_BYTES", len(replaced))
        too_big = client.put(f"/api/crops/{crop_id}/icon", content=replaced + b"\x00")
        assert too_big.status_code == 413
        assert client.get(f"/api/crops/{crop_id}/icon").content == replaced
        monkeypatch.setattr("crops.MAX_ICON_BYTES", MAX_ICON_BYTES)

        removed = client.delete(f"/api/crops/{crop_id}/icon")
        assert removed.status_code == 204
        assert client.get(f"/api/crops/{crop_id}/icon").status_code == 404
        assert client.get(f"/api/crops/{crop_id}").json()["icon"] == ""
        assert client.delete("/api/crops/999/icon").status_code == 404

    assert (tmp_path / "icons" / f"{crop_id}.png").exists() is False


def test_icon_for_a_missing_crop_is_not_stored(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))

    with TestClient(app) as client:
        missing = client.put("/api/crops/999/icon", content=png_bytes())
        assert missing.status_code == 404

    assert (tmp_path / "icons").exists() is False
