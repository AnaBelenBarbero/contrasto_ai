"""
Unit tests for AI Incident Tracker data models.

Tests cover:
- Model instantiation and field validation for all four incident types
- `to_db_row()` serialisation: correct structure and metadata promotion
- Discriminated union resolution via `AnyIncident`
- Field validators (jobs_lost ≥ 1, fine_amount_usd ≥ 0)
"""

import datetime
import json

import pytest
from pydantic import ValidationError

from models import (
    AIHarmIncident,
    AILayoffEvent,
    AnyIncident,
    ModelFailureIncident,
    RegulatoryAction,
)
from models.base import IncidentType


# ── Shared fixtures ────────────────────────────────────────────────────────────

BASE_FIELDS = {
    "id": "test-incident-001",
    "date": datetime.date(2024, 1, 15),
    "title": "Test incident title",
    "description": "A detailed description of the test incident.",
    "source": "Test Source",
    "links": ["https://example.com/source"],
    "tags": ["test", "example"],
    "countries": ["US"],
    "companies": ["Acme Corp"],
    "image_url": None,
}


# ── AIHarmIncident ─────────────────────────────────────────────────────────────

class TestAIHarmIncident:
    def test_instantiation(self) -> None:
        """Basic harm incident can be created with required fields."""
        incident = AIHarmIncident(
            **BASE_FIELDS,
            harm_categories=["bias", "discrimination"],
            affected_population="Women in hiring process",
            aiid_id="AIID-100",
            severity="high",
        )
        assert incident.incident_type == IncidentType.AI_HARM
        assert incident.harm_categories == ["bias", "discrimination"]
        assert incident.aiid_id == "AIID-100"

    def test_optional_fields_default_to_none(self) -> None:
        """aiid_id and severity are optional and default to None."""
        incident = AIHarmIncident(
            **BASE_FIELDS,
            harm_categories=["safety"],
            affected_population="General public",
        )
        assert incident.aiid_id is None
        assert incident.severity is None

    def test_to_db_row_structure(self) -> None:
        """to_db_row() puts harm-specific fields inside the metadata dict."""
        incident = AIHarmIncident(
            **BASE_FIELDS,
            harm_categories=["bias"],
            affected_population="Loan applicants",
            aiid_id="AIID-200",
            severity="medium",
        )
        row = incident.to_db_row()

        assert row["incident_type"] == "ai_harm"
        assert row["date"] == "2024-01-15"
        assert isinstance(row["metadata"], dict)
        assert row["metadata"]["harm_categories"] == ["bias"]
        assert row["metadata"]["affected_population"] == "Loan applicants"
        assert row["metadata"]["aiid_id"] == "AIID-200"
        assert row["metadata"]["severity"] == "medium"

        # Type-specific fields must NOT appear at top level
        assert "harm_categories" not in row
        assert "affected_population" not in row

    def test_to_db_row_contains_all_base_columns(self) -> None:
        """to_db_row() includes every base column the DB expects."""
        incident = AIHarmIncident(
            **BASE_FIELDS,
            harm_categories=["privacy"],
            affected_population="Platform users",
        )
        row = incident.to_db_row()
        required_columns = {
            "id", "date", "title", "description", "incident_type",
            "links", "tags", "source", "countries", "companies",
            "image_url", "metadata",
        }
        assert required_columns.issubset(row.keys())


# ── AILayoffEvent ──────────────────────────────────────────────────────────────

class TestAILayoffEvent:
    def test_instantiation(self) -> None:
        """Layoff event can be created with required fields."""
        incident = AILayoffEvent(
            **BASE_FIELDS,
            sector="Technology",
            jobs_lost=5000,
            ai_automation_confirmed=True,
        )
        assert incident.incident_type == IncidentType.LAYOFF
        assert incident.jobs_lost == 5000
        assert incident.ai_automation_confirmed is True

    def test_jobs_lost_must_be_positive(self) -> None:
        """jobs_lost must be ≥ 1."""
        with pytest.raises(ValidationError, match="greater than or equal to 1"):
            AILayoffEvent(
                **BASE_FIELDS,
                sector="Technology",
                jobs_lost=0,
                ai_automation_confirmed=False,
            )

    def test_to_db_row_metadata(self) -> None:
        """to_db_row() places layoff-specific fields in metadata."""
        incident = AILayoffEvent(
            **BASE_FIELDS,
            sector="Finance",
            jobs_lost=1200,
            ai_automation_confirmed=True,
            severity="high",
        )
        row = incident.to_db_row()
        assert row["incident_type"] == "layoff"
        assert row["metadata"]["jobs_lost"] == 1200
        assert row["metadata"]["sector"] == "Finance"
        assert row["metadata"]["ai_automation_confirmed"] is True
        assert "jobs_lost" not in row


# ── RegulatoryAction ───────────────────────────────────────────────────────────

class TestRegulatoryAction:
    def test_instantiation_with_fine(self) -> None:
        """Regulatory action with a fine can be created."""
        incident = RegulatoryAction(
            **BASE_FIELDS,
            regulator="CNIL",
            fine_amount_usd=5_000_000.0,
            regulation_violated="GDPR Art. 5",
        )
        assert incident.incident_type == IncidentType.REGULATORY
        assert incident.fine_amount_usd == 5_000_000.0

    def test_instantiation_without_fine(self) -> None:
        """Regulatory action without a fine (investigation/warning)."""
        incident = RegulatoryAction(
            **BASE_FIELDS,
            regulator="FTC",
            fine_amount_usd=None,
            regulation_violated="FTC Act Section 5",
        )
        assert incident.fine_amount_usd is None

    def test_negative_fine_rejected(self) -> None:
        """Negative fine amounts are not valid."""
        with pytest.raises(ValidationError, match="greater than or equal to 0"):
            RegulatoryAction(
                **BASE_FIELDS,
                regulator="FTC",
                fine_amount_usd=-1.0,
                regulation_violated="FTC Act",
            )

    def test_to_db_row_metadata(self) -> None:
        """to_db_row() places regulatory fields in metadata."""
        incident = RegulatoryAction(
            **BASE_FIELDS,
            regulator="ICO",
            fine_amount_usd=10_000_000.0,
            regulation_violated="UK GDPR",
        )
        row = incident.to_db_row()
        assert row["incident_type"] == "regulatory"
        assert row["metadata"]["regulator"] == "ICO"
        assert row["metadata"]["fine_amount_usd"] == 10_000_000.0
        assert row["metadata"]["regulation_violated"] == "UK GDPR"


