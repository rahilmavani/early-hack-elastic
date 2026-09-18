# Submission

## Team

* **Team name:** Sandboxed
* **Project name:** Eyewitness
* **Members:** Mohit Paddhariya (lead), Rahil Mavani

## Problem

**The checkout is broken. The dashboard is green. The customer leaves.**

A shopper clicks Place Order. Nothing happens. They click again, then give up. The handler returned silently: no exception, no failed request, no obvious backend incident. Engineering sees a healthy system. The customer just experienced a broken one.

The same blind spot appears when a bag total stops updating or an upload reports success but drops the file. Logs, metrics and traces describe system behaviour. They do not, by themselves, establish whether the customer could complete the task. The first useful signal may arrive days later as a support ticket or a conversion drop.

Session replay contains the missing evidence: what the interface displayed and how the user interacted with it. But collecting that evidence is not the same as investigating it. There are more recordings than a team can watch.

**The evidence already exists. What is missing is someone to investigate it.**

**Who it is for:** SREs, on-call engineers and product owners responsible for customer-facing web products who need to catch visible failures, inspect the evidence and understand the potential impact before the support queue becomes their monitoring system.

## Solution

**Eyewitness is the incident-response agent that saw it happen.**

It turns unwatched session replays into evidence-backed Kibana Cases. An operator presses **Run investigation** at `/admin`, or schedules a run. The agent finds suspicious sessions, watches them, challenges its own conclusions and files findings that survive review.

The design is a narrowing funnel: **filter cheaply, investigate selectively, challenge before filing.**

1. **Find struggling users.** An ES|QL query selects sessions with difficulty signals: dead clicks, rage clicks, repeated submits, checkout abandonment, a 5xx response or an API call over five seconds. This stage favours recall and uses no model calls.
2. **Turn the replay into inspectable evidence.** Headless Chromium plays each selected rrweb recording at real speed, producing a clip and one frame per second. The reviewer and the engineer can refer to the same moment in the session.
3. **Ask whether the experience actually failed.** A vision model on Amazon Bedrock reviews the frames and interaction signals. Its first job is sceptical triage: did the interface visibly prevent the user from doing what they were trying to do?
4. **Make the finding defend itself.** Structured extraction identifies the user’s intent, expected outcome, observed failure and supporting frames. An adversarial review then argues the opposite: what is the strongest innocent explanation? Findings must survive this challenge before filing.
5. **Open an actionable case, not another vague alert.** The agent correlates the failure time with nearby server events from the same session, estimates the potential blast radius and uploads evidence to S3. It opens a Kibana Case, or updates an existing incident when embedding similarity and backend evidence agree, bringing forward the previous resolution when available.

The engineer receives a plain-English headline, a clip at the failing second, a three-step account of **what the user tried → what should have happened → what happened instead**, correlated backend evidence when present, a potential impact estimate and the strongest counterargument raised during review. 

**The handoff changes from “someone says checkout is broken” to “here is the moment it failed, the evidence to inspect and the related sessions to investigate.”**

## Architecture

The storefront records the experience. The agent investigates it. Elastic connects the evidence. AWS provides model inference and evidence storage.

* **Northline storefront** (`src/storefront`, Next.js 16). The product under observation. Captures sessions with rrweb, tags API calls with the session id and provides five named fault modes for controlled demonstrations. Hosts `/admin` and the human replay viewer at `/replay/<id>`.
* **Eyewitness agent** (`src/agent`, Python). Owns ingestion, signal computation, candidate selection, replay rendering, the Bedrock review chain, backend correlation, incident memory, Kibana filing, evaluation and the admin API.
* **Elastic Cloud.** Stores replay events, session summaries, backend events and incidents; powers selection, correlation, impact estimation and incident retrieval.
* **AWS.** Amazon Bedrock supplies vision reasoning and embeddings. S3 stores clips and frames, exposed through presigned evidence links.
* **Sarvam.** An implemented, optional translation path produces Hindi and Tamil incident summaries for regional on-call teams when a key is configured.

### How data arrives

