from unittest.mock import MagicMock

import pytest

from eyewitness import incidents
from eyewitness.correlate import TraceMatch
from eyewitness.memory import SimilarIncident
from eyewitness.watch.schemas import ExtractionResult, ReviewResult, TriageResult, WatchResult


@pytest.mark.parametrize("with_trace", [True, False])
def test_recurrence_keeps_new_finding_and_backend_evidence(monkeypatch, with_trace):
    watch = WatchResult(
        session_id="session-123",
        stage_reached="review",
        confirmed=True,
        triage=TriageResult(broken=True, confidence=0.95, reason="Order failed"),
        extraction=ExtractionResult(
            title="Payment failed",
            page="/checkout",
            user_intent="Place order",
            expected="Order confirmation",
            observed="Error after spinner",
            failing_second=23,
            evidence_seconds=[23],
            summary="The order request timed out after eight seconds.",
        ),
        review=ReviewResult(verdict="confirm", counterargument="No confirmation", confidence=0.97),
        usage={},
    )
    trace = TraceMatch("trace-new", "/api/orders", "POST", 504, 8003, "2026-09-18T08:00:00Z")
    monkeypatch.setattr(incidents, "load_watch", lambda _: watch)
    monkeypatch.setattr(incidents, "load_render", lambda _: {})
    monkeypatch.setattr(incidents, "find_trace", lambda *args: trace if with_trace else None)
    monkeypatch.setattr(incidents, "affected_users", lambda *args: 10)
    monkeypatch.setattr(incidents, "upload_evidence", lambda *args: ("https://clip.test/1", []))
    monkeypatch.setattr(incidents.sarvam, "translations", lambda _: {})
    monkeypatch.setattr(incidents, "embed_incident", lambda *args: [0.1])
    monkeypatch.setattr(
        incidents,
        "find_similar",
        lambda *args: [
            SimilarIncident(
                "inc-old",
                "Old checkout finding",
                "open",
                "case-old",
                None,
                0.95,
                status_code=504 if with_trace else None,
            )
        ],
    )
    add_comment = MagicMock(return_value={"owner": "observability"})
    monkeypatch.setattr(incidents.kibana, "add_comment", add_comment)
    monkeypatch.setattr(incidents.kibana, "case_url", lambda *args: "https://kibana.test/case-old")
    client = MagicMock()
    client.get.return_value = {"_source": {"started_at": 0}}

    result = incidents.file_session(client, "session-123")

    assert result.deduplicated
    note = add_comment.call_args.args[1]
    assert watch.extraction.summary in note
    assert "second 23" in note and "https://clip.test/1" in note
    if with_trace:
        assert "trace-new" in note and "returned 504 in 8003 ms" in note
    else:
        assert "no API call reached the server" in note
