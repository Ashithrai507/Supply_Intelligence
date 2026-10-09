"""FROZEN contract models for the MedPredict Helpdesk (grounded Groq assistant).

The answer must rest on the verified rows in ``evidence``; the backend owns
``intent``, ``data_as_of`` and ``limitations``. Groq is only ever asked to
produce ``answer`` and ``suggested_questions`` inside a JSON object.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class HelpdeskRequest(BaseModel):
    """A natural-language question about this hospital's MedPredict data."""

    question: str = Field(min_length=1, max_length=1200)


class EvidenceRow(BaseModel):
    """A single verified record surfaced to the user in a table."""

    model_config = ConfigDict(extra="ignore")

    hospital: str = ""
    medicine: str = ""
    risk: str | None = None
    projected_stockout_date: str | None = None
    days_of_supply: float | None = None
    quantity: float | None = None
    total_quantity: float | None = None
    expected_daily_demand: float | None = None
    daily_demand: float | None = None
    supplier: str | None = None
    supplier_lead_time_days: int | None = None
    suggested_quantity: float | None = None
    expiry_date: str | None = None
    days_to_expiry: int | None = None
    potential_wastage: float | None = None
    urgency: str | None = None
    date: str | None = None
    predicted_demand: float | None = None
    is_forecast: bool = False
    reason: str | None = None
    detail: str | None = None


class HelpdeskResponse(BaseModel):
    """Verified answer with the evidence that supports it."""

    answer: str
    intent: str
    evidence: list[EvidenceRow] = Field(default_factory=list)
    data_as_of: str
    limitations: list[str] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)


class HelpdeskCapability(BaseModel):
    """One supported Helpdesk capability surfaced on the chat page."""

    intent: str
    description: str
    example_questions: list[str] = Field(default_factory=list)