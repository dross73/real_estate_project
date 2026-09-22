"""Schemas for office management and public office presentation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class OfficeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    address_line1: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    postal_code: str = Field(..., min_length=3, max_length=20)
    phone: str | None = Field(None, max_length=40)
    email: EmailStr | None = None
    hours: str | None = Field(None, max_length=2000)
    is_active: bool = True
    is_public: bool = True

    @field_validator("name", "address_line1", "city", "postal_code")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 2 or not normalized.isalpha():
            raise ValueError("State must be a two-letter code")
        return normalized

    @field_validator("phone", "hours")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class OfficeCreate(OfficeBase):
    pass


class OfficeUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=160)
    address_line1: str | None = Field(None, min_length=1, max_length=255)
    city: str | None = Field(None, min_length=1, max_length=100)
    state: str | None = Field(None, min_length=2, max_length=2)
    postal_code: str | None = Field(None, min_length=3, max_length=20)
    phone: str | None = Field(None, max_length=40)
    email: EmailStr | None = None
    hours: str | None = Field(None, max_length=2000)
    is_active: bool | None = None
    is_public: bool | None = None

    @field_validator("name", "address_line1", "city", "postal_code")
    @classmethod
    def normalize_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if len(normalized) != 2 or not normalized.isalpha():
            raise ValueError("State must be a two-letter code")
        return normalized

    @field_validator("phone", "hours")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class OfficeRead(OfficeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicOfficeSummary(BaseModel):
    id: int
    name: str
    address_line1: str
    city: str
    state: str
    postal_code: str
    phone: str | None = None
    email: EmailStr | None = None
    hours: str | None = None

    model_config = ConfigDict(from_attributes=True)
