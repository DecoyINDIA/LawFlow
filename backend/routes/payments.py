import os
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Request, HTTPException

import razorpay

from database import db
from routes.auth import get_current_advocate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

AMOUNTS = {
    "monthly": 9900,   # paise = ₹99
    "yearly": 99900,   # paise = ₹999
}


def get_razorpay_client():
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Razorpay not configured")
    return razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def _plan_expiry(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "yearly":
        return now + timedelta(days=365)
    return now + timedelta(days=30)


# ── POST /api/payments/create-order ──────────────────────────────────────
@router.post("/create-order")
async def create_order(body: dict, advocate=Depends(get_current_advocate)):
    period = body.get("period", "monthly")
    if period not in AMOUNTS:
        raise HTTPException(status_code=400, detail="period must be 'monthly' or 'yearly'")

    client = get_razorpay_client()
    amount = AMOUNTS[period]

    try:
        order = client.order.create({
            "amount": amount,
            "currency": "INR",
            "receipt": f"lawflow_{advocate['id'][:8]}_{period}",
            "notes": {
                "advocate_id": advocate["id"],
                "period": period,
            },
        })
    except Exception as e:
        logger.error(f"Razorpay create order error: {e}")
        raise HTTPException(status_code=502, detail="Failed to create payment order")

    # Save order ID to advocate record
    await db.advocates.update_one(
        {"id": advocate["id"]},
        {"$set": {"razorpayOrderId": order["id"]}}
    )

    return {
        "orderId": order["id"],
        "amount": amount,
        "currency": "INR",
        "keyId": RAZORPAY_KEY_ID,
    }


# ── POST /api/payments/verify ─────────────────────────────────────────────
@router.post("/verify")
async def verify_payment(body: dict, advocate=Depends(get_current_advocate)):
    order_id = body.get("razorpay_order_id", "")
    payment_id = body.get("razorpay_payment_id", "")
    signature = body.get("razorpay_signature", "")
    period = body.get("period", "monthly")

    if not all([order_id, payment_id, signature]):
        raise HTTPException(status_code=400, detail="Missing payment fields")

    # Verify HMAC SHA256
    msg = f"{order_id}|{payment_id}"
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        msg.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    expiry = _plan_expiry(period)
    history_entry = {
        "orderId": order_id,
        "paymentId": payment_id,
        "amount": AMOUNTS.get(period, 9900),
        "period": period,
        "paidAt": datetime.now(timezone.utc).isoformat(),
    }

    await db.advocates.update_one(
        {"id": advocate["id"]},
        {
            "$set": {
                "plan": "pro",
                "planExpiry": expiry,
            },
            "$push": {"planHistory": history_entry},
        }
    )

    # ── Referral bonus (first payment only) ──────────────────────────────
    adv_fresh = await db.advocates.find_one({"id": advocate["id"]})
    referred_by_code = adv_fresh.get("referredBy") if adv_fresh else None
    referral_redeemed = adv_fresh.get("referralRedeemedAt") if adv_fresh else None

    if referred_by_code and not referral_redeemed:
        # User B gets bonus days
        bonus_days = 455 if period == "yearly" else 45
        bonus_expiry = datetime.now(timezone.utc) + timedelta(days=bonus_days)
        expiry = bonus_expiry  # update response value

        await db.advocates.update_one(
            {"id": advocate["id"]},
            {"$set": {"planExpiry": bonus_expiry, "referralRedeemedAt": datetime.now(timezone.utc)}}
        )

        # User A gets +30 days added to planExpiry
        referrer = await db.advocates.find_one({"referralCode": referred_by_code})
        if referrer:
            ref_exp = referrer.get("planExpiry")
            now_utc = datetime.now(timezone.utc)
            if ref_exp:
                if hasattr(ref_exp, 'tzinfo') and ref_exp.tzinfo is None:
                    ref_exp = ref_exp.replace(tzinfo=timezone.utc)
                base = ref_exp if ref_exp > now_utc else now_utc
            else:
                base = now_utc
            await db.advocates.update_one(
                {"referralCode": referred_by_code},
                {"$set": {"planExpiry": base + timedelta(days=30), "plan": "pro"}}
            )
        logger.info(f"Referral reward applied: User B={advocate['id']} referrer_code={referred_by_code}")

    return {
        "success": True,
        "plan": "pro",
        "planExpiry": expiry.isoformat(),
    }


# ── POST /api/payments/webhook ────────────────────────────────────────────
@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Razorpay calls this directly — no JWT auth."""
    body_bytes = await request.body()
    sig = request.headers.get("X-Razorpay-Signature", "")

    # Verify webhook signature if secret configured
    if RAZORPAY_WEBHOOK_SECRET:
        expected = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, sig):
            logger.warning("Razorpay webhook signature mismatch")
            return {"status": "ok"}  # Always 200

    import json
    try:
        payload = json.loads(body_bytes)
    except Exception:
        return {"status": "ok"}

    event = payload.get("event", "")
    if event == "payment.captured":
        try:
            payment = payload["payload"]["payment"]["entity"]
            notes = payment.get("notes", {})
            advocate_id = notes.get("advocate_id")
            period = notes.get("period", "monthly")
            order_id = payment.get("order_id", "")
            payment_id = payment.get("id", "")

            if advocate_id:
                expiry = _plan_expiry(period)
                history_entry = {
                    "orderId": order_id,
                    "paymentId": payment_id,
                    "amount": payment.get("amount", AMOUNTS.get(period, 9900)),
                    "period": period,
                    "paidAt": datetime.now(timezone.utc).isoformat(),
                }
                await db.advocates.update_one(
                    {"id": advocate_id},
                    {
                        "$set": {"plan": "pro", "planExpiry": expiry},
                        "$push": {"planHistory": history_entry},
                    }
                )
                logger.info(f"Webhook: upgraded advocate {advocate_id} to Pro via {event}")
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")

    return {"status": "ok"}
