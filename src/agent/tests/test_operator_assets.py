import importlib.util
import json

import httpx
import pytest

from eyewitness.config import REPO_ROOT

spec = importlib.util.spec_from_file_location(
    "operator_provision", REPO_ROOT / "docs/kibana/provision.py"
)
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


def test_failed_dashboard_import_stops_before_creating_alerts():
    requests = []

    def handle(request):
        requests.append(request)
        assert request.headers["content-type"].startswith("multipart/form-data;")
        return httpx.Response(200, json={"success": False, "errors": ["migration failed"]})

    with httpx.Client(
        base_url="https://example.test/s/demo",
        transport=httpx.MockTransport(handle),
        headers={"Content-Type": "application/json"},
    ) as client:
        with pytest.raises(RuntimeError, match="migration failed"):
            provision.install(client)
        assert client.headers["content-type"] == "application/json"
    assert len(requests) == 1
    assert requests[0].url.path == "/s/demo/api/saved_objects/_import"


def test_repeat_install_keeps_existing_matching_rule_and_connector():
    mutations = []

    def handle(request):
        path = request.url.path
        if path.endswith("_import"):
            return httpx.Response(200, json={"success": True})
        assert request.method == "GET", "Existing resources must not be overwritten"
        mutations.append(path)
        filename = "rule.json" if "/rule/" in path else "connector.json"
        return httpx.Response(200, json=json.loads((provision.HERE / filename).read_text()))

    with httpx.Client(
        base_url="https://example.test", transport=httpx.MockTransport(handle)
    ) as client:
        provision.install(client)
    assert len(mutations) == 2
