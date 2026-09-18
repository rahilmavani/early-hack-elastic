import importlib
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from eyewitness import admin, config
from eyewitness.run import RunSummary


@pytest.fixture
def admin_api(monkeypatch, tmp_path):
    monkeypatch.setattr(
        config, "get_settings", lambda: SimpleNamespace(storefront_url="http://localhost:3000")
    )
    monkeypatch.setattr(admin, "DATA_DIR", tmp_path)
    module = importlib.import_module("eyewitness.ingest.app")
    monkeypatch.setattr(module, "get_client", lambda: object())
    monkeypatch.setattr(module, "run_manager", admin.RunManager())
    return module, TestClient(module.app), tmp_path


def test_session_status_prefers_incident_then_watch_then_score():
    assert admin.session_status(1.0, 5.0, {"incident_id": "inc-1"}, None) == "filed"
    assert admin.session_status(9.0, 5.0, None, {"confirmed": True}) == "confirmed"
    assert admin.session_status(9.0, 5.0, None, {"confirmed": False}) == "cleared"
    assert admin.session_status(9.0, 5.0, None, None) == "flagged"
    assert admin.session_status(1.0, 5.0, None, None) == "healthy"
    assert admin.session_status(None, 5.0, None, None) == "unscored"


def test_run_payload_counts_stages_from_checkpoints(monkeypatch, tmp_path):
    monkeypatch.setattr(admin, "DATA_DIR", tmp_path)
    monkeypatch.setattr("eyewitness.run.DATA_DIR", tmp_path)
    state = admin.RunState(
        run_id="admin-test", status="running", started_at="now", window="1h", threshold=5, limit=25
    )
    state.swept = 3
    folder = tmp_path / "runs" / "admin-test"
    folder.mkdir(parents=True)
    checkpoints = [
        {"session_id": "a", "difficulty_score": 9, "stage": "rendered", "confirmed": False},
        {"session_id": "b", "difficulty_score": 8, "stage": "watched", "confirmed": True},
        {
            "session_id": "c",
            "difficulty_score": 7,
            "stage": "filed",
            "confirmed": True,
            "case_id": "case-1",
        },
    ]
    for checkpoint in checkpoints:
        (folder / f"{checkpoint['session_id']}.json").write_text(json.dumps(checkpoint))

    payload = admin.run_payload(state)
    assert payload["stages"] == {
        "swept": 3,
        "rendered": 3,
        "watched": 2,
        "confirmed": 2,
        "filed": 1,
    }
    assert [outcome["session_id"] for outcome in payload["outcomes"]] == ["a", "b", "c"]


def test_sessions_endpoint_rejects_bad_window(admin_api):
    _, client, _ = admin_api
    assert client.get("/admin/sessions?window=yesterday").status_code == 400


def test_sessions_endpoint_returns_listing(admin_api, monkeypatch):
    module, client, _ = admin_api
    listing = [{"session_id": "s-1", "status": "flagged", "score": 7.0}]
    monkeypatch.setattr(module.admin, "list_sessions", lambda c, window, threshold: listing)
    response = client.get("/admin/sessions?window=1h&threshold=5")
    assert response.status_code == 200
    assert response.json() == {"window": "1h", "threshold": 5.0, "sessions": listing}


def test_start_run_is_exclusive_and_reports_progress(admin_api, monkeypatch):
    import threading

    module, client, _ = admin_api
    release = threading.Event()
    seen = {}

    def fake_execute(es_client, manifest, run_id, log):
        seen["window"] = manifest["window"]
        log("signals computed for 2 sessions")
        log("sweep selected 1 sessions above 5.0")
        release.wait(timeout=5)
        return RunSummary(run_id=run_id, started_at="now", swept=1, rendered=1, watched=1)

    monkeypatch.setattr(module.admin, "execute_run", fake_execute)
    monkeypatch.setattr(
        module.admin,
        "load_manifest",
        lambda path: {
            "window": "24h",
            "sweep": {"threshold": 5.0, "limit": 25},
            "render": {"max_seconds": 180},
            "pricing": {"input_per_1k": 0, "output_per_1k": 0},
        },
    )

    started = client.post("/admin/runs", content=json.dumps({"window": "15m"}))
    assert started.status_code == 202
    run_id = started.json()["run_id"]

    assert client.post("/admin/runs", content=json.dumps({"window": "15m"})).status_code == 409

    for _ in range(50):
        progress = client.get(f"/admin/runs/{run_id}").json()
        if progress["swept"] == 1:
            break
        threading.Event().wait(0.02)
    assert progress["status"] == "running"
    assert progress["stages"]["swept"] == 1

    release.set()
    for _ in range(50):
        final = client.get("/admin/runs/latest").json()["run"]
        if final["status"] != "running":
            break
        threading.Event().wait(0.02)
    assert final["status"] == "done"
    assert final["summary"]["swept"] == 1
    assert seen["window"] == "15m"


def test_clip_endpoint_validates_id_and_missing_file(admin_api):
    _, client, tmp_path = admin_api
    assert client.get("/admin/renders/bad..id/clip.webm").status_code == 400
    assert client.get("/admin/renders/session-1234/clip.webm").status_code == 404
    folder = tmp_path / "renders" / "session-1234"
    folder.mkdir(parents=True)
    (folder / "clip.webm").write_bytes(b"webm")
    response = client.get("/admin/renders/session-1234/clip.webm")
    assert response.status_code == 200
    assert response.headers["content-type"] == "video/webm"
