from dataclasses import dataclass

from elasticsearch import Elasticsearch

from eyewitness.bedrock import embed_text
from eyewitness.es.indices import INCIDENTS

# Raw cosine similarity, not Elasticsearch's transformed positive _score.
SIMILARITY_THRESHOLD = 0.85


@dataclass
class SimilarIncident:
    incident_id: str
    title: str
    status: str
    case_id: str | None
    resolution: str | None
    similarity: float
    status_code: int | None = None


def incident_text(title: str, page: str, summary: str) -> str:
    return f"{title}\nPage: {page}\n{summary}"


def embed_incident(title: str, page: str, summary: str) -> list[float]:
    return embed_text(incident_text(title, page, summary))


def find_similar(client: Elasticsearch, vector: list[float], k: int = 3) -> list[SimilarIncident]:
    response = client.search(
        index=INCIDENTS,
        knn={"field": "embedding", "query_vector": vector, "k": k, "num_candidates": 50},
        source=["incident_id", "title", "status", "case_id", "resolution", "status_code"],
        size=k,
    )
    similar = []
    for hit in response["hits"]["hits"]:
        source = hit["_source"]
        similar.append(
            SimilarIncident(
                incident_id=source["incident_id"],
                title=source["title"],
                status=source["status"],
                case_id=source.get("case_id"),
                resolution=source.get("resolution"),
                # The embedding mapping uses cosine and this is an unboosted kNN query:
                # Elasticsearch _score = (1 + cosine) / 2.
                similarity=2 * hit["_score"] - 1,
                status_code=source.get("status_code"),
            )
        )
    return similar


def _failure_class(status_code: int | None) -> int | None:
    """Separate client/server failures from sessions with no known backend failure."""
    if status_code is not None and 400 <= status_code < 600:
        return status_code // 100
    return None


def matching_incident(
    similar: list[SimilarIncident], *, status_code: int | None = None
) -> SimilarIncident | None:
    failure_class = _failure_class(status_code)
    for candidate in similar:
        if (
            _failure_class(candidate.status_code) == failure_class
            and candidate.similarity >= SIMILARITY_THRESHOLD
        ):
            return candidate
    return None
