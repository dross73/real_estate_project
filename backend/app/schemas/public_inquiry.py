"""Public-safe schemas for verified-user contact and showing requests."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.lead import LeadStatus


PublicInquiryType = Literal["contact", "showing"]


class PublicInquiryCreate(BaseModel):
    inquiry_type: PublicInquiryType
    listing_id: int | None = Field(None, gt=0)
    message: str | None = Field(None, max_length=5000)
    preferred_at: datetime | None = None
    submission_key: str = Field(
        ...,
        min_length=16,
        max_length=64,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    @model_validator(mode="after")
    def validate_request_shape(self):
        if self.inquiry_type == "showing" and self.listing_id is None:
            raise ValueError("Showing requests require a listing")
        if self.inquiry_type == "contact" and not (self.message or "").strip():
            raise ValueError("Contact requests require a message")
        return self


class PublicInquiryRead(BaseModel):
    id: int
    inquiry_type: PublicInquiryType
    status: LeadStatus
    listing_id: int | None = None
    listing_title: str | None = None
    message: str | None = None
    preferred_at: datetime | None = None
    destination_label: str
    created_at: datetime


class PublicInquiryList(BaseModel):
    items: list[PublicInquiryRead]
    total: int
