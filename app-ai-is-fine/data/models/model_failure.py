"""
Model Failure incident model.

Tracks events where an AI model behaved in an unintended, harmful, or
dangerously incorrect way — including hallucinations, outages, jailbreaks,
data leaks, and unsafe recommendations. The optional `users_affected` field
drives the `total_users_affected` counter.

Counter contribution: total_incidents, model_failures, total_users_affected.
"""

from typing import Literal

from pydantic import Field

from .base import BaseIncident, IncidentType

FAILURE_MODES = [
    "hallucination",
    "outage",
    "jailbreak",
    "data-leak",
    "unsafe-recommendation",
    "bias-output",
    "adversarial-manipulation",
    "other",
]


class ModelFailureIncident(BaseIncident):
    """
    An incident where an AI model produced dangerous, incorrect, or
    unintended outputs with measurable real-world impact.

    `failure_mode` classifies the mechanism of failure. Use values from
    FAILURE_MODES where applicable; additional free-form values are accepted.

    `users_affected` is None when impact is qualitative or unquantified.
    """

    incident_type: Literal[IncidentType.MODEL_FAILURE] = IncidentType.MODEL_FAILURE  # type: ignore[assignment]

    model_name: str = Field(
        description="Name of the AI model, e.g. 'GPT-4', 'Gemini Ultra', 'Sydney'.",
    )
    failure_mode: str = Field(
        description="Mechanism of failure (use FAILURE_MODES values where possible).",
    )
    users_affected: int | None = Field(
        default=None,
        ge=0,
        description="Estimated number of users impacted. None if unquantified.",
    )
    severity: str | None = Field(
        default=None,
        description="Optional self-assessed severity label.",
    )

    def to_db_row(self) -> dict:
        """Promote type-specific fields to the JSONB metadata blob."""
        row = self._base_row()
        row["metadata"] = {
            "model_name": self.model_name,
            "failure_mode": self.failure_mode,
            "users_affected": self.users_affected,
            "severity": self.severity,
        }
        return row
