from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models.client import ClientCreate, ClientUpdate
from routes.auth import get_current_advocate
from datetime import datetime
import uuid

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("")
async def list_clients(advocate=Depends(get_current_advocate), db=Depends(get_db)):
    clients = await db.clients.find(
        {"advocateId": advocate["id"]}, {"_id": 0}
    ).to_list(None)
    return {"success": True, "data": clients}


@router.post("")
async def create_client(
    body: ClientCreate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    data = body.model_dump()
    data.pop("syncPending", None)
    client_id = data.pop("id", None) or str(uuid.uuid4())
    now = int(datetime.utcnow().timestamp() * 1000)
    created_at = data.pop("createdAt", None) or now
    data.pop("updatedAt", None)
    client = {
        "id": client_id,
        "advocateId": advocate["id"],
        "createdAt": created_at,
        "updatedAt": now,
        **data,
    }
    await db.clients.update_one({"id": client_id}, {"$set": client}, upsert=True)
    stored = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return {"success": True, "data": stored}


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    client = await db.clients.find_one(
        {"id": client_id, "advocateId": advocate["id"]}, {"_id": 0}
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"success": True, "data": client}


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    body: ClientUpdate,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data.pop("syncPending", None)
    update_data["updatedAt"] = int(datetime.utcnow().timestamp() * 1000)
    result = await db.clients.update_one(
        {"id": client_id, "advocateId": advocate["id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return {"success": True, "data": client}


@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    advocate=Depends(get_current_advocate),
    db=Depends(get_db),
):
    result = await db.clients.delete_one(
        {"id": client_id, "advocateId": advocate["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"success": True, "message": "Client deleted"}
