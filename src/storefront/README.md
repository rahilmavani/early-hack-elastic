# Northline storefront

A minimal ecommerce site that acts as the live product Eyewitness watches. It records every session with rrweb, reports to Elastic RUM when configured, and can be switched into named silent-failure modes for demos.

No auth, no real payments. Bag, wishlist and orders live in the browser's localStorage. Orders and reviews also hit API routes so there is a real backend edge to trace.

## Run

From the repo root:

```bash
npm install
cp src/storefront/.env.example src/storefront/.env.local
npm run dev
```

Then open http://localhost:3000. The same scripts also work from inside `src/storefront`.

| Script                          | What it does                                               |
| ------------------------------- | ---------------------------------------------------------- |
| `npm run dev`                   | Development server                                         |
| `npm run build`                 | Production build                                           |
| `npm run start`                 | Serve the production build                                 |
| `npm run lint`                  | ESLint                                                     |
| `npm run format`                | Prettier, write mode                                       |
| `node scripts/fetch-images.mjs` | Re-download product images from `data/image-manifest.json` |

## Environment

Next.js reads `src/storefront/.env.local`, so copy `src/storefront/.env.example` there. This app-specific file is required in addition to the repository root `.env` used by the Python agent. Restart the dev server after changing it. The defaults send replay batches and API events to the agent at `http://localhost:8100`; run `uv run eyewitness ingest` from `src/agent` after configuring the root `.env`. For a standalone local demo, leave `NEXT_PUBLIC_REPLAY_ENDPOINT` and `INGEST_URL` blank.

| Variable                             | Purpose                                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_REPLAY_ENDPOINT`        | Where rrweb batches are posted. Example defaults to `http://localhost:8100/ingest/replay`. Blank uses `/api/replay`, which appends batches to `src/storefront/.data/replay/<sessionId>.ndjson`. |
| `NEXT_PUBLIC_ELASTIC_APM_SERVER_URL` | Elastic APM server URL for the RUM browser agent. Blank disables RUM entirely.                                                                                                                  |
| `INGEST_URL`                         | Server-side agent URL for API call events. Example defaults to `http://localhost:8100`; blank disables forwarding.                                                                              |

## Admin page

`/admin` is the operator surface for the demo. It lists every recorded session in a chosen window with its difficulty signals and score, has a **Run investigation** button that starts the agent's funnel and shows each stage filling live (sweep, reconstruct, watch, cross-examine, file), and shows every confirmed incident with its clip, a jump-to-failure button, the evidence frames, the backend trace and a link to the Kibana case.

It needs `INGEST_URL` set and the agent's `eyewitness ingest` service running: the page talks only to `/api/admin/*`, which proxies server-side to the agent's admin API, so no credentials reach the browser. The admin and replay pages render without the shop chrome and do not record themselves as shopper sessions.

## Replay viewer

With the default agent configuration, browse the shop and open `/replay/<sessionId>` to fetch its recording from Elasticsearch via the ingest service. The browser never receives Elasticsearch credentials.

For local playback without Elasticsearch, set `NEXT_PUBLIC_REPLAY_ENDPOINT=` in `src/storefront/.env.local`, restart the storefront, browse the shop, and wait at least five seconds for a batch to flush. Read the session id with `sessionStorage.getItem("northline.session")` in the browser console, then open `/replay/<sessionId>`. The player supports play/pause, seeking, and playback speed. Replay pages do not record themselves.

`GET /api/replay/<sessionId>` reads the local batch file and returns events in timestamp order. If no local file exists and `INGEST_URL` is set, it proxies to the agent’s `GET /replay/<sessionId>` endpoint, which reads Elasticsearch. Local recordings live under `src/storefront/.data/replay/` when launched using the documented npm scripts. Missing, incomplete, and malformed recordings show an explanatory error.

## Telemetry

Every tab gets a session id stored in `sessionStorage`. The same id is:

- the file name of the rrweb recording under `.data/replay/`
- the `session_id` label on every RUM transaction
- the `x-session-id` header on API calls and `session_id` on forwarded server events

so a replay clip and an APM trace can be joined on it.

rrweb events are buffered and flushed every five seconds. On `pagehide` and when the tab is hidden, the buffer is sent with `sendBeacon` in chunks under the browser's 64 KB limit.

## Fault scenarios

The site is correct by default. Visit any page with `?fault=<name>` to turn one scenario on. It persists in `localStorage` until you visit a page with `?fault=none`.

| Name                   | What the user sees                                                               | What telemetry sees                                     |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `silent-checkout`      | Place order does nothing. No spinner, no error, no navigation.                   | No request is made.                                     |
| `offscreen-validation` | Missing-field errors are rendered outside the viewport. The button looks dead.   | Nothing.                                                |
| `dropped-upload`       | A review photo shows as uploaded, the review posts, the photo is never attached. | A 200 from `/api/reviews`.                              |
| `stale-bag-total`      | Changing quantity updates the line but the order summary total never changes.    | Nothing.                                                |
| `slow-payment`         | Payment stays pending for eight seconds, then shows a retry error.               | A 504 from `/api/orders` with roughly 8000 ms duration. |

Each scenario is one `if` branch at the point of failure, gated on `useFault()` from `lib/faults/FaultProvider.tsx`.

## Layout

```
app/              routes and API handlers
components/       rendering, grouped by area
data/             product catalogue, categories, image manifest, review seeds
lib/              logic: catalogue queries, bag maths, checkout validation, stores, faults, telemetry
public/products/  product images
scripts/          one-off tooling
```

Product photography is from Unsplash under the Unsplash licence. Credits are recorded in `data/image-manifest.json`.
