"""Shared data contracts for the investigation pipeline and API."""

from enum import Enum

from pydantic import BaseModel, Field


class InvestigationType(str, Enum):
    url = "url"
    message = "message"
    screenshot = "screenshot"


class EvidenceStatus(str, Enum):
    confirmed = "confirmed"  # confirmed malicious finding
    suspicious = "suspicious"
    verified = "verified"
    unverified = "unverified"
    contradictory = "contradictory"
    missing = "missing"  # check failed or data unavailable; never counts as clean


class Category(str, Enum):
    threat_intel = "threat_intel"
    identity = "identity"
    url_domain = "url_domain"
    content = "content"
    context = "context"


class Evidence(BaseModel):
    id: str
    category: Category
    finding: str
    why_it_matters: str
    status: EvidenceStatus
    source: str
    raw: dict = Field(default_factory=dict)


class RiskBand(str, Enum):
    low = "Low Risk"
    moderate = "Moderate Risk"
    high = "High Risk"
    unknown = "Unknown Risk"


class HealthResponse(BaseModel):
    status: str
    version: str
    ai_provider: str
    offline_demo: bool
    services: dict[str, bool]
