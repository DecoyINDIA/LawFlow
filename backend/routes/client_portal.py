from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from routes.auth import get_current_advocate
from datetime import datetime, timedelta
import secrets
import uuid

router = APIRouter(prefix="/portal", tags=["client-portal"])


class PortalGenerateRequest(BaseModel):
    clientId: str
    caseIds: List[str] = []
    notes: Optional[str] = None
    expiresInDays: int = 30


class PortalRevokeResponse(BaseModel):
    success: bool
    message: str


@router.post("/generate")
async def generate_portal_link(
    body: PortalGenerateRequest,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    client = await db.clients.find_one(
        {"id": body.clientId, "advocateId": advocate["id"]}, {"_id": 0}
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if body.caseIds:
        for case_id in body.caseIds:
            case = await db.cases.find_one(
                {"id": case_id, "advocateId": advocate["id"]}, {"_id": 0}
            )
            if not case:
                raise HTTPException(
                    status_code=404, detail=f"Case {case_id} not found"
                )

    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()

    portal_link = {
        "id": str(uuid.uuid4()),
        "token": token,
        "advocateId": advocate["id"],
        "clientId": body.clientId,
        "caseIds": body.caseIds,
        "notes": body.notes,
        "createdAt": now.isoformat(),
        "expiresAt": (now + timedelta(days=body.expiresInDays)).isoformat(),
        "revoked": False,
    }

    await db.portal_links.insert_one({**portal_link})

    return {"success": True, "data": portal_link}


@router.get("/links")
async def list_portal_links(
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    links = await db.portal_links.find(
        {"advocateId": advocate["id"], "revoked": False}, {"_id": 0}
    ).to_list(None)
    return {"success": True, "data": links}


@router.get("/{token}")
async def get_portal(token: str, db=Depends(get_db)):
    link = await db.portal_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Portal link not found")

    if link.get("revoked"):
        raise HTTPException(status_code=410, detail="Portal link has been revoked")

    expires_at = datetime.fromisoformat(link["expiresAt"])
    if datetime.utcnow() > expires_at:
        raise HTTPException(status_code=410, detail="Portal link has expired")

    advocate_id = link["advocateId"]
    client_id = link["clientId"]

    client = await db.clients.find_one(
        {"id": client_id, "advocateId": advocate_id}, {"_id": 0}
    )
    client_info = None
    if client:
        client_info = {
            "name": client.get("name"),
            "phone": client.get("phone"),
            "email": client.get("email"),
        }

    cases = []
    if link.get("caseIds"):
        for case_id in link["caseIds"]:
            case = await db.cases.find_one(
                {"id": case_id, "advocateId": advocate_id, "clientId": client_id},
                {"_id": 0},
            )
            if case:
                cases.append({
                    "id": case.get("id"),
                    "caseNumber": case.get("caseNumber"),
                    "title": case.get("title"),
                    "courtName": case.get("courtName"),
                    "status": case.get("status"),
                    "nextHearingDate": case.get("nextHearingDate"),
                })

    advocate = await db.advocates.find_one(
        {"id": advocate_id}, {"_id": 0}
    )
    advocate_info = None
    if advocate:
        advocate_info = {
            "name": advocate.get("name"),
            "phone": advocate.get("phone"),
        }

    return {
        "success": True,
        "data": {
            "client": client_info,
            "cases": cases,
            "notes": link.get("notes"),
            "advocate": advocate_info,
            "expiresAt": link["expiresAt"],
        },
    }


@router.delete("/{token}")
async def revoke_portal_link(
    token: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    result = await db.portal_links.update_one(
        {"token": token, "advocateId": advocate["id"]},
        {"$set": {"revoked": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Portal link not found")
    return {"success": True, "message": "Portal link revoked"}
