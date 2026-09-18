from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / ".data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    elastic_cloud_endpoint: str
    elastic_api_key: str
    kibana_url: str = ""
    kibana_case_owner: Literal["observability", "cases", "securitySolution"] = "observability"

    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    bedrock_vision_model_id: str = ""
    bedrock_embedding_model_id: str = ""
    embedding_dimensions: int = 1024
    s3_clips_bucket: str = ""

    sarvam_api_key: str = ""

    storefront_url: str = "http://localhost:3000"
    ingest_host: str = "127.0.0.1"
    ingest_port: int = 8100


@lru_cache
def get_settings() -> Settings:
    return Settings()


def aws_session():
    """A boto3 session using the keys from .env, falling back to the ambient AWS config."""
    import boto3

    settings = get_settings()
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        return boto3.Session(
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
    return boto3.Session(region_name=settings.aws_region)
