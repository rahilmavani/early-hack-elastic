from dataclasses import dataclass

from elasticsearch import Elasticsearch

from eyewitness.bedrock import embed_text
from eyewitness.es.indices import INCIDENTS

SIMILARITY_THRESHOLD = 0.85


@dataclass
class SimilarIncident:
    incident_id: str
    title: str
    status: str
    case_id: str | None
    resolution: str | None
    similarity: float


def incident_text(title: str, page: str, summary: str) -> str:
    return f"{title}\nPage: {page}\n{summary}"


def embed_incident(title: str, page: str, summary: str) -> list[float]:
    return embed_text(incident_text(title, page, summary))


def find_similar(client: Elasticsearch, vector: list[float], k: int = 3) -> list[SimilarIncident]:
    response = client.search(
        index=INCIDENTS,
        knn={"field": "embedding", "query_vector": vector, "k": k, "num_candidates": 50},
        source=["incident_id", "title", "status", "case_id", "resolution"],
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
                similarity=hit["_score"],
            )
        )
    return similar


def matching_incident(similar: list[SimilarIncident]) -> SimilarIncident | None:
    for candidate in similar:
        if candidate.similarity >= SIMILARITY_THRESHOLD:
            return candidate
    return None
