"""
Base incident model shared across all four incident types.

Actuarial note: every incident, regardless of type, contributes to
`total_incidents`. Type-specific risk metrics (jobs_lost, fine_amount_usd,
etc.) are defined on subclasses and serialised to the JSONB `metadata`
column in Supabase via `to_db_row()`.
"""

import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class IncidentType(str, Enum):
    """
    Discriminator enum for the four AI incident categories.

    Used as a Literal type annotation on each subclass so Pydantic can
    resolve the correct model from the `AnyIncident` union.
    """

    AI_HARM = "ai_harm"
    LAYOFF = "layoff"
    REGULATORY = "regulatory"
    MODEL_FAILURE = "model_failure"


class BaseIncident(BaseModel):
    """
    Fields present on every incident row in the `incidents` table.

    These map 1-to-1 to non-metadata columns. Type-specific risk fields
    (jobs_lost, fine_amount_usd, harm_categories, etc.) live on subclasses
    and are promoted to the JSONB `metadata` column by `to_db_row()`.

    Design principle: keep the shared schema stable so the frontend can
    display a useful card for any incident without knowing its type; only
    the type-specific section of each card card needs `metadata`.
    """

    model_config = ConfigDict(use_enum_values=True)

    id: str = Field(
        description="Stable slug, e.g. 'google-layoffs-2023-01'. Used as PK in Supabase.",
    )
    date: datetime.date = Field(
        description="Date the incident became publicly known (ISO-8601).",
    )
    title: str = Field(
        description="Short headline suitable for card display (≤ 120 chars).",
    )
    description: str = Field(
        description="1–4 paragraph narrative. Plain text; no markdown.",
    )
    incident_type: IncidentType = Field(
        description="Overridden as Literal[...] on each subclass for union discrimination.",
    )
    links: list[str] = Field(
        default_factory=list,
        description="Source URLs. First entry is treated as the primary source.",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Free-form topic tags, lower-kebab-case, e.g. ['big-tech', 'bias'].",
    )
    source: str = Field(
        description="Primary attribution label, e.g. 'Reuters', 'FTC press release'.",
    )
    countries: list[str] = Field(
        default_factory=list,
        description="ISO-3166-1 alpha-2 country codes for all affected/involved jurisdictions.",
    )
    companies: list[str] = Field(
        default_factory=list,
        description="All implicated organisations (both actors and victims), de-duplicated.",
    )
    image_url: str | None = Field(
        default=None,
        description="Optional card illustration. Use picsum or Unsplash for placeholders.",
    )

    # ── Serialisation helpers ────────────────────────────────────────────────

    def _base_row(self) -> dict:
        """
        Return a dict of columns that map directly to the DB table.

        Excludes type-specific fields; those are added by subclass `to_db_row()`.
        The `date` field is serialised to an ISO-8601 string for Supabase REST.
        """
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "title": self.title,
            "description": self.description,
            "incident_type": (
                self.incident_type.value
                if hasattr(self.incident_type, "value")
                else self.incident_type
            ),
            "links": self.links,
            "tags": self.tags,
            "source": self.source,
            "countries": self.countries,
            "companies": self.companies,
            "image_url": self.image_url,
        }

    def to_db_row(self) -> dict:
        """
        Serialise for Supabase upsert.

        Base implementation writes an empty metadata dict. Subclasses override
        this method to populate `metadata` with their type-specific fields.
        """
        return {**self._base_row(), "metadata": {}}
