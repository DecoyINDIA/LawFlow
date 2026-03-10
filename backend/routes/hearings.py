from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models.hearing import HearingCreate, HearingUpdate
from routes.auth import get_current_advocate
from datetime import datetime
import uuid

router = APIRouter(prefix="/hearings", tags=["hearings"])


@router.get("")
async def list_hearings(advocate=Depends(get_current_advocate), db=Depends(get_db)):
    hearings = await db.hearings.find(
        {"advocateId": advocate["id"]}, {"_id": 0}
    ).to_list(None)
    return {"success": True, "data": hearings}


@router.post("")
async def create_hearing(
    body: HearingCreate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    data = body.model_dump()
    data.pop("syncPending", None)
    hearing_id = data.pop("id", None) or str(uuid.uuid4())
    now = int(datetime.utcnow().timestamp() * 1000)
    created_at = data.pop("createdAt", None) or now
    hearing = {
        "id": hearing_id,
        "advocateId": advocate["id"],
        "createdAt": created_at,
        **data,
    }
    await db.hearings.update_one({"id": hearing_id}, {"$set": hearing}, upsert=True)
    stored = await db.hearings.find_one({"id": hearing_id}, {"_id": 0})
    return {"success": True, "data": stored}


@router.put("/{hearing_id}")
async def update_hearing(
    hearing_id: str,
    body: HearingUpdate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data.pop("syncPending", None)
    result = await db.hearings.update_one(
        {"id": hearing_id, "advocateId": advocate["id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hearing not found")
    hearing = await db.hearings.find_one({"id": hearing_id}, {"_id": 0})
    return {"success": True, "data": hearing}


@router.delete("/{hearing_id}")
async def delete_hearing(
    hearing_id: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    result = await db.hearings.delete_one(
        {"id": hearing_id, "advocateId": advocate["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hearing not found")
    return {"success": True, "message": "Hearing deleted"}
