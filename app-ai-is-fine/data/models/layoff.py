"""
AI Layoff Event model.

Tracks workforce reduction events where AI automation was cited as a cause
or contributing factor. The `jobs_lost` field drives the `total_jobs_lost`
counter displayed in the UI.

Counter contribution: total_incidents, layoff_events, total_jobs_lost.
"""

from typing import Literal

from pydantic import Field, field_validator

from .base import BaseIncident, IncidentType


class AILayoffEvent(BaseIncident):
    """
    A workforce reduction event linked to AI automation or restructuring.

    `ai_automation_confirmed` is True only when the company or a credible
    source explicitly cited AI/automation as the primary cause — not merely
    coincident with AI investment. This distinction matters for accurate
    causal attribution in the counter totals.
    """

    incident_type: Literal[IncidentType.LAYOFF] = IncidentType.LAYOFF  # type: ignore[assignment]

    sector: str = Field(
        description="Industry sector of the affected workforce, e.g. 'Technology', 'Finance'.",
    )
    jobs_lost: int = Field(
        ge=1,
        description="Confirmed or estimated headcount reduction. "
        "For phased cuts, use the total announced figure.",
    )
    ai_automation_confirmed: bool = Field(
        description="True if AI/automation was explicitly cited as a cause by the company "
        "or a primary source; False if AI is inferred or coincidental.",
    )
    severity: str | None = Field(
        default=None,
        description="Optional self-assessed severity label.",
    )
    jobs_lost_to_be_confirmed: bool | None = Field(
        default=None,
        description="True when the jobs_lost figure has not yet been formally agreed "
        "with unions or confirmed by the company — e.g. an ERE announced but still "
        "under negotiation. Null or False means the figure is confirmed.",
    )

    @field_validator("jobs_lost")
    @classmethod
    def jobs_must_be_positive(cls, v: int) -> int:
        """Jobs lost must represent at least one person."""
        if v < 1:
            raise ValueError("jobs_lost must be ≥ 1")
        return v

    def to_db_row(self) -> dict:
        """Promote type-specific fields to the JSONB metadata blob."""
        row = self._base_row()
        row["metadata"] = {
            "sector": self.sector,
            "jobs_lost": self.jobs_lost,
            "ai_automation_confirmed": self.ai_automation_confirmed,
            "severity": self.severity,
            "jobs_lost_to_be_confirmed": self.jobs_lost_to_be_confirmed,
        }
        return row
