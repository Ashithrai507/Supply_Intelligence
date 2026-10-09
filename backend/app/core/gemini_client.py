"""Grounded Gemini client for the MedPredict Helpdesk.

Thin transport wrapper around ``google-genai``. The Helpdesk service owns the
two-turn function-calling loop; this module only builds the client, assembles
tool declarations, and executes the ``generate_content`` calls. Tests can
monkeypatch ``build_client`` and ``run_grounded_query`` here without any
network access.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from google.genai import Client, types

from app.core.config import settings


class GeminiUnavailableError(Exception):
    """Gemini API is not configured, unreachable, or failed mid-request."""


def build_client() -> Client:
    """Return a Gemini client backed by the configured API key."""
    if not settings.GEMINI_API_KEY:
        raise GeminiUnavailableError("GEMINI_API_KEY is not configured")
    return Client(api_key=settings.GEMINI_API_KEY)


def build_function_declaration(
    name: str,
    description: str,
    parameters: dict[str, Any],
) -> types.FunctionDeclaration:
    """Build a Gemini FunctionDeclaration from a JSON-schema-style dict."""
    return types.FunctionDeclaration(
        name=name,
        description=description,
        parameters=types.Schema(**parameters),
    )


def _answer_schema() -> dict[str, Any]:
    return {
        "type": "OBJECT",
        "properties": {
            "answer": {"type": "STRING"},
            "suggested_questions": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
            },
        },
        "required": ["answer", "suggested_questions"],
    }


def _function_call(parts: list[types.Part]) -> types.FunctionCall | None:
    for part in parts:
        if part.function_call is not None:
            return part.function_call
    return None


def run_grounded_query(
    client: Client,
    model: str,
    system_instruction: str,
    question: str,
    tools: list[types.Tool],
    handler: Callable[[str, dict[str, Any]], dict[str, Any]],
) -> tuple[str | None, str | None, dict[str, Any] | None]:
    """Run the two-turn grounded query loop.

    Turn 1 asks the model to pick a tool. If it returns a function call, the
    ``handler`` executes the approved, validated tool (against the real DB and
    scoped to the caller's hospital) and its sanitized result is returned to
    the model on turn 2. If the model answers directly (no tool call), that
    text is returned as-is.

    Returns ``(final_text, invoked_tool_name, invoked_tool_result)``.
    Raises ``GeminiUnavailableError`` for transport/model failures.
    """
    try:
        turn1 = client.models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=[types.Part(text=question)])],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools,
                response_mime_type="application/json",
            ),
        )
        candidate = (turn1.candidates or [None])[0]
        if candidate is None or candidate.content is None:
            raise GeminiUnavailableError("Gemini returned no candidate")

        fcall = _function_call(candidate.content.parts)
        if fcall is None:
            return turn1.text, None, None

        args = dict(fcall.args) if fcall.args else {}
        result = handler(fcall.name, args)

        history = [
            types.Content(role="user", parts=[types.Part(text=question)]),
            candidate.content,
            types.Content(
                role="tool",
                parts=[
                    types.Part(
                        function_response=types.FunctionResponse(
                            id=fcall.id or "",
                            name=fcall.name,
                            response=result,
                        )
                    )
                ],
            ),
        ]
        turn2 = client.models.generate_content(
            model=model,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools,
                response_mime_type="application/json",
                response_schema=_answer_schema(),
            ),
        )
        return turn2.text, fcall.name, result
    except GeminiUnavailableError:
        raise
    except Exception as exc:
        raise GeminiUnavailableError(f"Gemini request failed: {exc}") from exc