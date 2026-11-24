"""Screenshot + visual brand match for one investigated link (optional feature).

Only for links worth it: the page loaded, and its final domain is neither a long-established
site (Tranco top 100k) nor an official domain in RAQEEB's registry. That is where a fake login
page lives, and it keeps the cost to a few seconds per investigation.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.config import settings
from app.models import Category, Evidence, EvidenceStatus
from app.pipeline.extract import ParsedUrl
from app.pipeline.reputation import is_established
from app.pipeline.verify import MatchKind, compare
from app.registry import load_registry


class VisualMatch(BaseModel):
    brand: str
    name: str
    similarity: int  # 0-100
    hash_distance: int
    official: list[str]
    reference_page: str


class PageScreenshot(BaseModel):
    jpeg_b64: str
    sha256: str
    final_url: str
    title: str
    taken_utc: str
    visual_match: VisualMatch | None = None


def worth_capturing(final: ParsedUrl | None) -> bool:
    if not settings.screenshots or final is None or not final.registrable_domain:
        return False
    reg = final.registrable_domain.lower()
    if is_established(reg):
        return False
    return not any(compare(final, o).kind == MatchKind.exact for o in load_registry())


async def capture_and_match(final: ParsedUrl, idx: int) -> tuple[PageScreenshot | None, list[Evidence]]:
    try:
        from app.net.screenshot import capture
        from app.pipeline.visual import fingerprint, match
    except ImportError:
        return None, []
    shot = await capture(final.url)
    if shot is None:
        return None, []
    ev: list[Evidence] = [Evidence(
        id=f"url{idx}.screenshot", category=Category.url_domain,
        finding=f"Screenshot of {final.registrable_domain} taken in a sandbox at {shot.taken_utc} UTC "
                f"(SHA-256 {shot.sha256[:16]}…).",
        why_it_matters="A picture of what the victim would see, sealed with a fingerprint so it can be used as evidence.",
        status=EvidenceStatus.unverified, source="RAQEEB sandboxed browser (page scripts fenced to public addresses)",
        raw={"url": shot.final_url, "sha256": shot.sha256, "taken_utc": shot.taken_utc, "title": shot.title})]
    vm = None
    if shot.image is not None:
        m = match(fingerprint(shot.image), final.registrable_domain.lower())
        if m:
            vm = VisualMatch(**m)
            ev.append(Evidence(
                id=f"url{idx}.visual.{m['brand']}", category=Category.identity,
                finding=f"The page looks like {m['name']}'s real sign-in page ({m['similarity']}% visual match), "
                        f"but {final.registrable_domain} is not a {m['name']} domain.",
                why_it_matters="Phishing kits copy a brand's login page pixel for pixel. A look-alike page on someone "
                               "else's domain is built to steal what you type.",
                status=EvidenceStatus.suspicious, source="RAQEEB visual brand match (layout hash + colours)",
                raw={"url": shot.final_url, **m}))
    return PageScreenshot(jpeg_b64=shot.jpeg_b64, sha256=shot.sha256, final_url=shot.final_url, title=shot.title,
                          taken_utc=shot.taken_utc, visual_match=vm), ev
