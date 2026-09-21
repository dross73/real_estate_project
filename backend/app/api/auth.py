"""Authentication and public account registration endpoints."""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.db.models import EmailVerificationToken, PasswordResetToken, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_verified_public_user
from app.schemas.user import (
    PasswordChangeRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PublicAccountUpdate,
    PublicUserRegister,
    UserRead,
)
from app.services.email_service import (
    EmailDeliveryError,
    send_password_reset_email,
    send_verification_email,
)
from app.services.email_verification import (
    ensure_utc,
    hash_verification_token,
    issue_verification_token,
    latest_verification_token,
    resend_is_allowed,
    utc_now,
)
from app.services.password_reset import (
    hash_password_reset_token,
    invalidate_password_reset_tokens,
    issue_password_reset_token,
)


PUBLIC_USER_ROLE = "public_user"
GENERIC_RESEND_MESSAGE = (
    "If an unverified account exists for that email, "
    "a verification message will be sent."
)
GENERIC_PASSWORD_RESET_MESSAGE = (
    "If an eligible account exists for that email, "
    "a password-reset message will be sent."
)
logger = logging.getLogger(__name__)


class TokenResponse(BaseModel):
    """JWT response returned after a successful login."""

    access_token: str
    token_type: str = "bearer"


class EmailVerificationRequest(BaseModel):
    """Raw verification token submitted by the public frontend."""

    token: str = Field(min_length=20, max_length=512)


class EmailVerificationResponse(BaseModel):
    """Result of consuming a verification token."""

    status: Literal["verified", "already_verified"]


class EmailVerificationResendRequest(BaseModel):
    """Email used to request another verification message."""

    email: EmailStr


class MessageResponse(BaseModel):
    """Generic response used where account enumeration should be avoided."""

    message: str


router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    """Normalize email input before storage and lookup."""
    return email.strip().lower()


def _send_verification_message(email: str, token: str) -> bool:
    """Attempt delivery without undoing an otherwise valid account operation."""
    try:
        send_verification_email(email, token)
        return True
    except EmailDeliveryError:
        logger.exception("Unable to deliver verification email to %s", email)
        return False


def _send_password_reset_message(email: str, token: str) -> bool:
    """Attempt reset delivery without logging the token or password data."""
    try:
        send_password_reset_email(email, token)
        return True
    except EmailDeliveryError:
        logger.exception("Unable to deliver password reset email")
        return False


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Verify credentials and return a signed access token."""
    normalized_email = _normalize_email(form_data.username)

    user = db.query(User).filter(User.email == normalized_email).first()

    # Do not reveal whether the email or password was incorrect.
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Disabled/archived accounts cannot receive new access tokens.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    access_token = create_access_token(
        subject=user.email,
        role=str(user.role),
        expires_delta=None,
    )

    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(
    user_in: PublicUserRegister,
    db: Session = Depends(get_db),
) -> User:
    """Create an unverified public-user account and issue a verification email."""
    normalized_email = _normalize_email(str(user_in.email))

    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    new_user = User(
        email=normalized_email,
        full_name=user_in.full_name.strip() if user_in.full_name else None,
        hashed_password=get_password_hash(user_in.password),
        is_active=True,
        role=PUBLIC_USER_ROLE,
        email_verified_at=None,
    )

    db.add(new_user)

    # Flush first so the verification token can safely reference the new user ID.
    db.flush()
    raw_token, _ = issue_verification_token(db, new_user)

    db.commit()
    db.refresh(new_user)

    # A transient email-provider failure must not roll back a valid account.
    # The user can request another message through the resend endpoint.
    _send_verification_message(new_user.email, raw_token)

    return new_user


@router.post(
    "/email-verification/verify",
    response_model=EmailVerificationResponse,
    status_code=status.HTTP_200_OK,
)
def verify_email(
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db),
) -> EmailVerificationResponse:
    """Consume one verification token and mark the owning email as verified."""
    token_hash = hash_verification_token(payload.token)
    token_record = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_hash)
        .first()
    )

    if token_record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    if token_record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has already been used",
        )

    user = token_record.user
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link",
        )

    now = utc_now()

    # Already-verified accounts are handled idempotently without changing state.
    if user.email_verified_at is not None:
        token_record.used_at = now
        db.commit()
        return EmailVerificationResponse(status="already_verified")

    if ensure_utc(token_record.expires_at) <= now:
        token_record.used_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired",
        )

    user.email_verified_at = now

    # Successful verification invalidates every outstanding token for this user.
    outstanding_tokens = (
        db.query(EmailVerificationToken)
        .filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used_at.is_(None),
        )
        .all()
    )
    for outstanding_token in outstanding_tokens:
        outstanding_token.used_at = now

    db.commit()

    return EmailVerificationResponse(status="verified")


@router.post(
    "/email-verification/resend",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def resend_verification_email(
    payload: EmailVerificationResendRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Issue another verification email while resisting account enumeration/spam."""
    normalized_email = _normalize_email(str(payload.email))
    user = db.query(User).filter(User.email == normalized_email).first()

    # Return the same response for unknown, ineligible, verified, and throttled
    # accounts so callers cannot use this endpoint to enumerate registrations.
    if (
        user is None
        or user.role != PUBLIC_USER_ROLE
        or not user.is_active
        or user.email_verified_at is not None
    ):
        return MessageResponse(message=GENERIC_RESEND_MESSAGE)

    latest_token = latest_verification_token(db, user.id)
    if not resend_is_allowed(latest_token):
        return MessageResponse(message=GENERIC_RESEND_MESSAGE)

    raw_token, _ = issue_verification_token(db, user)
    db.commit()

    _send_verification_message(user.email, raw_token)

    return MessageResponse(message=GENERIC_RESEND_MESSAGE)



