from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models.case import CaseCreate, CaseUpdate
from models.firm import CaseAssign
from routes.auth import get_current_advocate
from datetime import datetime
import uuid

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("")
async def list_cases(advocate=Depends(get_current_advocate), db=Depends(get_db)):
    # Return own cases + cases assigned BY this advocate (so Senior sees assigned cases)
    cases = await db.cases.find(
        {"$or": [
            {"advocateId": advocate["id"]},
            {"assignedBy": advocate["id"]},
        ]},
        {"_id": 0}
    ).to_list(None)
    return {"success": True, "data": cases}


@router.post("")
async def create_case(
    body: CaseCreate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    data = body.model_dump()
    data.pop("syncPending", None)
    case_id = data.pop("id", None) or str(uuid.uuid4())
    now = int(datetime.utcnow().timestamp() * 1000)
    created_at = data.pop("createdAt", None) or now
    data.pop("updatedAt", None)
    case = {
        "id": case_id,
        "advocateId": advocate["id"],
        "createdAt": created_at,
        "updatedAt": now,
        **data,
    }
    case.setdefault("hearings", [])
    case.setdefault("documents", [])
    case.setdefault("voiceNotes", [])
    await db.cases.update_one({"id": case_id}, {"$set": case}, upsert=True)
    stored = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return {"success": True, "data": stored}


@router.get("/{case_id}")
async def get_case(
    case_id: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    case = await db.cases.find_one(
        {"id": case_id, "advocateId": advocate["id"]}, {"_id": 0}
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"success": True, "data": case}


@router.put("/{case_id}")
async def update_case(
    case_id: str,
    body: CaseUpdate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data.pop("syncPending", None)
    update_data["updatedAt"] = int(datetime.utcnow().timestamp() * 1000)
    result = await db.cases.update_one(
        {"id": case_id, "advocateId": advocate["id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")

    # ── Upsert "Next Hearing" hearing when nextHearingDate changes ─────────
    # Never leave stale "Next Hearing" entries after a case edit.
    new_date = update_data.get("nextHearingDate")
    if new_date:
        # Find the most recent unresolved "Next Hearing" (outcome=null/missing)
        existing = await db.hearings.find_one({
            "caseId": case_id,
            "purpose": "Next Hearing",
            "outcome": None,          # matches both absent and null
        })
        if existing:
            # Update existing entry to the new date
            await db.hearings.update_one(
                {"_id": existing["_id"]},
                {"$set": {"hearingDate": new_date}},
            )
            # Delete any other stale "Next Hearing" entries for this case
            await db.hearings.delete_many({
                "caseId": case_id,
                "purpose": "Next Hearing",
                "outcome": None,
                "_id": {"$ne": existing["_id"]},
            })
        else:
            # No active "Next Hearing" exists — insert a fresh one
            now = int(datetime.utcnow().timestamp() * 1000)
            hearing = {
                "id": str(uuid.uuid4()),
                "advocateId": advocate["id"],
                "caseId": case_id,
                "hearingDate": new_date,
                "purpose": "Next Hearing",
                "clientNotified": False,
                "createdAt": now,
            }
            await db.hearings.insert_one(hearing)
    # ──────────────────────────────────────────────────────────────────────

    case = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return {"success": True, "data": case}


@router.delete("/{case_id}")
async def delete_case(
    case_id: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    result = await db.cases.delete_one(
        {"id": case_id, "advocateId": advocate["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    await db.hearings.delete_many({"caseId": case_id})
    return {"success": True, "message": "Case deleted"}


@router.put("/{case_id}/assign")
async def assign_case(
    case_id: str,
    body: CaseAssign,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    firm = await db.firms.find_one({"ownerId": advocate["id"]}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=403, detail="Only firm owner can assign cases")

    member_ids = [m["advocateId"] for m in firm.get("members", [])]
    if body.assignedTo not in member_ids:
        raise HTTPException(status_code=400, detail="Target is not a firm member")

    case = await db.cases.find_one(
        {"id": case_id, "advocateId": {"$in": member_ids}}, {"_id": 0}
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found in firm")

    old_advocate = case["advocateId"]
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {
            "advocateId": body.assignedTo,
            "assignedBy": advocate["id"],
            "updatedAt": int(datetime.utcnow().timestamp() * 1000),
        }},
    )

    await db.hearings.update_many(
        {"caseId": case_id, "advocateId": old_advocate},
        {"$set": {"advocateId": body.assignedTo}},
    )

    updated = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return {"success": True, "data": updated}
