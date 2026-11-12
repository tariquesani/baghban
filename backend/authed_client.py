"""TestClient that sends the API bearer token by default."""

from __future__ import annotations

import os

from fastapi.testclient import TestClient as BaseTestClient

DEFAULT_TOKEN = "test-api-token"


class TestClient(BaseTestClient):
    def request(self, method, url, **kwargs):
        headers = dict(kwargs.get("headers") or {})
        lower = {key.lower() for key in headers}
        if "authorization" not in lower:
            token = os.environ.get("BAGHBAN_API_TOKEN") or DEFAULT_TOKEN
            headers["Authorization"] = f"Bearer {token}"
        kwargs["headers"] = headers
        return super().request(method, url, **kwargs)
