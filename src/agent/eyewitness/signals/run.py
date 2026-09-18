from datetime import UTC, datetime

from elasticsearch import Elasticsearch

from eyewitness.es.indices import REPLAY_EVENTS, SERVER_EVENTS, SESSIONS
from eyewitness.signals.compute import HIGH_API_LATENCY_MS, Signals, compute_signals, score

MAX_EVENTS = 10_000


def fetch_events(client: Elasticsearch, session_id: str) -> list[dict]:
    response = client.search(
        index=REPLAY_EVENTS,
        query={"term": {"session_id": session_id}},
        sort=[{"timestamp": "asc"}],
        size=MAX_EVENTS,
        source=["event"],
    )
    hits = response["hits"]["hits"]
    if len(hits) == MAX_EVENTS:
        raise RuntimeError(f"session {session_id} has more than {MAX_EVENTS} events")
    return [hit["_source"]["event"] for hit in hits]


def fetch_backend_signals(client: Elasticsearch, session_ids: list[str]) -> dict[str, dict]:
    """Aggregate all calls for these sessions, without a per-session event-count limit."""
    if not session_ids:
        return {}
    response = client.search(
        index=SERVER_EVENTS,
        size=0,
        query={"terms": {"session_id": session_ids}},
        aggs={
            "sessions": {
                "terms": {"field": "session_id", "size": len(session_ids)},
                "aggs": {
                    "backend_error": {"filter": {"range": {"status": {"gte": 500}}}},
                    "high_api_latency": {
                        "filter": {"range": {"duration_ms": {"gt": HIGH_API_LATENCY_MS}}}
                    },
                },
            }
        },
    )
    return {
        bucket["key"]: {
            "backend_error": bucket["backend_error"]["doc_count"] > 0,
            "high_api_latency": bucket["high_api_latency"]["doc_count"] > 0,
        }
        for bucket in response["aggregations"]["sessions"]["buckets"]
    }


def sessions_to_compute(client: Elasticsearch, since: str, force: bool) -> list[dict]:
    response = client.search(
        index=SESSIONS,
        query={"range": {"last_batch_at": {"gte": f"now-{since}"}}},
        size=10_000,
        source=["session_id", "last_batch_at", "signals"],
    )
    sources = [hit["_source"] for hit in response["hits"]["hits"]]
    if force:
        return sources
    # Server events can arrive after the replay's last batch. Compare the current
    # backend evidence even when replay signals were already computed; missing
    # fields also backfill sessions scored before backend signals were introduced.
    backend = fetch_backend_signals(client, [item["session_id"] for item in sources])
    sessions = []
    for source in sources:
        computed_at = source.get("signals", {}).get("computed_at")
        stale = computed_at is None or computed_at < source["last_batch_at"]
        current = backend.get(source["session_id"], {})
        backend_changed = any(
            source.get("signals", {}).get(name) != current.get(name, False)
            for name in ("backend_error", "high_api_latency")
        )
        if stale or backend_changed:
            sessions.append(source)
    return sessions


def write_signals(client: Elasticsearch, session_id: str, signals: Signals) -> None:
    document = signals.as_dict()
    document["computed_at"] = datetime.now(UTC).isoformat()
    client.update(index=SESSIONS, id=session_id, doc={"signals": document})


def compute_for_session(client: Elasticsearch, session_id: str) -> Signals:
    signals = compute_signals(fetch_events(client, session_id))
    backend = fetch_backend_signals(client, [session_id]).get(session_id, {})
    signals.backend_error = backend.get("backend_error", False)
    signals.high_api_latency = backend.get("high_api_latency", False)
    signals.difficulty_score = score(signals)
    write_signals(client, session_id, signals)
    return signals
