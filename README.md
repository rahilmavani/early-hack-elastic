# Eyewitness

The incident response agent that saw it happen.

Logs, metrics and traces describe what the backend did. None of them capture what the user actually saw. Eyewitness replays recorded sessions, watches them with a vision model, and reports only the incidents it can prove.

## Layout

| Path             | What it is                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/storefront` | A minimal ecommerce site that acts as the live product under observation. Emits session replay and RUM telemetry, and can be switched into named silent-failure modes for demos. |

## Run

```bash
npm install
npm run dev
```

The root package uses npm workspaces. `npm run dev`, `build` and `start` target the storefront; `lint` and `format` run across every app. Application code lives under `src/`, notes and screenshots under `docs/`, and `SUBMISSION.md` is the judges' entry point. See each app's README for details.
