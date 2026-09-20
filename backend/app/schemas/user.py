from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# Fixed application roles for the current authorization model.
UserRole = Literal["admin", "staff", "public_user"]
InternalUserRole = Literal["admin", "staff"]


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    is_active: bool = True


class UserUpdate(BaseModel):
    """Fields an administrator may update on an existing user."""

    full_name: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class RoleRead(BaseModel):
    """Legacy role-catalog response kept for existing database compatibility."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class UserRead(BaseModel):
    """Safe user data returned by API endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    role: UserRole


class UserCreate(UserBase):
    """Admin-only schema for creating internal staff or administrator accounts."""

    password: str = Field(min_length=8)
    role: InternalUserRole = "staff"


class PublicUserRegister(BaseModel):
    """Public self-registration payload with no role or activation controls."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
