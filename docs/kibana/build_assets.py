"""Build portable dashboard definitions; no credentials or network required."""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
DASHBOARD_ID = "eyewitness-operations"
CONNECTOR_ID = "eyewitness-server-log"
RULE_ID = "eyewitness-new-incidents"


def chart(name, title, index, time_field, aggregation, x, y, filters=None):
    body = {"size": 0, "aggs": {"rows": aggregation}}
    url = {"index": index, "body": body}
    if filters:
        body["query"] = {
            "bool": {
                "must": ["%dashboard_context-must_clause%"],
                "must_not": ["%dashboard_context-must_not_clause%"],
                "filter": [
                    "%dashboard_context-filter_clause%",
                    {"range": {time_field: {"%timefilter%": True}}},
                    *filters,
                ],
            }
        }
    else:
        url.update({"%context%": True, "%timefield%": time_field})
    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "data": {"url": url, "format": {"property": "aggregations.rows.buckets"}},
        "mark": {"type": "bar", "tooltip": True},
        "encoding": {"x": x, "y": y},
    }
    return {
        "type": "visualization",
        "id": f"eyewitness-{name}",
        "references": [],
        "attributes": {
            "title": title,
            "description": "Eyewitness operator surface",
            "visState": json.dumps(
                {
                    "title": title,
                    "type": "vega",
                    "aggs": [],
                    "params": {"spec": json.dumps(spec)},
                }
            ),
            "uiStateJSON": "{}",
            "kibanaSavedObjectMeta": {"searchSourceJSON": "{}"},
        },
    }


def saved_objects():
    count = {"field": "doc_count", "type": "quantitative", "title": "Count"}
    objects = [
        chart(
            "eligible-per-day",
            "Sweep-eligible sessions per day (score >= 5)",
            "sessions",
            "last_batch_at",
            {"date_histogram": {"field": "last_batch_at", "calendar_interval": "day"}},
            {
                "field": "key",
                "type": "temporal",
                "timeUnit": "yearmonthdate",
                "axis": {"format": "%b %d"},
                "title": "Day",
            },
            count,
            [{"range": {"signals.difficulty_score": {"gte": 5}}}],
        ),
        chart(
            "difficulty",
            "Session difficulty score",
            "sessions",
            "last_batch_at",
            {"histogram": {"field": "signals.difficulty_score", "interval": 5}},
            {"field": "key", "type": "ordinal", "title": "Score (bin width 5)"},
            count,
        ),
        chart(
            "fingerprints",
            "Incidents by fingerprint (top 20)",
            "incidents",
            "created_at",
            {"terms": {"field": "fingerprint", "size": 20}},
            {"field": "key", "type": "nominal", "title": "Fingerprint"},
            count,
        ),
        chart(
            "affected-users",
            "Affected users per incident (top 20)",
            "incidents",
            "created_at",
            {
                "terms": {
                    "field": "incident_id",
                    "size": 20,
                    "order": {"users": "desc"},
                },
                "aggs": {"users": {"max": {"field": "affected_users"}}},
            },
            {"field": "key", "type": "nominal", "title": "Incident"},
            {"field": "users.value", "type": "quantitative", "title": "Affected users"},
        ),
    ]
    panels, references = [], []
    for i, obj in enumerate(objects):
        ref = f"panel_{i}"
        panels.append(
            {
                "panelIndex": str(i),
                "type": "visualization",
                "panelRefName": ref,
                "gridData": {
                    "x": (i % 2) * 24,
                    "y": (i // 2) * 15,
                    "w": 24,
                    "h": 15,
                    "i": str(i),
                },
                "embeddableConfig": {},
            }
        )
        references.append({"name": ref, "type": "visualization", "id": obj["id"]})
    objects.append(
        {
            "type": "dashboard",
            "id": DASHBOARD_ID,
            "references": references,
            "attributes": {
                "title": "Eyewitness operations",
                "description": (
                    "Eligibility is score >= 5, not an execution count. Actual run totals "
                    "are in summary.json. Affected users are a route-based estimate."
                ),
                "panelsJSON": json.dumps(panels),
                "optionsJSON": '{"useMargins":true}',
                "timeRestore": True,
                "timeFrom": "now-24h",
                "timeTo": "now",
                "kibanaSavedObjectMeta": {
                    "searchSourceJSON": '{"query":{"language":"kuery","query":""},"filter":[]}'
                },
            },
        }
    )
    return objects


def rule():
    return {
        "name": "Eyewitness new incidents",
        "rule_type_id": ".es-query",
        "consumer": "alerts",
        "enabled": True,
        "tags": ["eyewitness"],
        "schedule": {"interval": "1m"},
        "params": {
            "searchType": "esQuery",
            "index": ["incidents"],
            "timeField": "created_at",
            "esQuery": json.dumps(
                {"query": {"range": {"created_at": {"gte": "now-5m"}}}}
            ),
            "timeWindowSize": 5,
            "timeWindowUnit": "m",
            "threshold": [0],
            "thresholdComparator": ">",
            "size": 100,
            "aggType": "count",
            "groupBy": "all",
            "excludeHitsFromPreviousRun": True,
        },
        "actions": [
            {
                "id": CONNECTOR_ID,
                "group": "query matched",
                "frequency": {"summary": False, "notify_when": "onActiveAlert"},
                "params": {
                    "level": "info",
                    "message": "Eyewitness: {{context.value}} new incident(s). "
                    "Open the Eyewitness operations dashboard and Cases.",
                },
            }
        ],
    }


def build():
    (HERE / "dashboard.ndjson").write_text(
        "".join(json.dumps(obj) + "\n" for obj in saved_objects())
    )
    (HERE / "rule.json").write_text(json.dumps(rule(), indent=2) + "\n")
    connector = {
        "name": "Eyewitness server log",
        "connector_type_id": ".server-log",
        "config": {},
        "secrets": {},
    }
    (HERE / "connector.json").write_text(json.dumps(connector, indent=2) + "\n")


if __name__ == "__main__":
    build()
    print("Built dashboard.ndjson, rule.json, connector.json; no remote changes.")
