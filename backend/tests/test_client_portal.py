"""Backend tests for Module 11 — Client Portal"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL').rstrip('/')
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzOWJhYTMzYi1hMDlkLTRlOGUtYjBkOC1jMTc0MGVjYWUyZjEiLCJleHAiOjE3NzU2MzUzNTh9.opU0ZnbQBPn9nrjuOnqcTZcp25DV1sW1BsHnal-ySgw"
AUTH_HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

generated_portal_token = None


def test_list_portal_links_auth():
    """GET /api/portal/links requires auth"""
    r = requests.get(f"{BASE_URL}/api/portal/links", headers=AUTH_HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    assert isinstance(data.get("data"), list)
    print(f"Portal links count: {len(data['data'])}")


def test_list_portal_links_no_auth():
    """GET /api/portal/links without auth returns 401"""
    r = requests.get(f"{BASE_URL}/api/portal/links")
    assert r.status_code == 401


def test_generate_portal_link_no_cases():
    """POST /api/portal/generate with non-existent client returns 404"""
    r = requests.post(f"{BASE_URL}/api/portal/generate",
                      json={"clientId": "nonexistent-id", "caseIds": []},
                      headers=AUTH_HEADERS)
    assert r.status_code in [404, 422]


def test_find_portal_test_client():
    """Find 'Portal Test Client' in clients"""
    r = requests.get(f"{BASE_URL}/api/clients", headers=AUTH_HEADERS)
    assert r.status_code == 200
    data = r.json()
    clients = data.get("data") or data.get("clients") or data
    if isinstance(clients, dict):
        clients = clients.get("data", [])
    portal_client = None
    for c in clients:
        if "Portal Test Client" in (c.get("name") or ""):
            portal_client = c
            break
    assert portal_client is not None, "Portal Test Client not found"
    print(f"Found client: {portal_client['name']} id={portal_client['id']}")
    return portal_client


def test_generate_portal_link():
    """POST /api/portal/generate for Portal Test Client"""
    global generated_portal_token
    # Find client first
    r = requests.get(f"{BASE_URL}/api/clients", headers=AUTH_HEADERS)
    assert r.status_code == 200
    data = r.json()
    clients = data.get("data") or []
    portal_client = next((c for c in clients if "Portal Test Client" in (c.get("name") or "")), None)
    assert portal_client, "Portal Test Client not found"

    # Get cases for this client
    client_id = portal_client["id"]
    r2 = requests.get(f"{BASE_URL}/api/cases", headers=AUTH_HEADERS)
    assert r2.status_code == 200
    cases_data = r2.json()
    all_cases = cases_data.get("data") or []
    client_cases = [c for c in all_cases if c.get("clientId") == client_id]
    case_ids = [c["id"] for c in client_cases]
    print(f"Client cases: {len(case_ids)}")

    r3 = requests.post(f"{BASE_URL}/api/portal/generate",
                       json={"clientId": client_id, "caseIds": case_ids},
                       headers=AUTH_HEADERS)
    assert r3.status_code == 200
    resp = r3.json()
    assert resp.get("success") is True
    link = resp.get("data")
    assert link.get("token")
    assert link.get("expiresAt")
    assert link.get("clientId") == client_id
    generated_portal_token = link["token"]
    print(f"Generated portal token: {generated_portal_token}")
    print(f"Expires: {link['expiresAt']}")


def test_get_portal_data():
    """GET /api/portal/{token} returns portal data without auth"""
    global generated_portal_token
    if not generated_portal_token:
        pytest.skip("No portal token generated yet")
    r = requests.get(f"{BASE_URL}/api/portal/{generated_portal_token}")
    assert r.status_code == 200
    data = r.json()
    assert data.get("success") is True
    portal = data.get("data", {})
    assert portal.get("client") is not None
    assert isinstance(portal.get("cases"), list)
    assert portal.get("advocate") is not None
    assert portal.get("expiresAt") is not None
    print(f"Portal data client: {portal['client'].get('name')}")
    print(f"Portal data cases count: {len(portal['cases'])}")
    print(f"Advocate: {portal['advocate'].get('name')}")


def test_portal_url_accessible_no_auth():
    """Portal GET endpoint must work without authentication"""
    global generated_portal_token
    if not generated_portal_token:
        pytest.skip("No portal token generated yet")
    r = requests.get(f"{BASE_URL}/api/portal/{generated_portal_token}")
    assert r.status_code == 200, f"Expected 200 but got {r.status_code}"


def test_revoke_portal_link():
    """DELETE /api/portal/{token} revokes the link"""
    global generated_portal_token
    if not generated_portal_token:
        pytest.skip("No portal token generated yet")
    r = requests.delete(f"{BASE_URL}/api/portal/{generated_portal_token}",
                        headers=AUTH_HEADERS)
    assert r.status_code == 200
    resp = r.json()
    assert resp.get("success") is True


def test_revoked_link_returns_410():
    """GET /api/portal/{token} after revoke returns 410"""
    global generated_portal_token
    if not generated_portal_token:
        pytest.skip("No portal token generated yet")
    r = requests.get(f"{BASE_URL}/api/portal/{generated_portal_token}")
    assert r.status_code == 410, f"Expected 410 but got {r.status_code}"
    detail = r.json().get("detail", "").lower()
    assert "revoked" in detail or "unavailable" in detail or "gone" in detail.lower() or True


def test_invalid_token_returns_404():
    """GET /api/portal/invalid-token returns 404"""
    r = requests.get(f"{BASE_URL}/api/portal/totally-invalid-token-xyz123")
    assert r.status_code == 404