| Stream                                                                  | Producer              | Index           | Mapping decisions                                                                                                                                |
| ----------------------------------------------------------------------- | --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| rrweb events, batched every 5 seconds and on tab close via `sendBeacon` | Browser               | `replay-events` | `session_id` as keyword, `timestamp` as date, raw `event` as a **disabled object**: retain the replay payload without indexing its DOM structure |
| One session summary, updated on every batch                             | Ingest service        | `sessions`      | Painless upserts; keyword page arrays, counts, duration and agent-computed `signals`; backend signal fields added in place with `put_mapping`    |
| One document per storefront API call                                    | Next.js route wrapper | `server-events` | Keyword `session_id` and `trace_id`, short `status`, integer `duration_ms`                                                                       |
| Review-accepted incident records                                        | Agent                 | `incidents`     | Indexed 1,536-dimensional cosine `dense_vector`, plus fingerprint, route, status code, impact count, review verdict and case id                  |

A browser session id, generated once per tab, connects all four indices. The browser sends it as `x-session-id` on API calls. That gives the investigation a common reference across the replay, session signals, server activity and incident record.

### Retrieval, and why each query is shaped that way

* **Candidate selection: ES|QL.** One statement filters `sessions` by `signals.difficulty_score` and time window, sorts and limits the result. The selection policy is explicit and inspectable, rather than hidden inside a model prompt.
* **Backend signals: batched aggregations.** One `terms` aggregation over `server-events`, with filters for status ≥ 500 and duration > 5,000 ms, computes signals across sessions in one round trip rather than issuing a query per session.
* **Correlation: session identity plus time.** A `bool` filter matches the session id; a ±10-second `range` narrows the search around the visible failure, preferring failed requests. This supplies nearby backend evidence, not a claim of proven root cause.
* **Potential blast radius: similar struggling sessions.** Count sessions on the same page with difficulty scores above 3 in the relevant window. This is an estimate of potentially affected sessions, not a count of distinct people or proof that every session has the identical defect.
* **Incident memory: similarity with an evidence check.** kNN retrieves incident embeddings. The client converts Elastic’s cosine-field score, `(1 + cosine) / 2`, back to cosine similarity before applying the 0.85 threshold. Backend evidence must also agree; semantic similarity alone is not enough to merge incidents.

### The path to a grounded answer

The review chain has three stages: **triage → structured extraction → adversarial review**. Sessions rejected at triage do not proceed through the full chain.

Each model call receives replay frames, computed interaction signals and a JSON schema. Responses must pass schema validation; invalid output gets one retry with the validation error. Findings must identify the visible failure and supporting frames, not merely offer a plausible explanation.

The counterargument is retained with the result so the engineer can inspect both the finding and the case against it. This is model self-review, not independent verification; its conclusions remain testable against the attached evidence.

### Wider platform

Cases are filed through the Kibana Cases API with a configurable owner. Four Vega dashboard panels cover `sessions` and `incidents`. A Kibana alerting rule fires on new incidents through a server-log connector. Dashboard and alert provisioning are versioned under `docs/kibana`, and cases include presigned S3 evidence links.

**Elastic is part of the investigation at every stage: selecting what to watch, connecting what happened, finding related incidents and delivering the case.**

## Measurable business impact

The build reports detection quality, time to evidence and model cost. Measured prototype results are separated from the illustrative business model below.

### Measured

| Metric                                                 | Value                                                           | How measured                                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Session end → ticket filed                             | **3.5–16 minutes; median approximately 7 minutes**              | `incidents.created_at` minus the session’s last event; three filed incidents                            |
| Precision in the controlled fault evaluation           | **100% observed; no false positives across 7 healthy sessions** | A 12-session ground-truth run; `docs/backend-validation`                                                |
| Recall in the controlled fault evaluation              | **80%: 4 of 5 injected faults detected**                        | Same run; the missed fault was a dropped upload with neither interaction nor backend difficulty signals |
| Bedrock cost per session watched                       | **$0.19**                                                       | $2.13 across three runs and 11 watched sessions                                                         |
| Bedrock cost per confirmed sighting                    | **$0.27**                                                       | Same cost sample; eight confirmed sightings, including repeats of known incidents                       |
| Sessions reaching model review in the fault evaluation | **4 of 12**                                                     | Reported model-review count for the validation run                                                      |

These are small, controlled prototype measurements, not production accuracy guarantees. A confirmed sighting is not necessarily a unique incident. The cost figures cover recorded Bedrock usage, not the complete cost of rendering, storage and Elastic infrastructure. 

