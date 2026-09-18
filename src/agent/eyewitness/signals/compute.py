from dataclasses import asdict, dataclass

from eyewitness.ingest.writer import (
    EVENT_TYPE_INCREMENTAL,
    MOUSE_INTERACTION_CLICK,
    SOURCE_MOUSE_INTERACTION,
    visited_path,
)

EVENT_TYPE_FULL_SNAPSHOT = 2
SOURCE_MUTATION = 0

DEAD_CLICK_WINDOW_MS = 1000
RAGE_CLICK_GAP_MS = 2000
RAGE_CLICK_MIN = 3
HIGH_API_LATENCY_MS = 5_000

WEIGHTS = {
    "backend_issue": 5.0,
    "dead_clicks": 3.0,
    "rage_clicks": 4.0,
    "repeated_submits": 3.0,
    "checkout_abandoned": 2.0,
    "bag_abandoned": 1.0,
    "checkout_dwell_per_minute": 1.0,
    "checkout_dwell_cap": 2.0,
}


@dataclass
class Signals:
    dead_clicks: int = 0
    rage_clicks: int = 0
    repeated_submits: int = 0
    checkout_dwell_ms: int = 0
    checkout_abandoned: bool = False
    bag_abandoned: bool = False
    difficulty_score: float = 0.0
    backend_error: bool = False
    high_api_latency: bool = False

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Click:
    timestamp: int
    node_id: int


def collect_node_tags(events: list[dict]) -> dict[int, tuple[str, dict]]:
    """Map rrweb node ids to (tag, attributes) from full snapshots and mutation adds."""
    tags: dict[int, tuple[str, dict]] = {}

    def walk(node: dict) -> None:
        if "tagName" in node and "id" in node:
            tags[node["id"]] = (node["tagName"].lower(), node.get("attributes", {}))
        for child in node.get("childNodes", []):
            walk(child)

    for event in events:
        data = event.get("data", {})
        if event.get("type") == EVENT_TYPE_FULL_SNAPSHOT and "node" in data:
            walk(data["node"])
        elif event.get("type") == EVENT_TYPE_INCREMENTAL and data.get("source") == SOURCE_MUTATION:
            for added in data.get("adds", []):
                walk(added.get("node", {}))
    return tags


def collect_clicks(events: list[dict]) -> list[Click]:
    clicks = []
    for event in events:
        data = event.get("data", {})
        if (
            event.get("type") == EVENT_TYPE_INCREMENTAL
            and data.get("source") == SOURCE_MOUSE_INTERACTION
            and data.get("type") == MOUSE_INTERACTION_CLICK
        ):
            clicks.append(Click(event["timestamp"], data.get("id", -1)))
    return clicks


def collect_change_timestamps(events: list[dict]) -> list[int]:
    """Timestamps at which the page visibly changed: DOM mutations or navigations."""
    stamps = []
    for event in events:
        data = event.get("data", {})
        is_mutation = (
            event.get("type") == EVENT_TYPE_INCREMENTAL and data.get("source") == SOURCE_MUTATION
        )
        if is_mutation or event.get("type") == EVENT_TYPE_FULL_SNAPSHOT or visited_path(event):
            stamps.append(event["timestamp"])
    return stamps


def count_dead_clicks(clicks: list[Click], change_stamps: list[int]) -> list[Click]:
    dead = []
    for click in clicks:
        window_end = click.timestamp + DEAD_CLICK_WINDOW_MS
        responded = any(click.timestamp < stamp <= window_end for stamp in change_stamps)
        if not responded:
            dead.append(click)
    return dead


def count_rage_clusters(clicks: list[Click]) -> int:
    clusters = 0
    run_length = 1
    for previous, current in zip(clicks, clicks[1:], strict=False):
        same_target = previous.node_id == current.node_id
        close_in_time = current.timestamp - previous.timestamp <= RAGE_CLICK_GAP_MS
        if same_target and close_in_time:
            run_length += 1
            if run_length == RAGE_CLICK_MIN:
                clusters += 1
        else:
            run_length = 1
    return clusters


def count_repeated_submits(clicks: list[Click], tags: dict[int, tuple[str, dict]]) -> int:
    submit_clicks: dict[int, int] = {}
    for click in clicks:
        tag, attributes = tags.get(click.node_id, ("", {}))
        if tag == "button" and attributes.get("type") == "submit":
            submit_clicks[click.node_id] = submit_clicks.get(click.node_id, 0) + 1
    return sum(count - 1 for count in submit_clicks.values() if count > 1)


def page_trail(events: list[dict]) -> list[tuple[int, str]]:
    trail = []
    for event in events:
        path = visited_path(event)
        if path:
            trail.append((event["timestamp"], path))
    return trail


def checkout_outcome(trail: list[tuple[int, str]], session_end: int) -> tuple[int, bool, bool]:
    """Return (checkout dwell ms, checkout abandoned, bag abandoned)."""
    checkout_at = next((stamp for stamp, path in trail if path.startswith("/checkout")), None)
    order_at = next((stamp for stamp, path in trail if path.startswith("/order/")), None)
    bag_at = next((stamp for stamp, path in trail if path.startswith("/bag")), None)

    if checkout_at is None:
        return 0, False, bag_at is not None
    if order_at is None:
        return session_end - checkout_at, True, False
    return order_at - checkout_at, False, False


def score(signals: Signals) -> float:
    dwell_minutes = signals.checkout_dwell_ms / 60_000 if signals.checkout_abandoned else 0
    dwell_points = min(
        dwell_minutes * WEIGHTS["checkout_dwell_per_minute"], WEIGHTS["checkout_dwell_cap"]
    )
    return round(
        signals.dead_clicks * WEIGHTS["dead_clicks"]
        + signals.rage_clicks * WEIGHTS["rage_clicks"]
        + signals.repeated_submits * WEIGHTS["repeated_submits"]
        + (WEIGHTS["checkout_abandoned"] if signals.checkout_abandoned else 0)
        + (WEIGHTS["bag_abandoned"] if signals.bag_abandoned else 0)
        + dwell_points
        + (WEIGHTS["backend_issue"] if signals.backend_error or signals.high_api_latency else 0),
        2,
    )


def compute_signals(events: list[dict]) -> Signals:
    if not events:
        return Signals()
    events = sorted(events, key=lambda event: event["timestamp"])
    clicks = collect_clicks(events)
    tags = collect_node_tags(events)
    change_stamps = collect_change_timestamps(events)
    dwell, checkout_abandoned, bag_abandoned = checkout_outcome(
        page_trail(events), events[-1]["timestamp"]
    )

    signals = Signals(
        dead_clicks=len(count_dead_clicks(clicks, change_stamps)),
        rage_clicks=count_rage_clusters(clicks),
        repeated_submits=count_repeated_submits(clicks, tags),
        checkout_dwell_ms=dwell,
        checkout_abandoned=checkout_abandoned,
        bag_abandoned=bag_abandoned,
    )
    signals.difficulty_score = score(signals)
    return signals
