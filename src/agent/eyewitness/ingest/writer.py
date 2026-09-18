from datetime import UTC, datetime

from elasticsearch import Elasticsearch, helpers

from eyewitness.es.indices import REPLAY_EVENTS, SERVER_EVENTS, SESSIONS
from eyewitness.ingest.models import ReplayBatch, ServerEvent

EVENT_TYPE_META = 4
EVENT_TYPE_INCREMENTAL = 3
EVENT_TYPE_CUSTOM = 5
ROUTE_CHANGE_TAG = "route"
SOURCE_MOUSE_INTERACTION = 2
MOUSE_INTERACTION_CLICK = 2

SESSION_UPSERT_SCRIPT = """
if (ctx._source.started_at == null || params.started_at < ctx._source.started_at) {
  ctx._source.started_at = params.started_at;
}
if (ctx._source.ended_at == null || params.ended_at > ctx._source.ended_at) {
  ctx._source.ended_at = params.ended_at;
}
ctx._source.duration_ms = ctx._source.ended_at - ctx._source.started_at;
ctx._source.event_count += params.event_count;
ctx._source.click_count += params.click_count;
for (page in params.pages) {
  if (!ctx._source.pages.contains(page)) {
    ctx._source.pages.add(page);
  }
}
ctx._source.page_count = ctx._source.pages.size();
ctx._source.last_batch_at = params.last_batch_at;
"""


def is_click(event: dict) -> bool:
    if event.get("type") != EVENT_TYPE_INCREMENTAL:
        return False
    data = event.get("data", {})
    return (
        data.get("source") == SOURCE_MOUSE_INTERACTION
        and data.get("type") == MOUSE_INTERACTION_CLICK
    )


def page_path(href: str) -> str:
    without_scheme = href.split("://", 1)[-1]
    path = "/" + without_scheme.split("/", 1)[1] if "/" in without_scheme else "/"
    return path.split("?", 1)[0]


def visited_path(event: dict) -> str | None:
    data = event.get("data", {})
    if event.get("type") == EVENT_TYPE_META and data.get("href"):
        return page_path(data["href"])
    if event.get("type") == EVENT_TYPE_CUSTOM and data.get("tag") == ROUTE_CHANGE_TAG:
        return data.get("payload", {}).get("path")
    return None


def event_documents(batch: ReplayBatch, ingested_at: str):
    for position, event in enumerate(batch.events):
        timestamp = event.get("timestamp")
        if timestamp is None:
            continue
        data = event.get("data", {})
        yield {
            "_index": REPLAY_EVENTS,
            "_id": f"{batch.session_id}:{timestamp}:{position}",
            "_source": {
                "session_id": batch.session_id,
                "timestamp": timestamp,
                "type": event.get("type"),
                "source": data.get("source"),
                "href": data.get("href"),
                "event": event,
                "ingested_at": ingested_at,
            },
        }


def write_replay_batch(client: Elasticsearch, batch: ReplayBatch) -> int:
    ingested_at = datetime.now(UTC).isoformat()
    timestamps = [event["timestamp"] for event in batch.events if "timestamp" in event]
    if not timestamps:
        return 0

    written, _ = helpers.bulk(client, event_documents(batch, ingested_at), refresh=False)

    pages = [path for path in (visited_path(event) for event in batch.events) if path]
    params = {
        "started_at": min(timestamps),
        "ended_at": max(timestamps),
        "event_count": len(timestamps),
        "click_count": sum(1 for event in batch.events if is_click(event)),
        "pages": pages,
        "last_batch_at": ingested_at,
    }
    client.update(
        index=SESSIONS,
        id=batch.session_id,
        retry_on_conflict=5,
        script={"source": SESSION_UPSERT_SCRIPT, "params": params},
        upsert={
            "session_id": batch.session_id,
            "started_at": params["started_at"],
            "ended_at": params["ended_at"],
            "duration_ms": params["ended_at"] - params["started_at"],
            "event_count": params["event_count"],
            "click_count": params["click_count"],
            "pages": list(dict.fromkeys(pages)),
            "page_count": len(set(pages)),
            "last_batch_at": ingested_at,
        },
    )
    return written


def write_server_event(client: Elasticsearch, event: ServerEvent) -> None:
    client.index(index=SERVER_EVENTS, document=event.model_dump())
