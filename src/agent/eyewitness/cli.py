import typer

from eyewitness.config import get_settings
from eyewitness.es.client import get_client
from eyewitness.es.indices import SESSIONS, ensure_indices, index_mappings

app = typer.Typer(
    help="Eyewitness: the incident response agent that saw it happen.",
    no_args_is_help=True,
)


@app.command()
def setup(recreate: bool = typer.Option(False, help="Delete and recreate every index.")) -> None:
    """Create the Elasticsearch indices the agent writes to."""
    settings = get_settings()
    created = ensure_indices(get_client(), settings.embedding_dimensions, recreate=recreate)
    for name in index_mappings(settings.embedding_dimensions):
        state = "created" if name in created else "exists"
        typer.echo(f"{name}: {state}")


@app.command()
def doctor() -> None:
    """Check that Elasticsearch, Kibana, Bedrock and S3 are reachable with the configured keys."""
    from eyewitness.doctor import run_checks

    failures = run_checks()
    if failures:
        raise typer.Exit(code=1)


@app.command()
def ingest(
    host: str = typer.Option(None, help="Bind address. Defaults to INGEST_HOST."),
    port: int = typer.Option(None, help="Port. Defaults to INGEST_PORT."),
) -> None:
    """Run the ingest service the storefront posts replay batches and server events to."""
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "eyewitness.ingest.app:app",
        host=host or settings.ingest_host,
        port=port or settings.ingest_port,
    )


@app.command()
def traffic(
    sessions: int = typer.Option(24, help="Total sessions to run."),
    broken: int = typer.Option(6, help="How many of them run under a fault scenario."),
    concurrency: int = typer.Option(3, help="Browser contexts running at once."),
    base_url: str = typer.Option(None, help="Storefront URL. Defaults to STOREFRONT_URL."),
) -> None:
    """Drive realistic sessions against the storefront so there is traffic to sweep."""
    import asyncio

    from eyewitness.traffic.runner import run_traffic, save_ground_truth

    url = (base_url or get_settings().storefront_url).rstrip("/")
    records = asyncio.run(run_traffic(url, sessions, broken, concurrency))
    path = save_ground_truth(records)
    failed = sum(1 for record in records if not record.ok)
    typer.echo(f"{len(records)} sessions, {failed} failed. Ground truth: {path}")


@app.command()
def signals(
    since: str = typer.Option("24h", help="Only sessions with batches newer than this."),
    session: str = typer.Option(None, help="Compute for one session id only."),
    force: bool = typer.Option(False, help="Recompute even if signals are up to date."),
) -> None:
    """Compute difficulty signals onto each session summary."""
    from eyewitness.signals.run import compute_for_session, sessions_to_compute

    client = get_client()
    if session:
        session_ids = [session]
    else:
        session_ids = [item["session_id"] for item in sessions_to_compute(client, since, force)]

    for session_id in session_ids:
        result = compute_for_session(client, session_id)
        typer.echo(
            f"{session_id}  score={result.difficulty_score:<6} dead={result.dead_clicks} "
            f"rage={result.rage_clicks} resubmits={result.repeated_submits} "
            f"checkout_abandoned={result.checkout_abandoned} "
            f"backend_error={result.backend_error} high_api_latency={result.high_api_latency}"
        )
    if session_ids:
        client.indices.refresh(index=SESSIONS)
    typer.echo(f"{len(session_ids)} sessions updated")


@app.command()
def sweep(
    threshold: float = typer.Option(5.0, help="Minimum difficulty score to select."),
    window: str = typer.Option("24h", help="How far back to look, e.g. 24h or 7d."),
    limit: int = typer.Option(50, help="Maximum sessions to return."),
) -> None:
    """Select sessions showing signs of user difficulty with one ES|QL query."""
    from eyewitness.sweep import sweep as run_sweep

    swept = run_sweep(get_client(), threshold, window, limit)
    for item in swept:
        typer.echo(
            f"{item.session_id}  score={item.difficulty_score:<6} dead={item.dead_clicks} "
            f"rage={item.rage_clicks} resubmits={item.repeated_submits} "
            f"checkout_abandoned={item.checkout_abandoned} "
            f"backend_error={item.backend_error} high_api_latency={item.high_api_latency}"
        )
    typer.echo(f"{len(swept)} sessions selected")


