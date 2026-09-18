import json
from pathlib import Path

from elasticsearch import Elasticsearch

from eyewitness.config import DATA_DIR
from eyewitness.es.indices import SESSIONS
from eyewitness.watch.client import converse_json
from eyewitness.watch.prompts import extraction_prompt, review_prompt, triage_prompt
from eyewitness.watch.schemas import (
    ExtractionResult,
    ReviewResult,
    TriageResult,
    Usage,
    WatchResult,
)


def load_render(session_id: str) -> dict:
    path = DATA_DIR / "renders" / session_id / "render.json"
    if not path.exists():
        raise FileNotFoundError(f"no render for {session_id}; run `eyewitness render` first")
    return json.loads(path.read_text())


def load_session(client: Elasticsearch, session_id: str) -> dict:
    return client.get(index=SESSIONS, id=session_id)["_source"]


def save_watch(session_id: str, result: WatchResult) -> Path:
    path = DATA_DIR / "renders" / session_id / "watch.json"
    path.write_text(result.model_dump_json(indent=2))
    return path


def watch_session(client: Elasticsearch, session_id: str) -> WatchResult:
    render = load_render(session_id)
    session = load_session(client, session_id)
    frames = render["frames"]
    seconds = render["rendered_seconds"]
    usage = Usage()

    triage, call_usage = converse_json(
        triage_prompt(session, seconds, TriageResult), frames, TriageResult
    )
    usage = usage.add(call_usage)
    if not triage.broken:
        result = WatchResult(
            session_id=session_id,
            stage_reached="triage",
            confirmed=False,
            triage=triage,
            usage=usage,
        )
        save_watch(session_id, result)
        return result

    extraction, call_usage = converse_json(
        extraction_prompt(session, seconds, ExtractionResult), frames, ExtractionResult
    )
    usage = usage.add(call_usage)

    review, call_usage = converse_json(
        review_prompt(session, seconds, extraction, ReviewResult), frames, ReviewResult
    )
    usage = usage.add(call_usage)

    result = WatchResult(
        session_id=session_id,
        stage_reached="review",
        confirmed=review.verdict == "confirm",
        triage=triage,
        extraction=extraction,
        review=review,
        usage=usage,
    )
    save_watch(session_id, result)
    return result
