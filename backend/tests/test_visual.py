"""Visual brand match on synthetic pages (no browser needed)."""

import pytest

PIL = pytest.importorskip("PIL")
from PIL import Image, ImageDraw  # noqa: E402

from app.pipeline import visual  # noqa: E402


def page(boxes, bg=(255, 255, 255), shift=0):
    img = Image.new("RGB", (1280, 800), bg)
    d = ImageDraw.Draw(img)
    for x, y, w, h, c in boxes:
        d.rectangle((x + shift, y, x + shift + w, y + h), fill=c)
    return img


LOGIN = [(500, 120, 280, 60, (0, 112, 186)), (480, 230, 320, 40, (230, 230, 230)), (480, 290, 320, 40, (230, 230, 230)),
         (480, 360, 320, 44, (0, 48, 135)), (520, 440, 240, 14, (120, 120, 120))]
OTHER = [(60, 60, 1160, 90, (20, 20, 20)), (60, 200, 360, 360, (200, 60, 60)), (460, 200, 760, 30, (90, 90, 90)),
         (460, 260, 700, 30, (90, 90, 90)), (460, 320, 500, 30, (90, 90, 90))]


@pytest.fixture
def refs(monkeypatch):
    ref = {"bank": {"name": "Bank", "domains": ["bank.ae"], "prints": [{"url": "https://bank.ae/login", **visual.fingerprint(page(LOGIN))}]}}
    monkeypatch.setattr(visual, "references", lambda: ref)


def test_copied_page_matches_even_when_moved(refs):
    m = visual.match(visual.fingerprint(page(LOGIN, shift=-300)), "bank-secure-login.top")
    assert m and m["brand"] == "bank" and m["similarity"] >= 85


def test_different_page_and_blank_page_do_not_match(refs):
    assert visual.match(visual.fingerprint(page(OTHER)), "news-site.com") is None
    assert visual.match(visual.fingerprint(page([])), "blank.com") is None


def test_brand_own_domain_is_never_flagged(refs):
    assert visual.match(visual.fingerprint(page(LOGIN)), "bank.ae") is None
    assert visual.match(visual.fingerprint(page(LOGIN)), "online.bank.ae") is None
