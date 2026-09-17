# Eyewitness

The incident response agent that saw it happen.

Logs, metrics and traces describe what the backend did. None of them capture what the user actually saw. Eyewitness replays recorded sessions, watches them with a vision model, and reports only the incidents it can prove.

## Apps

| Path | What it is |
| --- | --- |
| `apps/storefront` | A minimal ecommerce site that acts as the live product under observation. Emits session replay and RUM telemetry, and can be switched into named silent-failure modes for demos. |

Each app is self-contained. See its README for setup.
