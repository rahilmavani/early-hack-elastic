from elasticsearch import Elasticsearch

REPLAY_EVENTS = "replay-events"
SESSIONS = "sessions"
SERVER_EVENTS = "server-events"
INCIDENTS = "incidents"

BACKEND_SIGNAL_MAPPINGS = {
    "backend_error": {"type": "boolean"},
    "high_api_latency": {"type": "boolean"},
}


def index_mappings(embedding_dimensions: int) -> dict[str, dict]:
    return {
        REPLAY_EVENTS: {
            "properties": {
                "session_id": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "type": {"type": "short"},
                "source": {"type": "short"},
                "href": {"type": "keyword"},
                "event": {"type": "object", "enabled": False},
                "ingested_at": {"type": "date"},
            }
        },
        SESSIONS: {
            "properties": {
                "session_id": {"type": "keyword"},
                "started_at": {"type": "date"},
                "ended_at": {"type": "date"},
                "duration_ms": {"type": "long"},
                "pages": {"type": "keyword"},
                "page_count": {"type": "integer"},
                "event_count": {"type": "integer"},
                "click_count": {"type": "integer"},
                "last_batch_at": {"type": "date"},
                "signals": {
                    "properties": {
                        **BACKEND_SIGNAL_MAPPINGS,
                        "dead_clicks": {"type": "integer"},
                        "rage_clicks": {"type": "integer"},
                        "repeated_submits": {"type": "integer"},
                        "checkout_dwell_ms": {"type": "long"},
                        "checkout_abandoned": {"type": "boolean"},
                        "difficulty_score": {"type": "float"},
                        "computed_at": {"type": "date"},
                    }
                },
            }
        },
        SERVER_EVENTS: {
            "properties": {
                "session_id": {"type": "keyword"},
                "trace_id": {"type": "keyword"},
                "timestamp": {"type": "date"},
                "route": {"type": "keyword"},
                "method": {"type": "keyword"},
                "status": {"type": "short"},
                "duration_ms": {"type": "integer"},
            }
        },
        INCIDENTS: {
            "properties": {
                "incident_id": {"type": "keyword"},
                "created_at": {"type": "date"},
                "status": {"type": "keyword"},
                "title": {"type": "text"},
                "summary": {"type": "text"},
                "session_id": {"type": "keyword"},
                "failing_second": {"type": "float"},
                "clip_url": {"type": "keyword"},
                "frame_urls": {"type": "keyword"},
                "route": {"type": "keyword"},
                "status_code": {"type": "short"},
                "affected_users": {"type": "integer"},
                "fingerprint": {"type": "keyword"},
                "review": {
                    "properties": {
                        "verdict": {"type": "keyword"},
                        "counterargument": {"type": "text"},
                        "confidence": {"type": "float"},
                    }
                },
                "case_id": {"type": "keyword"},
                "resolution": {"type": "text"},
                "embedding": {
                    "type": "dense_vector",
                    "dims": embedding_dimensions,
                    "index": True,
                    "similarity": "cosine",
                },
            }
        },
    }


def ensure_indices(
    client: Elasticsearch, embedding_dimensions: int, recreate: bool = False
) -> list[str]:
    created = []
    for name, mappings in index_mappings(embedding_dimensions).items():
        exists = client.indices.exists(index=name)
        if exists and recreate:
            client.indices.delete(index=name)
            exists = False
        if not exists:
            client.indices.create(index=name, mappings=mappings)
            created.append(name)
        elif name == SESSIONS:
            # Add fields to existing deployments without recreating any index.
            client.indices.put_mapping(
                index=name, properties={"signals": {"properties": BACKEND_SIGNAL_MAPPINGS}}
            )
    return created
