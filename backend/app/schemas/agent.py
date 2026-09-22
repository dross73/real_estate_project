"""Schemas for agent profile management and public presentation."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.office import PublicOfficeSummary


class AgentProfileBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    professional_title: str | None = Field(None, max_length=120)
    email: EmailStr
    phone: str | None = Field(None, max_length=40)
    photo_url: str | None = Field(None, max_length=2048)
    bio: str | None = Field(None, max_length=5000)
    office_name: str | None = Field(None, max_length=160)
    office_id: int | None = Field(None, gt=0)
    is_active: bool = True
    is_public: bool = True

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Full name is required")
        return normalized

    @field_validator(
        "professional_title",
        "phone",
        "photo_url",
        "bio",
        "office_name",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AgentProfileCreate(AgentProfileBase):
    pass


class AgentProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=120)
    professional_title: str | None = Field(None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=40)
    photo_url: str | None = Field(None, max_length=2048)
    bio: str | None = Field(None, max_length=5000)
    office_name: str | None = Field(None, max_length=160)
    office_id: int | None = Field(None, gt=0)
    is_active: bool | None = None
    is_public: bool | None = None

    @field_validator(
        "full_name",
        "professional_title",
        "phone",
        "photo_url",
        "bio",
        "office_name",
    )
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class AgentProfileRead(AgentProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicAgentSummary(BaseModel):
    id: int
    full_name: str
    professional_title: str | None = None
    email: EmailStr
    phone: str | None = None
    photo_url: str | None = None
    office_name: str | None = None
    office: PublicOfficeSummary | None = None

    model_config = ConfigDict(from_attributes=True)



class PublicAgentProfile(PublicAgentSummary):
    bio: str | None = None
