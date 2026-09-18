"""Read models and the run manager behind the storefront's /admin page.

The page is the demo surface for people who never open a terminal: every recorded
session, the difficulty signals on it, a button that runs the funnel with live
progress, and the confirmed incidents with their evidence clips.
"""

import json
import re
import threading
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from elasticsearch import Elasticsearch

from eyewitness import kibana
from eyewitness.config import DATA_DIR, REPO_ROOT
from eyewitness.es.indices import INCIDENTS, SESSIONS
from eyewitness.run import execute_run, load_manifest, run_dir

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "runs" / "nightly.yaml"
SESSION_ID_PATTERN = re.compile(r"[A-Za-z0-9-]{8,64}")
WINDOW_PATTERN = re.compile(r"^\d{1,4}[mhd]$")
MAX_SESSIONS = 200
MAX_INCIDENTS = 50
MAX_HISTORY = 10

SWEPT_PATTERN = re.compile(r"sweep selected (\d+) sessions")


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def renders_dir(session_id: str) -> Path:
    return DATA_DIR / "renders" / session_id


def read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def local_evidence(session_id: str) -> dict:
    """What the renderer and the vision chain left on disk for this session."""
    folder = renders_dir(session_id)
    render = read_json(folder / "render.json")
    watch = read_json(folder / "watch.json")
    return {
        "has_clip": (folder / "clip.webm").exists(),
        "rendered_seconds": render.get("rendered_seconds") if render else None,
        "frame_seconds": [frame["second"] for frame in render.get("frames", [])] if render else [],
        "watch": watch,
    }


def session_status(
    score: float | None, threshold: float, incident: dict | None, watch: dict | None
) -> str:
    if incident:
        return "filed"
    if watch:
        return "confirmed" if watch.get("confirmed") else "cleared"
    if score is None:
        return "unscored"
    if score >= threshold:
        return "flagged"
    return "healthy"


def list_sessions(client: Elasticsearch, window: str, threshold: float) -> list[dict]:
    response = client.search(
        index=SESSIONS,
        query={"range": {"last_batch_at": {"gte": f"now-{window}"}}},
        sort=[{"last_batch_at": "desc"}],
        size=MAX_SESSIONS,
    )
    sources = [hit["_source"] for hit in response["hits"]["hits"]]
    incidents = incidents_by_session(client, [source["session_id"] for source in sources])

    sessions = []
    for source in sources:
        session_id = source["session_id"]
        signals = source.get("signals") or {}
        score = signals.get("difficulty_score")
        evidence = local_evidence(session_id)
        watch = evidence["watch"]
        incident = incidents.get(session_id)
        sessions.append(
            {
                "session_id": session_id,
                "started_at": source.get("started_at"),
                "last_batch_at": source.get("last_batch_at"),
                "duration_ms": source.get("duration_ms", 0),
                "pages": source.get("pages", []),
                "click_count": source.get("click_count", 0),
                "event_count": source.get("event_count", 0),
                "signals": signals,
                "score": score,
                "status": session_status(score, threshold, incident, watch),
                "has_clip": evidence["has_clip"],
                "incident_id": incident["incident_id"] if incident else None,
                "case_url": incident["case_url"] if incident else None,
                "finding": summarise_watch(watch),
            }
        )
    return sessions


def summarise_watch(watch: dict | None) -> dict | None:
    if not watch:
        return None
    extraction = watch.get("extraction") or {}
    review = watch.get("review") or {}
    triage = watch.get("triage") or {}
    return {
        "confirmed": watch.get("confirmed", False),
        "stage_reached": watch.get("stage_reached"),
        "title": extraction.get("title"),
        "headline": extraction.get("headline"),
        "step_tried": extraction.get("step_tried"),
        "step_expected": extraction.get("step_expected"),
        "step_got": extraction.get("step_got"),
        "page": extraction.get("page"),
        "user_intent": extraction.get("user_intent"),
        "expected": extraction.get("expected"),
        "observed": extraction.get("observed"),
        "summary": extraction.get("summary"),
        "failing_second": extraction.get("failing_second"),
        "evidence_seconds": extraction.get("evidence_seconds", []),
        "triage_reason": triage.get("reason"),
        "triage_confidence": triage.get("confidence"),
        "review_verdict": review.get("verdict"),
        "review_confidence": review.get("confidence"),
        "counterargument": review.get("counterargument"),
    }


