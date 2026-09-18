# Eyewitness

The incident response agent that saw it happen.

Logs, metrics and traces describe what the backend did. Eyewitness records what the user saw, selects sessions with interaction and backend signals, reviews replay frames with a vision model, and files confirmed findings as Kibana Cases.

## Layout

| Path | Purpose |
| --- | --- |
| `src/storefront` | Northline Next.js store, rrweb recorder, local replay viewer, and five demo faults. |
| `src/agent` | Python ingest service, signals, ES\|QL sweep, renderer, Bedrock review, correlation, incident memory and scoring CLI. |
| `docs` | Setup and demo instructions, validation notes, and Kibana operator assets. |
| `SUBMISSION.md` | Project explanation and submission status. |

## Setup

Requires Node.js 20.9+, npm, Python 3.12+, and [uv](https://docs.astral.sh/uv/).

```bash
npm install
cp .env.example .env
cp src/storefront/.env.example src/storefront/.env.local
cd src/agent
uv sync
uv run playwright install chromium
```

Fill the root `.env` with Elastic, Kibana, AWS, Bedrock model IDs and S3 settings. `EMBEDDING_DIMENSIONS` must match the model (for example, 1536 for Titan Text Embeddings v1). `KIBANA_CASE_OWNER` defaults to `observability`; use the owner your deployment permits. Case comments inherit the existing case’s owner. Sarvam is optional; when configured it translates case summaries into Hindi and Tamil. Next.js reads `src/storefront/.env.local`, separately from the agent's root `.env`. See the [storefront README](src/storefront/README.md) for replay endpoint options.

From `src/agent`:

```bash
uv run eyewitness doctor
uv run eyewitness setup
```

`setup` creates missing indices without deleting existing data. Do not use `--recreate` on indices you want to keep.

## Run in three terminals

Terminal 1, repository root:

```bash
npm run dev
```

Terminal 2, `src/agent`:

```bash
uv run eyewitness ingest
```

Terminal 3, `src/agent`:

```bash
uv run eyewitness traffic --sessions 12 --broken 5
uv run eyewitness signals
uv run eyewitness sweep
uv run eyewitness run
uv run eyewitness score --run <run-id> --truth <traffic-file>
```

Use the run ID and truth file printed by the commands. The traffic batch includes all five faults when `--broken` is at least 5. Keep the storefront running while rendering so recorded assets remain available. `run` makes paid Bedrock calls and uploads evidence to your S3 bucket. Agent artifacts live in root `.data/`; local storefront recordings live in `src/storefront/.data/replay/`.

Install the [Kibana dashboard and alert rule](docs/kibana/README.md), then follow [the demo script](docs/demo.md). See [run notes](docs/run-notes.md) for actual verification results and remaining limitations, and [the agent README](src/agent/README.md) for individual pipeline commands.

## Checks

```bash
npm run lint
npm run build
cd src/agent
uv run pytest
```

The root npm package uses workspaces; dev/build/start target the storefront. Unit tests and local browser checks do not prove the model's precision or recall; measure those using a completed live run and its traffic truth file.
