from typing import Literal

from pydantic import BaseModel, Field


class TriageResult(BaseModel):
    broken: bool = Field(
        description="True only if the user visibly failed to do what they were trying to do."
    )
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(description="One or two sentences grounded in specific frames.")


class ExtractionResult(BaseModel):
    title: str = Field(description="Short incident title, under 80 characters.")
    page: str = Field(description="Path of the page where it broke, e.g. /checkout.")
    user_intent: str = Field(description="What the user was trying to do.")
    expected: str = Field(description="What should have happened.")
    observed: str = Field(description="What actually happened on screen.")
    failing_second: int = Field(
        ge=0, description="Second in the clip where the failure is first visible."
    )
    evidence_seconds: list[int] = Field(description="Frame seconds that prove the failure.")
    summary: str = Field(description="Two to four sentences an engineer can act on.")


class ReviewResult(BaseModel):
    verdict: Literal["confirm", "reject"]
    counterargument: str = Field(description="The strongest case that this is not a real failure.")
    confidence: float = Field(ge=0, le=1, description="Confidence in the verdict.")


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0

    def add(self, other: "Usage") -> "Usage":
        return Usage(
            input_tokens=self.input_tokens + other.input_tokens,
            output_tokens=self.output_tokens + other.output_tokens,
        )


class WatchResult(BaseModel):
    session_id: str
    stage_reached: Literal["triage", "extract", "review"]
    confirmed: bool
    triage: TriageResult
    extraction: ExtractionResult | None = None
    review: ReviewResult | None = None
    usage: Usage
