from types import SimpleNamespace

from eyewitness import run


def test_successful_filing_retry_clears_checkpoint_error(monkeypatch, tmp_path):
    monkeypatch.setattr(run, "DATA_DIR", tmp_path)
    monkeypatch.setattr(
        run,
        "file_session",
        lambda *args: SimpleNamespace(
            case_id="case-123", deduplicated=True, case_url="https://kibana.test/cases/case-123"
        ),
    )
    outcome = run.SessionOutcome(
        session_id="session-123",
        difficulty_score=9,
        stage="watched",
        confirmed=True,
        error="HTTPStatusError: 403 Forbidden",
    )

    result = run.process_session(object(), "retry", outcome, {"window": "10m"}, lambda _: None)

    assert result.stage == "filed"
    assert result.case_id == "case-123"
    assert result.error is None
    assert run.load_checkpoint("retry", "session-123").error is None


def test_failed_retry_replaces_old_error(monkeypatch, tmp_path):
    monkeypatch.setattr(run, "DATA_DIR", tmp_path)

    def fail(*args):
        raise TimeoutError("storage unavailable")

    monkeypatch.setattr(run, "file_session", fail)
    outcome = run.SessionOutcome(
        session_id="session-123",
        difficulty_score=9,
        stage="watched",
        confirmed=True,
        error="HTTPStatusError: 403 Forbidden",
    )
    result = run.process_session(object(), "retry", outcome, {"window": "10m"}, lambda _: None)
    assert result.stage == "watched"
    assert result.error == "TimeoutError: storage unavailable"
    assert run.load_checkpoint("retry", "session-123").error == result.error


def test_run_refreshes_updated_signals_before_sweeping(monkeypatch, tmp_path):
    from unittest.mock import MagicMock

    monkeypatch.setattr(run, "DATA_DIR", tmp_path)
    actions = []
    monkeypatch.setattr(run, "sessions_to_compute", lambda *a, **kw: [{"session_id": "late-504"}])
    monkeypatch.setattr(run, "compute_for_session", lambda *a: actions.append("write"))
    client = MagicMock()
    client.indices.refresh.side_effect = lambda **kw: actions.append("refresh")

    def sweep_after_refresh(*args):
        assert actions == ["write", "refresh"]
        return []

    monkeypatch.setattr(run, "sweep", sweep_after_refresh)
    manifest = {
        "window": "24h",
        "sweep": {"threshold": 5, "limit": 25},
        "pricing": {"input_per_1k": 0.003, "output_per_1k": 0.015},
    }
    run.execute_run(client, manifest, "backend-refresh", lambda _: None)
