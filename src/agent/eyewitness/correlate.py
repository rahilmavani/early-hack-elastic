from dataclasses import dataclass

from elasticsearch import Elasticsearch

from eyewitness.es.indices import SERVER_EVENTS, SESSIONS

TRACE_WINDOW_MS = 10_000
BLAST_RADIUS_MIN_SCORE = 3.0


@dataclass
class TraceMatch:
    trace_id: str
    route: str
    method: str
    status: int
    duration_ms: int
    timestamp: str


def find_trace(
    client: Elasticsearch, session_id: str, session_started_ms: int, failing_second: int
) -> TraceMatch | None:
    """The backend call closest to the failing second, preferring one that failed."""
    centre = session_started_ms + failing_second * 1000
    response = client.search(
        index=SERVER_EVENTS,
        query={
            "bool": {
                "filter": [
                    {"term": {"session_id": session_id}},
                    {
                        "range": {
                            "timestamp": {
                                "gte": centre - TRACE_WINDOW_MS,
                                "lte": centre + TRACE_WINDOW_MS,
                            }
                        }
                    },
                ]
            }
        },
        sort=[{"timestamp": "desc"}],
        size=20,
    )
    hits = [hit["_source"] for hit in response["hits"]["hits"]]
    if not hits:
        return None
    failed = [hit for hit in hits if hit["status"] >= 400]
    chosen = failed[0] if failed else hits[0]
    return TraceMatch(
        trace_id=chosen["trace_id"],
        route=chosen["route"],
        method=chosen["method"],
        status=chosen["status"],
        duration_ms=chosen["duration_ms"],
        timestamp=chosen["timestamp"],
    )


def fingerprint(page: str, signals: dict) -> str:
    if signals.get("repeated_submits", 0) > 0:
        kind = "dead-submit"
    elif signals.get("dead_clicks", 0) > 0:
        kind = "dead-click"
    elif signals.get("rage_clicks", 0) > 0:
        kind = "rage-click"
    elif signals.get("checkout_abandoned"):
        kind = "checkout-abandoned"
    else:
        kind = "difficulty"
    return f"{page}:{kind}"


def affected_users(client: Elasticsearch, page: str, window: str) -> int:
    """Sessions in the window that reached the same page and showed difficulty there."""
    response = client.count(
        index=SESSIONS,
        query={
            "bool": {
                "filter": [
                    {"term": {"pages": page}},
                    {"range": {"signals.difficulty_score": {"gte": BLAST_RADIUS_MIN_SCORE}}},
                    {"range": {"last_batch_at": {"gte": f"now-{window}"}}},
                ]
            }
        },
    )
    return response["count"]
