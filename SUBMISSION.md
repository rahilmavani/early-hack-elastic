# Submission

## Team

- Team name: Sandboxed
- Project name: Eyewitness
- Members: Mohit Paddhariya (lead), Rahil Mavani

## Problem

**Logs, metrics and traces describe what the backend did. None of them capture what the user saw.**

A Place Order button whose handler silently returns. A bag total that stops updating. An upload that reports success and drops the file. Each leaves a clean log line, a healthy p99 and a green dashboard while every affected shopper quietly gives up. The business finds out days later through support tickets and a dip in conversion, if it finds out at all.

Session replay records exactly this evidence, frame for frame, but nobody watches it. A live product emits far more sessions a day than any team can sit through, so the highest-signal recording of an incident sits in cold storage.

**Who it is for:** the SRE, on-call engineer or product owner of a customer-facing web product who wants to know about the failures their telemetry cannot see, with proof, before customers complain.

## Solution

Eyewitness is an incident-response agent that **watches session replays so engineers do not have to**, and files only what it can prove. A user's path from "something might be broken" to "here is the ticket with the video" is one button on the operator page at `/admin`, or one scheduled run.

It is a shrinking funnel. Each stage costs more than the last and only sees what survived the one before.

1. **Find struggling users.** One ES|QL query over Elasticsearch selects sessions carrying a difficulty signal: dead clicks, rage clicks, repeated submits, checkout abandonment, a 5xx response, or an API call over five seconds. It is tuned to over-select. Recall is what matters here, and it costs nothing.
2. **Replay on video.** Each selected session is replayed through headless Chromium at real speed and recorded as a clip plus one frame per second, so timestamps stay honest.
3. **AI watches.** A vision model on Amazon Bedrock makes a first, sceptical judgement: did the user visibly fail to do what they were trying to do? Most sessions stop here.
4. **AI double-checks.** For anything judged broken, a structured extraction names the second it broke and the frames that prove it. Then a second call gets one instruction: argue that this finding is wrong. Only findings that survive their own cross-examination count.
5. **Ticket filed.** The failing second is joined to the backend request carrying the same session id, other affected sessions are counted, evidence goes to S3, and a Kibana Case is opened. If the incident is already known, kNN over incident embeddings adds the new sighting to the existing case and recalls how it was last resolved.

The result an engineer opens is not "the checkout looks broken". It is a case with a plain-English headline, the clip paused at the failing second, a three-step story (user tried, should have, got instead), the server request and status, the number of shoppers hit, and the strongest counterargument the model could find against itself.

## Architecture

Three runtime pieces and two cloud platforms.

- **Northline storefront** (`src/storefront`, Next.js 16). The product under observation. Records every session with rrweb, tags every API call with the session id, and can be switched into five named silent-failure modes for demos. Hosts the operator page (`/admin`) and a human replay viewer (`/replay/<id>`).
- **Eyewitness agent** (`src/agent`, Python). An ingest service, the signals and sweep, the renderer, the Bedrock review chain, correlation, incident memory, Kibana filing, a scoring tool, and the admin API behind the operator page.
- **Elastic Cloud**: the system of record and the retrieval layer.
- **AWS**: Amazon Bedrock for vision reasoning and embeddings, S3 for evidence.
- **Sarvam**: incident summaries translated to Hindi and Tamil for regional on-call teams. The code path is implemented; it runs when a key is configured.

### How data arrives

| Stream | Producer | Index | Mapping decisions |
| --- | --- | --- | --- |
| rrweb events, batched every 5 s and on tab close via `sendBeacon` | browser | `replay-events` | `session_id` keyword, `timestamp` date, raw `event` stored as a **disabled object** so millions of DOM mutations are stored but never indexed |
| One summary per session, upserted with a Painless script on every batch | ingest service | `sessions` | pages as keyword array, counts, duration, and a `signals` object added later by the agent; mapping extended in place with `put_mapping` when backend signals were introduced |
| One document per storefront API call | Next.js route wrapper | `server-events` | `session_id` and `trace_id` keyword, `status` short, `duration_ms` integer |
| Confirmed incidents | agent | `incidents` | `dense_vector` (1536 dims, cosine, indexed) for memory, plus fingerprint, route, status code, affected users, review verdict, case id |

The one id that joins everything is the browser session id, generated once per tab, sent as an `x-session-id` header on every API call, and stamped on all four indices.

### Retrieval, and why each query is shaped that way

