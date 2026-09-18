import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from eyewitness.render import renderer


@pytest.mark.parametrize(
    "duration_ms,cap,seconds,truncated",
    [
        (250, 2, [0, 1], False),
        (2000, 2, [0, 1, 2], False),
        (10250, 2, [0, 1, 2], True),
    ],
)
def test_terminal_frames_include_fractional_end_without_exceeding_cap(
    monkeypatch, tmp_path, duration_ms, cap, seconds, truncated
):
    page = SimpleNamespace(
        set_content=AsyncMock(),
        add_style_tag=AsyncMock(),
        add_script_tag=AsyncMock(),
        evaluate=AsyncMock(return_value=False),
        screenshot=AsyncMock(),
        video=None,
    )
    context = SimpleNamespace(new_page=AsyncMock(return_value=page), close=AsyncMock())
    browser = SimpleNamespace(new_context=AsyncMock(return_value=context), close=AsyncMock())
    playwright = SimpleNamespace(chromium=SimpleNamespace(launch=AsyncMock(return_value=browser)))
    manager = MagicMock()
    manager.__aenter__ = AsyncMock(return_value=playwright)
    manager.__aexit__ = AsyncMock(return_value=None)
    monkeypatch.setattr(renderer, "async_playwright", lambda: manager)
    monkeypatch.setattr(renderer, "DATA_DIR", tmp_path)
    monkeypatch.setattr(renderer.asyncio, "sleep", AsyncMock())

    result = asyncio.run(
        renderer.render_session(
            "session-123",
            [
                {"type": 2, "timestamp": 0, "data": {}},
                {"type": 3, "timestamp": duration_ms, "data": {}},
            ],
            cap,
        )
    )

    assert [frame.second for frame in result.frames] == seconds
    assert page.screenshot.await_count == len(seconds)
    assert result.frames[-1].second <= cap
    assert result.rendered_seconds == min(duration_ms / 1000, cap)
    assert result.truncated is truncated
