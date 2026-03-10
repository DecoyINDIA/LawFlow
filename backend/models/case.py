from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
import uuid


class CaseBase(BaseModel):
    model_config = ConfigDict(extra='allow')

    caseNumber: str
    title: str
    caseType: Optional[str] = None
    courtName: str
    courtCity: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    plaintiffPetitioner: Optional[str] = None
    plaintiffType: Optional[str] = None
    defendant: Optional[str] = None
    defendantType: Optional[str] = None
    status: str = "ACTIVE"
    priority: Optional[str] = "MEDIUM"
    registrationDate: Optional[int] = None
    nextHearingDate: Optional[int] = None
    notes: Optional[str] = None
    tags: List[str] = []
    isActive: bool = True


class CaseCreate(CaseBase):
    pass


class CaseUpdate(BaseModel):
    model_config = ConfigDict(extra='allow')

    caseNumber: Optional[str] = None
    title: Optional[str] = None
    caseType: Optional[str] = None
    courtName: Optional[str] = None
    courtCity: Optional[str] = None
    clientId: Optional[str] = None
    clientName: Optional[str] = None
    plaintiffPetitioner: Optional[str] = None
    plaintiffType: Optional[str] = None
    defendant: Optional[str] = None
    defendantType: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    registrationDate: Optional[int] = None
    nextHearingDate: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    isActive: Optional[bool] = None


class CaseDB(CaseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    advocateId: str
    hearings: List[Any] = []
    documents: List[Any] = []
    voiceNotes: List[Any] = []
    createdAt: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))
    updatedAt: int = Field(default_factory=lambda: int(datetime.utcnow().timestamp() * 1000))


class CaseResponse(CaseBase):
    id: str
    advocateId: str
    hearings: List[Any] = []
    documents: List[Any] = []
    voiceNotes: List[Any] = []
    createdAt: int
    updatedAt: int

    class Config:
        from_attributes = True