@app.command()
def render(
    session_id: str = typer.Argument(help="Session to replay."),
    from_file: str = typer.Option(None, help="Read events from a local ndjson file instead."),
    max_seconds: int = typer.Option(180, help="Stop rendering after this many seconds."),
) -> None:
    """Replay a session in headless Chromium at real speed, saving a clip and one frame a second."""
    import asyncio
    from pathlib import Path

    from eyewitness.render.renderer import load_events_from_ndjson, render_session

    if from_file:
        events = load_events_from_ndjson(Path(from_file))
    else:
        from eyewitness.signals.run import fetch_events

        events = fetch_events(get_client(), session_id)
    if not events:
        typer.echo("no events found for that session")
        raise typer.Exit(code=1)

    result = asyncio.run(render_session(session_id, events, max_seconds))
    typer.echo(
        f"rendered {result.rendered_seconds}s of {result.duration_seconds}s, "
        f"{len(result.frames)} frames, clip at {result.clip_path}"
    )


@app.command()
def watch(session_id: str = typer.Argument(help="A rendered session to judge.")) -> None:
    """Run the vision chain on a rendered session: triage, extract, then adversarial review."""
    from eyewitness.watch.run import watch_session

    result = watch_session(get_client(), session_id)
    triage = result.triage
    typer.echo(f"triage: broken={triage.broken} ({triage.confidence:.2f}) {triage.reason}")
    if result.extraction:
        finding = result.extraction
        typer.echo(f"finding: {finding.title} at second {finding.failing_second}")
        typer.echo(f"  {finding.summary}")
    if result.review:
        review = result.review
        typer.echo(f"review: {review.verdict} ({review.confidence:.2f}) {review.counterargument}")
    typer.echo(
        f"stage reached: {result.stage_reached}, confirmed: {result.confirmed}, "
        f"tokens in/out: {result.usage.input_tokens}/{result.usage.output_tokens}"
    )


@app.command()
def file(
    session_id: str = typer.Argument(help="A watched session with a confirmed finding."),
    window: str = typer.Option("24h", help="Window for counting affected users."),
) -> None:
    """Correlate a confirmed finding with its backend trace, dedupe against memory, open a case."""
    from eyewitness.incidents import file_session

    filed = file_session(get_client(), session_id, window)
    if filed is None:
        typer.echo("nothing to file: the finding was not confirmed")
        return
    action = "added to existing case" if filed.deduplicated else "opened case"
    typer.echo(
        f"{action} {filed.case_id} for {filed.incident_id}, {filed.affected_users} users affected"
    )
    typer.echo(filed.case_url)


@app.command()
def score(
    run_id: str = typer.Option(..., "--run", help="Run id under .data/runs/."),
    truth: str = typer.Option(..., help="Traffic ground-truth JSON file."),
) -> None:
    """Measure precision and recall across all successful sessions in a traffic batch."""
    from pathlib import Path

    from eyewitness.config import DATA_DIR
    from eyewitness.score import score_run

    if Path(run_id).name != run_id or run_id in (".", ".."):
        raise typer.BadParameter("use a run id, not a path", param_hint="--run")
    try:
        report = score_run(DATA_DIR / "runs" / run_id, Path(truth))
    except (OSError, ValueError) as error:
        raise typer.BadParameter(str(error)) from error

    typer.echo(
        f"evaluated {len(report.sessions)} traffic sessions: swept {report.swept}, "
        f"confirmed {report.confirmed}"
    )
    typer.echo(
        f"TP {report.true_positives}, FP {report.false_positives}, "
        f"FN {report.false_negatives}, TN {report.true_negatives}"
    )
    precision = f"{report.precision:.1%}" if report.precision is not None else "n/a"
    recall = f"{report.recall:.1%}" if report.recall is not None else "n/a"
    typer.echo(f"precision {precision}, recall {recall}")
    typer.echo(
        f"excluded traffic records {report.excluded_traffic}; "
        f"run outcomes outside evaluated truth {report.unlabeled_outcomes}"
    )
    typer.echo(f"{'session':<38} {'fault':<24} {'score':>7} {'stage':<14} confirmed")
    for row in report.sessions:
        difficulty = f"{row.difficulty_score:g}" if row.difficulty_score is not None else "-"
        typer.echo(
            f"{row.session_id:<38} {row.fault or 'healthy':<24} {difficulty:>7} "
            f"{row.stage:<14} {str(row.confirmed).lower()}"
        )


@app.command()
def run(
    manifest: str = typer.Option("runs/nightly.yaml", help="YAML manifest with thresholds."),
    run_id: str = typer.Option(
        None, help="Resume a previous run by id instead of starting a new one."
    ),
    every: int = typer.Option(0, help="Repeat every N minutes. 0 runs once."),
) -> None:
    """Run the whole funnel: signals, sweep, render, watch, correlate and file."""
    import time
    from pathlib import Path

    from eyewitness.run import execute_run, load_manifest

    settings = load_manifest(Path(manifest))
    while True:
        execute_run(get_client(), settings, run_id, typer.echo)
        if every <= 0:
            break
        run_id = None
        typer.echo(f"sleeping {every} minutes")
        time.sleep(every * 60)
