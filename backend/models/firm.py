from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class FirmMember(BaseModel):
    advocateId: str
    phone: str
    role: str = "junior"
    joinedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class FirmInvitation(BaseModel):
    phone: str
    invitedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = "pending"


class FirmCreate(BaseModel):
    name: str


class FirmUpdate(BaseModel):
    name: Optional[str] = None


class FirmInvite(BaseModel):
    phone: str


class FirmAccept(BaseModel):
    firmId: str


class CaseAssign(BaseModel):
    assignedTo: str
