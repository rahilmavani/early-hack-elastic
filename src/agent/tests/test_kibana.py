import json
from types import SimpleNamespace

import httpx
import pytest

from eyewitness import doctor, kibana
from eyewitness.config import Settings


def test_case_url_preserves_space(monkeypatch):
    monkeypatch.setattr(
        kibana,
        "get_settings",
        lambda: SimpleNamespace(
            kibana_url="https://example.test/s/demo/", kibana_case_owner="observability"
        ),
    )
    assert kibana.case_url("case-123") == (
        "https://example.test/s/demo/app/observability/cases/case-123"
    )


def test_doctor_missing_configuration_is_a_clean_failure(monkeypatch, capsys):
    def invalid_settings():
        return Settings(_env_file=None, elastic_cloud_endpoint=None, elastic_api_key=None)

    monkeypatch.setattr(doctor, "get_settings", invalid_settings)
    assert doctor.run_checks() == ["configuration"]
    output = capsys.readouterr().out
    assert "[FAIL] configuration" in output
    assert "elastic_api_key" in output
    assert "Traceback" not in output


@pytest.mark.parametrize("owner", ["observability", "securitySolution"])
def test_comment_uses_existing_owner(monkeypatch, owner):
    def handle(request):
        if request.method == "GET":
            return httpx.Response(200, json={"owner": owner})
        assert json.loads(request.content)["owner"] == owner
        return httpx.Response(200, json={"id": "case-123", "owner": owner})

    monkeypatch.setattr(
        kibana,
        "kibana_client",
        lambda: httpx.Client(
            base_url="https://example.test", transport=httpx.MockTransport(handle)
        ),
    )
    assert kibana.add_comment("case-123", "Seen again")["owner"] == owner


def test_create_case_uses_configured_owner(monkeypatch):
    monkeypatch.setattr(
        kibana, "get_settings", lambda: SimpleNamespace(kibana_case_owner="observability")
    )

    def handle(request):
        body = json.loads(request.content)
        assert body["owner"] == "observability"
        return httpx.Response(200, json={"id": "case-123", **body})

    monkeypatch.setattr(
        kibana,
        "kibana_client",
        lambda: httpx.Client(
            base_url="https://example.test", transport=httpx.MockTransport(handle)
        ),
    )
    assert kibana.create_case("title", "description", ["eyewitness"])["id"] == "case-123"
