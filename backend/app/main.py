"""RAQEEB API entry point. Run: uvicorn app.main:app --reload (from backend/)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import HealthResponse

VERSION = "0.1.0"

app = FastAPI(title="RAQEEB API", version=VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Reports which services are configured. Never returns key values."""
    return HealthResponse(
        status="ok",
        version=VERSION,
        ai_provider=settings.ai_provider,
        offline_demo=settings.offline_demo,
        services={
            "gemini": bool(settings.gemini_api_key),
            "safe_browsing": bool(settings.safe_browsing_api_key),
            "virustotal": bool(settings.virustotal_api_key),
            "urlscan": settings.urlscan_enabled and bool(settings.urlscan_api_key),
        },
    )
