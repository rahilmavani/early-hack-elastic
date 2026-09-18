# Submission

## Team

- Team name: Sandboxed
- Project name: Eyewitness
- Members: Mohit Paddhariya (lead), Rahil Mavani

## Problem

Logs, metrics and traces describe what the backend did. None of them capture what the user actually saw. A submit button whose handler silently returns, an upload that reports success and drops the file, a validation error rendered off-screen: each leaves a clean log line, a healthy p99 and a green dashboard while every affected user quietly gives up.

Session replay records exactly that evidence, frame for frame, but nobody watches it. A live product emits far more sessions a day than any team can sit through, so the highest-signal recording of an incident sits in cold storage until it resurfaces as a support ticket, or never does.

Eyewitness is for the SRE or on-call engineer who owns a customer-facing product and wants to know about the failures their telemetry cannot see.

## Solution

Eyewitness watches every session, every night, and reports only the incidents it can prove. It is a shrinking funnel where each stage costs more than the last and only sees what survived the one before.

1. **Sweep.** One ES|QL query over Elasticsearch selects every session carrying a signal of user difficulty: dead clicks, rage clicks, repeated submits, checkout abandonment. It is tuned to over-select. Recall is what matters here.
2. **Reconstruct.** Each selected session is replayed through headless Chromium at real time and recorded as video, so timestamps stay honest.
3. **Watch, extract, cross-examine.** A vision model on Amazon Bedrock makes three escalating passes: a first judgement on whether the session was genuinely broken, structured extraction of what went wrong and at which second, and an adversarial review whose only instruction is to argue the finding away.
4. **Remember, correlate, file.** Confirmed incidents are embedded and written back to Elasticsearch, so kNN search deduplicates against open incidents and recalls how a past one was closed. The visual moment is joined to the backend trace carrying the same session id, and a Kibana Case is opened holding the clip, the second, the route and the number of affected users.

An engineer opens the case and scrubs straight to the moment it broke.

## Architecture

- **Northline storefront** (`src/storefront`): a Next.js ecommerce site that is the product under observation. It records every session with rrweb, tags every API call with the session id, and can be switched into named silent-failure modes for demos.
- **Eyewitness agent** (`src/agent`): a Python CLI that runs the funnel. Ingest, signals, sweep, render, watch, correlate, file, remember.
- **Elastic**: Elasticsearch holds replay events, session summaries, server events and incidents. ES|QL is the recall layer. `dense_vector` with kNN is the agent's memory. Kibana Cases are the ticket and Kibana dashboards are the operator surface, with an alert rule on new incidents.
- **AWS**: Amazon Bedrock supplies the vision reasoning and the embeddings. S3 holds the rendered clips.
- **Sarvam**: (to be filled in)

## Demo

- Live URL or recording: (to be filled in)
- How to run locally: see `README.md` and `src/storefront/README.md`. (agent instructions to follow)
- Sample queries or prompts: (to be filled in)

## What we used

- Elastic: Elasticsearch, ES|QL, dense_vector and kNN, Kibana Cases, Kibana dashboards, alerting rules
- AWS: Amazon Bedrock (vision model and embeddings), S3
- Sarvam: (to be filled in)
- Other: rrweb, Playwright, Next.js, Pydantic

## What we would do next

- Move the renderer to Fargate so a night of sessions renders in parallel, with Step Functions driving the run and per-session checkpoints so an interrupted run resumes.
- ELSER-backed semantic search over runbooks so the agent can attach the fix, not just the past incident.
- Elastic APM and RUM agents in the storefront for richer trace correlation than the session-tagged API log.
- Privacy controls: input masking policies, retention windows and per-tenant IAM boundaries so recorded sessions never leave the account.
