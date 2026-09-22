"""Schemas for testimonial submission, moderation, and public display."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


TestimonialStatus = Literal["Pending", "Approved", "Rejected"]
TestimonialSource = Literal["internal", "public"]


def _clean_required(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Value cannot be blank")
    return cleaned


class TestimonialCreate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=10, max_length=3000)
    rating: int | None = Field(None, ge=1, le=5)
    status: TestimonialStatus = "Approved"

    @field_validator("author_name", "body")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return _clean_required(value)


class TestimonialUpdate(BaseModel):
    author_name: str | None = Field(None, min_length=1, max_length=120)
    body: str | None = Field(None, min_length=10, max_length=3000)
    rating: int | None = Field(None, ge=1, le=5)
    status: TestimonialStatus | None = None

    @field_validator("author_name", "body")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        return _clean_required(value) if value is not None else None


class TestimonialRead(BaseModel):
    id: int
    author_user_id: int | None = None
    author_name: str
    body: str
    rating: int | None = None
    source: TestimonialSource
    status: TestimonialStatus
    moderated_by_email: str | None = None
    moderated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicTestimonialCreate(BaseModel):
    body: str = Field(..., min_length=10, max_length=3000)
    rating: int | None = Field(None, ge=1, le=5)

    @field_validator("body")
    @classmethod
    def clean_body(cls, value: str) -> str:
        return _clean_required(value)


class PublicTestimonialRead(BaseModel):
    id: int
    author_name: str
    body: str
    rating: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
