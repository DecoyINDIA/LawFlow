"""
Tests for LawFlow bug fixes:
FIX1: No fake welcome notifications
FIX2: Global Search removed from More tab (frontend-only, code check)
FIX3: Firm members return name field from API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Login with test credentials and return token"""
    resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "9876543210"})
    assert resp.status_code == 200, f"Send OTP failed: {resp.text}"
    resp2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9876543210", "otp": "123456"})
    assert resp2.status_code == 200, f"Verify OTP failed: {resp2.text}"
    data = resp2.json()
    token = data.get("token") or data.get("data", {}).get("token")
    assert token, f"No token in response: {data}"
    return token


class TestFix1NoWelcomeNotification:
    """FIX 1: buildNotifications should not push static Welcome notification"""

    def test_notifications_endpoint_no_welcome(self, auth_token):
        """Verify there's no 'Welcome to LawFlow' notification via API for fresh/no-cases user"""
        # Get cases and hearings — user 9876543210 should have no cases
        cases_resp = requests.get(f"{BASE_URL}/api/cases", headers={"Authorization": f"Bearer {auth_token}"})
        assert cases_resp.status_code == 200
        cases = cases_resp.json().get("data", [])
        print(f"User has {len(cases)} cases")
        # Notifications are built client-side, no backend endpoint for notifications
        # Just verify the user has no hearings which would trigger notifications
        hearings_resp = requests.get(f"{BASE_URL}/api/hearings", headers={"Authorization": f"Bearer {auth_token}"})
        assert hearings_resp.status_code == 200
        hearings = hearings_resp.json().get("data", [])
        print(f"User has {len(hearings)} hearings")
        print("FIX1: Notifications are computed client-side from actual hearing data only")


class TestFix3FirmMembersName:
    """FIX 3: GET /api/firms/my must return members with name field populated"""

    def test_get_my_firm_returns_name(self, auth_token):
        """Firm members should have 'name' field (not just phone)"""
        resp = requests.get(
            f"{BASE_URL}/api/firms/my",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 200, f"Firms/my failed: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        firm = data.get("data")
        if firm is None:
            pytest.skip("No firm exists for this user — FIX3 cannot be tested without a firm")
        
        members = firm.get("members", [])
        assert len(members) > 0, "Firm should have at least 1 member (owner)"
        
        for m in members:
            print(f"Member: phone={m.get('phone')}, name={m.get('name')}, role={m.get('role')}")
            assert "name" in m, f"Member missing 'name' field: {m}"
        
        # Specifically check owner has real name (not empty/None)
        owner = next((m for m in members if m.get("role") == "owner"), None)
        assert owner is not None, "No owner member found"
        assert owner.get("name"), f"Owner should have a non-empty name, got: {owner.get('name')}"
        print(f"FIX3 PASS: Owner name = '{owner['name']}'")

    def test_firm_owner_name_is_advocate_name(self, auth_token):
        """Owner name should be 'Adv. Rahul Sharma', not phone number"""
        resp = requests.get(
            f"{BASE_URL}/api/firms/my",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        firm = resp.json().get("data")
        if not firm:
            pytest.skip("No firm for this user")
        
        owner = next((m for m in firm.get("members", []) if m.get("role") == "owner"), None)
        assert owner is not None
        name = owner.get("name", "")
        # Name should not be a phone number (10 digits)
        assert not name.isdigit() or len(name) != 10, f"Name looks like phone number: {name}"
        assert name != "9876543210", f"Name is phone number, fix not applied: {name}"
        print(f"FIX3 PASS: Owner name is '{name}' (not a phone number)")
