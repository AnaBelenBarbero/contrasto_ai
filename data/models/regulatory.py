"""
Regulatory Action model.

Tracks enforcement actions, fines, bans, and investigations by government
bodies or regulators related to AI systems. The optional `fine_amount_usd`
field drives the `total_fines_usd` counter in the UI.

Counter contribution: total_incidents, regulatory_actions, total_fines_usd.
"""

from typing import Literal

from pydantic import Field, field_validator

from .base import BaseIncident, IncidentType


class RegulatoryAction(BaseIncident):
    """
    An enforcement action, fine, ban, or investigation by a regulator.

    `fine_amount_usd` is None for investigations, warnings, or bans where
    no monetary penalty was issued. Amounts in non-USD currencies should be
    converted at the exchange rate on the date of the fine.

    `regulation_violated` should name the specific law or regulation,
    e.g. 'GDPR Art. 5', 'EU AI Act Art. 10', 'FTC Act Section 5'.
    """

    incident_type: Literal[IncidentType.REGULATORY] = IncidentType.REGULATORY  # type: ignore[assignment]

    regulator: str = Field(
        description="Name of the regulating body, e.g. 'CNIL', 'FTC', 'ICO', 'AEPD'.",
    )
    fine_amount_usd: float | None = Field(
        default=None,
        ge=0,
        description="Monetary penalty in USD. None for investigations/warnings without fines. "
        "Convert non-USD amounts at the date-of-fine exchange rate.",
    )
    regulation_violated: str = Field(
        description="Specific law or regulation cited, e.g. 'GDPR', 'EU AI Act', 'CCPA'.",
    )
    severity: str | None = Field(
        default=None,
        description="Optional self-assessed severity label.",
    )

    @field_validator("fine_amount_usd")
    @classmethod
    def fine_must_be_non_negative(cls, v: float | None) -> float | None:
        """Fines cannot be negative; use None to indicate no penalty."""
        if v is not None and v < 0:
            raise ValueError("fine_amount_usd must be ≥ 0 or None")
        return v

    def to_db_row(self) -> dict:
        """Promote type-specific fields to the JSONB metadata blob."""
        row = self._base_row()
        row["metadata"] = {
            "regulator": self.regulator,
            "fine_amount_usd": self.fine_amount_usd,
            "regulation_violated": self.regulation_violated,
            "severity": self.severity,
        }
        return row
