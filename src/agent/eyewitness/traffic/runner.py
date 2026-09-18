import asyncio
import json
import random
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from playwright.async_api import Browser, async_playwright

from eyewitness.config import DATA_DIR
from eyewitness.traffic import journeys

FLUSH_WAIT_SECONDS = 6


@dataclass
class PlannedSession:
    fault: str | None
    journey: str


@dataclass
class SessionRecord:
    session_id: str
    fault: str | None
    journey: str
    ok: bool
    error: str | None = None


def plan_sessions(total: int, broken: int) -> list[PlannedSession]:
    healthy_journeys = ["browse", "browse", "purchase", "purchase", "adjust_bag", "review"]
    broken_options = [
        ("silent-checkout", "purchase_dead_button"),
        ("offscreen-validation", "purchase_missing_field"),
        ("stale-bag-total", "adjust_bag"),
        ("dropped-upload", "review_with_photo"),
        ("slow-payment", "purchase_payment_timeout"),
    ]
    plan = [PlannedSession(None, random.choice(healthy_journeys)) for _ in range(total - broken)]
    for index in range(broken):
        fault, journey = broken_options[index % len(broken_options)]
        plan.append(PlannedSession(fault, journey))
    random.shuffle(plan)
    return plan


async def run_journey(page, planned: PlannedSession) -> None:
    match planned.journey:
        case "browse":
            await journeys.browse(page)
        case "purchase":
            await journeys.purchase(page)
        case "purchase_dead_button":
            await journeys.purchase(page, retries=random.randint(3, 5))
        case "purchase_missing_field":
            await journeys.purchase(page, skip_field="PIN code", retries=random.randint(2, 4))
        case "purchase_payment_timeout":
            await journeys.purchase(page, expect_payment_timeout=True)
        case "adjust_bag":
            await journeys.adjust_bag_quantity(page, changes=random.randint(2, 3))
        case "review":
            await journeys.write_review(page, with_photo=random.random() < 0.5)
        case "review_with_photo":
            await journeys.write_review(page, with_photo=True)
        case _:
            raise ValueError(f"unknown journey {planned.journey}")


async def run_session(browser: Browser, base_url: str, planned: PlannedSession) -> SessionRecord:
    context = await browser.new_context(viewport={"width": 1366, "height": 850})
    page = await context.new_page()
    fault_param = f"?fault={planned.fault}" if planned.fault else ""
    session_id = "unknown"
    try:
        await page.goto(f"{base_url}/{fault_param}")
        await page.wait_for_load_state("networkidle")
        session_id = await page.evaluate("sessionStorage.getItem('northline.session')")
        await journeys.pause(1.0, 2.0)
        await run_journey(page, planned)
        await asyncio.sleep(FLUSH_WAIT_SECONDS)
        return SessionRecord(session_id, planned.fault, planned.journey, ok=True)
    except Exception as error:
        await asyncio.sleep(FLUSH_WAIT_SECONDS)
        return SessionRecord(session_id, planned.fault, planned.journey, ok=False, error=str(error))
    finally:
        await context.close()


async def run_traffic(
    base_url: str, total: int, broken: int, concurrency: int
) -> list[SessionRecord]:
    plan = plan_sessions(total, broken)
    semaphore = asyncio.Semaphore(concurrency)
    records: list[SessionRecord] = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()

        async def bounded(planned: PlannedSession) -> None:
            async with semaphore:
                record = await run_session(browser, base_url, planned)
                records.append(record)
                status = "ok" if record.ok else f"failed: {record.error}"
                fault = record.fault or "healthy"
                print(f"{record.session_id}  {fault:<22} {record.journey:<24} {status}")

        await asyncio.gather(*(bounded(planned) for planned in plan))
        await browser.close()

    return records


def save_ground_truth(records: list[SessionRecord]) -> str:
    run_dir = DATA_DIR / "traffic"
    run_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    path = run_dir / f"{stamp}.json"
    path.write_text(json.dumps([asdict(record) for record in records], indent=2))
    return str(path)