- **Sweep** is a single ES|QL statement over `sessions`, filtered on `signals.difficulty_score` and a time window, sorted and limited. ES|QL because the operator can retune the threshold and window without touching code, and because it reads as a sentence in a case.
- **Backend signals** are one `terms` aggregation over `server-events` with two filter sub-aggregations (status ≥ 500, duration > 5000 ms), so a thousand sessions are scored in one round trip.
- **Correlation** is a `bool` filter on `session_id` plus a ±10 s `range` on timestamp around the failing second, preferring a failed status. Small window, because the visual moment and its request are seconds apart.
- **Blast radius** is a `count` of sessions that reached the same page with a difficulty score above 3 in the window.
- **Memory** is a `knn` search on the incident embedding. Elastic returns `(1 + cosine) / 2` for cosine fields, so the client converts back before applying the 0.85 threshold, and a match must also agree on backend evidence so a 504 and a silent click are never merged.

### The path to a grounded answer

Every model call receives the frames, the computed interaction signals and a JSON schema, and must return schema-validated JSON. Invalid output is sent back once with the validation error. Three calls per suspect session: triage, extraction, adversarial review. The model never sees free text about the incident; it sees pixels and counts.

### Wider platform

Kibana Cases via the Cases API with a configurable owner. A Kibana dashboard (four Vega panels over `sessions` and `incidents`) and an alerting rule that fires on new incidents through a server-log connector, both provisioned by script from `docs/kibana`. Presigned S3 links in every case.

## Measurable business impact

Measured on this build, then a worked model with every assumption stated.

### Measured

| Metric | Value | How measured |
| --- | --- | --- |
| Time from session end to ticket filed | **3.5 to 16 minutes** per incident, median about 7 | `incidents.created_at` minus the session's last event, three filed incidents |
| Precision on injected faults | **100%** (0 false positives in 7 healthy sessions) | 12-session run with ground truth, `docs/backend-validation` |
| Recall on injected faults | **80%** (4 of 5) | same run; the miss is a dropped upload with no interaction or backend signal |
| Cost per session watched | **$0.19** | Bedrock token usage summed over 3 runs, 11 sessions watched, $2.13 total |
| Cost per confirmed sighting | **$0.27** | same, 8 confirmed sightings including repeats of known incidents |
| Sessions the sweep discards for free | 7 of 12 | only 4 selected sessions ever reached the model |

The operator page shows the same numbers live under **What it is costing the business**: shoppers hit, revenue at risk (shoppers hit × average order value measured from real orders placed in the store), median time to find, and cost per confirmed incident.

### Worked model, assumptions stated

A mid-size store, 10,000 checkout attempts a day, average order ₹2,499 (the Northline catalogue average). A silent checkout failure that hits 2% of attempts:

| | Without Eyewitness | With Eyewitness |
| --- | --- | --- |
| Shoppers who hit it before anyone knows | 200 per day, for the 2 to 3 days it takes a support ticket to reach engineering | about 2 (the sweep runs every 30 minutes) |
| Revenue at risk before detection | ₹5 lakh per day × 2 to 3 days = **₹10 to 15 lakh** | **under ₹5,000** |
| Engineer time to reproduce | 1 to 2 hours per incident hunting for steps | 0. The case opens on the failing second with the request attached |
| Cost of detection | support headcount, churned customers | $0.19 per suspicious session, roughly **$6 a day** at 30 suspicious sessions |

The same arithmetic holds for any silent failure: the value is the gap between "when it started" and "when someone noticed", and Eyewitness closes that gap to minutes at a cost that is a rounding error next to one lost order.

### How we show it in the demo

1. Break the store on purpose in front of the judges (`?fault=silent-checkout`, `?fault=slow-payment`).
2. Press **Run investigation** on `/admin` and narrate the five stages as they fill.
3. Open the incident card: headline, clip at the failing second, server 504, shoppers hit.
4. Point at the impact strip: shoppers hit, ₹ at risk, found in N minutes, $ per incident. Every number came from data the judges just watched being generated.

## Production readiness

