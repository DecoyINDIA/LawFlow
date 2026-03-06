from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid


class AdvocateBase(BaseModel):
    phone: str
    name: Optional[str] = None
    enrollmentNumber: Optional[str] = None
    designation: Optional[str] = None
    barCouncil: Optional[str] = None
    practiceAreas: List[str] = []
    primaryCourts: List[str] = []
    email: Optional[str] = None
    officeAddress: Optional[str] = None
    photoUri: Optional[str] = None


class AdvocateCreate(AdvocateBase):
    pass


class AdvocateDB(AdvocateBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class AdvocateUpdate(BaseModel):
    name: Optional[str] = None
    enrollmentNumber: Optional[str] = None
    designation: Optional[str] = None
    barCouncil: Optional[str] = None
    practiceAreas: Optional[List[str]] = None
    primaryCourts: Optional[List[str]] = None
    email: Optional[str] = None
    officeAddress: Optional[str] = None
    photoUri: Optional[str] = None


class AdvocateResponse(AdvocateBase):
    id: str
    createdAt: datetime

    class Config:
        from_attributes = True
