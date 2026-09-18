# Validation notes — 2026-09-18

Worktree: `st-georges`. No commits or pushes were made during this execution.

## Configuration and local checks

The repository root `.env` and storefront `.env.local` are configured locally and gitignored. No credentials are included in these notes.

- `eyewitness doctor`: all five checks passed — Elasticsearch (9.6.0), Kibana, Bedrock vision, Bedrock embeddings (1536 dimensions), and S3.
- `eyewitness setup`: all four indices exist; no data was deleted or recreated.
- The full Chromium download timed out, so initial live tests used installed Google Chrome. The smaller `uv run playwright install chromium --only-shell` download later succeeded, and default Playwright Chromium launch passed. Normal CLI commands now work without the temporary adapter.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript and all 43 generated pages; both replay routes are present.
- Python suite: 76 tests passed at the latest integrated verification, including scoring, replay API, traffic planning, Kibana URLs and provisioning failures.
- Human replay: live Elasticsearch recording loads through the server-side proxy; play, speed selection and the recorded storefront iframe work. Viewing does not create a recorder session. Local API checks cover chronological flattening, missing sessions, malformed/incomplete batches and invalid IDs.

## Latest backend-signal follow-up

Implemented the backend recall improvement without changing the sweep threshold, interaction weights, traffic journeys, or vision prompts. `signals.backend_error` means at least one status >= 500; `signals.high_api_latency` means at least one call > 5000 ms. Either adds five points once per session. The flags are aggregated from `server-events` and persisted on `sessions`, where the ES|QL sweep exposes both reasons. Existing mappings are extended without recreation. Backend flags are rechecked for cached sessions so late API events can trigger rescoring; updated signal documents are refreshed before sweeping.

A controlled selection comparison on the **original recorded cohort** holds interaction signals fixed: faults selected rise from **2/5 to 3/5**, while healthy sessions selected remain **0/7**. This measures selection only, not a second vision run.

The fresh end-to-end cohort is `.data/traffic/20260918T081836Z.json`, run `live-20260918-backend`, using a five-minute window and threshold 5. All **12/12 journeys succeeded**, all session documents were present, and no outside-cohort session was selected. Results: **TP 4, FP 0, FN 1, TN 7 — precision 100%, recall 80%**.

| Fault | Score | Result |
| --- | --- | --- |
| Silent checkout | 33.21 | Confirmed and filed to the existing case |
| Slow payment | 7.21 | Backend boost raised the interaction-only score of 2.21 above threshold; confirmed and filed to the existing 504 case |
| Offscreen validation | 5.12 | Confirmed and filed to the existing case |
| Stale bag total | 5.00 | Existing rage-click plus bag-abandonment signals selected it; confirmed and opened a case |
| Dropped upload | 0.00 | Not selected; false negative |

All seven healthy sessions scored zero. The fresh stale-bag journey happened to generate a rage-click burst, unlike the earlier batch. Its detection is **not attributable to the new backend signal** and is not evidence of a general total-validation detector. Quiet stale totals and dropped uploads remain stated limitations; no demo-specific outcome heuristic was added. These are small synthetic cohorts, not a production accuracy estimate.

```text
done in 282s: swept 4, rendered 4, watched 4, confirmed 4, filed 1, deduplicated 3, cost $0.9358
```

