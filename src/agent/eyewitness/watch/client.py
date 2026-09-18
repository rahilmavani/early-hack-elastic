import json
import re
from pathlib import Path

from pydantic import BaseModel, ValidationError

from eyewitness.bedrock import runtime_client
from eyewitness.config import get_settings
from eyewitness.watch.schemas import Usage

MAX_FRAMES_PER_CALL = 16


def select_frames(frames: list[dict], limit: int = MAX_FRAMES_PER_CALL) -> list[dict]:
    """Keep at most `limit` frames, evenly spaced, always including the first and last."""
    if len(frames) <= limit:
        return frames
    step = (len(frames) - 1) / (limit - 1)
    indices = sorted({round(index * step) for index in range(limit)})
    return [frames[index] for index in indices]


def frame_blocks(frames: list[dict]) -> list[dict]:
    blocks = []
    for frame in frames:
        blocks.append({"text": f"Frame at second {frame['second']}:"})
        blocks.append(
            {"image": {"format": "jpeg", "source": {"bytes": Path(frame["path"]).read_bytes()}}}
        )
    return blocks


def extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text[text.find("{") : text.rfind("}") + 1]
    return json.loads(candidate)


def converse_json[T: BaseModel](
    prompt: str, frames: list[dict], schema: type[T], max_tokens: int = 1200
) -> tuple[T, Usage]:
    """One Bedrock Converse call returning a validated schema instance; retries once on bad JSON."""
    from eyewitness.watch.prompts import SYSTEM

    content = frame_blocks(select_frames(frames)) + [{"text": prompt}]
    messages = [{"role": "user", "content": content}]
    usage = Usage()

    for attempt in range(2):
        response = runtime_client().converse(
            modelId=get_settings().bedrock_vision_model_id,
            system=[{"text": SYSTEM}],
            messages=messages,
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0},
        )
        call_usage = response.get("usage", {})
        usage = usage.add(
            Usage(
                input_tokens=call_usage.get("inputTokens", 0),
                output_tokens=call_usage.get("outputTokens", 0),
            )
        )
        text = response["output"]["message"]["content"][0]["text"]
        try:
            return schema.model_validate(extract_json(text)), usage
        except (ValueError, ValidationError) as error:
            if attempt == 1:
                raise
            messages = messages + [
                {"role": "assistant", "content": [{"text": text}]},
                {
                    "role": "user",
                    "content": [
                        {"text": f"That reply was not valid: {error}. Reply with only the JSON."}
                    ],
                },
            ]

    raise RuntimeError("unreachable")
