from datetime import UTC, datetime

from elasticsearch import Elasticsearch

from eyewitness.es.indices import REPLAY_EVENTS, SESSIONS
from eyewitness.signals.compute import Signals, compute_signals

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


def sessions_to_compute(client: Elasticsearch, since: str, force: bool) -> list[dict]:
    response = client.search(
        index=SESSIONS,
        query={"range": {"last_batch_at": {"gte": f"now-{since}"}}},
        size=10_000,
        source=["session_id", "last_batch_at", "signals.computed_at"],
    )
    sessions = []
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        computed_at = source.get("signals", {}).get("computed_at")
        stale = computed_at is None or computed_at < source["last_batch_at"]
        if force or stale:
            sessions.append(source)
    return sessions


def write_signals(client: Elasticsearch, session_id: str, signals: Signals) -> None:
    document = signals.as_dict()
    document["computed_at"] = datetime.now(UTC).isoformat()
    client.update(index=SESSIONS, id=session_id, doc={"signals": document})


def compute_for_session(client: Elasticsearch, session_id: str) -> Signals:
    signals = compute_signals(fetch_events(client, session_id))
    write_signals(client, session_id, signals)
    return signals
