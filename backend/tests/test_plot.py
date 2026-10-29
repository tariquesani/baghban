import struct
import zlib

from fastapi.testclient import TestClient

from app import MAX_PHOTO_BYTES, app


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


def test_plot_photo_round_trip(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGHBAN_DB", str(tmp_path / "baghban.db"))
    photo = png_bytes()

    with TestClient(app) as client:
        missing = client.get("/api/photos/plot-1")
        assert missing.status_code == 404

        rejected = client.put("/api/photos/plot-1", content=b"not-an-image")
        assert rejected.status_code == 400
        assert client.get("/api/photos/plot-1").status_code == 404

        saved = client.put(
            "/api/photos/plot-1",
            content=photo,
            headers={"Content-Type": "image/png"},
        )
        assert saved.status_code == 200
        assert saved.json() == {"url": "/api/photos/plot-1"}

        loaded = client.get("/api/photos/plot-1")
        assert loaded.status_code == 200
        assert loaded.content == photo
        assert loaded.headers["content-type"].startswith("image/png")

        monkeypatch.setattr("app.MAX_PHOTO_BYTES", len(photo))
        too_big = client.put("/api/photos/plot-1", content=photo + b"\x00")
        assert too_big.status_code == 413
        assert client.get("/api/photos/plot-1").content == photo
        monkeypatch.setattr("app.MAX_PHOTO_BYTES", MAX_PHOTO_BYTES)

        removed = client.delete("/api/photos/plot-1")
        assert removed.status_code == 204
        assert client.get("/api/photos/plot-1").status_code == 404

    assert (tmp_path / "photos" / "plot-1.png").exists() is False
