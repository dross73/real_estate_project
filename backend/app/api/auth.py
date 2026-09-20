"""Authentication and public account registration endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.db.models import User
from app.db.session import get_db
from app.schemas.user import PublicUserRegister, UserRead


PUBLIC_USER_ROLE = "public_user"


class TokenResponse(BaseModel):
    """JWT response returned after a successful login."""

    access_token: str
    token_type: str = "bearer"


router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    """Normalize email input before storage and lookup."""
    return email.strip().lower()


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
    """Create a public-user account without allowing role escalation."""
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
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user