@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Issue a single-use reset link without revealing account existence."""
    normalized_email = _normalize_email(str(payload.email))
    user = db.query(User).filter(User.email == normalized_email).first()

    if (
        user is None
        or user.role != PUBLIC_USER_ROLE
        or not user.is_active
    ):
        return MessageResponse(message=GENERIC_PASSWORD_RESET_MESSAGE)

    raw_token, _ = issue_password_reset_token(db, user)
    db.commit()
    _send_password_reset_message(user.email, raw_token)

    return MessageResponse(message=GENERIC_PASSWORD_RESET_MESSAGE)


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Consume one valid reset token and replace the public user's password."""
    token_hash = hash_password_reset_token(payload.token)
    token_record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )

    if token_record is None or token_record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used password reset link",
        )

    now = utc_now()
    if ensure_utc(token_record.expires_at) <= now:
        token_record.used_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link has expired",
        )

    user = token_record.user
    if (
        user is None
        or user.role != PUBLIC_USER_ROLE
        or not user.is_active
    ):
        token_record.used_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link",
        )

    user.hashed_password = get_password_hash(payload.new_password)
    invalidate_password_reset_tokens(db, user.id, now=now)
    db.commit()

    return MessageResponse(message="Password has been reset.")


@router.get(
    "/account",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
)
def get_public_account(
    user: User = Depends(require_verified_public_user),
) -> User:
    """Return the verified public user's own safe account profile."""
    return user


@router.put(
    "/account",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
)
def update_public_account(
    payload: PublicAccountUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> User:
    """Update only the verified public user's own basic profile fields."""
    changes = payload.model_dump(exclude_unset=True)

    if "full_name" in changes:
        value = changes["full_name"]
        changes["full_name"] = value.strip() if value and value.strip() else None

    if "phone" in changes:
        value = changes["phone"]
        changes["phone"] = value.strip() if value and value.strip() else None

    for key, value in changes.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/account/change-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def change_public_account_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> MessageResponse:
    """Replace a verified public user's password after checking the current one."""
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.hashed_password = get_password_hash(payload.new_password)
    invalidate_password_reset_tokens(db, user.id)
    db.commit()

    return MessageResponse(message="Password has been changed.")
