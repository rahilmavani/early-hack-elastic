import importlib
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from eyewitness import config


@pytest.fixture
def replay_api(monkeypatch):
    # Importing the ingest app configures CORS; these tests need no credentials.
    monkeypatch.setattr(
        config, "get_settings", lambda: SimpleNamespace(storefront_url="http://localhost:3000")
    )
    module = importlib.import_module("eyewitness.ingest.app")
    monkeypatch.setattr(module, "get_client", lambda: object())
    return module, TestClient(module.app)


def test_replay_returns_events_without_caching(replay_api, monkeypatch):
    module, client = replay_api
    events = [{"type": 2, "timestamp": 1000, "data": {}}]
    monkeypatch.setattr(module, "fetch_events", lambda client, session_id: events)
    response = client.get("/replay/session-123")
    assert response.status_code == 200
    assert response.json() == {"sessionId": "session-123", "events": events}
    assert response.headers["cache-control"] == "no-store"


def test_replay_rejects_invalid_id_before_query(replay_api, monkeypatch):
    module, client = replay_api

    def unexpected_query(*args):
        raise AssertionError("Invalid session id reached Elasticsearch")

    monkeypatch.setattr(module, "fetch_events", unexpected_query)
    assert client.get("/replay/invalid..id").status_code == 400


@pytest.mark.parametrize("result, status", [([], 404), (RuntimeError("limit"), 413)])
def test_replay_missing_and_oversized_recordings(replay_api, monkeypatch, result, status):
    module, client = replay_api

    def fetch(*args):
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(module, "fetch_events", fetch)
    assert client.get("/replay/session-123").status_code == status


def test_replay_storage_error_does_not_expose_connection_details(replay_api, monkeypatch):
    module, client = replay_api

    def fail(*args):
        raise ValueError("private connection details")

    monkeypatch.setattr(module, "fetch_events", fail)
    response = client.get("/replay/session-123")
    assert response.status_code == 503
    assert "private" not in response.text
