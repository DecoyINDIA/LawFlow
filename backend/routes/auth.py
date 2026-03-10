from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from database import get_db
from models.advocate import AdvocateDB, AdvocateResponse
import random
import uuid
import os
import re
import string
import logging
import requests as http_requests

# MSG91 Setup:
# 1. Sign up at msg91.com
# 2. SMS > OTP > Create Template
# 3. Template: "Your LawFlow OTP is ##OTP##. Valid for 10 minutes."
# 4. Auth Key from Dashboard > Username > Auth Key
# 5. Set env vars: MSG91_AUTH_KEY and MSG91_TEMPLATE_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# ── JWT Secret ────────────────────────────────────────────────────────────
_JWT_SECRET = os.environ.get("JWT_SECRET")
_APP_ENV = os.environ.get("APP_ENV", "production")
_DEV_FALLBACK = "dev-secret-change-in-production"

if _JWT_SECRET:
    SECRET_KEY = _JWT_SECRET
else:
    SECRET_KEY = _DEV_FALLBACK
    if _APP_ENV == "development":
        logger.warning("⚠️ Using dev JWT secret — set JWT_SECRET in production")
    else:
        logger.warning("⚠️ JWT_SECRET not set — using dev fallback (INSECURE for production)")

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30

# ── Referral code helper ──────────────────────────────────────────────────
def generate_referral_code(name: str) -> str:
    letters = re.sub(r'[^A-Za-z]', '', name).upper()
    prefix = (letters + "XXXX")[:4]
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=4))
    return prefix + suffix

# ── MSG91 config ──────────────────────────────────────────────────────────
MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "")
MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"

# ── In-memory OTP store ───────────────────────────────────────────────────
_otp_store: dict = {}
_security = HTTPBearer()

# ── Mock OTP for test phone ───────────────────────────────────────────────
MOCK_PHONE = "+919876543210"
MOCK_OTP = "123456"
MOCK_PHONES = {"9876543210", "9888888888", "+919876543210", "+919888888888", "9999999999", "+919999999999"}

# ── Protected numbers (lifetime Pro) ─────────────────────────────────────
PROTECTED_NUMBERS = {"9538556555", "9861960969"}


