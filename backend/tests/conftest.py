import pytest

from app.config import settings


@pytest.fixture(autouse=True)
def no_network_by_default():
    """Tests never call real external services unless they opt in."""
    saved = (settings.network_checks, settings.offline_demo, settings.ai_provider,
             settings.gemini_api_key, settings.safe_browsing_api_key, settings.virustotal_api_key,
             settings.screenshots)
    settings.network_checks = False
    settings.screenshots = False  # no real browser in unit tests
    settings.offline_demo = False
    settings.ai_provider = "mock"
    settings.gemini_api_key = settings.safe_browsing_api_key = settings.virustotal_api_key = None
    yield
    (settings.network_checks, settings.offline_demo, settings.ai_provider,
     settings.gemini_api_key, settings.safe_browsing_api_key, settings.virustotal_api_key,
     settings.screenshots) = saved
