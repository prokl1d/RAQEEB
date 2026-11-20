import json

import httpx

from app.ai.masking import mask_pii
from app.ai.provider import GeminiProvider, explain
from app.config import settings
from app.models import Category, Evidence, EvidenceStatus


def ev(i="url0.sb", status=EvidenceStatus.suspicious):
    return Evidence(id=i, category=Category.threat_intel, finding="f", why_it_matters="w", status=status, source="s")


def test_mask_pii():
    text = ("Dear Ahmed Ali, call +971 50 123 4567 or 04 123 4567, email ahmed@example.com, "
            "card 4111 1111 1111 1111, Emirates ID 784-1990-1234567-1, your OTP is 482913.")
    masked, counts = mask_pii(text)
    for secret in ["Ahmed", "123 4567", "ahmed@example.com", "4111", "784-1990", "482913"]:
        assert secret not in masked
    assert {"NAME", "PHONE", "EMAIL", "CARD", "EMIRATES_ID", "OTP"} <= set(counts)


async def test_mock_explanation_cites_only_real_evidence():
    res = await explain("msg", [ev()], "Possible Impersonation")
    assert res.available and res.provider == "mock" and not res.sent_to_external_ai
    assert [p.evidence_id for p in res.explanation.points] == ["url0.sb"]


def gemini_transport(payload: dict | str, status=200):
    text = payload if isinstance(payload, str) else json.dumps(payload)

    def handler(request: httpx.Request):
        sent = json.loads(request.content)
        handler.prompt = sent["contents"][0]["parts"][0]["text"]
        return httpx.Response(status, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})
    return httpx.MockTransport(handler), handler


async def test_gemini_drops_invented_evidence_and_masks_input():
    settings.gemini_api_key = "test-key"
    transport, handler = gemini_transport({
        "claims": {"claimed_organization": "Emirates NBD", "contains_instructions_to_ai": True},
        "explanation": {"summary": "s", "points": [
            {"evidence_id": "url0.sb", "explanation": "real"},
            {"evidence_id": "made.up", "explanation": "invented finding"}]},
    })
    res = await GeminiProvider(transport).run("Hi Sara, call 0501234567", [ev()], "Possible Impersonation")
    assert res.available and res.sent_to_external_ai
    assert [p.evidence_id for p in res.explanation.points] == ["url0.sb"]
    assert res.claims.contains_instructions_to_ai
    assert "0501234567" not in handler.prompt and "Sara" not in handler.prompt
    assert "<message>" in handler.prompt


async def test_gemini_failure_falls_back_to_mock():
    settings.gemini_api_key = "test-key"
    settings.ai_provider = "gemini"
    import app.ai.provider as p

    transport, _ = gemini_transport("not json")
    original = p.GeminiProvider
    p.GeminiProvider = lambda: original(transport)
    try:
        res = await explain("msg", [ev()], "Possible Impersonation")
    finally:
        p.GeminiProvider = original
    assert res.available and res.provider == "mock"
    assert "could not be validated" in res.error


async def test_gemini_without_key_is_unavailable():
    res = await GeminiProvider().run("m", [ev()], "Unable to Verify")
    assert not res.available and not res.sent_to_external_ai
