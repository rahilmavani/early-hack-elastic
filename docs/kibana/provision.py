"""Install the operator assets using the agent's root .env settings."""

import argparse
import json
from pathlib import Path

from eyewitness.kibana import kibana_client

HERE = Path(__file__).resolve().parent
DASHBOARD_ID = "eyewitness-operations"
CONNECTOR_ID = "eyewitness-server-log"
RULE_ID = "eyewitness-new-incidents"


def ensure_resource(client, path, payload, type_key):
    response = client.get(path)
    if response.status_code == 404:
        response = client.post(path, json=payload)
        response.raise_for_status()
        return
    response.raise_for_status()
    existing = response.json()
    if existing.get(type_key) != payload[type_key] or existing.get("name") != payload["name"]:
        raise RuntimeError(f"Existing resource at {path} does not match Eyewitness; left unchanged")
    print(f"Already exists: {path}; settings left unchanged")


def install(client):
    with (HERE / "dashboard.ndjson").open("rb") as asset:
        # kibana_client normally sends JSON; multipart needs its own boundary.
        content_type = client.headers.pop("Content-Type", None)
        try:
            response = client.post(
                "/api/saved_objects/_import",
                params={"overwrite": "true"},
                files={"file": ("dashboard.ndjson", asset, "application/x-ndjson")},
            )
        finally:
            if content_type:
                client.headers["Content-Type"] = content_type
    response.raise_for_status()
    result = response.json()
    if not result.get("success"):
        raise RuntimeError(f"Dashboard import failed: {json.dumps(result.get('errors', result))}")
    ensure_resource(
        client,
        f"/api/actions/connector/{CONNECTOR_ID}",
        json.loads((HERE / "connector.json").read_text()),
        "connector_type_id",
    )
    ensure_resource(
        client,
        f"/api/alerting/rule/{RULE_ID}",
        json.loads((HERE / "rule.json").read_text()),
        "rule_type_id",
    )
    print(f"Dashboard: {str(client.base_url).rstrip('/')}/app/dashboards#/view/{DASHBOARD_ID}")
    print("Rule installed; verify its next execution and the Kibana server log.")


def export_dashboard(client):
    response = client.post(
        "/api/saved_objects/_export",
        json={
            "objects": [{"type": "dashboard", "id": DASHBOARD_ID}],
            "includeReferencesDeep": True,
            "excludeExportDetails": True,
        },
    )
    response.raise_for_status()
    target = HERE / "dashboard.export.ndjson"
    target.write_bytes(response.content)
    print(f"Live dashboard export: {target}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Import dashboard and create rule")
    parser.add_argument("--export", action="store_true", help="Export the installed dashboard")
    args = parser.parse_args()
    if not args.apply and not args.export:
        print("No changes. Use --apply to install, --export to capture the live dashboard.")
        return
    with kibana_client() as client:
        if args.apply:
            install(client)
        if args.export:
            export_dashboard(client)


if __name__ == "__main__":
    main()
