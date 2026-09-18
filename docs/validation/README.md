# Reproducible validation evidence

`traffic.json` is the earlier interaction-only 12-session ground truth. The subsequent [backend-signal evaluation](../backend-validation/README.md) is preserved separately. `run/summary.json` is the complete real run output, including one selected manual session outside that cohort. `score.txt` evaluates only the 12 labeled sessions. `manifest.yaml` preserves the run's three-minute sweep window and unchanged threshold of 5.

From the repository root, reproduce the offline score:

```bash
mkdir -p .data/runs/validation-example
cp docs/validation/run/summary.json .data/runs/validation-example/summary.json
uv run --project src/agent eyewitness score --run validation-example --truth docs/validation/traffic.json
```

No service credentials or model calls are needed for scoring. The run's $0.5617 cost is an estimate from its vision token counts and manifest prices; it excludes standalone calibration calls, embeddings, storage and other service charges.

The run completed before the final incident-memory compatibility correction. Detection metrics are unchanged by that filing-only fix, which was verified separately through slow-payment filing and repeat filing. Earlier comments remain in the original Kibana case as validation history. See [run notes](../run-notes.md) for exact outcomes and limitations.
