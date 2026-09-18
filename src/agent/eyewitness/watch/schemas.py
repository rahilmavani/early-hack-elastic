from typing import Literal

from pydantic import BaseModel, Field


class TriageResult(BaseModel):
    broken: bool = Field(
        description="True only if the user visibly failed to do what they were trying to do."
    )
    confidence: float = Field(ge=0, le=1)
    reason: str = Field(description="One or two sentences grounded in specific frames.")


class PlainLanguage(BaseModel):
    """The finding retold for someone who has ten seconds and no engineering background."""

    headline: str = Field(
        description=(
            "Plain-English headline under 60 characters, no jargon, no component names. "
            "Example: 'Bag total doesn't update when quantity changes'."
        )
    )
    step_tried: str = Field(
        description=(
            "What the user tried, under 50 characters. Example: 'Added more jeans to the bag'."
        )
    )
    step_expected: str = Field(
        description="What should have happened, under 50 characters. Example: 'Total goes up'."
    )
    step_got: str = Field(
        description=(
            "What happened instead, under 60 characters, the single most visible fact. "
            "Example: 'Total stayed at ₹3,799'."
        )
    )


class ExtractionResult(BaseModel):
    title: str = Field(description="Short incident title, under 80 characters.")
    headline: str | None = Field(
        default=None, description=PlainLanguage.model_fields["headline"].description
    )
    step_tried: str | None = Field(
        default=None, description=PlainLanguage.model_fields["step_tried"].description
    )
    step_expected: str | None = Field(
        default=None, description=PlainLanguage.model_fields["step_expected"].description
    )
    step_got: str | None = Field(
        default=None, description=PlainLanguage.model_fields["step_got"].description
    )
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
