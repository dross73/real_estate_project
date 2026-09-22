"""Schemas for internal lead and inquiry management."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator


LeadType = Literal["contact", "showing", "open_house"]
LeadStatus = Literal["New", "Contacted", "Qualified", "Closed", "Lost"]
LeadActivityType = Literal[
    "created",
    "status_changed",
    "assignment_changed",
    "note",
]


class LeadCreate(BaseModel):
    inquiry_type: LeadType
    requester_user_id: int | None = Field(None, gt=0)
    contact_name: str = Field(..., min_length=1, max_length=120)
    contact_email: EmailStr
    contact_phone: str | None = Field(None, max_length=40)
    listing_id: int | None = Field(None, gt=0)
    message: str | None = Field(None, max_length=5000)
    preferred_at: datetime | None = None
    source: str | None = Field(None, max_length=100)
    assigned_agent_id: int | None = Field(None, gt=0)
    assigned_user_id: int | None = Field(None, gt=0)

    @model_validator(mode="after")
    def validate_assignment(self):
        if self.assigned_agent_id is not None and self.assigned_user_id is not None:
            raise ValueError("Lead can be assigned to an agent or staff user, not both")
        return self


class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    assigned_agent_id: int | None = Field(None, gt=0)
    assigned_user_id: int | None = Field(None, gt=0)


class LeadNoteCreate(BaseModel):
    note: str = Field(..., min_length=1, max_length=5000)


class LeadActivityRead(BaseModel):
    id: int
    activity_type: LeadActivityType
    actor_email: str
    note: str | None = None
    details: dict
    created_at: datetime


class LeadRead(BaseModel):
    id: int
    inquiry_type: LeadType
    status: LeadStatus
    requester_user_id: int | None = None
    contact_name: str
    contact_email: EmailStr
    contact_phone: str | None = None
    listing_id: int | None = None
    listing_title: str | None = None
    message: str | None = None
    preferred_at: datetime | None = None
    source: str | None = None
    assigned_agent_id: int | None = None
    assigned_user_id: int | None = None
    assigned_to_label: str | None = None
    created_at: datetime
    updated_at: datetime
    activities: list[LeadActivityRead] = Field(default_factory=list)


class LeadListRead(BaseModel):
    items: list[LeadRead]
    total: int


class AssignmentOption(BaseModel):
    kind: Literal["agent", "staff"]
    id: int
    name: str
    subtitle: str | None = None


class AssignmentOptionsRead(BaseModel):
    items: list[AssignmentOption]
