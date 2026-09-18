import asyncio
import importlib
import threading
from types import SimpleNamespace

import httpx

from eyewitness import config


def test_slow_replay_write_does_not_block_health(monkeypatch):
    monkeypatch.setattr(
        config, "get_settings", lambda: SimpleNamespace(storefront_url="http://localhost:3000")
    )
    module = importlib.import_module("eyewitness.ingest.app")
    monkeypatch.setattr(module, "get_client", lambda: object())
    writing = threading.Event()
    release = threading.Event()

    def slow_write(client, batch):
        writing.set()
        release.wait(timeout=2)

    monkeypatch.setattr(module, "write_replay_batch", slow_write)

    async def verify():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=module.app), base_url="http://test"
        ) as client:
            post = asyncio.create_task(
                client.post(
                    "/ingest/replay",
                    json={
                        "sessionId": "session-123",
                        "sentAt": "2026-09-18T00:00:00Z",
                        "events": [],
                    },
                )
            )
            await asyncio.to_thread(writing.wait, 1)
            try:
                health = await asyncio.wait_for(client.get("/health"), timeout=0.5)
                assert health.status_code == 200
                assert not post.done(), "Replay storage must still be waiting independently"
            finally:
                release.set()
            assert (await post).status_code == 204

    asyncio.run(verify())
