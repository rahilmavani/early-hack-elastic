"""Offline evaluation of the full funnel against generated traffic labels."""

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ScoredSession:
    session_id: str
    fault: str | None
    difficulty_score: float | None
    stage: str
    confirmed: bool
    selected: bool


@dataclass(frozen=True)
class ScoreReport:
    sessions: list[ScoredSession]
    excluded_traffic: int
    unlabeled_outcomes: int

    @property
    def swept(self) -> int:
        return sum(row.selected for row in self.sessions)

    @property
    def confirmed(self) -> int:
        return sum(row.confirmed for row in self.sessions)

    @property
    def true_positives(self) -> int:
        return sum(row.confirmed and bool(row.fault) for row in self.sessions)

    @property
    def false_positives(self) -> int:
        return sum(row.confirmed and not row.fault for row in self.sessions)

    @property
    def false_negatives(self) -> int:
        return sum(not row.confirmed and bool(row.fault) for row in self.sessions)

    @property
    def true_negatives(self) -> int:
        return sum(not row.confirmed and not row.fault for row in self.sessions)

    @property
    def precision(self) -> float | None:
        return self.true_positives / self.confirmed if self.confirmed else None

    @property
    def recall(self) -> float | None:
        positives = self.true_positives + self.false_negatives
        return self.true_positives / positives if positives else None


def _session_id(record: dict) -> str | None:
    value = record.get("session_id")
    return value if isinstance(value, str) and value.strip() and value != "unknown" else None


def _outcome(record: object, source: Path) -> dict:
    if not isinstance(record, dict) or not _session_id(record):
        raise ValueError(f"{source}: outcome needs a valid session_id")
    if not isinstance(record.get("confirmed"), bool):
        raise ValueError(f"{source}: outcome confirmed must be a boolean")
    if not isinstance(record.get("stage"), str):
        raise ValueError(f"{source}: outcome needs a stage")
    score = record.get("difficulty_score")
    if score is not None and (isinstance(score, bool) or not isinstance(score, (int, float))):
        raise ValueError(f"{source}: difficulty_score must be a number")
    return record


def load_outcomes(run_path: Path) -> dict[str, dict]:
    """Load a summary and checkpoints, including runs interrupted before summary writing."""
    if not run_path.is_dir():
        raise ValueError(f"run directory does not exist: {run_path}")
    outcomes: dict[str, dict] = {}
    summary_path = run_path / "summary.json"
    if summary_path.exists():
        summary = json.loads(summary_path.read_text())
        if not isinstance(summary, dict) or not isinstance(summary.get("outcomes"), list):
            raise ValueError(f"{summary_path}: expected a summary with an outcomes list")
        for record in summary["outcomes"]:
            record = _outcome(record, summary_path)
            session_id = record["session_id"]
            if session_id in outcomes:
                raise ValueError(f"{summary_path}: duplicate session_id {session_id}")
            outcomes[session_id] = record
    checkpoints = sorted(path for path in run_path.glob("*.json") if path != summary_path)
    if not summary_path.exists() and not checkpoints:
        raise ValueError(f"no summary or checkpoints found in {run_path}")
    for path in checkpoints:
        record = _outcome(json.loads(path.read_text()), path)
        if path.stem != record["session_id"]:
            raise ValueError(f"{path}: checkpoint filename does not match session_id")
        # A resumed run can update checkpoints before replacing its old summary.
        outcomes[record["session_id"]] = record
    return outcomes


def score_run(run_path: Path, truth_path: Path) -> ScoreReport:
    outcomes = load_outcomes(run_path)
    truth = json.loads(truth_path.read_text())
    if not isinstance(truth, list):
        raise ValueError(f"{truth_path}: expected a list of traffic records")
    sessions = []
    seen = set()
    excluded = 0
    for record in truth:
        if not isinstance(record, dict):
            raise ValueError(f"{truth_path}: traffic records must be objects")
        session_id = _session_id(record)
        # A failed journey does not establish whether the injected fault was exercised.
        if not session_id or record.get("ok", True) is False:
            excluded += 1
            continue
        if record.get("ok", True) is not True:
            raise ValueError(f"{truth_path}: traffic ok must be a boolean")
        if session_id in seen:
            raise ValueError(f"{truth_path}: duplicate session_id {session_id}")
        seen.add(session_id)
        if "fault" not in record or (
            record["fault"] is not None
            and (not isinstance(record["fault"], str) or not record["fault"].strip())
        ):
            raise ValueError(f"{truth_path}: fault must be null (healthy) or a nonempty string")
        outcome = outcomes.get(session_id)
        sessions.append(
            ScoredSession(
                session_id=session_id,
                fault=record["fault"],
                difficulty_score=outcome.get("difficulty_score") if outcome else None,
                stage=outcome["stage"] if outcome else "not_selected",
                confirmed=outcome["confirmed"] if outcome else False,
                selected=outcome is not None,
            )
        )
    return ScoreReport(sessions, excluded, len(outcomes.keys() - seen))
