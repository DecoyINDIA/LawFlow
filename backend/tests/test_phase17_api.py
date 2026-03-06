"""
Phase 17 API Tests — WhatsApp Integration for Hearing Reminders
Tests: health check, login, reminders/send endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


@pytest.fixture
def auth_token():
    """Get auth token using test credentials"""
    resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "9876543210"})
    assert resp.status_code == 200
    resp2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9876543210", "otp": "123456"})
    assert resp2.status_code == 200
    data = resp2.json()
    return data.get("token") or data.get("access_token")


def test_health_check():
    """GET /api/health returns {status: ok, database: connected}"""
    resp = requests.get(f"{BASE_URL}/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"
    assert data.get("database") == "connected"


def test_reminders_send_requires_auth():
    """POST /api/notifications/reminders/send returns 401 without token"""
    resp = requests.post(f"{BASE_URL}/api/notifications/reminders/send")
    assert resp.status_code in (401, 403)


def test_reminders_send_with_auth(auth_token):
    """POST /api/notifications/reminders/send returns success:true with tomorrowHearings"""
    if not auth_token:
        pytest.skip("Auth failed")
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = requests.post(f"{BASE_URL}/api/notifications/reminders/send", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("success") is True
    result = data.get("result", {})
    assert "tomorrowHearings" in result
    assert "results" in result
    print(f"tomorrowHearings: {result['tomorrowHearings']}, results: {result['results']}")
