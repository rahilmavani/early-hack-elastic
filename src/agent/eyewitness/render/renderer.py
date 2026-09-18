import asyncio
import json
import math
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

from playwright.async_api import async_playwright

from eyewitness.config import DATA_DIR

PLAYER_HTML = Path(__file__).with_name("player.html")
VENDOR_DIR = Path(__file__).with_name("vendor")
PLAYER_SCRIPT = VENDOR_DIR / "rrweb-player.umd.cjs"
PLAYER_STYLE = VENDOR_DIR / "rrweb-player.css"
EVENT_TYPE_META = 4
DEFAULT_VIEWPORT = (1366, 850)
FRAME_INTERVAL_SECONDS = 1.0
FINISH_GRACE_SECONDS = 2.0


@dataclass
class Frame:
    second: int
    path: str


@dataclass
class RenderResult:
    session_id: str
    duration_seconds: float
    rendered_seconds: float
    truncated: bool
    clip_path: str
    frames: list[Frame]

    def as_dict(self) -> dict:
        return asdict(self)


def recorded_viewport(events: list[dict]) -> tuple[int, int]:
    for event in events:
        if event.get("type") == EVENT_TYPE_META:
            data = event.get("data", {})
            if data.get("width") and data.get("height"):
                return int(data["width"]), int(data["height"])
    return DEFAULT_VIEWPORT


def session_duration_seconds(events: list[dict]) -> float:
    stamps = [event["timestamp"] for event in events if "timestamp" in event]
    return (max(stamps) - min(stamps)) / 1000 if stamps else 0.0


def output_dir(session_id: str) -> Path:
    path = DATA_DIR / "renders" / session_id
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)
    return path


async def render_session(session_id: str, events: list[dict], max_seconds: int) -> RenderResult:
    events = sorted(events, key=lambda event: event["timestamp"])
    width, height = recorded_viewport(events)
    duration = session_duration_seconds(events)
    play_seconds = min(duration, max_seconds)
    target = output_dir(session_id)
    frames_dir = target / "frames"
    frames_dir.mkdir(exist_ok=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        context = await browser.new_context(
            viewport={"width": width, "height": height},
            record_video_dir=str(target),
            record_video_size={"width": width, "height": height},
        )
        page = await context.new_page()
        await page.set_content(PLAYER_HTML.read_text())
        await page.add_style_tag(path=str(PLAYER_STYLE))
        await page.add_script_tag(path=str(PLAYER_SCRIPT))
        await page.evaluate(
            "([events, width, height]) => window.startPlayer(events, width, height)",
            [events, width, height],
        )

        frames: list[Frame] = []
        loop = asyncio.get_running_loop()
        started = loop.time()
        second = 0
        # Include the terminal state when the final event falls between second ticks.
        # Otherwise a last-moment confirmation or error can be absent from every frame.
        while second <= math.ceil(play_seconds):
            frame_path = frames_dir / f"{second:04d}.jpg"
            await page.screenshot(path=str(frame_path), type="jpeg", quality=70)
            frames.append(Frame(second=second, path=str(frame_path)))
            second += 1
            if second > math.ceil(play_seconds):
                break
            next_tick = started + second * FRAME_INTERVAL_SECONDS
            await asyncio.sleep(max(0.0, next_tick - loop.time()))

        await asyncio.sleep(FINISH_GRACE_SECONDS)
        video = page.video
        await context.close()

        clip_path = target / "clip.webm"
        if video:
            await video.save_as(str(clip_path))
            await video.delete()
        await browser.close()

    result = RenderResult(
        session_id=session_id,
        duration_seconds=round(duration, 2),
        rendered_seconds=round(play_seconds, 2),
        truncated=duration > max_seconds,
        clip_path=str(clip_path),
        frames=frames,
    )
    (target / "render.json").write_text(json.dumps(result.as_dict(), indent=2))
    return result


def load_events_from_ndjson(path: Path) -> list[dict]:
    events: list[dict] = []
    for line in path.read_text().splitlines():
        if line.strip():
            events.extend(json.loads(line)["events"])
    return events
