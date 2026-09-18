from pathlib import Path

from eyewitness.config import aws_session, get_settings

PRESIGN_SECONDS = 7 * 24 * 3600
CONTENT_TYPES = {".webm": "video/webm", ".jpg": "image/jpeg", ".json": "application/json"}


def upload_file(path: Path, key: str) -> str:
    """Upload a file to the clips bucket and return a link that works for a week."""
    settings = get_settings()
    s3 = aws_session().client("s3")
    content_type = CONTENT_TYPES.get(path.suffix, "application/octet-stream")
    s3.upload_file(
        str(path), settings.s3_clips_bucket, key, ExtraArgs={"ContentType": content_type}
    )
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_clips_bucket, "Key": key},
        ExpiresIn=PRESIGN_SECONDS,
    )
