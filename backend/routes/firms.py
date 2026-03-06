from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models.firm import FirmCreate, FirmInvite, FirmAccept
from routes.auth import get_current_advocate
from datetime import datetime
import uuid

router = APIRouter(prefix="/firms", tags=["firms"])


@router.post("")
async def create_firm(
    body: FirmCreate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    existing = await db.firms.find_one(
        {"$or": [
            {"ownerId": advocate["id"]},
            {"members.advocateId": advocate["id"]},
        ]},
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already part of a firm")

    firm = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "ownerId": advocate["id"],
        "members": [
            {
                "advocateId": advocate["id"],
                "phone": advocate["phone"],
                "role": "owner",
                "joinedAt": datetime.utcnow().isoformat(),
            }
        ],
        "invitations": [],
        "createdAt": datetime.utcnow().isoformat(),
    }
    await db.firms.insert_one({**firm})
    return {"success": True, "data": firm}


@router.get("/my")
async def get_my_firm(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    firm = await db.firms.find_one(
        {"$or": [
            {"ownerId": advocate["id"]},
            {"members.advocateId": advocate["id"]},
        ]},
        {"_id": 0},
    )
    if not firm:
        return {"success": True, "data": None}
    return {"success": True, "data": firm}


@router.post("/invite")
async def invite_member(
    body: FirmInvite,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    firm = await db.firms.find_one({"ownerId": advocate["id"]}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=403, detail="Only firm owner can invite")

    phone = body.phone.strip()

    for m in firm.get("members", []):
        if m["phone"] == phone:
            raise HTTPException(status_code=400, detail="Already a member")

    for inv in firm.get("invitations", []):
        if inv["phone"] == phone and inv["status"] == "pending":
            raise HTTPException(status_code=400, detail="Invitation already pending")

    invitation = {
        "phone": phone,
        "invitedAt": datetime.utcnow().isoformat(),
        "status": "pending",
    }
    await db.firms.update_one(
        {"id": firm["id"]},
        {"$push": {"invitations": invitation}},
    )
    return {"success": True, "data": invitation}


@router.post("/accept")
async def accept_invite(
    body: FirmAccept,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    firm = await db.firms.find_one({"id": body.firmId}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")

    phone = advocate["phone"]
    found = False
    for inv in firm.get("invitations", []):
        if inv["phone"] == phone and inv["status"] == "pending":
            found = True
            break

    if not found:
        raise HTTPException(status_code=400, detail="No pending invitation found")

    already_member = any(m["advocateId"] == advocate["id"] for m in firm.get("members", []))
    if already_member:
        raise HTTPException(status_code=400, detail="Already a member")

    member = {
        "advocateId": advocate["id"],
        "phone": phone,
        "role": "junior",
        "joinedAt": datetime.utcnow().isoformat(),
    }
    await db.firms.update_one(
        {"id": body.firmId, "invitations.phone": phone},
        {
            "$push": {"members": member},
            "$set": {"invitations.$.status": "accepted"},
        },
    )
    return {"success": True, "data": member}


@router.delete("/members/{member_id}")
async def remove_member(
    member_id: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    firm = await db.firms.find_one({"ownerId": advocate["id"]}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=403, detail="Only firm owner can remove members")

    if member_id == advocate["id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    result = await db.firms.update_one(
        {"id": firm["id"]},
        {"$pull": {"members": {"advocateId": member_id}}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"success": True, "message": "Member removed"}


@router.get("/dashboard")
async def firm_dashboard(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    firm = await db.firms.find_one({"ownerId": advocate["id"]}, {"_id": 0})
    if not firm:
        raise HTTPException(status_code=403, detail="Only firm owner can view dashboard")

    member_ids = [m["advocateId"] for m in firm.get("members", [])]

    all_cases = await db.cases.find(
        {"advocateId": {"$in": member_ids}}, {"_id": 0}
    ).to_list(None)

    all_hearings = await db.hearings.find(
        {"advocateId": {"$in": member_ids}}, {"_id": 0}
    ).to_list(None)

    workload = {}
    for mid in member_ids:
        member_cases = [c for c in all_cases if c.get("advocateId") == mid]
        member_hearings = [h for h in all_hearings if h.get("advocateId") == mid]
        member_info = next((m for m in firm["members"] if m["advocateId"] == mid), {})
        workload[mid] = {
            "phone": member_info.get("phone", ""),
            "role": member_info.get("role", ""),
            "totalCases": len(member_cases),
            "activeCases": len([c for c in member_cases if c.get("status") == "ACTIVE"]),
            "totalHearings": len(member_hearings),
        }

    return {
        "success": True,
        "data": {
            "firm": firm,
            "totalCases": len(all_cases),
            "totalHearings": len(all_hearings),
            "workload": workload,
            "cases": all_cases,
            "hearings": all_hearings,
        },
    }


