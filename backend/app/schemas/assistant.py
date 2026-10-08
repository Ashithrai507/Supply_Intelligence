"""Assistant / copilot schemas (project.md §24, issue #17)."""

from pydantic import BaseModel, Field

from app.schemas.common import ScenarioName


class CopilotRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    scenario: ScenarioName = "normal"


class CopilotResponse(BaseModel):
    answer: str
    citations: list[str]  # context-JSON keys the answer drew from