All outcomes completed without errors. The new [stale-total case](https://eyewitness-b857e1.kb.us-west-2.aws.elastic.cloud/app/observability/cases/2bcadae6-2c74-465f-a922-cc766b0f92d4) and existing 504 case were filed by the normal pipeline. [Truth, per-session signals, sweep output, manifest, complete summary and score](backend-validation/README.md) are preserved for offline reproduction. The cost line estimates this run's vision calls only.

## Earlier interaction-only traffic cohort

The post-fix cohort is `.data/traffic/20260918T080022Z.json`: 12 successful browser journeys, comprising five injected faults and seven healthy sessions. All 12 have Elasticsearch session documents. The run ID is `live-20260918-final`; its sweep threshold is the unchanged default of 5. A three-minute window limits older traffic, though one older manual session was still selected and is reported outside the scored truth cohort.

The two selected cohort faults (silent checkout and offscreen validation) were confirmed. Slow payment, stale bag totals and dropped uploads did not reach the sweep threshold. These remain end-to-end misses even though a separate manual watch confirmed slow payment. On these 12 sessions this means TP 2, FP 0, FN 3, TN 7: **precision 100%, recall 40%**. This is a small synthetic evaluation after prompt calibration, not a production accuracy claim.

The actual run completed without errors:

```text
done in 422s: swept 3, rendered 3, watched 3, confirmed 2, filed 0, deduplicated 2, cost $0.5617
```

Both confirmed findings updated an existing case. The third selected session was outside the final cohort and was rejected. The preserved [summary, truth, manifest, sweep and score](validation/README.md) make the metrics reproducible offline. Run cost is an estimate for that run's vision calls only.

A healthy purchase demonstrated the shared session ID across all three stores: `c609fea4-8e6d-431f-bbd6-5106225d790c` has a session summary ending on `/order/NL-NV1JPBUW`, 162 replay events and three server events, including a successful order request. A separate concurrent-ingest check returned 204 for all three simultaneous batches and retained all three events in the session count.

## Backend failure evidence

A slow-payment order request returned HTTP 504 in 8.017 seconds. Elasticsearch `server-events` contains the same session and trace:

- Session: `b4da1898-588d-4449-b05f-0b74d176a0de`
- Trace: `7d936bfc-9032-464a-8f32-102beb3ca7d4`
- Route: `POST /api/orders`
- Status: `504`
- Recorded duration: `8003 ms`

Invalid order payloads still fail immediately with HTTP 400.

A separately watched slow-payment replay confirmed the visible error at second 23 and correlated it with trace `33c7a0f0-39d4-49d1-aa76-2316a98f9db0` (`POST /api/orders`, 504, 8003 ms). After fixing incident-memory matching, filing opened [the slow-payment case](https://eyewitness-b857e1.kb.us-west-2.aws.elastic.cloud/app/observability/cases/e2964983-121c-4012-b886-d4ad67c7fc0c), incident `inc-e3868cbb5c`. API readback verified its owner and the 504 trace in the description. Filing the same session again updated that same case. The signed clip and evidence frame both returned HTTP 200 (video/webm, 1,558,186 bytes; image/jpeg, 43,680 bytes). This manual validation is separate from the 12-session score and does not turn its unswept slow-payment session into a hit.

## Kibana operator assets

The [Eyewitness operations dashboard](https://eyewitness-b857e1.kb.us-west-2.aws.elastic.cloud/app/dashboards#/view/eyewitness-operations) and `eyewitness-new-incidents` alert rule were installed through the Kibana APIs. The rule is enabled and its scheduled executions report `succeeded`. An explicit execution of the server-log connector returned HTTP 200 and `status: ok`. All four dashboard charts were visually verified with live data. At `2026-09-18T08:09:35Z`, after the new slow-payment incident, the rule reported a successful execution with one new active alert. See `kibana/dashboard.export.ndjson` for the actual dashboard export, and `kibana/rule.json` plus `connector.json` for portable alerting payloads.

## Issues found and repaired during live validation

- Concurrent ingest: synchronous Elasticsearch writes inside async endpoints blocked the service. Writes now run in the threadpool, and concurrent updates to a session retry version conflicts. A regression test holds a write open and verifies health remains responsive.
- Checkout automation: Next.js has an extra alert element; the slow-payment assertion now targets the checkout error specifically.
- Vision instructions: the original prompt missed silent-checkout clicks between still frames and falsely confirmed a transient healthy checkout state. The revised prompt uses actual recorded interaction signals and considers the final outcome. Rechecking the same recordings rejected the healthy session (0.95 confidence) and confirmed silent checkout (review confidence 0.92). This is a calibration check, not an independent benchmark.
- Replay timing: frames at whole seconds could omit an error appearing in the final fractional second. Capturing through the terminal second now includes the slow-payment error; the corrected frame was visually verified.
- Kibana owner mismatch: the existing case belongs to `observability`, while the old client hardcoded `cases`; that produced HTTP 403 on comments. New cases use configurable `KIBANA_CASE_OWNER` (default `observability`), and comments read the existing case owner. The management URL suggested in the handoff did not resolve to case details on this deployment; Observability links are used instead. The actual case detail page and repeat-incident comments were verified visually.
- Incident memory: Elasticsearch returns `(1 + cosine) / 2` for the configured cosine vector field. The client previously compared this shifted score directly to the 0.85 similarity threshold; it now converts back to cosine first. The threshold stays 0.85. Embeddings alone still matched the 504 failure to the silent checkout, so deduplication now also requires compatible backend evidence: no known HTTP failure, 4xx, or 5xx. Earlier broad matches and their comments are retained as validation history. See [Elastic's score definition](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/dense-vector/).

## Screenshots

- [Operator dashboard](kibana-dashboard.png)
- [Kibana case](kibana-case.png)
- [Slow-payment case with backend evidence](kibana-slow-payment-case.png)
- [Human replay viewer](replay-viewer.png)
- [Slow-payment terminal evidence frame](slow-payment-evidence.jpg)
- [Confirmed silent-checkout evidence frame](silent-checkout-evidence.jpg)

## Limitations

Responsive-but-wrong UI outcomes remain hard to select when both interaction and backend signals are quiet. This run caught stale totals through rage clicks, but there is no direct total or upload correctness detector.

Sarvam is unconfigured, so Hindi/Tamil translation has not been exercised. No public storefront deployment or narrated demo video has been published. The telemetry implementation uses session-tagged API server events, not full OpenTelemetry tracing. Dashboard affected-user counts inherit the agent's route-based estimate. The eligibility panel is a score-threshold count, not a history of executed sweeps. S3 evidence links expire after seven days.
