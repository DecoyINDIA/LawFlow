"""
LawFlow Background Scheduler
================================

Jobs:
  1. Daily Digest      — Every day at 08:00 IST
     Sends push: "Good morning! You have X hearings this week: ..."

  2. eCourts Refresh   — Every Monday at 08:05 IST (5 min after digest)
     Re-checks all active cases whose caseNumber looks like a CNR.
     If eCourts returns a new/changed hearing date:
       • Creates a hearing record in MongoDB
       • Updates case.nextHearingDate
       • Sends push: "📋 [Case Title] — new hearing on [date]"
     CAPTCHA / timeout cases are silently skipped and logged.

Push delivery: Expo Push Notification API
  https://docs.expo.dev/push-notifications/sending-notifications/

Manual triggers:
  POST /api/notifications/digest/send   — trigger digest for current advocate
  POST /api/ecourts/refresh-all         — trigger eCourts refresh for current advocate
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
IST = pytz.timezone("Asia/Kolkata")

_scheduler: Optional[AsyncIOScheduler] = None

# "Active" statuses — anything else is considered closed/done
_INACTIVE_STATUSES = {"CLOSED", "DISPOSED", "WITHDRAWN", "DISPOSED_OFF", "DECIDED"}


# ── Scheduler lifecycle ───────────────────────────────────────────────────

def start_scheduler(db) -> None:
    """Start both background jobs. Called from server.py on startup."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone=IST)

    # Job 1: Daily digest — every day at 08:00 IST
    _scheduler.add_job(
        _daily_digest_job,
        CronTrigger(hour=8, minute=0, timezone=IST),
        id="daily_digest",
        name="Daily Hearing Digest",
        replace_existing=True,
        args=[db],
    )

    # Job 2: eCourts refresh — every Monday at 08:05 IST
    _scheduler.add_job(
        _case_status_refresh_job,
        CronTrigger(day_of_week="mon", hour=8, minute=5, timezone=IST),
        id="ecourts_refresh",
        name="eCourts Case Status Refresh",
        replace_existing=True,
        args=[db],
    )

    _scheduler.start()
    logger.info("⏰ Scheduler started — daily digest 08:00 IST | eCourts refresh Mon 08:05 IST")