- **Tested.** 82 Python tests (signals, scoring, ingest concurrency, admin API, Kibana client, memory, renderer) plus ESLint, TypeScript and a production Next build.
- **Resumable.** Each session in a run has a checkpoint; a rerun resumes from the stage it reached. Runs repeat on a schedule with `run --every`.
- **Cheap by construction.** Deterministic signals discard most sessions before any model call. Cost is metered per run and shown on the operator page.
- **Honest about accuracy.** A `score` command joins run output to traffic ground truth and prints precision, recall and per-session misses. Numbers above come from that, not from prose.
- **Safe defaults.** Passwords are masked at record time. The browser never receives Elastic or AWS credentials; the operator page talks only to same-origin routes that proxy server-side. Session ids are validated before touching disk. Evidence links expire after seven days.
- **Operable.** `doctor` checks every credential and model before a run. Kibana dashboard and alert rule are versioned and provisioned by script.
- **Known limitations.** Recall on failures with no interaction and no backend signal (a quietly dropped upload) is the open problem. Backend telemetry is session-tagged API events, not full OpenTelemetry. Rendering is real-time and capped at three minutes per session.

## Go-to-market reusability

The integration contract for any web product is three lines: mount the recorder, send the session id header on API calls, wrap API routes to emit server events. Nothing in the agent knows about shopping: signals are generic interaction patterns, the sweep is a query, the prompts describe "a user's session on a website". Point it at a bank's onboarding flow or a SaaS settings page and the same funnel runs. Kibana Cases and alerts plug into whatever the team already pages on.

## Innovation

Three ideas we have not seen combined elsewhere:

- **Treat the replay as the primary evidence**, not the logs. The model is shown what the customer saw and asked to cite the second.
- **Adversarial self-review as a gate.** A confirmed incident is one the model failed to talk itself out of. This is what keeps precision at 100% on the evaluation.
- **Incident memory in the same index.** kNN over incident embeddings means the second sighting of a bug becomes a comment on the first case with the last resolution attached, not a new ticket.

## Demo

- **Operator page:** `http://localhost:3000/admin`. One button runs the whole funnel with live progress; confirmed incidents appear as cards with the clip, the failing second, the backend evidence and the business impact strip.
- **Human replay viewer:** `http://localhost:3000/replay/<session-id>`.
- **Kibana:** the operations dashboard and Cases on the team's Elastic Cloud deployment, screenshots in `docs/`.
- **How to run locally:** [README](README.md) for setup and the three-terminal recipe. Presenter script: [docs/demo.md](docs/demo.md). Measured results and screenshots: [docs/run-notes.md](docs/run-notes.md).
- **Live URL or recording:** local only at submission time.

**Sample queries.** The sweep, in `src/agent/eyewitness/sweep.py`:

```esql
FROM sessions
| WHERE signals.difficulty_score >= 5 AND last_batch_at >= NOW() - 1 hours
| SORT signals.difficulty_score DESC
| KEEP session_id, signals.difficulty_score, signals.dead_clicks, signals.rage_clicks,
       signals.repeated_submits, signals.checkout_abandoned, duration_ms,
       signals.backend_error, signals.high_api_latency
| LIMIT 25
```

**Sample prompts** (full prompts and schemas in `src/agent/eyewitness/watch/`):

- Triage: "Decide whether this user visibly failed to complete what they were trying to do because the interface did not respond correctly. Be sceptical. Most sessions are fine."
- Extract: "Extract exactly what went wrong: the user's intent, what should have happened, what happened instead, and the first second at which the failure is visible. Name the frames that prove it." Plus a plain-language headline and three short steps for non-engineers.
- Cross-examine: "Your only job is to argue that this finding is wrong. Look for an innocent explanation. State the strongest counterargument. Then give your honest verdict."

## What we used

- **Elastic:** Elasticsearch (four indices, disabled-object mapping for raw replay, Painless upsert scripts, terms and filter aggregations, bool and range queries), ES|QL for the sweep, `dense_vector` with kNN for incident memory, Kibana Cases API, Kibana dashboards (Vega), Kibana alerting rules and connectors.
- **AWS:** Amazon Bedrock Converse API with a vision model for triage, extraction and review; Bedrock embeddings for incident memory; S3 with presigned URLs for clips and frames.
- **Sarvam:** translation API for Hindi and Tamil incident summaries in the case description.
- **Other:** rrweb and rrweb-player, Playwright, Next.js 16, FastAPI, Pydantic, uv.

## What we would do next

- Recall for quiet failures: compare the final DOM state to the expected outcome of the last action (the dropped upload case) as a third signal family.
- Move the renderer to Fargate so a night of sessions renders in parallel, with Step Functions driving the run.
- Elastic Agent Builder for the operator's questions ("show me every session that hit this bug") over the same indices.
- Elastic APM and RUM agents in the storefront for full distributed traces instead of session-tagged API events.
- ELSER over runbooks so a case arrives with the likely fix, not only the last resolution.
- Privacy controls: input masking policies, retention windows and per-tenant IAM boundaries so recordings never leave the account.
