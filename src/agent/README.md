# Eyewitness agent

The incident response agent that saw it happen. It watches session replays of the storefront, finds the sessions where a user visibly struggled, replays them, has a vision model judge what went wrong, argues against its own finding, and files only what survives as a Kibana Case with the clip, the failing second, the backend trace and the number of users affected.

## Setup

Python 3.12 and [uv](https://docs.astral.sh/uv/). From this folder:

```bash
uv sync
uv run playwright install chromium
```

Keys come from the `.env` at the repo root, see `.env.example` there. Then:

```bash
uv run eyewitness doctor    # checks Elasticsearch, Kibana, Bedrock and S3 with your keys
uv run eyewitness setup     # creates the four indices
```

## The funnel

Each stage is a command. `run` chains them.

| Command | What it does |
| --- | --- |
| `ingest` | HTTP service the storefront posts rrweb batches and API call events to. Indexes events, keeps a summary per session. |
| `traffic` | Drives realistic sessions against the storefront with Playwright, some under fault scenarios, and records which was which to `.data/traffic/`. |
| `signals` | Computes difficulty signals onto each session: dead clicks, rage clicks, repeated submits, checkout dwell and abandonment, and a score. |
| `sweep` | One ES\|QL query over `sessions` returning everything above the score threshold. Tuned to over-select. |
| `render <session>` | Replays a session in headless Chromium at real speed, records a clip and one frame a second to `.data/renders/`. |
| `watch <session>` | Three Bedrock calls: triage, structured extraction, adversarial review. Only a finding that survives review is confirmed. |
| `file <session>` | Joins the finding to the backend trace, counts affected users, dedupes against past incidents with kNN, uploads evidence to S3, opens or updates a Kibana Case. |
| `run` | Signals, sweep, then render, watch and file each selected session, with a checkpoint per session so a rerun resumes. |

A full run:

```bash
uv run eyewitness ingest                        # terminal 1, keep running
uv run eyewitness traffic --sessions 24 --broken 6
uv run eyewitness run
```

Thresholds, the render cap and token prices live in `runs/nightly.yaml`. `run --every 30` repeats on a schedule.

## Indices

| Index | Holds |
| --- | --- |
| `replay-events` | Every rrweb event, keyed by session id and timestamp. |
| `sessions` | One summary per session: pages, counts, duration, and the `signals` object. |
| `server-events` | One doc per storefront API call: session id, trace id, route, status, duration. |
| `incidents` | Confirmed incidents with a `dense_vector` embedding for kNN dedupe and recall. |

## How the signals work

Signals are generic interaction patterns with no knowledge of the storefront's fault scenarios. A dead click is a click with no DOM mutation or navigation within a second. A rage burst is three or more clicks on one element within two seconds of each other. A repeated submit is a second click on the same submit button. Checkout dwell and abandonment come from the route trail the storefront marks on every client-side navigation. The score is a weighted sum; the weights are constants in `eyewitness/signals/compute.py`.

## Layout

```
eyewitness/
  cli.py              every command
  config.py           settings from the root .env
  es/                 client and index mappings
  ingest/             the ingest service
  traffic/            the traffic generator
  signals/            signal computation and the per-session update
  sweep.py            the ES|QL sweep
  render/             the rrweb-player renderer and its vendored player
  watch/              schemas, prompts and the Bedrock vision chain
  correlate.py        trace join and blast radius
  memory.py           embeddings and kNN dedupe
  kibana.py           Cases API
  storage.py          S3 upload
  sarvam.py           incident summaries translated for regional on-call teams
  incidents.py        the file step
  run.py              the orchestrator
runs/nightly.yaml     the run manifest
tests/                unit tests for the signals
```