def incidents_by_session(client: Elasticsearch, session_ids: list[str]) -> dict[str, dict]:
    if not session_ids:
        return {}
    response = client.search(
        index=INCIDENTS,
        query={"terms": {"session_id": session_ids}},
        size=len(session_ids),
        source=["incident_id", "session_id", "case_id", "title"],
    )
    found = {}
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        found[source["session_id"]] = {
            "incident_id": source["incident_id"],
            "title": source.get("title"),
            "case_url": safe_case_url(source.get("case_id")),
        }
    return found


def safe_case_url(case_id: str | None) -> str | None:
    if not case_id:
        return None
    try:
        return kibana.case_url(case_id)
    except Exception:
        return None


def list_incidents(client: Elasticsearch) -> list[dict]:
    response = client.search(
        index=INCIDENTS,
        query={"match_all": {}},
        sort=[{"created_at": "desc"}],
        size=MAX_INCIDENTS,
        source={"excludes": ["embedding"]},
    )
    incidents = []
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        session_id = source.get("session_id", "")
        evidence = local_evidence(session_id) if session_id else {"has_clip": False}
        incidents.append(
            {
                **source,
                "case_url": safe_case_url(source.get("case_id")),
                "has_clip": evidence["has_clip"],
                "finding": summarise_watch(evidence.get("watch")),
            }
        )
    return incidents


@dataclass
class RunState:
    run_id: str
    status: str
    started_at: str
    window: str
    threshold: float
    limit: int
    finished_at: str | None = None
    swept: int | None = None
    events: list[dict] = field(default_factory=list)
    summary: dict | None = None
    error: str | None = None


