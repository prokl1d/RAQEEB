"""RAQEEB API entry point. Run: uvicorn app.main:app --reload (from backend/)."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import settings
from app.models import HealthResponse, InvestigationType
from app.pipeline.extract import InputError
from app.pipeline.investigate import InvestigationResult, investigate
from app.pipeline.listing import DemoListing, ListingInput, ListingResult, check_listing, demo_listings
from app.pipeline.shield import MAX_LINKS, LinkCheck, SearchDemo, check_links, search_demo

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


class CheckLinksRequest(BaseModel):
    links: list[str] = Field(min_length=1, max_length=MAX_LINKS)


@app.post("/api/check-links", response_model=list[LinkCheck])
def check_links_endpoint(req: CheckLinksRequest) -> list[LinkCheck]:
    """Search Shield: offline identity badges for up to 25 links. No network calls, nothing stored."""
    return check_links([x[:2048] for x in req.links])


@app.get("/api/search-demo", response_model=SearchDemo)
def search_demo_endpoint() -> SearchDemo:
    """Labelled sample search results; badges are computed by the real identity engine."""
    return search_demo()


@app.post("/api/check-listing", response_model=ListingResult)
def check_listing_endpoint(req: ListingInput) -> ListingResult:
    """Business listing check: name vs. website and phone, against the registry. Offline."""
    return check_listing(req)


@app.get("/api/listing-demo", response_model=list[DemoListing])
def listing_demo_endpoint() -> list[DemoListing]:
    return demo_listings()
