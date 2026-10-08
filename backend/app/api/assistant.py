"""Assistant endpoint (project.md §13, §24). LLM lands in issue #17."""

from fastapi import APIRouter

from app.api._fixtures import load_fixture
from app.schemas.assistant import CopilotRequest, CopilotResponse

router = APIRouter()


@router.post("/query", response_model=CopilotResponse, summary="Ask the operations copilot (mock)")
def ask_assistant(body: CopilotRequest) -> dict:
    _ = body  # real LLM call (grounded on computed results) lands in issue #17
    return load_fixture("assistant")
