"""
Phase 23 — Case Files API
Stores only file metadata (never binary) in MongoDB case_files collection.
"""
import logging
from datetime import datetime, UTC
from typing import Optional, Annotated
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, BeforeValidator
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ── PyObjectId helper ────────────────────────────────────────────────────────
def _coerce_objectid(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v

PyObjectId = Annotated[str, BeforeValidator(_coerce_objectid)]


# ── Models ────────────────────────────────────────────────────────────────────
class CaseFileCreate(BaseModel):
    caseId: str
    advocateId: Optional[str] = None
    fileName: str
    fileType: str          # PDF | IMAGE | WORD | EXCEL | AUDIO | OTHER
    size: Optional[str] = None
    googleDriveFileId: Optional[str] = None
    googleDriveUrl: Optional[str] = None
    localUri: Optional[str] = None
    isSynced: bool = False
    type: str = "DOCUMENT"  # DOCUMENT | VOICE_NOTE


class CaseFileOut(BaseModel):
    id: PyObjectId
    caseId: str
    advocateId: Optional[str] = None
    fileName: str
    fileType: str
    size: Optional[str] = None
    googleDriveFileId: Optional[str] = None
    googleDriveUrl: Optional[str] = None
    localUri: Optional[str] = None
    isSynced: bool
    type: str
    createdAt: str

    model_config = {"populate_by_name": True}

    @classmethod
    def from_doc(cls, doc: dict) -> "CaseFileOut":
        doc["id"] = str(doc.pop("_id", ""))
        return cls(**doc)


# ── Auth helper ───────────────────────────────────────────────────────────────
async def _get_advocate_id(authorization: Optional[str]) -> str:
    """Extract advocate ID from JWT token."""
    from database import db
    import jwt as pyjwt
    import os

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        secret = os.getenv("JWT_SECRET", "lawflow-dev-secret-key-2024")
        payload = pyjwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("advocate_id") or payload.get("sub") or ""
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Routes ─────────────────────────────────────────────────────────────────────
@router.get("/case-files")
async def list_case_files(caseId: str, authorization: Optional[str] = Header(None)):
    from database import db
    advocate_id = await _get_advocate_id(authorization)
    cursor = db["case_files"].find({"caseId": caseId, "advocateId": advocate_id})
    results = []
    async for doc in cursor:
        results.append(CaseFileOut.from_doc(doc).model_dump())
    return {"success": True, "data": results}


@router.post("/case-files")
async def create_case_file(payload: CaseFileCreate, authorization: Optional[str] = Header(None)):
    from database import db
    advocate_id = await _get_advocate_id(authorization)
    doc = payload.model_dump()
    doc["advocateId"] = advocate_id
    doc["createdAt"] = datetime.now(UTC).isoformat()
    result = await db["case_files"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": CaseFileOut.from_doc(doc).model_dump()}


@router.patch("/case-files/{file_id}/sync")
async def mark_file_synced(
    file_id: str,
    body: dict,
    authorization: Optional[str] = Header(None),
):
    from database import db
    advocate_id = await _get_advocate_id(authorization)
    update = {
        "isSynced": True,
        "googleDriveFileId": body.get("googleDriveFileId"),
        "googleDriveUrl": body.get("googleDriveUrl"),
    }
    result = await db["case_files"].update_one(
        {"_id": ObjectId(file_id), "advocateId": advocate_id},
        {"$set": update},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"success": True}


@router.delete("/case-files/{file_id}")
async def delete_case_file(file_id: str, authorization: Optional[str] = Header(None)):
    from database import db
    advocate_id = await _get_advocate_id(authorization)
    result = await db["case_files"].delete_one(
        {"_id": ObjectId(file_id), "advocateId": advocate_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"success": True}
