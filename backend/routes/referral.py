import logging
from fastapi import APIRouter, Depends
from database import get_db
from routes.auth import get_current_advocate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/referral", tags=["referral"])


# ── POST /api/referral/validate ──────────────────────────────────────────────
@router.post("/validate")
async def validate_referral_code(body: dict, db=Depends(get_db)):
    """Validate a referral code — no auth required (called during onboarding)."""
    code = (body.get("code") or "").strip().upper()
    if not code:
        return {"valid": False}

    advocate = await db.advocates.find_one(
        {"referralCode": code}, {"_id": 0, "name": 1}
    )
    if not advocate:
        return {"valid": False}

    return {"valid": True, "advocateName": advocate.get("name") or "LawFlow User"}


# ── GET /api/referral/stats ──────────────────────────────────────────────────
@router.get("/stats")
async def get_referral_stats(advocate=Depends(get_current_advocate), db=Depends(get_db)):
    """Return referral stats for the current advocate."""
    code = advocate.get("referralCode")
    if not code:
        return {"referralCode": None, "totalReferred": 0, "totalRewarded": 0}

    total_referred = await db.advocates.count_documents({"referredBy": code})
    total_rewarded = await db.advocates.count_documents(
        {"referredBy": code, "referralRedeemedAt": {"$ne": None}}
    )

    return {
        "referralCode": code,
        "totalReferred": total_referred,
        "totalRewarded": total_rewarded,
    }
