import asyncio
import json
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import yaml
from elasticsearch import Elasticsearch

from eyewitness.config import DATA_DIR
from eyewitness.es.indices import SESSIONS
from eyewitness.incidents import file_session
from eyewitness.render.renderer import render_session
from eyewitness.signals.run import compute_for_session, fetch_events, sessions_to_compute
from eyewitness.sweep import sweep
from eyewitness.watch.run import watch_session


@dataclass
class SessionOutcome:
    session_id: str
    difficulty_score: float
    stage: str = "selected"
    confirmed: bool = False
    case_id: str | None = None
    deduplicated: bool = False
    input_tokens: int = 0
    output_tokens: int = 0
    error: str | None = None


@dataclass
class RunSummary:
    run_id: str
    started_at: str
    swept: int = 0
    rendered: int = 0
    watched: int = 0
    confirmed: int = 0
    filed: int = 0
    deduplicated: int = 0
    cost_usd: float = 0.0
    outcomes: list[SessionOutcome] = field(default_factory=list)


def load_manifest(path: Path) -> dict:
    return yaml.safe_load(path.read_text())


def run_dir(run_id: str) -> Path:
    path = DATA_DIR / "runs" / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def checkpoint_path(run_id: str, session_id: str) -> Path:
    return run_dir(run_id) / f"{session_id}.json"


def load_checkpoint(run_id: str, session_id: str) -> SessionOutcome | None:
    path = checkpoint_path(run_id, session_id)
    if not path.exists():
        return None
    return SessionOutcome(**json.loads(path.read_text()))


def save_checkpoint(run_id: str, outcome: SessionOutcome) -> None:
    checkpoint_path(run_id, outcome.session_id).write_text(json.dumps(asdict(outcome), indent=2))


def process_session(
    client: Elasticsearch, run_id: str, outcome: SessionOutcome, manifest: dict, log
) -> SessionOutcome:
    """Render, watch and file one session, resuming from whatever stage a checkpoint reached."""
    outcome.error = None
    try:
        if outcome.stage == "selected":
            events = fetch_events(client, outcome.session_id)
            asyncio.run(
                render_session(outcome.session_id, events, manifest["render"]["max_seconds"])
            )
            outcome.stage = "rendered"
            save_checkpoint(run_id, outcome)
            log(f"  rendered {outcome.session_id}")

        if outcome.stage == "rendered":
            watched = watch_session(client, outcome.session_id)
            outcome.confirmed = watched.confirmed
            outcome.input_tokens = watched.usage.input_tokens
            outcome.output_tokens = watched.usage.output_tokens
            outcome.stage = "watched"
            save_checkpoint(run_id, outcome)
            verdict = "confirmed" if watched.confirmed else f"rejected at {watched.stage_reached}"
            log(f"  watched {outcome.session_id}: {verdict}")

        if outcome.stage == "watched" and outcome.confirmed:
            filed = file_session(client, outcome.session_id, manifest["window"])
            if filed:
                outcome.case_id = filed.case_id
                outcome.deduplicated = filed.deduplicated
                action = "added to" if filed.deduplicated else "opened"
                log(f"  {action} case {filed.case_id}: {filed.case_url}")
            outcome.stage = "filed"
            save_checkpoint(run_id, outcome)
        elif outcome.stage == "watched":
            outcome.stage = "done"
            save_checkpoint(run_id, outcome)
    except Exception as error:
        outcome.error = f"{type(error).__name__}: {error}"
        save_checkpoint(run_id, outcome)
        log(f"  failed {outcome.session_id} at {outcome.stage}: {outcome.error}")
    return outcome


def execute_run(client: Elasticsearch, manifest: dict, run_id: str | None, log) -> RunSummary:
    run_id = run_id or datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    summary = RunSummary(run_id=run_id, started_at=datetime.now(UTC).isoformat())
    started = time.monotonic()
    log(f"run {run_id}")

    pending = sessions_to_compute(client, manifest["window"], force=False)
    for item in pending:
        compute_for_session(client, item["session_id"])
    if pending:
        client.indices.refresh(index=SESSIONS)
    log(f"signals computed for {len(pending)} sessions")

    swept = sweep(
        client, manifest["sweep"]["threshold"], manifest["window"], manifest["sweep"]["limit"]
    )
    summary.swept = len(swept)
    log(f"sweep selected {len(swept)} sessions above {manifest['sweep']['threshold']}")

    for item in swept:
        outcome = load_checkpoint(run_id, item.session_id) or SessionOutcome(
            session_id=item.session_id, difficulty_score=item.difficulty_score
        )
        if outcome.stage in ("filed", "done"):
            log(f"  skipping {item.session_id}, already {outcome.stage}")
        else:
            outcome = process_session(client, run_id, outcome, manifest, log)
        summary.outcomes.append(outcome)

    pricing = manifest["pricing"]
    for outcome in summary.outcomes:
        summary.rendered += outcome.stage in ("rendered", "watched", "filed", "done")
        summary.watched += outcome.stage in ("watched", "filed", "done")
        summary.confirmed += outcome.confirmed
        summary.filed += outcome.case_id is not None and not outcome.deduplicated
        summary.deduplicated += outcome.deduplicated
        summary.cost_usd += (
            outcome.input_tokens / 1000 * pricing["input_per_1k"]
            + outcome.output_tokens / 1000 * pricing["output_per_1k"]
        )
    summary.cost_usd = round(summary.cost_usd, 4)

    (run_dir(run_id) / "summary.json").write_text(json.dumps(asdict(summary), indent=2))
    elapsed = time.monotonic() - started
    log(
        f"done in {elapsed:.0f}s: swept {summary.swept}, rendered {summary.rendered}, "
        f"watched {summary.watched}, confirmed {summary.confirmed}, filed {summary.filed}, "
        f"deduplicated {summary.deduplicated}, cost ${summary.cost_usd}"
    )
    return summary
