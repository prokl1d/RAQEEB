"""Central configuration. Secrets come only from environment variables / backend/.env."""

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class ScoringWeights(BaseModel):
    """Category weights (must sum to 100). See docs/PLAN.md section 10."""

    threat_intel: int = 30
    identity: int = 25
    url_domain: int = 20
    content: int = 15
    context: int = 10


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # External services (all optional; missing keys mean that check is reported as unavailable)
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    safe_browsing_api_key: str | None = None
    virustotal_api_key: str | None = None
    urlscan_api_key: str | None = None
    urlscan_enabled: bool = False

    # Modes
    ai_provider: str = "mock"  # "gemini" | "mock"
    offline_demo: bool = False  # replay labelled fixtures instead of calling external APIs
    network_checks: bool = True  # False disables all outbound checks (used by tests)
    ai_timeout_seconds: float = 15.0

    # Limits
    max_message_chars: int = 5000
    max_upload_bytes: int = 5 * 1024 * 1024
    http_timeout_seconds: float = 5.0
    max_redirects: int = 5

    # Scoring
    weights: ScoringWeights = ScoringWeights()
    min_coverage_for_verdict: int = 40

    # CORS: local frontend only
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]


settings = Settings()
