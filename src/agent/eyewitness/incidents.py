import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from elasticsearch import Elasticsearch

from eyewitness import kibana, sarvam
from eyewitness.config import DATA_DIR
from eyewitness.correlate import TraceMatch, affected_users, find_trace, fingerprint
from eyewitness.es.indices import INCIDENTS, SESSIONS
from eyewitness.memory import embed_incident, find_similar, matching_incident
from eyewitness.storage import upload_file
from eyewitness.watch.schemas import WatchResult


@dataclass
class FiledIncident:
    incident_id: str
    case_id: str
    case_url: str
    deduplicated: bool
    affected_users: int


def plain_language_fields(finding) -> dict:
    """The short retelling of a finding, only the parts the model actually filled."""
    fields = {}
    for name in ("headline", "step_tried", "step_expected", "step_got"):
        value = getattr(finding, name, None)
        if value:
            fields[name] = value
    return fields


def load_watch(session_id: str) -> WatchResult:
    path = DATA_DIR / "renders" / session_id / "watch.json"
    return WatchResult.model_validate_json(path.read_text())


def load_render(session_id: str) -> dict:
    return json.loads((DATA_DIR / "renders" / session_id / "render.json").read_text())


def upload_evidence(
    session_id: str, render: dict, evidence_seconds: list[int]
) -> tuple[str, list[str]]:
    clip_url = upload_file(Path(render["clip_path"]), f"{session_id}/clip.webm")
    frame_urls = []
    for frame in render["frames"]:
        if frame["second"] in evidence_seconds:
            key = f"{session_id}/frames/{frame['second']:04d}.jpg"
            frame_urls.append(upload_file(Path(frame["path"]), key))
    return clip_url, frame_urls


def describe(
    watch: WatchResult,
    trace: TraceMatch | None,
    clip_url: str,
    frame_urls: list[str],
    users: int,
    translated: dict[str, str],
) -> str:
    finding = watch.extraction
    review = watch.review
    lines = [
        f"**What the user saw**: {finding.observed}",
        f"**What they were doing**: {finding.user_intent}",
        f"**What should have happened**: {finding.expected}",
        "",
        f"**Breaks at second {finding.failing_second}** on `{finding.page}`. "
        f"[Watch the clip]({clip_url}) and scrub to {finding.failing_second}s.",
        "",
        f"**Affected users in the window**: {users}",
    ]
    if trace:
        lines.append(
            f"**Backend trace**: `{trace.trace_id}` {trace.method} `{trace.route}` "
            f"returned {trace.status} in {trace.duration_ms} ms"
        )
    else:
        lines.append("**Backend trace**: no API call reached the server around the failure")
    lines += [
        "",
        f"**Adversarial review**: {review.verdict} ({review.confidence:.0%}). "
        f"Strongest counterargument: {review.counterargument}",
        "",
        f"**Session**: `{watch.session_id}`",
    ]
    if frame_urls:
        lines.append(
            "**Evidence frames**: "
            + ", ".join(f"[{i + 1}]({url})" for i, url in enumerate(frame_urls))
        )
    for language, text in translated.items():
        lines += ["", f"**Summary in {language}**: {text}"]
    return "\n".join(lines)


def file_session(
    client: Elasticsearch, session_id: str, window: str = "24h"
) -> FiledIncident | None:
    watch = load_watch(session_id)
    if not watch.confirmed or watch.extraction is None:
        return None

    finding = watch.extraction
    session = client.get(index=SESSIONS, id=session_id)["_source"]
    render = load_render(session_id)

    trace = find_trace(client, session_id, session["started_at"], finding.failing_second)
    users = affected_users(client, finding.page, window)
    clip_url, frame_urls = upload_evidence(session_id, render, finding.evidence_seconds)
    translated = sarvam.translations(finding.summary)
    description = describe(watch, trace, clip_url, frame_urls, users, translated)

    vector = embed_incident(finding.title, finding.page, finding.summary)
    match = matching_incident(
        find_similar(client, vector), status_code=trace.status if trace else None
    )
    incident_id = f"inc-{uuid.uuid4().hex[:10]}"
    now = datetime.now(UTC).isoformat()

    if match and match.case_id:
        note = (
            f"Seen again in session `{session_id}` at second {finding.failing_second}. "
            f"Affected users now {users}.\n\n"
            f"**Finding**: {finding.summary}\n\n{description}"
        )
        if match.status == "closed" and match.resolution:
            note += f"\n\nLast time this was closed with: {match.resolution}"
        updated_case = kibana.add_comment(match.case_id, note)
        client.update(
            index=INCIDENTS,
            id=match.incident_id,
            doc={
                "affected_users": users,
                "last_seen_at": now,
                "last_seen_session_id": session_id,
                **plain_language_fields(finding),
            },
        )
        return FiledIncident(
            match.incident_id,
            match.case_id,
            kibana.case_url(match.case_id, updated_case.get("owner")),
            True,
            users,
        )

    case = kibana.create_case(
        title=finding.title,
        description=description,
        tags=["eyewitness", fingerprint(finding.page, session.get("signals", {}))],
    )
    client.index(
        index=INCIDENTS,
        id=incident_id,
        document={
            "incident_id": incident_id,
            "created_at": now,
            "status": "open",
            "title": finding.title,
            "summary": finding.summary,
            **plain_language_fields(finding),
            "session_id": session_id,
            "failing_second": finding.failing_second,
            "clip_url": clip_url,
            "frame_urls": frame_urls,
            "route": trace.route if trace else None,
            "status_code": trace.status if trace else None,
            "affected_users": users,
            "fingerprint": fingerprint(finding.page, session.get("signals", {})),
            "review": watch.review.model_dump() if watch.review else None,
            "case_id": case["id"],
            "embedding": vector,
        },
        refresh=True,
    )
    return FiledIncident(
        incident_id, case["id"], kibana.case_url(case["id"], case.get("owner")), False, users
    )
