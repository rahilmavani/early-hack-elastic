# Northline storefront

A minimal ecommerce site that acts as the live product Eyewitness watches. It records every session with rrweb, reports to Elastic RUM when configured, and can be switched into named silent-failure modes for demos.

No auth, no real payments. Bag, wishlist and orders live in the browser's localStorage. Orders and reviews also hit API routes so there is a real backend edge to trace.

## Run

From the repo root:

```bash
npm install
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

Copy `.env.example` to `.env.local` and fill in what you need. Both values can stay blank.

| Variable                             | Purpose                                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_REPLAY_ENDPOINT`        | Where rrweb batches are posted. Defaults to the local sink at `/api/replay`, which appends one JSON line per batch to `.data/replay/<sessionId>.ndjson`. |
| `NEXT_PUBLIC_ELASTIC_APM_SERVER_URL` | Elastic APM server URL for the RUM browser agent. Blank disables RUM entirely.                                                                           |

## Telemetry

Every tab gets a session id stored in `sessionStorage`. The same id is:

- the file name of the rrweb recording under `.data/replay/`
- the `session_id` label on every RUM transaction

so a replay clip and an APM trace can be joined on it.

rrweb events are buffered and flushed every five seconds. On `pagehide` and when the tab is hidden, the buffer is sent with `sendBeacon` in chunks under the browser's 64 KB limit.

## Fault scenarios

The site is correct by default. Visit any page with `?fault=<name>` to turn one scenario on. It persists in `localStorage` until you visit a page with `?fault=none`.

| Name                   | What the user sees                                                               | What telemetry sees        |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| `silent-checkout`      | Place order does nothing. No spinner, no error, no navigation.                   | No request is made.        |
| `offscreen-validation` | Missing-field errors are rendered outside the viewport. The button looks dead.   | Nothing.                   |
| `dropped-upload`       | A review photo shows as uploaded, the review posts, the photo is never attached. | A 200 from `/api/reviews`. |
| `stale-bag-total`      | Changing quantity updates the line but the order summary total never changes.    | Nothing.                   |

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
