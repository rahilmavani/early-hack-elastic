from eyewitness.signals.compute import compute_signals


def snapshot(ts: int) -> dict:
    button = {
        "type": 2,
        "tagName": "button",
        "attributes": {"type": "submit"},
        "id": 10,
        "childNodes": [],
    }
    return {"type": 2, "timestamp": ts, "data": {"node": {"id": 1, "childNodes": [button]}}}


def route(ts: int, path: str) -> dict:
    return {"type": 5, "timestamp": ts, "data": {"tag": "route", "payload": {"path": path}}}


def click(ts: int, node_id: int = 10) -> dict:
    return {"type": 3, "timestamp": ts, "data": {"source": 2, "type": 2, "id": node_id}}


def mutation(ts: int) -> dict:
    return {"type": 3, "timestamp": ts, "data": {"source": 0, "adds": [], "removes": []}}


def test_healthy_checkout_scores_zero():
    events = [
        snapshot(0),
        route(0, "/checkout"),
        click(5_000),
        mutation(5_200),
        route(6_000, "/order/NL-1"),
    ]
    signals = compute_signals(events)
    assert signals.dead_clicks == 0
    assert signals.rage_clicks == 0
    assert signals.checkout_abandoned is False
    assert signals.checkout_dwell_ms == 6_000
    assert signals.difficulty_score == 0


def test_dead_button_repeated_clicks_score_high():
    events = [snapshot(0), route(0, "/checkout")]
    events += [click(10_000 + gap) for gap in (0, 1_500, 3_000, 4_200)]
    events.append(mutation(40_000))
    signals = compute_signals(events)
    assert signals.dead_clicks == 4
    assert signals.rage_clicks == 1
    assert signals.repeated_submits == 3
    assert signals.checkout_abandoned is True
    assert signals.difficulty_score >= 20


def test_click_answered_by_mutation_is_not_dead():
    events = [snapshot(0), click(1_000, node_id=7), mutation(1_300)]
    assert compute_signals(events).dead_clicks == 0


def test_bag_abandoned_when_checkout_never_reached():
    events = [snapshot(0), route(0, "/bag"), click(2_000, node_id=7), mutation(2_100)]
    signals = compute_signals(events)
    assert signals.bag_abandoned is True
    assert signals.difficulty_score == 1
