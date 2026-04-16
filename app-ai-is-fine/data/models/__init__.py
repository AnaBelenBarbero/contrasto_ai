"""
AI Incident Tracker — data models.

All four incident types share a common base and are unified under the
`AnyIncident` discriminated union, which Pydantic resolves via the
`incident_type` field.
"""

from typing import Annotated, Union

from pydantic import Field

from .ai_harm import AIHarmIncident
from .base import BaseIncident, IncidentType
from .layoff import AILayoffEvent
from .model_failure import ModelFailureIncident
from .regulatory import RegulatoryAction

AnyIncident = Annotated[
    Union[AIHarmIncident, AILayoffEvent, RegulatoryAction, ModelFailureIncident],
    Field(discriminator="incident_type"),
]

__all__ = [
    "BaseIncident",
    "IncidentType",
    "AIHarmIncident",
    "AILayoffEvent",
    "RegulatoryAction",
    "ModelFailureIncident",
    "AnyIncident",
]
