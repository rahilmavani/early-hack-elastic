from unittest.mock import MagicMock

import pytest

from eyewitness.es.indices import BACKEND_SIGNAL_MAPPINGS, SESSIONS, ensure_indices
from eyewitness.signals import run
from eyewitness.signals.compute import Signals, score
from eyewitness.sweep import sweep


@pytest.mark.parametrize(
    "error,slow,expected",
    [
        (False, False, 0),
        (True, False, 5),
        (False, True, 5),
        (True, True, 5),
    ],
)
def test_backend_issue_selects_session_without_double_counting(error, slow, expected):
    assert score(Signals(backend_error=error, high_api_latency=slow)) == expected


class BackendClient:
    """Exercise the requested aggregation on a small mixed-session backend fixture."""

    def __init__(self, docs):
        self.docs = docs

    def search(self, *, index, size, query, aggs):
        assert index == "server-events" and size == 0
        requested = query["terms"]["session_id"]
        config = aggs["sessions"]
        assert config["terms"] == {"field": "session_id", "size": len(requested)}
        error_min = config["aggs"]["backend_error"]["filter"]["range"]["status"]["gte"]
        latency_min = config["aggs"]["high_api_latency"]["filter"]["range"]["duration_ms"]["gt"]
        buckets = []
        for session_id in requested:
            calls = [doc for doc in self.docs if doc["session_id"] == session_id]
            if calls:
                buckets.append(
                    {
                        "key": session_id,
                        "backend_error": {
                            "doc_count": sum(c["status"] >= error_min for c in calls)
                        },
                        "high_api_latency": {
                            "doc_count": sum(c["duration_ms"] > latency_min for c in calls)
                        },
                    }
                )
        return {"aggregations": {"sessions": {"buckets": buckets}}}


@pytest.mark.parametrize(
    "status,duration,expected",
    [
        (499, 5000, (False, False)),
        (500, 100, (True, False)),
        (200, 5001, (False, True)),
        (504, 8000, (True, True)),
    ],
)
def test_backend_thresholds_and_session_isolation(status, duration, expected):
    client = BackendClient(
        [
            {"session_id": "requested", "status": status, "duration_ms": duration},
            {"session_id": "unrelated", "status": 503, "duration_ms": 9000},
        ]
    )
    result = run.fetch_backend_signals(client, ["requested", "missing"])
    assert result == {
        "requested": dict(zip(("backend_error", "high_api_latency"), expected, strict=True))
    }


def test_backend_signal_is_written_into_difficulty_score(monkeypatch):
    client = MagicMock()
    monkeypatch.setattr(run, "fetch_events", lambda *_: [])
    monkeypatch.setattr(
        run,
        "fetch_backend_signals",
        lambda *_: {
            "session-123": {"backend_error": True, "high_api_latency": True},
        },
    )
    result = run.compute_for_session(client, "session-123")
    assert result.difficulty_score == 5
    persisted = client.update.call_args.kwargs["doc"]["signals"]
    assert persisted["backend_error"] is True
    assert persisted["high_api_latency"] is True
    assert persisted["difficulty_score"] == 5


@pytest.mark.parametrize(
    "stored,backend,selected",
    [
        (
            {"backend_error": False, "high_api_latency": False},
            {"backend_error": True, "high_api_latency": True},
            True,
        ),
        (
            {"backend_error": True, "high_api_latency": False},
            {"backend_error": True, "high_api_latency": True},
            True,
        ),
        ({"backend_error": False, "high_api_latency": False}, {}, False),
        ({}, {}, True),  # Upgrade old documents without requiring --force.
    ],
)
def test_cached_replay_recomputes_for_new_backend_evidence(monkeypatch, stored, backend, selected):
    source = {
        "session_id": "session-123",
        "last_batch_at": "2026-09-18T00:00:00Z",
        "signals": {"computed_at": "2026-09-18T00:01:00Z", **stored},
    }
    client = MagicMock()
    client.search.return_value = {"hits": {"hits": [{"_source": source}]}}
    monkeypatch.setattr(run, "fetch_backend_signals", lambda *_: {"session-123": backend})
    assert run.sessions_to_compute(client, "24h", False) == ([source] if selected else [])


def test_sweep_exposes_backend_reason_and_handles_legacy_nulls():
    client = MagicMock()
    names = [
        "session_id",
        "signals.difficulty_score",
        "signals.dead_clicks",
        "signals.rage_clicks",
        "signals.repeated_submits",
        "signals.checkout_abandoned",
        "duration_ms",
        "signals.backend_error",
        "signals.high_api_latency",
    ]
    client.esql.query.return_value = {
        "columns": [{"name": name} for name in names],
        "values": [
            ["timeout", 5, 0, 0, 0, False, 9000, True, True],
            ["legacy", 6, 2, 0, 0, False, 3000, None, None],
        ],
    }
    result = sweep(client, 5, "24h", 50)
    assert result[0].backend_error and result[0].high_api_latency
    assert not result[1].backend_error and not result[1].high_api_latency
    query = client.esql.query.call_args.kwargs["query"]
    assert "signals.backend_error" in query and "signals.high_api_latency" in query


def test_setup_adds_fields_without_recreating_existing_indices():
    client = MagicMock()
    client.indices.exists.return_value = True
    assert ensure_indices(client, 1536) == []
    client.indices.delete.assert_not_called()
    client.indices.create.assert_not_called()
    client.indices.put_mapping.assert_called_once_with(
        index=SESSIONS,
        properties={"signals": {"properties": BACKEND_SIGNAL_MAPPINGS}},
    )