# ── ModelFailureIncident ───────────────────────────────────────────────────────

class TestModelFailureIncident:
    def test_instantiation(self) -> None:
        """Model failure can be created with required fields."""
        incident = ModelFailureIncident(
            **BASE_FIELDS,
            model_name="GPT-4",
            failure_mode="hallucination",
            users_affected=50_000,
        )
        assert incident.incident_type == IncidentType.MODEL_FAILURE
        assert incident.model_name == "GPT-4"
        assert incident.users_affected == 50_000

    def test_users_affected_optional(self) -> None:
        """users_affected is optional and defaults to None."""
        incident = ModelFailureIncident(
            **BASE_FIELDS,
            model_name="Claude",
            failure_mode="unsafe-recommendation",
        )
        assert incident.users_affected is None

    def test_to_db_row_metadata(self) -> None:
        """to_db_row() places model failure fields in metadata."""
        incident = ModelFailureIncident(
            **BASE_FIELDS,
            model_name="Gemini",
            failure_mode="bias-output",
            users_affected=200_000,
            severity="high",
        )
        row = incident.to_db_row()
        assert row["incident_type"] == "model_failure"
        assert row["metadata"]["model_name"] == "Gemini"
        assert row["metadata"]["failure_mode"] == "bias-output"
        assert row["metadata"]["users_affected"] == 200_000


# ── AnyIncident discriminated union ───────────────────────────────────────────

class TestAnyIncidentUnion:
    def test_resolves_ai_harm(self) -> None:
        """AnyIncident resolves to AIHarmIncident when incident_type is ai_harm."""
        from pydantic import TypeAdapter

        adapter = TypeAdapter(AnyIncident)
        data = {
            **BASE_FIELDS,
            "date": "2024-01-15",
            "incident_type": "ai_harm",
            "harm_categories": ["bias"],
            "affected_population": "Test population",
        }
        incident = adapter.validate_python(data)
        assert isinstance(incident, AIHarmIncident)

    def test_resolves_layoff(self) -> None:
        """AnyIncident resolves to AILayoffEvent when incident_type is layoff."""
        from pydantic import TypeAdapter

        adapter = TypeAdapter(AnyIncident)
        data = {
            **BASE_FIELDS,
            "date": "2024-01-15",
            "incident_type": "layoff",
            "sector": "Technology",
            "jobs_lost": 1000,
            "ai_automation_confirmed": True,
        }
        incident = adapter.validate_python(data)
        assert isinstance(incident, AILayoffEvent)

    def test_resolves_regulatory(self) -> None:
        """AnyIncident resolves to RegulatoryAction when incident_type is regulatory."""
        from pydantic import TypeAdapter

        adapter = TypeAdapter(AnyIncident)
        data = {
            **BASE_FIELDS,
            "date": "2024-01-15",
            "incident_type": "regulatory",
            "regulator": "FTC",
            "regulation_violated": "FTC Act",
        }
        incident = adapter.validate_python(data)
        assert isinstance(incident, RegulatoryAction)

    def test_resolves_model_failure(self) -> None:
        """AnyIncident resolves to ModelFailureIncident when incident_type is model_failure."""
        from pydantic import TypeAdapter

        adapter = TypeAdapter(AnyIncident)
        data = {
            **BASE_FIELDS,
            "date": "2024-01-15",
            "incident_type": "model_failure",
            "model_name": "GPT-4",
            "failure_mode": "hallucination",
        }
        incident = adapter.validate_python(data)
        assert isinstance(incident, ModelFailureIncident)

    def test_unknown_type_raises(self) -> None:
        """AnyIncident rejects unknown incident_type values."""
        from pydantic import TypeAdapter, ValidationError

        adapter = TypeAdapter(AnyIncident)
        data = {
            **BASE_FIELDS,
            "date": "2024-01-15",
            "incident_type": "unknown_type",
        }
        with pytest.raises(ValidationError):
            adapter.validate_python(data)


# ── Round-trip serialisation ───────────────────────────────────────────────────

class TestSerialisationRoundTrip:
    def test_db_row_is_json_serialisable(self) -> None:
        """to_db_row() output must be JSON-serialisable for Supabase REST."""
        incident = AILayoffEvent(
            **BASE_FIELDS,
            sector="Technology",
            jobs_lost=3000,
            ai_automation_confirmed=True,
        )
        row = incident.to_db_row()
        serialised = json.dumps(row)
        assert isinstance(serialised, str)
        parsed = json.loads(serialised)
        assert parsed["metadata"]["jobs_lost"] == 3000

    def test_date_is_isoformat_string_in_db_row(self) -> None:
        """Dates must be ISO-8601 strings in to_db_row() for Supabase REST."""
        incident = AIHarmIncident(
            **BASE_FIELDS,
            harm_categories=["safety"],
            affected_population="Children",
        )
        row = incident.to_db_row()
        assert isinstance(row["date"], str)
        assert row["date"] == "2024-01-15"
