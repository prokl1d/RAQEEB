"""RAQEEB API entry point. Run: uvicorn app.main:app --reload (from backend/)."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.models import HealthResponse, InvestigationType
from app.pipeline.extract import InputError
from app.pipeline.investigate import InvestigationResult, investigate

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


class InvestigateRequest(BaseModel):
    type: InvestigationType
    message: str | None = None
    url: str | None = None


@app.post("/api/investigate", response_model=InvestigationResult)
async def investigate_endpoint(req: InvestigateRequest) -> InvestigationResult:
    """Runs the investigation in memory. Nothing is stored or logged beyond status."""
    if req.type == InvestigationType.screenshot:
        raise HTTPException(status_code=501, detail="Screenshot investigations arrive in Phase 6.")
    try:
        return await investigate(req.type, message=req.message, url=req.url)
    except InputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
