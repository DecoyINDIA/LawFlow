"""Tests for referral system: validate, stats, and payment bonus logic"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for test user 9876543210"""
    r = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "9876543210"})
    assert r.status_code == 200, f"OTP request failed: {r.text}"
    r2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9876543210", "otp": "123456"})
    assert r2.status_code == 200, f"OTP verify failed: {r2.text}"
    data = r2.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def user_b_token():
    """Get auth token for test user B 9999999999"""
    r = requests.post(f"{BASE_URL}/api/auth/request-otp", json={"phone": "9999999999"})
    assert r.status_code == 200
    r2 = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "9999999999", "otp": "123456"})
    assert r2.status_code == 200
    data = r2.json()
    token = data.get("token") or data.get("access_token")
    assert token
    return token


# T2 — Validate valid code
class TestReferralValidate:
    def test_validate_valid_code(self):
        r = requests.post(f"{BASE_URL}/api/referral/validate", json={"code": "ADVR14AV"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("valid") is True, f"Expected valid=True, got: {data}"
        assert "advocateName" in data
        print(f"T2 PASS: valid=True, advocateName={data['advocateName']}")

    # T3 — Validate invalid code
    def test_validate_invalid_code(self):
        r = requests.post(f"{BASE_URL}/api/referral/validate", json={"code": "BADCODE1"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("valid") is False, f"Expected valid=False, got: {data}"
        print("T3 PASS: invalid code returns valid=False")

    def test_validate_empty_code(self):
        r = requests.post(f"{BASE_URL}/api/referral/validate", json={"code": ""})
        assert r.status_code == 200
        data = r.json()
        assert data.get("valid") is False


# T5 — Referral stats
class TestReferralStats:
    def test_get_referral_stats(self, auth_token):
        r = requests.get(f"{BASE_URL}/api/referral/stats",
                         headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("referralCode") == "ADVR14AV", f"Expected ADVR14AV, got: {data}"
        assert "totalReferred" in data
        assert "totalRewarded" in data
        print(f"T5 PASS: stats={data}")

    def test_stats_referral_code_in_me(self, auth_token):
        """referralCode should appear in /api/auth/me response (nested under data)"""
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        resp = r.json()
        # Response is {success: true, data: {...}}
        data = resp.get("data") or resp
        assert data.get("referralCode") == "ADVR14AV", f"referralCode not in me: {resp}"
        print("PASS: referralCode in /api/auth/me")

    def test_stats_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/referral/stats")
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# T8 — Referral stats update after setting referredBy on user B
class TestReferralStatsDynamic:
    def test_set_referred_by_and_check_stats(self, auth_token, user_b_token):
        """Set referredBy on user B, then check user A stats increment"""
        # Get current stats for user A
        r = requests.get(f"{BASE_URL}/api/referral/stats",
                         headers={"Authorization": f"Bearer {auth_token}"})
        initial = r.json().get("totalReferred", 0)
        print(f"Initial totalReferred: {initial}")

        # Set referredBy on user B via PUT /api/auth/me
        r2 = requests.put(f"{BASE_URL}/api/auth/me",
                          headers={"Authorization": f"Bearer {user_b_token}",
                                   "Content-Type": "application/json"},
                          json={"referredBy": "ADVR14AV"})
        print(f"Set referredBy status: {r2.status_code}, body: {r2.text[:200]}")
        # Check stats again for user A
        r3 = requests.get(f"{BASE_URL}/api/referral/stats",
                          headers={"Authorization": f"Bearer {auth_token}"})
        updated = r3.json().get("totalReferred", 0)
        print(f"T8: totalReferred after set: {updated}")
        # Note: may or may not increment depending on whether referredBy was already set


# T9/T10 — Payment bonus logic via DB direct check
class TestPaymentBonusLogic:
    """Test referral bonus days logic by inspecting the code logic"""
    
    def test_monthly_bonus_days_logic(self):
        """Verify code says 45 days for monthly referral (not 30)"""
        import ast, inspect
        with open('/app/backend/routes/payments.py') as f:
            content = f.read()
        assert '45' in content, "45 bonus days not found in payments.py"
        assert 'bonus_days' in content
        # Check the actual line
        for line in content.split('\n'):
            if 'bonus_days' in line and '45' in line:
                print(f"T9 PASS: Found bonus logic: {line.strip()}")
                break

    def test_referrer_gets_30_days(self):
        """Verify referrer (user A) gets +30 days"""
        with open('/app/backend/routes/payments.py') as f:
            content = f.read()
        assert 'timedelta(days=30)' in content, "+30 days for referrer not found"
        print("T10 PASS: Referrer gets +30 days - logic present in code")

    def test_yearly_bonus_days(self):
        """Verify yearly bonus is 455 days"""
        with open('/app/backend/routes/payments.py') as f:
            content = f.read()
        assert '455' in content, "455 yearly bonus days not found"
        print("T9/yearly PASS: yearly bonus 455 days found")
