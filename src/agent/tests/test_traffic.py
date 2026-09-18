import asyncio
from collections import Counter
from unittest.mock import AsyncMock

from eyewitness.traffic.runner import PlannedSession, plan_sessions, run_journey


def test_plan_covers_five_faults_and_keeps_healthy_count():
    plan = plan_sessions(total=12, broken=5)
    counts = Counter(session.fault for session in plan)

    assert len(plan) == 12
    assert counts[None] == 7
    assert counts["slow-payment"] == 1
    assert len(counts) == 6
    assert next(session for session in plan if session.fault == "slow-payment").journey == (
        "purchase_payment_timeout"
    )


def test_slow_payment_journey_expects_timeout(monkeypatch):
    purchase = AsyncMock()
    monkeypatch.setattr("eyewitness.traffic.runner.journeys.purchase", purchase)
    page = object()

    asyncio.run(run_journey(page, PlannedSession("slow-payment", "purchase_payment_timeout")))

    purchase.assert_awaited_once_with(page, expect_payment_timeout=True)
