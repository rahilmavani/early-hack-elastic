import json

import pytest
from typer.testing import CliRunner

from eyewitness.cli import app
from eyewitness.score import score_run


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))
    return path


def outcome(session_id, confirmed=False, stage="done", score=8):
    return {
        "session_id": session_id,
        "difficulty_score": score,
        "stage": stage,
        "confirmed": confirmed,
    }


def test_full_truth_join_counts_unswept_faults_as_misses(tmp_path):
    run = tmp_path / "run"
    write_json(
        run / "summary.json",
        {
            "outcomes": [
                outcome("broken-found", True),
                outcome("healthy-flagged", True),
                outcome("broken-rejected"),
                outcome("unrelated", True),
            ]
        },
    )
    truth = write_json(
        tmp_path / "truth.json",
        [
            {"session_id": "broken-found", "fault": "silent-checkout", "ok": True},
            {"session_id": "healthy-flagged", "fault": None, "ok": True},
            {"session_id": "broken-rejected", "fault": "dropped-upload", "ok": True},
            {"session_id": "broken-unswept", "fault": "slow-payment", "ok": True},
            {"session_id": "healthy-unswept", "fault": None, "ok": True},
            {"session_id": "failed-journey", "fault": "silent-checkout", "ok": False},
            {"session_id": "unknown", "fault": "silent-checkout", "ok": False},
        ],
    )

    report = score_run(run, truth)

    assert report.swept == 3
    assert report.confirmed == 2
    assert report.true_positives == 1
    assert report.false_positives == 1
    assert report.false_negatives == 2
    assert report.true_negatives == 1
    assert report.precision == 0.5
    assert report.recall == pytest.approx(1 / 3)
    assert report.excluded_traffic == 2
    assert report.unlabeled_outcomes == 1
    assert report.sessions[3].stage == "not_selected"
    assert report.sessions[3].difficulty_score is None


def test_checkpoints_override_old_summary_and_support_interrupted_runs(tmp_path):
    run = tmp_path / "run"
    summary = write_json(run / "summary.json", {"outcomes": [outcome("s1")]})
    write_json(run / "s1.json", outcome("s1", True, "filed"))
    write_json(run / "s2.json", outcome("s2", False, "rendered"))
    truth = write_json(
        tmp_path / "truth.json",
        [
            {"session_id": "s1", "fault": "silent-checkout"},
            {"session_id": "s2", "fault": "slow-payment"},
        ],
    )

    with_summary = score_run(run, truth)
    summary.unlink()
    checkpoint_only = score_run(run, truth)

    assert with_summary == checkpoint_only
    assert checkpoint_only.swept == 2
    assert checkpoint_only.recall == 0.5
    assert checkpoint_only.sessions[0].stage == "filed"
    assert checkpoint_only.sessions[1].stage == "rendered"


@pytest.mark.parametrize("fault,expected_recall", [(None, None), ("silent-checkout", 0)])
def test_undefined_denominators_and_empty_sweep(tmp_path, fault, expected_recall):
    run = tmp_path / "run"
    write_json(run / "summary.json", {"outcomes": []})
    truth = write_json(tmp_path / "truth.json", [{"session_id": "s1", "fault": fault}])

    report = score_run(run, truth)

    assert report.precision is None
    assert report.recall == expected_recall
    assert report.swept == 0


@pytest.mark.parametrize(
    "truth_rows,error",
    [
        ([{"session_id": "s1", "fault": None}] * 2, "duplicate session_id"),
        ([{"session_id": "s1"}], "fault must be"),
        ([{"session_id": "s1", "fault": None, "ok": "false"}], "ok must be"),
    ],
)
def test_invalid_labels_fail_instead_of_producing_misleading_metrics(tmp_path, truth_rows, error):
    run = tmp_path / "run"
    write_json(run / "summary.json", {"outcomes": []})
    truth = write_json(tmp_path / "truth.json", truth_rows)
    with pytest.raises(ValueError, match=error):
        score_run(run, truth)


def test_missing_run_does_not_silently_score_all_sessions_as_missed(tmp_path):
    truth = write_json(tmp_path / "truth.json", [])
    with pytest.raises(ValueError, match="run directory does not exist"):
        score_run(tmp_path / "missing", truth)


def test_cli_scores_without_network_or_credentials(tmp_path, monkeypatch):
    monkeypatch.setattr("eyewitness.config.DATA_DIR", tmp_path)
    monkeypatch.setattr(
        "eyewitness.cli.get_settings",
        lambda: pytest.fail("offline scoring must not load credentials"),
    )
    monkeypatch.setattr(
        "eyewitness.cli.get_client", lambda: pytest.fail("offline scoring must not connect to ES")
    )
    write_json(
        tmp_path / "runs" / "demo" / "summary.json",
        {
            "outcomes": [outcome("s1", True)],
        },
    )
    truth = write_json(
        tmp_path / "truth.json",
        [
            {"session_id": "s1", "fault": "silent-checkout", "ok": True},
            {"session_id": "s2", "fault": "slow-payment", "ok": True},
        ],
    )

    result = CliRunner().invoke(app, ["score", "--run", "demo", "--truth", str(truth)])

    assert result.exit_code == 0, result.output
    assert "swept 1, confirmed 1" in result.output
    assert "precision 100.0%, recall 50.0%" in result.output
    assert "not_selected" in result.output


def test_cli_missing_run_is_a_clear_error(tmp_path, monkeypatch):
    monkeypatch.setattr("eyewitness.config.DATA_DIR", tmp_path)
    result = CliRunner().invoke(app, ["score", "--run", "missing", "--truth", "missing.json"])
    assert result.exit_code == 2
    assert "run directory does not exist" in result.output
