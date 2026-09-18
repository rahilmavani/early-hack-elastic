import json

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from eyewitness.config import get_settings
from eyewitness.es.client import get_client
from eyewitness.ingest.models import ReplayBatch, ServerEvent
from eyewitness.ingest.writer import write_replay_batch, write_server_event

app = FastAPI(title="Eyewitness ingest")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().storefront_url],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


async def parse_body(request: Request, model):
    # sendBeacon sends text/plain to avoid a preflight, so parse the raw body regardless.
    raw = await request.body()
    try:
        return model.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/ingest/replay", status_code=204)
async def ingest_replay(request: Request) -> Response:
    batch = await parse_body(request, ReplayBatch)
    write_replay_batch(get_client(), batch)
    return Response(status_code=204)


@app.post("/ingest/server-events", status_code=204)
async def ingest_server_event(request: Request) -> Response:
    event = await parse_body(request, ServerEvent)
    write_server_event(get_client(), event)
    return Response(status_code=204)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
