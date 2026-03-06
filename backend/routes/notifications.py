"""
Notification routes for LawFlow.

POST /api/notifications/push-token
  Saves or updates the advocate's Expo push token in MongoDB.
  Called by the frontend after permission is granted.

GET  /api/notifications/digest/preview
  Returns what the daily digest would look like for the current advocate.
  Used for testing without sending an actual push notification.

POST /api/notifications/digest/send
  Manually trigger the digest for the current advocate.
  Useful for testing the Expo push delivery end-to-end.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import logging
from database import get_db
from routes.auth import get_current_advocate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Models ────────────────────────────────────────────────────────────────

class PushTokenBody(BaseModel):
    token: str          # e.g. "ExponentPushToken[xxx]"
    platform: Optional[str] = None   # "ios" | "android"


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("/push-token")
async def save_push_token(
    body: PushTokenBody,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    """Register or refresh the advocate's Expo push token."""
    if not body.token or not body.token.startswith("ExponentPushToken"):
        return {"success": False, "message": "Invalid Expo push token format"}

    await db.advocates.update_one(
        {"id": advocate["id"]},
        {"$set": {"pushToken": body.token, "pushPlatform": body.platform}},
    )
    logger.info("📲 Push token saved for advocate %s (%s)", advocate["id"], body.platform or "unknown")
    return {"success": True, "message": "Push token registered"}


@router.get("/digest/preview")
async def preview_digest(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    """Return the daily digest data for the current advocate (no push sent)."""
    from scheduler import build_digest_payload
    payload = await build_digest_payload(db, advocate["id"])
    return {"success": True, "data": payload}


@router.post("/digest/send")
async def send_digest_now(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    """Manually send the daily digest push notification to this advocate."""
    from scheduler import send_digest_to_advocate
    result = await send_digest_to_advocate(db, advocate["id"])
    return {"success": True, "result": result}


@router.post("/reminders/send")
async def send_reminders_now(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    """
    Manually trigger the evening WhatsApp reminder for this advocate.
    Sends push notifications for all hearings scheduled TOMORROW.
    Useful for testing Expo push delivery end-to-end.
    """
    from scheduler import send_evening_reminders_for_advocate
    result = await send_evening_reminders_for_advocate(db, advocate["id"])
    return {"success": True, "result": result}
