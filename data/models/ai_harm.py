"""
AI Harm incident model.

Tracks events where an AI system caused measurable harm — including bias,
privacy violations, safety failures, manipulation, and loss of autonomy.
Aligned with the taxonomy used by the MIT AI Incident Database (AIID).

Counter contribution: total_incidents, harm_incidents.
"""

from typing import Literal

from pydantic import Field

from .base import BaseIncident, IncidentType

HARM_CATEGORIES = [
    "bias",
    "privacy",
    "safety",
    "manipulation",
    "autonomy",
    "misinformation",
    "copyright",
    "discrimination",
    "security",
    "other",
]


class AIHarmIncident(BaseIncident):
    """
    An incident where an AI system caused or contributed to measurable harm.

    `harm_categories` should use values from HARM_CATEGORIES where possible;
    additional free-form values are accepted for novel harm types.

    `aiid_id` links to the MIT AI Incident Database entry, e.g. 'AIID-146'.
    Leave None if the incident is not yet catalogued in AIID.
    """

    incident_type: Literal[IncidentType.AI_HARM] = IncidentType.AI_HARM  # type: ignore[assignment]

    harm_categories: list[str] = Field(
        description="Harm taxonomy labels (use HARM_CATEGORIES values where possible).",
    )
    affected_population: str = Field(
        description="Plain-language description of who was harmed, e.g. "
        "'Black defendants in US criminal courts'.",
    )
    aiid_id: str | None = Field(
        default=None,
        description="MIT AIID reference, e.g. 'AIID-146'. None if not yet catalogued.",
    )
    severity: str | None = Field(
        default=None,
        description="Optional self-assessed label (no enforced taxonomy). "
        "E.g. 'high', 'systemic', 'contained'.",
    )

    def to_db_row(self) -> dict:
        """Promote type-specific fields to the JSONB metadata blob."""
        row = self._base_row()
        row["metadata"] = {
            "harm_categories": self.harm_categories,
            "affected_population": self.affected_population,
            "aiid_id": self.aiid_id,
            "severity": self.severity,
        }
        return row
