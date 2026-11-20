from fastapi.testclient import TestClient

from app.config import ScoringWeights
from app.main import app

client = TestClient(app)


def test_health_ok_and_no_secrets():
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    # Only booleans about services, never key values
    assert all(isinstance(v, bool) for v in body["services"].values())


def test_default_weights_sum_to_100():
    w = ScoringWeights()
    assert w.threat_intel + w.identity + w.url_domain + w.content + w.context == 100
