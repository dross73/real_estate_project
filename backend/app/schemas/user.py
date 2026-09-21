from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# Fixed application roles for the current authorization model.
UserRole = Literal["admin", "staff", "public_user"]
InternalUserRole = Literal["admin", "staff"]
BCRYPT_MAX_PASSWORD_BYTES = 72


def _validate_bcrypt_password(password: str) -> str:
    """Keep passwords within bcrypt's explicit byte limit."""
    if len(password.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            f"Password must be {BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes or fewer"
        )
    return password


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    phone: str | None = Field(None, max_length=40)
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

    @field_validator("password")
    @classmethod
    def validate_password_size(cls, password: str) -> str:
        return _validate_bcrypt_password(password)


class PublicUserRegister(BaseModel):
    """Public self-registration payload with no role or activation controls."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_size(cls, password: str) -> str:
        return _validate_bcrypt_password(password)



class PublicAccountUpdate(BaseModel):
    """Profile fields a verified public user may change for their own account."""

    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(None, max_length=120)
    phone: str | None = Field(None, max_length=40)


class PasswordResetRequest(BaseModel):
    """Email used to request a password-reset message."""

    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Single-use reset token plus replacement password."""

    token: str = Field(min_length=20, max_length=512)
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password_size(cls, password: str) -> str:
        return _validate_bcrypt_password(password)


class PasswordChangeRequest(BaseModel):
    """Authenticated password-change request."""

    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password_size(cls, password: str) -> str:
        return _validate_bcrypt_password(password)