class RunManager:
    """Runs the funnel on a background thread and exposes its progress."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._runs: dict[str, RunState] = {}
        self._latest_id: str | None = None
        self._thread: threading.Thread | None = None

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(
        self,
        client: Elasticsearch,
        window: str,
        threshold: float | None = None,
        limit: int | None = None,
    ) -> RunState:
        with self._lock:
            if self.is_running():
                raise RuntimeError("a run is already in progress")
            manifest = load_manifest(MANIFEST_PATH)
            manifest["window"] = window
            if threshold is not None:
                manifest["sweep"]["threshold"] = threshold
            if limit is not None:
                manifest["sweep"]["limit"] = limit

            run_id = datetime.now(UTC).strftime("admin-%Y%m%dT%H%M%SZ")
            state = RunState(
                run_id=run_id,
                status="running",
                started_at=now_iso(),
                window=window,
                threshold=manifest["sweep"]["threshold"],
                limit=manifest["sweep"]["limit"],
            )
            self._runs[run_id] = state
            self._latest_id = run_id
            self._thread = threading.Thread(
                target=self._execute, args=(client, manifest, state), daemon=True
            )
            self._thread.start()
            return state

    def _execute(self, client: Elasticsearch, manifest: dict, state: RunState) -> None:
        def log(message: str) -> None:
            state.events.append({"at": now_iso(), "message": message.strip()})
            match = SWEPT_PATTERN.search(message)
            if match:
                state.swept = int(match.group(1))

        try:
            summary = execute_run(client, manifest, state.run_id, log)
            state.summary = asdict(summary)
            state.status = "done"
        except Exception as error:
            state.error = f"{type(error).__name__}: {error}"
            state.status = "failed"
            log(f"run failed: {state.error}")
        finally:
            state.finished_at = now_iso()

    def get(self, run_id: str) -> RunState | None:
        return self._runs.get(run_id)

    def latest(self) -> RunState | None:
        return self._runs.get(self._latest_id) if self._latest_id else None


def run_outcomes(run_id: str) -> list[dict]:
    """Per-session checkpoints written by the orchestrator, readable while it is still running."""
    folder = run_dir(run_id)
    outcomes = []
    for path in sorted(folder.glob("*.json")):
        if path.name == "summary.json":
            continue
        outcome = read_json(path)
        if outcome:
            outcomes.append(outcome)
    return outcomes


def run_payload(state: RunState) -> dict:
    outcomes = run_outcomes(state.run_id)
    stages = {
        "swept": state.swept if state.swept is not None else 0,
        "rendered": sum(o["stage"] in ("rendered", "watched", "filed", "done") for o in outcomes),
        "watched": sum(o["stage"] in ("watched", "filed", "done") for o in outcomes),
        "confirmed": sum(bool(o.get("confirmed")) for o in outcomes),
        "filed": sum(o.get("case_id") is not None for o in outcomes),
    }
    return {**asdict(state), "stages": stages, "outcomes": outcomes}


def run_history() -> list[dict]:
    """Summaries of past runs on disk, newest first."""
    root = DATA_DIR / "runs"
    if not root.exists():
        return []
    summaries = []
    for path in root.glob("*/summary.json"):
        summary = read_json(path)
        if summary:
            summaries.append(summary)
    summaries.sort(key=lambda item: item.get("started_at", ""), reverse=True)
    return summaries[:MAX_HISTORY]


ORDERS_DIR = REPO_ROOT / "src" / "storefront" / ".data" / "orders"
FALLBACK_ORDER_VALUE = 2499.0


def average_order_value() -> tuple[float, int]:
    """Mean total of orders the storefront actually placed, and how many there were."""
    totals = []
    if ORDERS_DIR.exists():
        for path in ORDERS_DIR.glob("*.json"):
            order = read_json(path)
            if order and isinstance(order.get("total"), int | float):
                totals.append(float(order["total"]))
    if not totals:
        return FALLBACK_ORDER_VALUE, 0
    return sum(totals) / len(totals), len(totals)


def to_epoch_ms(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, int | float):
        return float(value)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000
    except ValueError:
        return None


def impact(client: Elasticsearch) -> dict:
    """Business-impact numbers from what the agent has actually filed.

    Every figure is derived from stored data plus one stated assumption (the average
    order value, measured from real orders when there are any)."""
    response = client.search(
        index=INCIDENTS,
        query={"match_all": {}},
        size=MAX_INCIDENTS,
        source=["incident_id", "session_id", "created_at", "affected_users", "status"],
    )
    incidents = [hit["_source"] for hit in response["hits"]["hits"]]
    open_incidents = [item for item in incidents if item.get("status") != "closed"]

    sessions_hit = sum(max(1, int(item.get("affected_users") or 0)) for item in open_incidents)
    order_value, order_count = average_order_value()

    latencies_minutes = []
    session_ids = [item["session_id"] for item in incidents if item.get("session_id")]
    if session_ids:
        docs = client.mget(index=SESSIONS, ids=session_ids, source=["started_at", "ended_at"])
        started = {
            doc["_id"]: to_epoch_ms((doc.get("_source") or {}).get("ended_at"))
            for doc in docs["docs"]
            if doc.get("found")
        }
        for item in incidents:
            ended = started.get(item["session_id"])
            filed = to_epoch_ms(item.get("created_at"))
            if ended and filed and filed >= ended:
                latencies_minutes.append((filed - ended) / 60_000)
    latencies_minutes.sort()
    median_detect = latencies_minutes[len(latencies_minutes) // 2] if latencies_minutes else None

    history = run_history()
    total_cost = sum(float(run.get("cost_usd") or 0) for run in history)
    watched = sum(int(run.get("watched") or 0) for run in history)
    confirmed = sum(int(run.get("confirmed") or 0) for run in history)

    return {
        "open_incidents": len(open_incidents),
        "sessions_hit": sessions_hit,
        "average_order_value": round(order_value, 2),
        "orders_measured": order_count,
        "revenue_at_risk": round(sessions_hit * order_value, 2),
        "median_detect_minutes": round(median_detect, 1) if median_detect is not None else None,
        "detect_samples": len(latencies_minutes),
        "runs": len(history),
        "sessions_watched": watched,
        "incidents_confirmed": confirmed,
        "total_cost_usd": round(total_cost, 2),
        "cost_per_watched_usd": round(total_cost / watched, 2) if watched else None,
        "cost_per_confirmed_usd": round(total_cost / confirmed, 2) if confirmed else None,
    }


def validate_window(window: str) -> str:
    if not WINDOW_PATTERN.match(window):
        raise ValueError("window must look like 15m, 1h or 24h")
    return window


def validate_session_id(session_id: str) -> str:
    if not SESSION_ID_PATTERN.fullmatch(session_id):
        raise ValueError("invalid session id")
    return session_id
