from pydantic import BaseModel, Field


class ReplayBatch(BaseModel):
    session_id: str = Field(alias="sessionId", pattern=r"^[A-Za-z0-9-]{8,64}$")
    sent_at: str = Field(alias="sentAt")
    events: list[dict]


class ServerEvent(BaseModel):
    session_id: str = Field(alias="sessionId", pattern=r"^[A-Za-z0-9-]{8,64}$")
    trace_id: str = Field(alias="traceId")
    timestamp: str
    route: str
    method: str
    status: int
    duration_ms: int = Field(alias="durationMs")
