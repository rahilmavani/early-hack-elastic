from functools import lru_cache

from elasticsearch import Elasticsearch

from eyewitness.config import get_settings


@lru_cache
def get_client() -> Elasticsearch:
    settings = get_settings()
    return Elasticsearch(settings.elastic_cloud_endpoint, api_key=settings.elastic_api_key)
