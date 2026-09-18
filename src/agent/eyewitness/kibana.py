import httpx

from eyewitness.config import get_settings


def kibana_client() -> httpx.Client:
    settings = get_settings()
    return httpx.Client(
        base_url=settings.kibana_url.rstrip("/"),
        headers={
            "Authorization": f"ApiKey {settings.elastic_api_key}",
            "kbn-xsrf": "true",
            "Content-Type": "application/json",
        },
        timeout=30,
    )


def create_case(title: str, description: str, tags: list[str]) -> dict:
    payload = {
        "title": title,
        "description": description,
        "tags": tags,
        "owner": "cases",
        "connector": {"id": "none", "name": "none", "type": ".none", "fields": None},
        "settings": {"syncAlerts": False},
    }
    with kibana_client() as client:
        response = client.post("/api/cases", json=payload)
        response.raise_for_status()
        return response.json()


def add_comment(case_id: str, comment: str) -> dict:
    payload = {"type": "user", "comment": comment, "owner": "cases"}
    with kibana_client() as client:
        response = client.post(f"/api/cases/{case_id}/comments", json=payload)
        response.raise_for_status()
        return response.json()


def case_url(case_id: str) -> str:
    return f"{get_settings().kibana_url.rstrip('/')}/app/security/cases/{case_id}"
