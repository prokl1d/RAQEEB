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

if settings.phish_feeds and settings.network_checks:
    from app.intel import feeds as _feeds

    _feeds.preload()  # parse the local known-phishing lists in the background

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


# ---------- batch triage (police / analyst use) ----------

BATCH_MAX = 20


class BatchRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=BATCH_MAX)


class BatchItem(BaseModel):
    url: str
    verdict: str | None = None
    score: int | None = None
    identity: str | None = None
    top_reasons: list[str] = []
    error: str | None = None
    domain: str | None = None
    registrar: str | None = None
    abuse_email: str | None = None
    campaign: str | None = None  # letter of the campaign this link belongs to, if any


class BatchCampaign(BaseModel):
    id: str
    members: list[str]
    links: list[str]


class BatchResult(BaseModel):
    items: list[BatchItem]
    campaigns: list[BatchCampaign]
    generated_utc: str


@app.post("/api/investigate-batch", response_model=BatchResult)
async def investigate_batch(req: BatchRequest) -> BatchResult:
    """Full investigation of up to 20 links at once, most dangerous first, grouped into campaigns
    that share infrastructure. Nothing is stored."""
    import asyncio
    from datetime import datetime, timezone

    from app.pipeline.campaigns import fingerprint_from_result, link

    sem = asyncio.Semaphore(8)
    prints = []

    async def one(raw: str) -> BatchItem:
        async with sem:
            try:
                r = await investigate(InvestigationType.url, url=raw[:2048])
            except InputError as exc:
                return BatchItem(url=raw[:2048], error=str(exc))
            order = {"threat_intel": 0, "identity": 1, "context": 2, "url_domain": 3, "content": 4}
            flagged = [e for e in r.evidence if e.status.value in ("confirmed", "suspicious")]
            flagged.sort(key=lambda e: (e.status.value != "confirmed", order.get(e.category.value, 9)))
            reasons = [e.finding for e in flagged][:3]
            url = r.urls[0].url if r.urls else raw
            fp = fingerprint_from_result(url, r)
            prints.append(fp)
            return BatchItem(url=url, verdict=r.score.band.value, score=r.score.score,
                             identity=r.identity.outcome.value, top_reasons=reasons, domain=fp.domain or None,
                             registrar=fp.registrar,
                             abuse_email=next((e.raw.get("abuse_email") for e in r.evidence if e.id == "url0.age"), None))

    items = await asyncio.gather(*(one(u) for u in dict.fromkeys(req.urls)))
    camps = link(prints)
    for c in camps:
        for it in items:
            if it.url in c.members:
                it.campaign = c.id
    items = sorted(items, key=lambda i: -(i.score if i.score is not None else -1))
    return BatchResult(items=items, campaigns=[BatchCampaign(id=c.id, members=c.members, links=c.links) for c in camps],
                       generated_utc=datetime.now(timezone.utc).isoformat(timespec="seconds"))


# ---------- early warning (lookalike domains before they are used) ----------

from app.pipeline.early_warning import EarlyWarningResult, early_warning, find_org  # noqa: E402


@app.get("/api/early-warning/{org_id}", response_model=EarlyWarningResult)
async def early_warning_endpoint(org_id: str) -> EarlyWarningResult:
    """Lookalike domains of one registry organization: DNS-live permutations + new HTTPS certificates."""
    org = find_org(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Unknown organization.")
    return await early_warning(org)
