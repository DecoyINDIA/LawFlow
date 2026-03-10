"""
Tests for LawFlow bug fixes iteration 5:
BUG1: Case delete crash - React hooks violation (printingHistory useState moved before early return)
BUG2: Duplicate cases in Upcoming Hearings section on dashboard
BUG3: Firm dashboard Team Workload showing phone numbers instead of member names
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

TEST_PHONE = "9876543210"
TEST_OTP = "123456"


@pytest.fixture(scope="module")
def auth_token():
    """Login with test credentials and return token"""
    resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": TEST_PHONE})
    assert resp.status_code == 200, f"Send OTP failed: {resp.text}"
    resp2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": TEST_PHONE, "otp": TEST_OTP})
    assert resp2.status_code == 200, f"Verify OTP failed: {resp2.text}"
    data = resp2.json()
    token = data.get("token") or data.get("data", {}).get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ─── BUG 1: Case Detail / Delete functionality ───────────────────────────
class TestBug1CaseDeleteCrash:
    """Case detail screen should load and delete should work without crash"""

    def test_get_cases_list(self, headers):
        """Verify cases API returns successfully"""
        resp = requests.get(f"{BASE_URL}/api/cases", headers=headers)
        assert resp.status_code == 200, f"Cases API failed: {resp.text}"
        data = resp.json()
        assert "data" in data, f"No data key in response: {data}"
        cases = data["data"]
        print(f"BUG1: Found {len(cases)} cases")

    def test_create_case_for_delete_test(self, headers):
        """Create a test case to verify delete works"""
        payload = {
            "caseNumber": "TEST_DELETE_001",
            "title": "Test Delete Case",
            "caseType": "Civil",
            "courtName": "District Court",
            "courtCity": "Mumbai",
            "status": "ACTIVE",
            "priority": "MEDIUM",
        }
        resp = requests.post(f"{BASE_URL}/api/cases", json=payload, headers=headers)
        assert resp.status_code in (200, 201), f"Create case failed: {resp.text}"
        data = resp.json()
        case_id = data.get("data", {}).get("id") or data.get("id")
        assert case_id, f"No case ID in response: {data}"
        print(f"BUG1: Created case with ID={case_id}")

        # Verify case was created
        get_resp = requests.get(f"{BASE_URL}/api/cases/{case_id}", headers=headers)
        assert get_resp.status_code == 200, f"Get case failed: {get_resp.text}"
        print(f"BUG1: Case detail accessible, ID={case_id}")

        # Now delete the case
        del_resp = requests.delete(f"{BASE_URL}/api/cases/{case_id}", headers=headers)
        assert del_resp.status_code in (200, 204), f"Delete case failed: {del_resp.text}"
        print(f"BUG1: Case deleted successfully, ID={case_id}")

        # Verify case is gone
        verify_resp = requests.get(f"{BASE_URL}/api/cases/{case_id}", headers=headers)
        assert verify_resp.status_code == 404, f"Case should be gone after delete but got: {verify_resp.status_code}"
        print(f"BUG1 PASS: Case create/read/delete cycle works correctly")


# ─── BUG 2: Duplicate cases in Upcoming Hearings (frontend logic) ─────────
class TestBug2DuplicateUpcomingHearings:
    """
    The duplicate fix is frontend-only (upcomingFromCases filters coveredCaseIds).
    We can verify backend returns distinct hearings and cases.
    """

    def test_hearings_api_returns_unique_entries(self, headers):
        """Backend hearings should not have duplicate entries"""
        resp = requests.get(f"{BASE_URL}/api/hearings", headers=headers)
        assert resp.status_code == 200, f"Hearings API failed: {resp.text}"
        data = resp.json()
        hearings = data.get("data", [])
        # Check no duplicate hearing IDs
        hearing_ids = [h.get("id") for h in hearings]
        unique_ids = set(hearing_ids)
        assert len(hearing_ids) == len(unique_ids), f"Duplicate hearings found: {len(hearing_ids)} total, {len(unique_ids)} unique"
        print(f"BUG2: {len(hearings)} hearings returned, all unique IDs")

    def test_cases_api_returns_unique_entries(self, headers):
        """Backend cases should not have duplicate entries"""
        resp = requests.get(f"{BASE_URL}/api/cases", headers=headers)
        assert resp.status_code == 200, f"Cases API failed: {resp.text}"
        data = resp.json()
        cases = data.get("data", [])
        # Check no duplicate case IDs
        case_ids = [c.get("id") for c in cases]
        unique_ids = set(case_ids)
        assert len(case_ids) == len(unique_ids), f"Duplicate cases found: {len(case_ids)} total, {len(unique_ids)} unique"
        print(f"BUG2: {len(cases)} cases returned, all unique IDs")
        print(f"BUG2 PASS: No duplicates from backend; frontend deduplication logic verified via code review")


# ─── BUG 3: Firm dashboard member names ───────────────────────────────────
class TestBug3FirmDashboardMemberNames:
    """GET /api/firms/dashboard should return name field for members in workload"""

    def test_firm_dashboard_accessible(self, headers):
        """Firm dashboard endpoint should return 200 for firm owner"""
        resp = requests.get(f"{BASE_URL}/api/firms/dashboard", headers=headers)
        # Should be 200 if user is firm owner, 403 if not
        if resp.status_code == 403:
            pytest.skip("User is not a firm owner — dashboard test skipped")
        assert resp.status_code == 200, f"Firm dashboard failed: {resp.text}"
        data = resp.json()
        assert data.get("success") is True
        print(f"BUG3: Firm dashboard accessible")

    def test_firm_dashboard_workload_has_names(self, headers):
        """Workload dict values should contain 'name' field, not just phone"""
        resp = requests.get(f"{BASE_URL}/api/firms/dashboard", headers=headers)
        if resp.status_code == 403:
            pytest.skip("User is not a firm owner")
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        workload = data.get("workload", {})
        
        if not workload:
            pytest.skip("No workload data — no firm members")
        
        for member_id, member_data in workload.items():
            print(f"BUG3: Member {member_id}: name={member_data.get('name')}, phone={member_data.get('phone')}")
            assert "name" in member_data, f"Workload entry missing 'name' field: {member_data}"

    def test_firm_dashboard_members_have_names(self, headers):
        """Firm members in dashboard response should have 'name' not just phone"""
        resp = requests.get(f"{BASE_URL}/api/firms/dashboard", headers=headers)
        if resp.status_code == 403:
            pytest.skip("User is not a firm owner")
        data = resp.json().get("data", {})
        firm = data.get("firm", {})
        members = firm.get("members", [])
        
        if not members:
            pytest.skip("No firm members")
        
        for m in members:
            print(f"BUG3: Member phone={m.get('phone')}, name={m.get('name')}, role={m.get('role')}")
            assert "name" in m, f"Member missing 'name' field: {m}"
        
        # Owner should have a name (not empty, not phone number)
        owner = next((m for m in members if m.get("role") == "owner"), None)
        if owner:
            name = owner.get("name", "")
            assert name and not (name.isdigit() and len(name) == 10), \
                f"Owner 'name' is a phone number or empty: '{name}'"
            print(f"BUG3 PASS: Owner name='{name}' (not a phone number)")

    def test_firm_my_endpoint_has_names(self, headers):
        """GET /api/firms/my should also return enriched member names"""
        resp = requests.get(f"{BASE_URL}/api/firms/my", headers=headers)
        assert resp.status_code == 200, f"Firms/my failed: {resp.text}"
        data = resp.json()
        firm = data.get("data")
        if not firm:
            pytest.skip("No firm for this user")
        
        members = firm.get("members", [])
        for m in members:
            assert "name" in m, f"firms/my member missing 'name': {m}"
            print(f"BUG3: firms/my member name='{m.get('name')}', phone={m.get('phone')}")
        
        print(f"BUG3 PASS: firms/my returns enriched member names")
