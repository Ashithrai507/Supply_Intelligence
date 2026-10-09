"""Grounded Groq client for the MedPredict Helpdesk.

Thin transport wrapper around Groq's OpenAI-compatible chat API (via httpx —
no vendor SDK needed). The Helpdesk service owns the two-turn function-calling
loop; this module only builds the client, assembles OpenAI-style tool
definitions, and executes the ``chat/completions`` calls. Tests can
monkeypatch ``build_client`` and ``run_grounded_query`` here without any
network access.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqUnavailableError(Exception):
    """Groq API is not configured, unreachable, or failed mid-request."""


@dataclass
class GroqClient:
    """Minimal authenticated handle for Groq chat requests."""

    api_key: str
    timeout_seconds: float = 60.0


def build_client() -> GroqClient:
    """Return a Groq client backed by the configured API key."""
    if not settings.GROQ_API_KEY:
        raise GroqUnavailableError("GROQ_API_KEY is not configured")
    return GroqClient(api_key=settings.GROQ_API_KEY)


def _lower_types(node: Any) -> Any:
    """Recursively lowercase JSON-schema type names (OBJECT→object, …)."""
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for key, value in node.items():
            out[key] = value.lower() if key == "type" and isinstance(value, str) else _lower_types(value)
        return out
    if isinstance(node, list):
        return [_lower_types(item) for item in node]
    return node


def build_function_declaration(
    name: str,
    description: str,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    """Build an OpenAI-style function tool from a JSON-schema-style dict."""
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": _lower_types(parameters),
        },
    }


def _answer_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "answer": {"type": "string"},
            "suggested_questions": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["answer", "suggested_questions"],
    }


def _post(client: GroqClient, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        response = httpx.post(
            GROQ_API_URL,
            headers={
                "Authorization": f"Bearer {client.api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=client.timeout_seconds,
        )
    except Exception as exc:
        raise GroqUnavailableError(f"Groq request failed: {exc}") from exc
    if response.status_code == 401:
        raise GroqUnavailableError("Groq rejected the API key (401)")
    if response.status_code == 429:
        raise GroqUnavailableError("Groq rate limit exceeded (429)")
    if response.status_code >= 400:
        raise GroqUnavailableError(f"Groq API error {response.status_code}: {response.text[:200]}")
    try:
        return response.json()
    except Exception as exc:
        raise GroqUnavailableError(f"Groq returned non-JSON: {exc}") from exc


def run_grounded_query(
    client: GroqClient,
    model: str,
    system_instruction: str,
    question: str,
    tools: list[dict[str, Any]],
    handler: Callable[[str, dict[str, Any]], dict[str, Any]],
) -> tuple[str | None, str | None, dict[str, Any] | None]:
    """Run the two-turn grounded query loop.

    Turn 1 asks the model to pick a tool. If it returns tool calls, the
    ``handler`` executes the approved, validated tool (against the real DB and
    scoped to the caller's hospital) and its sanitized result is returned to
    the model on turn 2, which must answer in the fixed JSON shape. If the
    model answers directly (no tool call), that text is returned as-is.

    Returns ``(final_text, invoked_tool_name, invoked_tool_result)``.
    Raises ``GroqUnavailableError`` for transport/model failures.
    """
    turn1 = _post(
        client,
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": question},
            ],
            "tools": tools,
            "tool_choice": "auto",
        },
    )
    try:
        message = turn1["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as exc:
        raise GroqUnavailableError("Groq returned no message") from exc

    tool_calls = message.get("tool_calls") or []
    if not tool_calls:
        return message.get("content"), None, None

    first_call = tool_calls[0]
    func = first_call.get("function", {})
    name = func.get("name", "")
    try:
        args = json.loads(func.get("arguments") or "{}")
    except json.JSONDecodeError:
        args = {}
    if not isinstance(args, dict):
        args = {}
    result = handler(name, args)

    turn2 = _post(
        client,
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": question},
                {
                    "role": "assistant",
                    "content": message.get("content"),
                    "tool_calls": [
                        {
                            "id": first_call.get("id", "call_0"),
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": json.dumps(args),
                            },
                        }
                    ],
                },
                {
                    "role": "tool",
                    "tool_call_id": first_call.get("id", "call_0"),
                    "content": json.dumps(result),
                },
            ],
            "tools": tools,
            "tool_choice": "none",
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "helpdesk_answer", "schema": _answer_schema()},
            },
        },
    )
    try:
        text = turn2["choices"][0]["message"].get("content")
    except (KeyError, IndexError, TypeError) as exc:
        raise GroqUnavailableError("Groq returned no answer") from exc
    return text, name, result
