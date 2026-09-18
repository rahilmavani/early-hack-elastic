import json
from functools import lru_cache

from eyewitness.config import aws_session, get_settings


@lru_cache
def runtime_client():
    return aws_session().client("bedrock-runtime")


def embed_text(text: str) -> list[float]:
    model_id = get_settings().bedrock_embedding_model_id

    if "cohere" in model_id:
        body = {"texts": [text], "input_type": "search_document"}
    else:
        body = {"inputText": text}

    response = runtime_client().invoke_model(modelId=model_id, body=json.dumps(body))
    payload = json.loads(response["body"].read())

    if "embeddings" in payload:
        return payload["embeddings"][0]
    return payload["embedding"]
