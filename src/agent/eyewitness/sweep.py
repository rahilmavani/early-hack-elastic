from dataclasses import dataclass

from elasticsearch import Elasticsearch

SWEEP_QUERY = """
FROM sessions
| WHERE signals.difficulty_score >= ?threshold AND last_batch_at >= NOW() - {window}
| SORT signals.difficulty_score DESC
| KEEP session_id, signals.difficulty_score, signals.dead_clicks, signals.rage_clicks,
       signals.repeated_submits, signals.checkout_abandoned, duration_ms,
       signals.backend_error, signals.high_api_latency
| LIMIT {limit}
"""


@dataclass
class SweptSession:
    session_id: str
    difficulty_score: float
    dead_clicks: int
    rage_clicks: int
    repeated_submits: int
    checkout_abandoned: bool
    duration_ms: int
    backend_error: bool = False
    high_api_latency: bool = False


def parse_window(window: str) -> str:
    """Turn '24h' or '7d' into an ES|QL duration literal such as '24 hours'."""
    units = {"m": "minutes", "h": "hours", "d": "days"}
    amount, unit = window[:-1], window[-1]
    if not amount.isdigit() or unit not in units:
        raise ValueError(f"window must look like 24h or 7d, got {window!r}")
    return f"{amount} {units[unit]}"


def sweep(client: Elasticsearch, threshold: float, window: str, limit: int) -> list[SweptSession]:
    query = SWEEP_QUERY.format(window=parse_window(window), limit=int(limit))
    response = client.esql.query(query=query, params=[{"threshold": threshold}])
    columns = [column["name"] for column in response["columns"]]
    swept = []
    for row in response["values"]:
        record = dict(zip(columns, row, strict=True))
        swept.append(
            SweptSession(
                session_id=record["session_id"],
                difficulty_score=record["signals.difficulty_score"],
                dead_clicks=record["signals.dead_clicks"] or 0,
                rage_clicks=record["signals.rage_clicks"] or 0,
                repeated_submits=record["signals.repeated_submits"] or 0,
                checkout_abandoned=bool(record["signals.checkout_abandoned"]),
                duration_ms=record["duration_ms"] or 0,
                backend_error=bool(record["signals.backend_error"]),
                high_api_latency=bool(record["signals.high_api_latency"]),
            )
        )
    return swept
