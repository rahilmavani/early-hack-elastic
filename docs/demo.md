# Presenter script

Complete the README setup and service checks first. Start the storefront and ingest. Use a fresh browser context for each scenario so each has its own session ID and bag.

1. Open the storefront normally, add a product, and place an order. Show the confirmation.
2. Open `/?fault=silent-checkout`, add a product and reach checkout. Click Place order three times. The UI stays put while no order call reaches the backend.
3. In a fresh context, open `/?fault=slow-payment`, add a product and check out. Show the pending state for about eight seconds, then the visible retry error. This scenario returns HTTP 504 and records the duration in `server-events`.
4. Allow the recorder to flush (about ten seconds after the last click). Open `/admin`. The sessions table already shows the scenarios you just played, with their signal chips. Pick **Last hour** and press **Run investigation**. The pipeline panel fills stage by stage: sweep → reconstruct → watch → cross-examine → file, with a live log. Explain each stage while it runs. An injected fault is ground truth, not a guarantee that the model will confirm it.
5. When the run finishes, the confirmed incidents appear at the top of `/admin`. Play the clip and press **Jump to failure**. A slow-payment card shows the matching 504 server event; a silent-checkout card correctly says no request reached the server. These server events are lightweight session-tagged telemetry, not a full OpenTelemetry trace. Press **Open Kibana case** to show the same evidence filed as a ticket.
6. Run the investigation again over the same window. The pipeline shows the same findings arriving as *added to existing case* rather than new cases, which is the kNN dedupe. A historical resolution is only included if the matching incident already contains one.

Timing: reconstruction replays each flagged session at real speed, capped at three minutes. Keep demo sessions short and close their tabs when done, so a run finishes in a few minutes. The terminal equivalents (`uv run eyewitness run`, `file <session-id>`) still work if the page is unavailable.
7. For repeatable metrics, generate `traffic --sessions 12 --broken 5`, run the funnel, and execute `score --run <id> --truth <printed-path>`. Show precision, recall and per-session misses. Failed browser journeys are excluded and counted separately.
8. Open the Eyewitness operations dashboard. Show the signal distribution and incident groups. Explain that the first panel counts sweep-eligible sessions, not completed run executions. Show the new-incident rule's last execution status.

The human viewer is `/replay/<session-id>`; use the recording configuration in the storefront README. S3 clip links expire after seven days. Capture screenshots only from demo sessions; keep credentials and signed URLs out of screenshots intended for public submission.
