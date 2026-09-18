from unittest.mock import Mock

import pytest
from elasticsearch import Elasticsearch

from eyewitness.es.indices import INCIDENTS, index_mappings
from eyewitness.memory import SIMILARITY_THRESHOLD, find_similar, matching_incident


def search_client(*hits):
    client = Mock(spec=Elasticsearch)
    client.search.return_value = {"hits": {"hits": list(hits)}}
    return client


def incident_hit(
    score, incident_id="inc-silent-checkout", title="Checkout button does nothing", status_code=None
):
    return {
        "_score": score,
        "_source": {
            "incident_id": incident_id,
            "title": title,
            "status": "open",
            "case_id": f"case-{incident_id}",
            "resolution": None,
            "status_code": status_code,
        },
    }


@pytest.mark.parametrize("score, cosine", [(0, -1), (0.5, 0), (0.9, 0.8), (1, 1)])
def test_find_similar_exposes_cosine_instead_of_elasticsearch_score(score, cosine):
    client = search_client(incident_hit(score))
    candidates = find_similar(client, [1.0, 0.0])
    assert candidates[0].similarity == pytest.approx(cosine)
    # The score conversion only applies to this index's cosine mapping and pure kNN query.
    assert index_mappings(2)[INCIDENTS]["properties"]["embedding"]["similarity"] == "cosine"
    client.search.assert_called_once_with(
        index=INCIDENTS,
        knn={"field": "embedding", "query_vector": [1.0, 0.0], "k": 3, "num_candidates": 50},
        source=["incident_id", "title", "status", "case_id", "resolution", "status_code"],
        size=3,
    )


@pytest.mark.parametrize("score, matches", [(0.924999, False), (0.925, True), (0.925001, True)])
def test_matching_uses_inclusive_cosine_threshold(score, matches):
    assert SIMILARITY_THRESHOLD == 0.85
    candidates = find_similar(search_client(incident_hit(score)), [1.0, 0.0])
    assert (matching_incident(candidates) is not None) is matches


def test_distinct_checkout_failure_does_not_merge_on_positive_score_alone():
    # A gateway-timeout query can still be moderately similar to a dead checkout button.
    # ES score .90 means cosine .80, which should not merge these incidents.
    candidates = find_similar(search_client(incident_hit(0.90)), [0.8, 0.6])
    assert matching_incident(candidates) is None


def test_repeated_gateway_failure_matches_its_case_not_other_checkout_failure():
    client = search_client(
        incident_hit(0.995),
        incident_hit(0.985, "inc-payment-timeout", "Payment gateway timed out", status_code=504),
    )
    candidates = find_similar(client, [1.0, 0.0])
    match = matching_incident(candidates, status_code=504)
    assert match is not None
    assert match.incident_id == "inc-payment-timeout"
    assert match.case_id == "case-inc-payment-timeout"
    assert match.similarity == pytest.approx(0.97)
    assert match.status_code == 504


@pytest.mark.parametrize(
    "current_status, previous_status",
    [(504, None), (504, 200), (504, 302), (504, 400), (404, 503), (None, 504)],
)
def test_incompatible_backend_evidence_rejects_even_identical_embeddings(
    current_status, previous_status
):
    candidates = find_similar(
        search_client(incident_hit(1, status_code=previous_status)), [1.0, 0.0]
    )
    assert matching_incident(candidates, status_code=current_status) is None


@pytest.mark.parametrize(
    "current_status, previous_status",
    [(None, None), (None, 200), (302, None), (200, 302), (504, 503), (401, 403)],
)
def test_same_backend_evidence_class_can_match(current_status, previous_status):
    candidates = find_similar(
        search_client(incident_hit(0.985, status_code=previous_status)), [1.0, 0.0]
    )
    assert matching_incident(candidates, status_code=current_status) is candidates[0]


def test_same_backend_failure_still_requires_cosine_threshold():
    candidates = find_similar(search_client(incident_hit(0.9, status_code=504)), [1.0, 0.0])
    assert matching_incident(candidates, status_code=504) is None


def test_legacy_incident_without_status_code_matches_unknown_evidence():
    hit = incident_hit(0.985)
    del hit["_source"]["status_code"]
    candidates = find_similar(search_client(hit), [1.0, 0.0])
    assert candidates[0].status_code is None
    assert matching_incident(candidates) is candidates[0]


def test_no_incidents_means_no_match():
    assert matching_incident(find_similar(search_client(), [1.0, 0.0])) is None