def send_otp_msg91(phone: str, otp: str) -> None:
    """Send OTP via MSG91. Raises on HTTP/network error."""
    payload = {
        "template_id": MSG91_TEMPLATE_ID,
        "mobile": f"91{phone.lstrip('+').lstrip('91')}",
        "otp": otp,
    }
    resp = http_requests.post(
        MSG91_OTP_URL,
        json=payload,
        headers={"authkey": MSG91_AUTH_KEY, "Content-Type": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()


def create_token(advocate_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": advocate_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_advocate(
    credentials: HTTPAuthorizationCredentials = Security(_security),
    db=Depends(get_db),
) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        advocate_id: str = payload.get("sub")
        if not advocate_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        advocate = await db.advocates.find_one({"id": advocate_id}, {"_id": 0})
        if not advocate:
            raise HTTPException(status_code=401, detail="Advocate not found")
        return advocate
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    otp: str


@router.post("/request-otp")
async def request_otp(body: OTPRequest):
    # Normalise phone: strip spaces, ensure +91 prefix for Indian numbers
    phone = body.phone.strip()

    # Always allow mock OTP for test phone (both +91 and raw 10-digit)
    clean_digits = phone.replace("+91", "").replace(" ", "")
    is_mock_phone = clean_digits in MOCK_PHONES or phone in MOCK_PHONES

    # In dev mode, use mock OTP for ALL phones so tests can use multiple advocates
    if _APP_ENV == "development":
        otp = MOCK_OTP
    else:
        otp = MOCK_OTP if is_mock_phone else str(random.randint(100000, 999999))

    _otp_store[phone] = {
        "otp": otp,
        "expiry": datetime.utcnow() + timedelta(minutes=10),
    }

    if MSG91_AUTH_KEY and not is_mock_phone:
        # Real SMS via MSG91
        try:
            send_otp_msg91(phone, otp)
            logger.info("📱 OTP sent via MSG91 to %s", phone)
        except Exception as exc:
            logger.error("MSG91 send failed for %s: %s", phone, exc)
            # SMS failed — log and continue, OTP still valid in store
    else:
        logger.info("🔐 DEV OTP for %s: %s", phone, otp)

    # Never expose OTP in response (dev_otp field only for non-mock phones in dev)
    response: dict = {"success": True, "message": "OTP sent"}
    if _APP_ENV == "development" and not is_mock_phone:
        response["dev_otp"] = otp
    return response


@router.post("/verify-otp")
async def verify_otp(body: OTPVerify, db=Depends(get_db)):
    phone = body.phone.strip()

    # ── Dev / mock-phone bypass ─────────────────────────────────────────
    # In development mode, always accept MOCK_OTP for mock phones
    # (prevents failures when backend restarts between request/verify)
    clean_digits = phone.replace("+91", "").replace(" ", "")
    is_mock_phone = clean_digits in MOCK_PHONES or phone in MOCK_PHONES
    if is_mock_phone and body.otp == MOCK_OTP:
        pass  # bypass OTP store check — mock phones always accept MOCK_OTP
    else:
        # Also check raw 10-digit key if +91 prefixed
        record = _otp_store.get(phone)
        if not record:
            # Try the +91-prefixed version
            alt_phone = f"+91{phone}" if not phone.startswith("+") else phone
            record = _otp_store.get(alt_phone)
            if record:
                phone = alt_phone

        if not record or record["otp"] != body.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP")
        if datetime.utcnow() > record["expiry"]:
            raise HTTPException(status_code=400, detail="OTP expired")

    # Normalise phone for DB: always use raw 10-digit (strip +91 prefix)
    db_phone = phone.replace("+91", "").replace(" ", "")

    advocate = await db.advocates.find_one({"phone": db_phone}, {"_id": 0})
    is_new = False
    if not advocate:
        # Generate unique referral code for new advocate
        while True:
            code = generate_referral_code("")
            existing = await db.advocates.find_one({"referralCode": code}, {"_id": 1})
            if not existing:
                break
        advocate = {
            "id": str(uuid.uuid4()),
            "phone": db_phone,
            "name": None,
            "plan": "free",
            "planExpiry": None,
            "referralCode": code,
            "referredBy": None,
            "referralRedeemedAt": None,
            "createdAt": datetime.utcnow().isoformat(),
        }
        await db.advocates.insert_one({**advocate})
        is_new = True

    # ── Protected numbers: auto-set lifetime Pro on signup ──────────────
    if db_phone in PROTECTED_NUMBERS:
        await db.advocates.update_one(
            {"phone": db_phone},
            {"$set": {
                "plan": "pro",
                "planExpiry": (datetime.utcnow() + timedelta(days=36500)).isoformat(),
                "protected": True,
            }},
        )
        # refresh advocate dict for token response
        advocate = await db.advocates.find_one({"phone": db_phone}, {"_id": 0})

    token = create_token(advocate["id"])
    _otp_store.pop(phone, None)

    return {"success": True, "token": token, "advocate": advocate, "isNewUser": is_new}


@router.get("/me")
async def get_me(advocate=Depends(get_current_advocate), db=Depends(get_db)):
    # Auto-generate referral code for legacy accounts that don't have one
    if not advocate.get("referralCode"):
        code = generate_referral_code(advocate.get("name", ""))
        for _ in range(10):
            existing = await db.advocates.find_one({"referralCode": code}, {"_id": 1})
            if not existing:
                break
            code = generate_referral_code("")
        await db.advocates.update_one({"id": advocate["id"]}, {"$set": {"referralCode": code}})
        advocate["referralCode"] = code
    return {"success": True, "data": advocate}


@router.put("/me")
async def update_me(body: dict, advocate=Depends(get_current_advocate), db=Depends(get_db)):
    disallowed = {'id', 'phone', 'createdAt', '_id'}
    update_data = {k: v for k, v in body.items() if k not in disallowed}
    if update_data:
        await db.advocates.update_one({"id": advocate["id"]}, {"$set": update_data})
    updated = await db.advocates.find_one({"id": advocate["id"]}, {"_id": 0})
    return {"success": True, "data": updated}
