# Eyewitness agent

The incident response agent that saw it happen. It watches session replays of the storefront, finds the sessions where a user visibly struggled, replays them, has a vision model judge what went wrong, argues against its own finding, and files only what survives as a Kibana Case with the clip, the failing second, the backend trace and the number of users affected.

## Setup

Python 3.12 and [uv](https://docs.astral.sh/uv/). From this folder:

```bash
uv sync
uv run playwright install chromium
```

Keys come from the `.env` at the repo root, see `.env.example` there. `KIBANA_CASE_OWNER` defaults to `observability` (also supports `cases` or `securitySolution`); new cases and their links use that app, while repeat comments use the existing case owner. Then:

```bash
uv run eyewitness doctor    # checks Elasticsearch, Kibana, Bedrock and S3 with your keys
uv run eyewitness setup     # creates the four indices
```

## The funnel

Each stage is a command. `run` chains them.

| Command | What it does |
| --- | --- |
| `ingest` | HTTP service the storefront posts rrweb batches and API call events to. Indexes events, keeps a summary per session. Also serves the admin API (`/admin/sessions`, `/admin/incidents`, `/admin/runs`, `/admin/renders/...`) that the storefront's `/admin` page proxies to, so a run can be started and watched from the browser. |
| `traffic` | Drives realistic sessions against the storefront with Playwright, some under fault scenarios, and records which was which to `.data/traffic/`. |
| `signals` | Computes difficulty signals onto each session: dead clicks, rage clicks, repeated submits, checkout dwell and abandonment, backend errors, high API latency, and a score. |
| `sweep` | One ES\|QL query over `sessions` returning everything above the score threshold. Tuned to over-select. |
| `render <session>` | Replays a session in headless Chromium at real speed, records a clip and one frame a second to `.data/renders/`. |
| `watch <session>` | Three Bedrock calls: triage, structured extraction, adversarial review. Only a finding that survives review is confirmed. |
| `file <session>` | Joins the finding to the backend trace, counts affected users, dedupes against past incidents with kNN, uploads evidence to S3, opens or updates a Kibana Case. |
| `run` | Signals, sweep, then render, watch and file each selected session, with a checkpoint per session so a rerun resumes. |
| `score --run <id> --truth <file>` | Compares run outcomes against traffic ground truth, reporting swept/confirmed counts, precision, recall and every labeled session. Works offline. |

A full run:

```bash
uv run eyewitness ingest                        # terminal 1, keep running
uv run eyewitness traffic --sessions 24 --broken 6
uv run eyewitness run
```

Thresholds, the render cap and token prices live in `runs/nightly.yaml`. `run --every 30` repeats on a schedule.

The renderer includes a held final frame at the next whole second when a recording ends
between ticks, so a last-moment error or confirmation reaches the vision model. The
`rendered_seconds` metadata still records the actual playback duration, and this terminal
frame never exceeds the integer `max_seconds` cap.

## Evaluate a run

Use the run id printed by `run` and the ground-truth path printed by `traffic`:

```bash
uv run eyewitness score --run 20260918T120000Z --truth ../../.data/traffic/20260918T115000Z.json
```

The evaluator reads `.data/runs/<id>/summary.json` and per-session checkpoints. Checkpoints
override summary entries, so an interrupted or resumed run can also be inspected. Counts and
metrics are scoped to successful, identifiable sessions in the supplied traffic file; failed
journeys and invalid session ids are excluded and counted explicitly. Run outcomes outside
that evaluated batch are counted separately.

A nonempty fault label is a positive, and a confirmed finding is a prediction. A fault session
missing from the run is a false negative, shown as `not_selected`; failures before confirmation
also count as misses. Precision is TP / (TP + FP), recall is TP / (TP + FN), and an empty
denominator is shown as `n/a`. These measure session detection, not correctness of the diagnosed
fault. An interrupted run has provisional metrics until it completes.

Traffic cycles through `silent-checkout`, `offscreen-validation`, `stale-bag-total`,
`dropped-upload`, and `slow-payment`. The first four inject silent UI failures; `slow-payment`
waits eight seconds before returning HTTP 504 so the finding can correlate to backend failure.

## Indices

| Index | Holds |
| --- | --- |
| `replay-events` | Every rrweb event, keyed by session id and timestamp. |
| `sessions` | One summary per session: pages, counts, duration, and the `signals` object. |
| `server-events` | One doc per storefront API call: session id, trace id, route, status, duration. |
| `incidents` | Confirmed incidents with a `dense_vector` embedding for kNN dedupe and recall. |

## How the signals work

Signals combine generic interaction patterns and backend response evidence, with no knowledge of the storefront's fault scenarios. A dead click is a click with no DOM mutation or navigation within a second. A rage burst is three or more clicks on one element within two seconds of each other. A repeated submit is a second click on the same submit button. Checkout dwell and abandonment come from the route trail the storefront marks on every client-side navigation. The score is a weighted sum; the weights are constants in `eyewitness/signals/compute.py`. Per-session aggregations over `server-events` set `backend_error` for any status >= 500 and `high_api_latency` for any duration > 5000 ms. Either flag adds five points once, even when the same request triggers both. A responsive spinner followed by a server failure can therefore enter the default threshold-5 sweep without dead clicks. The sweep prints both reasons; visual review still decides whether to file.

Backend flags are rechecked even when the replay has not changed, so a late API event can trigger recomputation. Old signal documents are backfilled automatically on the next `signals` or `run`; `setup` adds the two boolean mappings to an existing sessions index without deleting data. Updated scores are refreshed before the sweep reads them.

UI-only outcome errors such as stale totals or dropped photos can still be missed when the interface responds and no other difficulty signal fires. No demo-specific quantity-change or upload signal is added.

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
  admin.py            read models and the background run manager behind the storefront's /admin page
  score.py            offline precision/recall evaluation against traffic labels
runs/nightly.yaml     the run manifest
tests/                unit tests for signals, evaluation and agent behavior
```
