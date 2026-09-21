"""Admin-only user-management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.audit import record_audit_event


router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(require_admin)],
)


@router.get("/", response_model=list[UserRead], status_code=status.HTTP_200_OK)
def get_all_users(db: Session = Depends(get_db)):
    """Return all users to an authenticated administrator."""
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    """Return one user by ID to an authenticated administrator."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    return user


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
):
    """Create an internal account and record the administrator action."""
    normalized_email = str(payload.email).strip().lower()

    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    new_user = User(
        email=normalized_email,
        full_name=payload.full_name.strip() if payload.full_name else None,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        role=payload.role,
    )

    db.add(new_user)
    db.flush()

    record_audit_event(
        db,
        actor_email=actor_email,
        action="user.created",
        target_type="user",
        target_id=new_user.id,
        details={
            "email": new_user.email,
            "role": new_user.role,
            "is_active": new_user.is_active,
        },
    )

    db.commit()
    db.refresh(new_user)

    return new_user


@router.put(
    "/{user_id}",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
):
    """Update administrator-managed user fields and record the change."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    changes = payload.model_dump(exclude_unset=True)

    if user.archived_at is not None and payload.is_active is True:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived accounts cannot be reactivated from user management",
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or None

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.role is not None:
        user.role = payload.role

    record_audit_event(
        db,
        actor_email=actor_email,
        action="user.updated",
        target_type="user",
        target_id=user.id,
        details={
            "email": user.email,
            "changed_fields": sorted(changes.keys()),
        },
    )

    db.commit()
    db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
):
    """Delete a user while preserving who performed the action."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    record_audit_event(
        db,
        actor_email=actor_email,
        action="user.deleted",
        target_type="user",
        target_id=user.id,
        details={
            "email": user.email,
            "role": user.role,
        },
    )

    db.delete(user)
    db.commit()

    return None
