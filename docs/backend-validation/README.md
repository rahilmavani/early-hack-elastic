# Backend-signal validation

This follow-up adds one five-point boost for any HTTP status >= 500 or API duration > 5000 ms in the session's `server-events`. The two flags share that boost; a slow 504 is not counted twice. The sweep threshold remains 5, and the vision prompts and storefront journeys are unchanged in this follow-up.

`traffic.json` contains the fresh 12-session truth. `signals.json` preserves the actual per-session signal documents, and `sweep.txt` shows the four selected sessions with their backend flags. `manifest.yaml` preserves the five-minute window used for this run. The earlier [interaction-only benchmark](../validation/README.md) is retained.

`baseline-selection-comparison.json` is a separate controlled comparison on the original recorded cohort: with identical interaction signals, adding backend evidence selects 3/5 faults instead of 2/5, with zero healthy sessions selected in either case. This measures sweep selection only; it does not represent another vision run.

The full run confirmed 4/5 faults and flagged 0/7 healthy sessions: **100% precision, 80% recall** (TP 4, FP 0, FN 1, TN 7). It completed without errors: 4 rendered, 4 watched, 4 confirmed, 1 new case, 3 deduplicated; estimated vision cost $0.9358. `run/summary.json`, `score.txt` and `run-output.txt` preserve the actual results.

The fresh traffic is randomized. Its stale-bag session happened to produce a rage-click burst and score 5 with the existing interaction weights. No quantity-change, total-comparison or upload-specific heuristic was added. Quiet UI outcome errors remain a limitation.

To reproduce the final saved score offline from the repository root:

```bash
mkdir -p .data/runs/backend-validation-example
cp docs/backend-validation/run/summary.json .data/runs/backend-validation-example/summary.json
uv run --project src/agent eyewitness score --run backend-validation-example --truth docs/backend-validation/traffic.json
```

See [run notes](../run-notes.md) for the measured final results. Cost in a run summary estimates that run's vision calls using its manifest prices; it is not total service billing.