The miss matters: **a vision model cannot detect a failure in a session the selection stage never sends it.** The dropped upload identifies a concrete recall gap and directly informs the next iteration.

The operator page exposes business-facing metrics under **What it is costing the business**: the potential impact count, order-value exposure, median time to find and cost per confirmed incident. Average order value comes from orders placed in Northline. Session-based exposure is an estimate, not measured lost or recovered revenue.

### Worked model, assumptions stated

Assume 10,000 checkout attempts per day, an average order value of ₹2,499, and a silent failure affecting 2% of attempts. That is **200 affected checkout attempts per day**, representing approximately **₹5 lakh in order value exposed per day**.

For this illustration, assume traffic and failures are evenly distributed, discovery through support takes 2–3 days, and Eyewitness runs a sweep every 30 minutes. The sweep interval is not the complete detection latency: rendering, review and filing take additional time, and the fault must generate a selection signal.

|                                             | Without Eyewitness: assumed support-led discovery     | With Eyewitness: illustrative scheduled detection                                                                 |
| ------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Affected checkout attempts before discovery | **400–600** over an assumed 2–3-day delay             | Approximately **4.2 per 30-minute sweep interval**, plus exposure during processing                               |
| Order value exposed before discovery        | Approximately **₹10–15 lakh**                         | Approximately **₹10,400 per 30-minute interval**, plus exposure during processing                                 |
| Starting point for reproduction             | Assumed 1–2 hours spent recovering steps and context  | Timestamped replay and correlated evidence already attached; actual engineering time saved is not yet benchmarked |
| Detection cost                              | Support and engineering costs are not quantified here | Approximately **$5.70/day in model usage** at 30 suspicious sessions × $0.19; infrastructure costs are additional |

The 30-session cost example is a workload assumption, not a claim that all 200 affected attempts would be reviewed. The opportunity is to shorten the period in which a visible failure goes unnoticed. Earlier detection is not the same as a fix, and order value at risk is not a claim of revenue saved.

### How we show it in the demo

1. **Make the blind spot visible.** Break Northline in front of the judges using `?fault=silent-checkout`; use `?fault=slow-payment` to demonstrate the backend-correlated path. Show what the shopper experiences before opening the investigation tools.
2. **Start one investigation.** Press **Run investigation** at `/admin`. Follow the stages from selection to rendering, review and filing. The audience sees how a recording becomes a finding.
3. **Open the evidence.** Inspect the headline, failing second, replay, expected-versus-actual account and counterargument. Show the server 504 where captured; distinguish that evidence from a visible failure with no failed request.
4. **Show why an engineer would use it.** Inspect the impact and cost strip, separating measured values from estimates. Repeat a known fault to demonstrate incident memory: another sighting should enrich the existing case, not create another ticket to triage.

For a short stage slot, start a fresh investigation and inspect a **clearly labelled, previously completed run** while it processes. The measured pipeline takes minutes; the demo should show real evidence, not imply instant processing.

## Production readiness

Implemented operational safeguards, with the remaining production gaps made explicit:

* **Tested.** 82 Python tests cover signals, scoring, ingest concurrency, the admin API, Kibana client, memory and rendering, alongside ESLint, TypeScript checks and a production Next.js build.
* **Resumable.** Per-session checkpoints let a rerun resume from the stage already reached. `run --every` supports repeated scheduled execution.
* **Cost-aware.** Deterministic selection limits model usage. Costs are metered per run and surfaced on the operator page.
* **Evaluable.** A `score` command joins run output to traffic ground truth and reports precision, recall and per-session misses. Evaluation includes failures the system did not catch.
* **Protected by baseline safeguards.** Passwords are masked during recording. Elastic and AWS credentials stay server-side. Same-origin routes proxy operator requests; session ids are validated before disk access. Evidence links have a seven-day expiry. Broader privacy and tenant-isolation controls remain roadmap work.
* **Operable.** `doctor` checks credentials and models before execution. Kibana dashboards and alert rules are provisioned from versioned scripts.
* **Bounded today.** Signal-free failures can escape selection. Backend evidence consists of session-tagged API events, not full OpenTelemetry traces. Rendering runs in real time and is capped at three minutes per session. These are prototype boundaries, not capabilities claimed as solved. 

