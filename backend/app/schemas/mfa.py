"""Request and response schemas for internal TOTP MFA."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LoginResponse(BaseModel):
    status: Literal[
        "authenticated",
        "mfa_required",
        "mfa_enrollment_required",
    ]
    access_token: str | None = None
    token_type: str | None = None
    challenge_token: str | None = None


class MfaCodeRequest(BaseModel):
    challenge_token: str = Field(min_length=32, max_length=512)
    code: str = Field(min_length=6, max_length=64)


class MfaEnrollmentStartRequest(BaseModel):
    challenge_token: str = Field(min_length=32, max_length=512)


class MfaEnrollmentStartResponse(BaseModel):
    secret: str
    provisioning_uri: str
    enrollment_token: str


class MfaEnrollmentConfirmRequest(BaseModel):
    enrollment_token: str = Field(min_length=20, max_length=4096)
    code: str = Field(min_length=6, max_length=64)


class MfaChallengeEnrollmentConfirmRequest(MfaEnrollmentConfirmRequest):
    challenge_token: str = Field(min_length=32, max_length=512)


class MfaEnrollmentCompleteResponse(BaseModel):
    recovery_codes: list[str]
    access_token: str | None = None
    token_type: str | None = None


class MfaStatusResponse(BaseModel):
    enabled: bool
    required: bool
    enrolled_at: datetime | None
    recovery_codes_remaining: int


class MfaDisableRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    code: str = Field(min_length=6, max_length=64)


class MfaAdminResetRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
