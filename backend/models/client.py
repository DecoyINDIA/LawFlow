from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid


class ClientBase(BaseModel):
    model_config = ConfigDict(extra='allow')

    name: str
    phone: str
    email: Optional[str] = None
    clientType: Optional[str] = "INDIVIDUAL"
    city: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    whatsappOptIn: bool = True
    smsOptIn: bool = False
    isActive: bool = True
    tags: List[str] = []


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra='allow')

    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    clientType: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    whatsappOptIn: Optional[bool] = None
    smsOptIn: Optional[bool] = None
    isActive: Optional[bool] = None
    tags: Optional[List[str]] = None


class ClientDB(ClientBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    advocateId: str
    createdAt: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))
    updatedAt: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))


class ClientResponse(ClientBase):
    id: str
    advocateId: str
    createdAt: int
    updatedAt: int

    class Config:
        from_attributes = True