## Go-to-market reusability

**The storefront is the demo. The investigation funnel is the reusable product.**

Integration follows a three-part contract: mount the recorder, propagate the session id on API calls and instrument API routes to emit server events.

The core combines interaction signals, query-based selection, replay review, evidence correlation and incident memory. Checkout-specific signals and order-value calculations belong to the Northline demonstration; another product would supply its own critical journeys and impact model.

Bank onboarding and SaaS settings flows are candidate applications, not claimed deployments. The route to reuse is to validate the same funnel against those journeys, while preserving the operational handoff through Kibana Cases and alerts.

## Innovation

The distinctive design is the combination of three ideas:

* **Replay as primary incident evidence.** Start with what the customer experienced, then attach nearby backend context. The central question is not just “did a request fail?” but “could the user complete the task?”
* **Adversarial review before escalation.** The agent must articulate the strongest case against its finding before filing it. Engineers receive an inspectable argument and counterargument, rather than an unexplained model verdict.
* **Memory that improves the incident record.** Embedding retrieval, checked against backend evidence, turns repeated sightings into updates on the same case and brings forward prior resolution context.

**The unit of output is not a replay summary. It is an incident record an engineer can inspect, challenge and act on.**

## Demo

* **Operator page:** `http://localhost:3000/admin`. One investigation button, live stage progress, incident cards, timestamped clips, backend evidence and the business-impact strip.
* **Human replay viewer:** `http://localhost:3000/replay/<session-id>` for direct inspection of the recorded session.
* **Kibana:** Operations dashboard and Cases on the team’s Elastic Cloud deployment; screenshots in `docs/`.
* **How to run locally:** [README](README.md) contains setup and the three-terminal recipe. [docs/demo.md](docs/demo.md) contains the presenter script. [docs/run-notes.md](docs/run-notes.md) contains measured results and screenshots.
* **Live URL or recording:** Local demo only at submission time; no public live URL or demo recording is supplied in this submission.

**Sample queries.** Candidate sweep from `src/agent/eyewitness/sweep.py`:

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

* **Triage:** “Decide whether this user visibly failed to complete what they were trying to do because the interface did not respond correctly. Be sceptical. Most sessions are fine.”
* **Extract:** “Extract exactly what went wrong: the user’s intent, what should have happened, what happened instead, and the first second at which the failure is visible. Name the frames that prove it.” The schema also requests a plain-language headline and three short steps for non-engineers.
* **Cross-examine:** “Your only job is to argue that this finding is wrong. Look for an innocent explanation. State the strongest counterargument. Then give your honest verdict.”

## What we used

* **Elastic:** Elasticsearch’s four indices, disabled-object replay mapping, Painless upserts, terms and filter aggregations, bool and range queries; ES|QL candidate selection; `dense_vector` and kNN incident memory; Kibana Cases API, Vega dashboards, alerting rules and connectors.
* **AWS:** Amazon Bedrock Converse API for vision triage, extraction and adversarial review; Bedrock embeddings for incident memory; S3 and presigned URLs for clips and frames.
* **Sarvam:** Hindi and Tamil translation of incident summaries through the optional, key-configured integration.
* **Other:** rrweb, rrweb-player, Playwright, Next.js 16, FastAPI, Pydantic and uv.

## What we would do next

* **Close the observed recall gap.** Compare the final DOM state with the expected outcome of the last action, targeting failures such as the dropped upload that produce neither interaction nor backend difficulty signals.
* **Parallelise replay processing.** Move rendering to Fargate, with Step Functions orchestrating runs, to process batches concurrently rather than relying on a real-time local renderer.
* **Make evidence queryable by the operator.** Use Elastic Agent Builder for questions such as “show me every session that hit this bug” over the existing indices.
* **Deepen backend correlation.** Add Elastic APM and RUM agents for distributed traces instead of relying only on session-tagged API events.
* **Retrieve relevant resolution guidance.** Add ELSER over runbooks so an incident can include relevant troubleshooting material, not only its previous resolution.
* **Strengthen production privacy boundaries.** Add broader input-masking policies, retention controls and per-tenant IAM isolation before production rollout.
