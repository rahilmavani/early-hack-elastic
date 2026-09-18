import json
import re

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from eyewitness import admin
from eyewitness.config import get_settings
from eyewitness.es.client import get_client
from eyewitness.ingest.models import ReplayBatch, ServerEvent
from eyewitness.ingest.writer import write_replay_batch, write_server_event
from eyewitness.signals.run import fetch_events

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
    await run_in_threadpool(write_replay_batch, get_client(), batch)
    return Response(status_code=204)


@app.post("/ingest/server-events", status_code=204)
async def ingest_server_event(request: Request) -> Response:
    event = await parse_body(request, ServerEvent)
    await run_in_threadpool(write_server_event, get_client(), event)
    return Response(status_code=204)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/replay/{session_id}")
def replay_events(session_id: str, response: Response) -> dict:
    """Read a session for the storefront's server-side replay proxy."""
    if not re.fullmatch(r"[A-Za-z0-9-]{8,64}", session_id):
        raise HTTPException(status_code=400, detail="Invalid session id")
    try:
        events = fetch_events(get_client(), session_id)
    except RuntimeError as error:
        raise HTTPException(
            status_code=413, detail="Recording exceeds the replay event limit"
        ) from error
    except Exception as error:
        raise HTTPException(status_code=503, detail="Recording storage is unavailable") from error
    if not events:
        raise HTTPException(status_code=404, detail="Recording not found")
    response.headers["Cache-Control"] = "no-store"
    return {"sessionId": session_id, "events": events}


# Admin API behind the storefront's /admin page. The storefront proxies these
# server-side, so they stay on the loopback interface with the ingest endpoints.

run_manager = admin.RunManager()


def admin_window(window: str) -> str:
    try:
        return admin.validate_window(window)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/admin/sessions")
async def admin_sessions(window: str = "24h", threshold: float = 5.0) -> dict:
    window = admin_window(window)
    try:
        sessions = await run_in_threadpool(admin.list_sessions, get_client(), window, threshold)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Session storage is unavailable") from error
    return {"window": window, "threshold": threshold, "sessions": sessions}


@app.get("/admin/incidents")
async def admin_incidents() -> dict:
    try:
        incidents = await run_in_threadpool(admin.list_incidents, get_client())
    except Exception as error:
        raise HTTPException(status_code=503, detail="Incident storage is unavailable") from error
    return {"incidents": incidents}


@app.get("/admin/impact")
async def admin_impact() -> dict:
    try:
        return await run_in_threadpool(admin.impact, get_client())
    except Exception as error:
        raise HTTPException(status_code=503, detail="Incident storage is unavailable") from error


@app.post("/admin/runs", status_code=202)
async def admin_start_run(request: Request) -> dict:
    raw = await request.body()
    body = json.loads(raw) if raw else {}
    window = admin_window(str(body.get("window", "1h")))
    threshold = body.get("threshold")
    limit = body.get("limit")
    try:
        state = run_manager.start(
            get_client(),
            window,
            float(threshold) if threshold is not None else None,
            int(limit) if limit is not None else None,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return admin.run_payload(state)


@app.get("/admin/runs/latest")
async def admin_latest_run() -> dict:
    state = run_manager.latest()
    return {
        "run": admin.run_payload(state) if state else None,
        "history": await run_in_threadpool(admin.run_history),
    }


@app.get("/admin/runs/{run_id}")
async def admin_run(run_id: str) -> dict:
    state = run_manager.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return admin.run_payload(state)


@app.get("/admin/renders/{session_id}/clip.webm")
async def admin_clip(session_id: str) -> FileResponse:
    try:
        admin.validate_session_id(session_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    path = admin.renders_dir(session_id) / "clip.webm"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No clip rendered for this session")
    return FileResponse(path, media_type="video/webm", headers={"Cache-Control": "no-store"})


@app.get("/admin/renders/{session_id}/frames/{second}.jpg")
async def admin_frame(session_id: str, second: int) -> FileResponse:
    try:
        admin.validate_session_id(session_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    path = admin.renders_dir(session_id) / "frames" / f"{second:04d}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No frame at that second")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "no-store"})
