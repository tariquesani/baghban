import pytest

from auth import reset_auth_secrets_cache
from authed_client import DEFAULT_TOKEN


@pytest.fixture(autouse=True)
def baghban_auth_env(monkeypatch):
    monkeypatch.setenv("BAGHBAN_USERNAME", "gardener")
    monkeypatch.setenv("BAGHBAN_PASSWORD", "secret")
    monkeypatch.setenv("BAGHBAN_API_TOKEN", DEFAULT_TOKEN)
    monkeypatch.setenv("BAGHBAN_SESSION_SECRET", "test-session-secret")
    reset_auth_secrets_cache()
    yield
    reset_auth_secrets_cache()
