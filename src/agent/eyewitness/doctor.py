import httpx
import typer
from pydantic import ValidationError

from eyewitness.bedrock import embed_text, runtime_client
from eyewitness.config import aws_session, get_settings
from eyewitness.es.client import get_client


def report(name: str, ok: bool, detail: str) -> bool:
    mark = "ok " if ok else "FAIL"
    typer.echo(f"[{mark}] {name}: {detail}")
    return ok


def check_elasticsearch() -> bool:
    try:
        info = get_client().info()
        version = info["version"]["number"]
        return report("elasticsearch", True, f"cluster {info['cluster_name']} v{version}")
    except Exception as error:
        return report("elasticsearch", False, str(error))


def check_kibana() -> bool:
    settings = get_settings()
    if not settings.kibana_url:
        return report("kibana", False, "KIBANA_URL is blank")
    try:
        response = httpx.get(
            f"{settings.kibana_url.rstrip('/')}/api/status",
            headers={"Authorization": f"ApiKey {settings.elastic_api_key}"},
            timeout=15,
        )
        response.raise_for_status()
        level = response.json()["status"]["overall"]["level"]
        return report("kibana", level == "available", f"status {level}")
    except Exception as error:
        return report("kibana", False, str(error))


def check_bedrock_vision() -> bool:
    settings = get_settings()
    if not settings.bedrock_vision_model_id:
        return report("bedrock vision", False, "BEDROCK_VISION_MODEL_ID is blank")
    try:
        response = runtime_client().converse(
            modelId=settings.bedrock_vision_model_id,
            messages=[{"role": "user", "content": [{"text": "Reply with the single word: ready"}]}],
            inferenceConfig={"maxTokens": 10},
        )
        text = response["output"]["message"]["content"][0]["text"].strip()
        return report("bedrock vision", True, f"{settings.bedrock_vision_model_id} said {text!r}")
    except Exception as error:
        return report("bedrock vision", False, str(error))


def check_bedrock_embeddings() -> bool:
    settings = get_settings()
    if not settings.bedrock_embedding_model_id:
        return report("bedrock embeddings", False, "BEDROCK_EMBEDDING_MODEL_ID is blank")
    try:
        vector = embed_text("connectivity check")
        ok = len(vector) == settings.embedding_dimensions
        detail = f"{len(vector)} dimensions"
        if not ok:
            detail += f", expected {settings.embedding_dimensions}; set EMBEDDING_DIMENSIONS"
        return report("bedrock embeddings", ok, detail)
    except Exception as error:
        return report("bedrock embeddings", False, str(error))


def check_s3() -> bool:
    settings = get_settings()
    if not settings.s3_clips_bucket:
        return report("s3", False, "S3_CLIPS_BUCKET is blank")
    try:
        s3 = aws_session().client("s3")
        s3.head_bucket(Bucket=settings.s3_clips_bucket)
        return report("s3", True, f"bucket {settings.s3_clips_bucket} reachable")
    except Exception as error:
        return report("s3", False, str(error))


def run_checks() -> list[str]:
    try:
        get_settings()
    except ValidationError as error:
        fields = ", ".join(".".join(map(str, item["loc"])) for item in error.errors())
        report("configuration", False, f"Set valid {fields} in the repo root .env")
        return ["configuration"]
    checks = [
        check_elasticsearch,
        check_kibana,
        check_bedrock_vision,
        check_bedrock_embeddings,
        check_s3,
    ]
    return [check.__name__ for check in checks if not check()]
