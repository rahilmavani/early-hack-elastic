# Kibana operator surface

`dashboard.ndjson` is generated from `build_assets.py`. It contains four Vega visualizations and a dashboard, using the `sessions` and `incidents` indices directly. No data views or external Vega data sources are required.

| Panel | Meaning |
| --- | --- |
| Sweep-eligible sessions per day | Sessions with difficulty score >= 5, grouped by last batch day. This is eligibility, not a count of actual executions; run totals are in `summary.json`. |
| Difficulty histogram | All scored sessions, bins of width 5. |
| Incidents by fingerprint | Top 20 fingerprints in the selected time window. |
| Affected users per incident | Top 20 incidents by stored affected-user estimate. The current agent estimates this from sessions visiting the route. |

The dashboard time picker applies to `last_batch_at` for sessions and `created_at` for incidents. Change the first panel's threshold if you change `runs/nightly.yaml`.

## Install and export

From `src/agent`, after `eyewitness setup`:

```bash
uv run python ../../docs/kibana/provision.py            # no changes
uv run python ../../docs/kibana/provision.py --apply    # install dashboard, log connector, rule
uv run python ../../docs/kibana/provision.py --export   # capture actual dashboard + dependencies
```

The installer uses root `.env` settings and preserves a space path in `KIBANA_URL`. The API key needs saved-object, connector and rule management privileges, and read access to `incidents`. Re-running overwrites this dashboard's deterministic IDs; existing matching connector/rule IDs keep their settings. It stops if an existing connector or rule ID belongs to another resource. There is no email action.

`rule.json` is a portable Create Rule API payload, and `connector.json` is its server-log connector payload. The rule checks every minute for incidents created within five minutes, excludes hits seen on the previous execution, and logs active matches. Deduplicated sightings only update an existing incident, so they do not count as newly created incidents. Alert execution depends on Kibana licensing, privileges, task scheduling and enabled connector types.

`dashboard.export.ndjson`, when present, is an actual live export. Alert rules are provisioned through the Alerting API separately; do not import `rule.json` through Saved Objects. Verify the rule's execution status in Stack Management → Rules and its action in the Kibana server log.

Rebuild generated definitions from the repository root with `python3 docs/kibana/build_assets.py`. Do not rebuild the live export.

API references: [saved objects import](https://www.elastic.co/docs/explore-analyze/dashboards/import-dashboards), [Vega Elasticsearch queries](https://www.elastic.co/docs/explore-analyze/visualize/custom-visualizations-with-vega), [create rule](https://www.elastic.co/docs/api/doc/kibana/operation/operation-post-alerting-rule-id), [server-log connector](https://www.elastic.co/docs/reference/kibana/connectors-kibana/server-log-action-type).