def stop_scheduler() -> None:
    """Gracefully shut down. Called from server.py on shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("⏰ Scheduler stopped")


# ══════════════════════════════════════════════════════════════════════════
# JOB 1 — DAILY DIGEST
# ══════════════════════════════════════════════════════════════════════════

async def _daily_digest_job(db) -> None:
    """Run at 08:00 IST — send digest push to all advocates with push tokens."""
    logger.info("📅 Running daily digest job...")
    try:
        advocates = await db.advocates.find(
            {"pushToken": {"$exists": True, "$ne": None}},
            {"_id": 0, "id": 1, "name": 1, "pushToken": 1},
        ).to_list(length=None)

        if not advocates:
            logger.info("📅 No advocates with push tokens — nothing to send")
            return

        results = await asyncio.gather(
            *[send_digest_to_advocate(db, adv["id"]) for adv in advocates],
            return_exceptions=True,
        )
        success = sum(1 for r in results if isinstance(r, dict) and r.get("sent"))
        logger.info("📅 Digest sent: %d/%d advocates", success, len(advocates))
    except Exception as exc:
        logger.error("📅 Daily digest job failed: %s", exc, exc_info=True)


async def build_digest_payload(db, advocate_id: str) -> dict:
    """Build the digest data for one advocate (used by route preview too)."""
    advocate = await db.advocates.find_one({"id": advocate_id}, {"_id": 0})
    if not advocate:
        return {"error": "Advocate not found"}

    now_ist = datetime.now(IST)
    today_midnight = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = today_midnight + timedelta(days=7)
    today_ms = int(today_midnight.timestamp() * 1000)
    week_end_ms = int(week_end.timestamp() * 1000)

    hearings_raw = await db.hearings.find(
        {"advocateId": advocate_id, "hearingDate": {"$gte": today_ms, "$lt": week_end_ms}},
        {"_id": 0, "caseId": 1, "hearingDate": 1, "purpose": 1, "courtRoom": 1},
    ).sort("hearingDate", 1).to_list(length=None)

    hearing_list = []
    for h in hearings_raw:
        case = await db.cases.find_one(
            {"id": h["caseId"]},
            {"_id": 0, "title": 1, "caseNumber": 1, "courtName": 1},
        )
        hearing_list.append({
            "caseTitle": (case or {}).get("title", "Unknown Case"),
            "caseNumber": (case or {}).get("caseNumber", ""),
            "date": _fmt_date(h["hearingDate"]),
            "hearingDate": h["hearingDate"],
            "courtName": h.get("courtRoom") or (case or {}).get("courtName", ""),
        })

    advocate_name = advocate.get("name") or "Counsellor"
    first_name = advocate_name.replace("Adv.", "").replace("adv.", "").strip().split()[0]
    count = len(hearing_list)

    if count == 0:
        body = "No hearings scheduled for this week. Stay prepared!"
    elif count == 1:
        body = f"1 hearing this week — {hearing_list[0]['caseTitle']} on {hearing_list[0]['date']}"
    else:
        brief = ", ".join(f"{h['caseTitle']} ({h['date']})" for h in hearing_list[:3])
        suffix = f" +{count - 3} more" if count > 3 else ""
        body = f"{count} hearings this week: {brief}{suffix}"

    return {
        "advocate_name": advocate_name,
        "push_token": advocate.get("pushToken"),
        "week_hearings": hearing_list,
        "hearing_count": count,
        "title": f"Good morning, {first_name}! 🌅",
        "body": body,
    }


async def send_digest_to_advocate(db, advocate_id: str) -> dict:
    """Build and send the daily digest push to one advocate."""
    payload = await build_digest_payload(db, advocate_id)
    if payload.get("error"):
        return {"sent": False, "error": payload["error"]}

    push_token = payload.get("push_token")
    if not push_token:
        return {"sent": False, "reason": "no_push_token", "digest": payload}

    sent = await _send_push(
        push_token,
        title=payload["title"],
        body=payload["body"],
        data={"type": "DAILY_DIGEST", "hearingCount": payload["hearing_count"]},
    )
    return {
        "sent": sent["ok"],
        "expo_response": sent.get("response"),
        "digest": {k: v for k, v in payload.items() if k != "push_token"},
    }


# ══════════════════════════════════════════════════════════════════════════
# JOB 2 — ECOURTS CASE STATUS REFRESH
# ══════════════════════════════════════════════════════════════════════════

async def _case_status_refresh_job(db) -> None:
    """Monday 08:05 IST — re-check eCourts for all active cases with CNR numbers."""
    logger.info("🔄 Starting eCourts case status refresh...")
    try:
        # All advocates (to send push if needed)
        advocates_list = await db.advocates.find(
            {}, {"_id": 0, "id": 1, "pushToken": 1}
        ).to_list(length=None)
        advocate_map = {a["id"]: a for a in advocates_list}

        # All active cases
        cases = await db.cases.find(
            {
                "isActive": True,
                "status": {"$nin": list(_INACTIVE_STATUSES)},
            },
            {"_id": 0, "id": 1, "advocateId": 1, "caseNumber": 1,
             "title": 1, "nextHearingDate": 1, "courtName": 1},
        ).to_list(length=None)

        cnr_cases = [c for c in cases if _is_cnr(c.get("caseNumber", ""))]
        if not cnr_cases:
            logger.info("🔄 No active cases with CNR numbers — nothing to refresh")
            return

        logger.info("🔄 Refreshing %d cases with CNRs...", len(cnr_cases))
        counts = {"updated": 0, "skipped": 0, "unchanged": 0}

        for case in cnr_cases:
            outcome = await _check_single_case(db, case, advocate_map)
            counts[outcome] = counts.get(outcome, 0) + 1

        logger.info(
            "🔄 Refresh complete — updated: %d | unchanged: %d | skipped: %d",
            counts["updated"], counts["unchanged"], counts["skipped"],
        )
    except Exception as exc:
        logger.error("🔄 eCourts refresh job failed: %s", exc, exc_info=True)


async def refresh_all_for_advocate(db, advocate_id: str) -> dict:
    """
    Manual trigger: run eCourts refresh for one advocate's active cases only.
    Used by POST /api/ecourts/refresh-all.
    Returns a detailed summary.
    """
    cases = await db.cases.find(
        {
            "advocateId": advocate_id,
            "isActive": True,
            "status": {"$nin": list(_INACTIVE_STATUSES)},
        },
        {"_id": 0, "id": 1, "advocateId": 1, "caseNumber": 1,
         "title": 1, "nextHearingDate": 1, "courtName": 1},
    ).to_list(length=None)

    cnr_cases = [c for c in cases if _is_cnr(c.get("caseNumber", ""))]

    advocate = await db.advocates.find_one({"id": advocate_id}, {"_id": 0})
    advocate_map = {advocate_id: advocate} if advocate else {}

    summary = {
        "total_active": len(cases),
        "cnr_cases": len(cnr_cases),
        "checked": 0, "updated": 0, "skipped": 0, "unchanged": 0,
        "cases": [],
    }

    for case in cnr_cases:
        outcome = await _check_single_case(db, case, advocate_map)
        summary["checked"] += 1
        summary[outcome] = summary.get(outcome, 0) + 1
        summary["cases"].append({
            "caseId": case["id"],
            "caseNumber": case["caseNumber"],
            "title": case.get("title", ""),
            "prevHearingDate": case.get("nextHearingDate"),
            "result": outcome,
        })

    return summary


# ── Per-case logic ────────────────────────────────────────────────────────

def _is_cnr(case_number: str) -> bool:
    """True if caseNumber looks like a 14-18 char alphanumeric CNR
    (starts with 2 letters = state code, rest alphanumeric)."""
    clean = (case_number or "").replace("-", "").replace(" ", "").replace(".", "").upper()
    return (
        14 <= len(clean) <= 18
        and clean[:2].isalpha()
        and clean.isalnum()
    )


async def _check_single_case(db, case: dict, advocate_map: dict) -> str:
    """
    Call eCourts for one case and apply any update.
    Returns: 'updated' | 'unchanged' | 'skipped'
    """
    cnr = case["caseNumber"].replace("-", "").replace(" ", "").replace(".", "").upper()
    try:
        # Import here to avoid circular imports at module load time
        from routes.ecourts import _fetch_from_ecourts, EcourtsLookupRequest

        result = await _fetch_from_ecourts(EcourtsLookupRequest(cnr_number=cnr))

        if result.source in ("unavailable", "not_found"):
            logger.debug("🔄 %s → skipped (%s)", cnr, result.source)
            return "skipped"

        new_ts = result.nextHearingDateTimestamp
        if not new_ts:
            return "unchanged"

        old_ts = case.get("nextHearingDate")
        # Treat dates within the same day (±24 h) as unchanged
        if old_ts and abs(new_ts - old_ts) < 86_400_000:
            return "unchanged"

        await _apply_date_update(db, case, new_ts, result, advocate_map)
        return "updated"

    except Exception as exc:
        logger.warning("🔄 %s → error during check: %s", cnr, exc)
        return "skipped"


async def _apply_date_update(
    db, case: dict, new_ts: int, ecourts_result, advocate_map: dict
) -> None:
    """Persist new hearing date, create hearing record, send push notification."""
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    case_id = case["id"]
    advocate_id = case["advocateId"]
    cnr = case["caseNumber"]
    date_str = _fmt_date(new_ts)

    # 1. Update case.nextHearingDate
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {"nextHearingDate": new_ts, "updatedAt": now_ms}},
    )

    # 2. Create new hearing record (avoid duplicates on same day)
    existing = await db.hearings.find_one(
        {"caseId": case_id, "hearingDate": {"$gte": new_ts - 86_400_000, "$lte": new_ts + 86_400_000}},
    )
    if not existing:
        hearing_doc = {
            "id": str(uuid.uuid4()),
            "advocateId": advocate_id,
            "caseId": case_id,
            "hearingDate": new_ts,
            "courtRoom": ecourts_result.courtName or case.get("courtName"),
            "purpose": "Court Hearing",
            "notes": f"Auto-refreshed from eCourts on {_fmt_date(now_ms)}",
            "clientNotified": False,
            "createdAt": now_ms,
        }
        await db.hearings.insert_one(hearing_doc)

    # 3. Push notification
    advocate = advocate_map.get(advocate_id, {})
    push_token = advocate.get("pushToken") if advocate else None
    if push_token:
        case_title = case.get("title") or cnr
        await _send_push(
            push_token,
            title="📋 New Hearing Date",
            body=f"{case_title} — new hearing on {date_str}",
            data={"type": "CASE_REFRESH", "caseId": case_id, "cnr": cnr},
        )

    logger.info("🔄 Updated %s (CNR: %s) → new hearing on %s", case_id, cnr, date_str)


# ══════════════════════════════════════════════════════════════════════════
# SHARED HELPERS
# ══════════════════════════════════════════════════════════════════════════

async def _send_push(token: str, title: str, body: str, data: dict) -> dict:
    """Send a single Expo push notification. Returns {ok: bool, response: dict}."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json={
                    "to": token,
                    "title": title,
                    "body": body,
                    "sound": "default",
                    "data": data,
                    "priority": "high",
                },
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            result = resp.json()
            ok = (
                resp.status_code == 200
                and isinstance(result.get("data"), dict)
                and result["data"].get("status") == "ok"
            )
            logger.info("📲 Push %s — %s", "ok" if ok else "failed", title)
            return {"ok": ok, "response": result}
    except Exception as exc:
        logger.error("📲 Push error: %s", exc)
        return {"ok": False, "error": str(exc)}


def _fmt_date(ts_ms: int) -> str:
    """Format a Unix timestamp (ms) → 'Mon 3 Mar'."""
    try:
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=IST)
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return f"{days[dt.weekday()]} {dt.day} {months[dt.month - 1]}"
    except Exception:
        return ""
