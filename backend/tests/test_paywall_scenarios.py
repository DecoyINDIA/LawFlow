"""
Backend tests for paywall scenarios: cases/clients limit enforcement for free users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "9876543210"})
    assert r.status_code == 200
    r2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9876543210", "otp": "123456"})
    assert r2.status_code == 200
    return r2.json()["token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"}

def set_plan(headers, plan, plan_expiry=None):
    body = {"plan": plan}
    if plan_expiry is not None:
        body["planExpiry"] = plan_expiry
    r = requests.put(f"{BASE_URL}/api/auth/me", json=body, headers=headers)
    assert r.status_code == 200
    return r.json()

def get_cases(headers):
    r = requests.get(f"{BASE_URL}/api/cases", headers=headers)
    assert r.status_code == 200
    return r.json().get("data", [])

def get_clients(headers):
    r = requests.get(f"{BASE_URL}/api/clients", headers=headers)
    assert r.status_code == 200
    return r.json().get("data", [])

def delete_test_cases(headers):
    cases = get_cases(headers)
    for c in cases:
        if "TEST_" in (c.get("title") or ""):
            requests.delete(f"{BASE_URL}/api/cases/{c['id']}", headers=headers)

def delete_test_clients(headers):
    clients = get_clients(headers)
    for cl in clients:
        if "TEST_" in (cl.get("name") or ""):
            requests.delete(f"{BASE_URL}/api/clients/{cl['id']}", headers=headers)

class TestPaywallSetup:
    """Setup: verify auth and plan management work"""

    def test_auth_works(self, headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["phone"] == "9876543210"
        print(f"✓ Auth OK, user: {data['name']}, plan: {data['plan']}")

    def test_set_plan_free(self, headers):
        d = set_plan(headers, "free")
        assert d["data"]["plan"] == "free"
        print("✓ Plan set to free")

    def test_set_plan_pro(self, headers):
        d = set_plan(headers, "pro")
        assert d["data"]["plan"] == "pro"
        print("✓ Plan set to pro")

class TestScenario1_FreePlanCasesLimit:
    """Scenario 1: Free user at 10 cases - insert 10 cases via API to verify API works"""

    created_ids = []

    def test_setup_free_and_insert_10_cases(self, headers):
        set_plan(headers, "free")
        # Delete existing test cases
        delete_test_cases(headers)

        # Insert 10 test cases
        for i in range(1, 11):
            payload = {
                "caseNumber": f"TEST/CASE/{i:04d}",
                "caseType": "Civil",
                "court": "HC",
                "courtName": "High Court",
                "courtCity": "Mumbai",
                "status": "ACTIVE",
                "title": f"TEST_ Case {i}",
            }
            r = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
            assert r.status_code in [200, 201], f"Failed to create case {i}: {r.text}"
            TestScenario1_FreePlanCasesLimit.created_ids.append(r.json()["data"]["id"])

        cases = get_cases(headers)
        test_cases = [c for c in cases if "TEST_" in (c.get("title") or "")]
        assert len(test_cases) >= 10
        print(f"✓ Created 10 test cases, total test cases: {len(test_cases)}")

    def test_cases_count_is_at_least_10(self, headers):
        cases = get_cases(headers)
        assert len(cases) >= 10
        print(f"✓ Total cases in DB: {len(cases)}")

    def teardown_class(cls):
        # Will be cleaned up after UI testing
        pass

class TestScenario4_FreePlanClientsLimit:
    """Scenario 4: Free user at 10 clients"""

    created_ids = []

    def test_setup_free_and_insert_10_clients(self, headers):
        set_plan(headers, "free")
        delete_test_clients(headers)

        for i in range(1, 11):
            payload = {
                "name": f"TEST_ Client {i}",
                "phone": f"98765{i:05d}",
                "clientType": "INDIVIDUAL",
                "isActive": True,
            }
            r = requests.post(f"{BASE_URL}/api/clients", json=payload, headers=headers)
            assert r.status_code in [200, 201], f"Failed to create client {i}: {r.text}"
            TestScenario4_FreePlanClientsLimit.created_ids.append(r.json()["data"]["id"])

        clients = get_clients(headers)
        test_clients = [cl for cl in clients if "TEST_" in (cl.get("name") or "")]
        assert len(test_clients) >= 10
        print(f"✓ Created 10 test clients, total test clients: {len(test_clients)}")
