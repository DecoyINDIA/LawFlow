from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
import uuid


class HearingBase(BaseModel):
    model_config = ConfigDict(extra='allow')

    caseId: str
    hearingDate: int
    hearingTime: Optional[str] = None
    courtRoom: Optional[str] = None
    purpose: Optional[str] = None
    outcome: Optional[str] = None
    adjournmentReason: Optional[str] = None
    nextDateSet: Optional[int] = None
    notes: Optional[str] = None
    clientNotified: bool = False


class HearingCreate(HearingBase):
    pass


class HearingUpdate(BaseModel):
    model_config = ConfigDict(extra='allow')

    hearingDate: Optional[int] = None
    hearingTime: Optional[str] = None
    courtRoom: Optional[str] = None
    purpose: Optional[str] = None
    outcome: Optional[str] = None
    adjournmentReason: Optional[str] = None
    nextDateSet: Optional[int] = None
    notes: Optional[str] = None
    clientNotified: Optional[bool] = None


class HearingDB(HearingBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    advocateId: str
    createdAt: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))


class HearingResponse(HearingBase):
    id: str
    advocateId: str
    createdAt: int

    class Config:
        from_attributes = True
