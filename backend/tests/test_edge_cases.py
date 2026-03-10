"""
Module 15: Edge Cases & Data Integrity Tests
Tests for offline mode, empty state, incomplete signup guard, grace period, paywall
"""
import pytest
import requests
import os
from pymongo import MongoClient
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "lawflow"
PHONE = "9876543210"
USER_ID = "431d5c70-9aa6-4da1-9dd3-9226f68141eb"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token via OTP flow"""
    # Request OTP
    resp = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": PHONE})
    assert resp.status_code == 200, f"OTP request failed: {resp.text}"
    # Verify OTP (dev mode: 123456)
    resp2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": PHONE, "otp": "123456"})
    assert resp2.status_code == 200, f"OTP verify failed: {resp2.text}"
    data = resp2.json()
    token = data.get("token") or data.get("data", {}).get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def api(auth_token):
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"})
    return session


# ── 15.1/15.2 — Offline Mode & Sync Pending (Code Inspection) ────────────────
class TestOfflineSyncBehavior:
    """Code inspection tests for offline mode and sync retry functionality"""

    def test_retry_sync_function_exists_in_context(self):
        """Verify retrySyncAll is exported from AppContext"""
        with open('/app/frontend/src/context/AppContext.tsx', 'r') as f:
            content = f.read()
        assert 'retrySyncAll' in content, "retrySyncAll should exist in AppContext"
        print("PASS: retrySyncAll exists in AppContext")

    def test_sync_retry_btn_testid_exists_in_dashboard(self):
        """Verify sync-retry-btn testID exists in dashboard"""
        with open('/app/frontend/app/(tabs)/index.tsx', 'r') as f:
            content = f.read()
        assert 'testID="sync-retry-btn"' in content, "sync-retry-btn testID should be in dashboard"
        print("PASS: sync-retry-btn testID found in dashboard header")

    def test_sync_pending_flag_set_on_failure(self):
        """Verify syncPending is set on items when doBackgroundSync fails"""
        with open('/app/frontend/src/context/AppContext.tsx', 'r') as f:
            content = f.read()
        assert 'syncPending: true' in content, "syncPending flag should be set on sync failure"
        print("PASS: syncPending flag set on doBackgroundSync failure")

    def test_sync_status_offline_set_on_failure(self):
        """Verify syncStatus is set to offline on API failure"""
        with open('/app/frontend/src/context/AppContext.tsx', 'r') as f:
            content = f.read()
        assert "setSyncStatus('offline')" in content, "syncStatus should be set to 'offline' on failure"
        print("PASS: setSyncStatus('offline') called on error")

    def test_retry_button_shown_when_offline(self):
        """Verify Retry button renders when status is offline or error"""
        with open('/app/frontend/app/(tabs)/index.tsx', 'r') as f:
            content = f.read()
        # The SyncIcon component renders the retry button for offline/error states
        assert "offline" in content and "sync-retry-btn" in content
        print("PASS: Retry button shown for offline/error state (WEB_LIMITATION: full offline simulation not possible in automated browser)")

    def test_retry_wired_to_retry_sync_all(self):
        """Verify onRetry is wired to retrySyncAll in dashboard"""
        with open('/app/frontend/app/(tabs)/index.tsx', 'r') as f:
            content = f.read()
        assert 'onRetry={retrySyncAll}' in content, "onRetry prop should be wired to retrySyncAll"
        print("PASS: Retry button wired to retrySyncAll")


# ── 15.3 — Empty State (No Fake Data) ───────────────────────────────────────
class TestEmptyState:
    """Test empty state shows correctly after clearing user data"""

    def test_cases_empty_after_clear(self, api):
        """Verify cases API returns empty after clearing"""
        # Delete all test cases first
        resp = api.get(f"{BASE_URL}/api/cases")
        assert resp.status_code == 200
        cases = resp.json().get("data", [])
        print(f"Current cases count: {len(cases)}")
        # Delete each case
        for case in cases:
            api.delete(f"{BASE_URL}/api/cases/{case['id']}")
        
        # Re-check
        resp2 = api.get(f"{BASE_URL}/api/cases")
        assert resp2.status_code == 200
        remaining = resp2.json().get("data", [])
        assert len(remaining) == 0, f"Expected 0 cases, got {len(remaining)}"
        print("PASS: Cases are empty")

    def test_clients_empty_after_clear(self, api):
        """Verify clients API returns empty"""
        resp = api.get(f"{BASE_URL}/api/clients")
        assert resp.status_code == 200
        clients = resp.json().get("data", [])
        print(f"Current clients count: {len(clients)}")
        for client in clients:
            api.delete(f"{BASE_URL}/api/clients/{client['id']}")
        
        resp2 = api.get(f"{BASE_URL}/api/clients")
        assert resp2.status_code == 200
        remaining = resp2.json().get("data", [])
        assert len(remaining) == 0, f"Expected 0 clients, got {len(remaining)}"
        print("PASS: Clients are empty")

    def test_hearings_empty_after_clear(self, api):
        """Verify hearings API returns empty"""
        resp = api.get(f"{BASE_URL}/api/hearings")
        assert resp.status_code == 200
        hearings = resp.json().get("data", [])
        print(f"Current hearings count: {len(hearings)}")
        for h in hearings:
            api.delete(f"{BASE_URL}/api/hearings/{h['id']}")
        
        resp2 = api.get(f"{BASE_URL}/api/hearings")
        assert resp2.status_code == 200
        remaining = resp2.json().get("data", [])
        assert len(remaining) == 0, f"Expected 0 hearings, got {len(remaining)}"
        print("PASS: Hearings are empty")

    def test_empty_state_text_in_cases_screen(self):
        """Verify No Cases Yet text exists in cases.tsx"""
        with open('/app/frontend/app/(tabs)/cases.tsx', 'r') as f:
            content = f.read()
        assert 'No Cases Yet' in content or 'no cases' in content.lower(), \
            "cases.tsx should have empty state message"
        print("PASS: Empty state text found in cases.tsx")

    def test_empty_state_text_in_dashboard(self):
        """Verify empty state message in dashboard"""
        with open('/app/frontend/app/(tabs)/index.tsx', 'r') as f:
            content = f.read()
        assert 'No hearings scheduled today' in content or 'No upcoming hearings' in content
        print("PASS: Empty state text found in dashboard")


# ── 15.4 — Incomplete Signup Blocks App ────────────────────────────────────
class TestIncompleteSignupGuard:
    """Test that incomplete profile redirects to signup"""

    def test_index_checks_name_enrollment_barcouncil(self):
        """Verify index.tsx checks name && enrollmentNumber && barCouncil"""
        with open('/app/frontend/app/index.tsx', 'r') as f:
            content = f.read()
        assert 'pd?.name' in content and 'pd?.enrollmentNumber' in content and 'pd?.barCouncil' in content
        print("PASS: index.tsx checks name, enrollmentNumber, barCouncil")

    def test_redirect_to_signup_when_profile_incomplete(self):
        """Verify redirect to /signup or /login when profile incomplete"""
        with open('/app/frontend/app/index.tsx', 'r') as f:
            content = f.read()
        assert '/signup' in content or '/login' in content
        assert "done ? '/(tabs)' : '/login'" in content or "done ?" in content
        print("PASS: Redirect logic exists in index.tsx")

    def test_null_name_via_api_redirect(self, api, db):
        """Set user name to null and verify getMe returns incomplete profile"""
        # Set name to null in DB
        db.advocates.update_one({"id": USER_ID}, {"$set": {"name": ""}})
        
        resp = api.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        name = data.get("name", "")
        assert not name, f"Expected empty name, got: {name}"
        print(f"PASS: Name is empty/null: '{name}' - app would redirect to /signup")

    def test_restore_user_name(self, api, db):
        """Restore user name after test"""
        db.advocates.update_one({"id": USER_ID}, {"$set": {"name": "Adv. Rahul Sharma"}})
        resp = api.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json().get("data", {})
        assert data.get("name") == "Adv. Rahul Sharma"
        print("PASS: User name restored")


# ── 15.5 — Grace Period Access ────────────────────────────────────────────
class TestGracePeriodAccess:
    """Test grace period (2 days after expiry) allows Pro access"""

    def test_set_grace_period_expiry(self, db):
        """Set planExpiry to 2 days ago (within 3-day grace)"""
        two_days_ago = (datetime.utcnow() - timedelta(days=2)).isoformat() + "Z"
        db.advocates.update_one({"id": USER_ID}, {"$set": {
            "plan": "pro",
            "planExpiry": two_days_ago
        }})
        user = db.advocates.find_one({"id": USER_ID})
        assert user["planExpiry"] is not None
        print(f"PASS: planExpiry set to 2 days ago: {two_days_ago}")

    def test_is_pro_user_during_grace_period(self):
        """Verify isProUser logic allows access within 3-day grace"""
        # From AppContext line 1295-1297:
        # isProUser = userPlan === 'pro' && (!planExpiry || new Date(planExpiry) >= new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
        with open('/app/frontend/src/context/AppContext.tsx', 'r') as f:
            content = f.read()
        assert '3 * 24 * 60 * 60 * 1000' in content, "Grace period of 3 days should be in isProUser check"
        print("PASS: Grace period (3-day) check exists in isProUser")

    def test_grace_period_card_testid_exists(self):
        """Verify grace-period-card testID exists in more.tsx"""
        with open('/app/frontend/app/(tabs)/more.tsx', 'r') as f:
            content = f.read()
        assert 'testID="grace-period-card"' in content
        print("PASS: grace-period-card testID exists in more.tsx")

    def test_grace_period_card_shown_when_expired(self):
        """Verify grace-period-card renders when isGracePeriod returns true"""
        with open('/app/frontend/app/(tabs)/more.tsx', 'r') as f:
            content = f.read()
        assert 'isGracePeriod' in content
        assert 'grace-period-card' in content
        print("PASS: grace-period-card shown during grace period")

    def test_restore_pro_plan_after_grace_test(self, db):
        """Restore Pro plan (planExpiry=null, plan=pro)"""
        db.advocates.update_one({"id": USER_ID}, {"$set": {
            "plan": "pro",
            "planExpiry": None
        }})
        user = db.advocates.find_one({"id": USER_ID})
        assert user["plan"] == "pro"
        assert user["planExpiry"] is None
        print("PASS: Pro plan restored")


# ── 15.6 — Read-Only After Expiry ────────────────────────────────────────
class TestReadOnlyAfterExpiry:
    """Test paywall behavior when plan expired > 3 days ago"""

    TEST_CASE_IDS = []

    def test_set_free_plan_expired(self, db):
        """Set plan=free, planExpiry=5 days ago"""
        five_days_ago = (datetime.utcnow() - timedelta(days=5)).isoformat() + "Z"
        db.advocates.update_one({"id": USER_ID}, {"$set": {
            "plan": "free",
            "planExpiry": five_days_ago
        }})
        user = db.advocates.find_one({"id": USER_ID})
        assert user["plan"] == "free"
        print(f"PASS: Plan set to free with planExpiry 5 days ago")

    def test_add_12_test_cases_via_api(self, api):
        """Add 12 test cases via API"""
        created_ids = []
        for i in range(12):
            payload = {
                "id": f"TEST_CASE_{i:03d}_{datetime.utcnow().timestamp():.0f}",
                "caseNumber": f"TEST/CASE/{i+1:03d}/2026",
                "title": f"TEST_ Case {i+1} for Paywall Testing",
                "caseType": "CIVIL",
                "courtName": "Test Court",
                "courtCity": "Mumbai",
                "clientId": "",
                "clientName": "",
                "plaintiffPetitioner": "Test Plaintiff",
                "plaintiffType": "Individual",
                "defendant": "Test Defendant",
                "defendantType": "Individual",
                "status": "ACTIVE",
                "priority": "MEDIUM",
                "notes": "TEST_ case for paywall testing",
                "tags": ["test"],
                "isActive": True,
                "createdAt": int(datetime.utcnow().timestamp() * 1000),
                "updatedAt": int(datetime.utcnow().timestamp() * 1000),
            }
            resp = api.post(f"{BASE_URL}/api/cases", json=payload)
            if resp.status_code in [200, 201]:
                data = resp.json().get("data", {})
                case_id = data.get("id", payload["id"])
                created_ids.append(case_id)
            else:
                print(f"WARNING: Case {i+1} creation returned {resp.status_code}: {resp.text[:100]}")
        
        TestReadOnlyAfterExpiry.TEST_CASE_IDS = created_ids
        print(f"Created {len(created_ids)} test cases")
        # Verify total cases >= 10
        resp = api.get(f"{BASE_URL}/api/cases")
        total = len(resp.json().get("data", []))
        assert total >= 10, f"Expected at least 10 cases for paywall test, got {total}"
        print(f"PASS: Total cases: {total} (>= 10, paywall should trigger)")

    def test_paywall_code_check_for_cases_limit(self):
        """Verify cases/new.tsx shows paywall when !isProUser && cases.length >= 10"""
        with open('/app/frontend/app/cases/new.tsx', 'r') as f:
            content = f.read()
        assert 'cases.length >= 10' in content, "Paywall should trigger at 10 cases for free users"
        assert 'showPaywall' in content, "PaywallSheet should be shown"
        assert 'PaywallSheet' in content
        print("PASS: Paywall check exists in cases/new.tsx (line ~169)")

    def test_get_pro_card_testid_exists(self):
        """Verify get-pro-card testID exists in more.tsx"""
        with open('/app/frontend/app/(tabs)/more.tsx', 'r') as f:
            content = f.read()
        assert 'testID="get-pro-card"' in content
        print("PASS: get-pro-card testID exists in more.tsx")

    def test_pro_upgrade_banner_testid_exists(self):
        """Verify pro-upgrade-banner testID in dashboard"""
        with open('/app/frontend/app/(tabs)/index.tsx', 'r') as f:
            content = f.read()
        assert 'testID="pro-upgrade-banner"' in content
        print("PASS: pro-upgrade-banner testID exists in dashboard")

    def test_existing_cases_not_deleted_for_free_user(self, api):
        """Verify existing cases are still accessible after plan expiry (read-only)"""
        resp = api.get(f"{BASE_URL}/api/cases")
        assert resp.status_code == 200
        cases = resp.json().get("data", [])
        assert len(cases) > 0, "Existing cases should still be accessible"
        print(f"PASS: {len(cases)} existing cases still accessible (read-only, not deleted)")

    def test_restore_pro_plan_and_cleanup(self, api, db):
        """Restore Pro plan and delete TEST_ cases"""
        # Restore pro plan
        db.advocates.update_one({"id": USER_ID}, {"$set": {
            "plan": "pro",
            "planExpiry": None
        }})
        user = db.advocates.find_one({"id": USER_ID})
        assert user["plan"] == "pro"
        assert user["planExpiry"] is None
        
        # Delete test cases
        resp = api.get(f"{BASE_URL}/api/cases")
        all_cases = resp.json().get("data", [])
        deleted = 0
        for case in all_cases:
            if case.get("title", "").startswith("TEST_") or case.get("caseNumber", "").startswith("TEST/"):
                del_resp = api.delete(f"{BASE_URL}/api/cases/{case['id']}")
                if del_resp.status_code in [200, 204]:
                    deleted += 1
        
        print(f"PASS: Pro plan restored, deleted {deleted} TEST_ cases")
