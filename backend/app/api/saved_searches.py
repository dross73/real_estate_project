"""Verified public-user saved-search CRUD API."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import SavedSearch, User
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_verified_public_user
from app.schemas.saved_search import (
    SavedSearchCreate,
    SavedSearchListRead,
    SavedSearchRead,
    SavedSearchUpdate,
)

router = APIRouter(
    prefix="/public/account/saved-searches",
    tags=["Public Account Saved Searches"],
)


def _owned_search_or_404(
    db: Session,
    *,
    search_id: int,
    user_id: int,
) -> SavedSearch:
    saved_search = (
        db.query(SavedSearch)
        .filter(
            SavedSearch.id == search_id,
            SavedSearch.user_id == user_id,
        )
        .first()
    )
    if saved_search is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Saved search not found",
        )
    return saved_search


def _serialize(saved_search: SavedSearch) -> SavedSearchRead:
    return SavedSearchRead(
        id=saved_search.id,
        name=saved_search.name,
        criteria=saved_search.criteria,
        alert_frequency=saved_search.alert_frequency,
        alerts_enabled=saved_search.alerts_enabled,
        last_alerted_at=saved_search.last_alerted_at,
        created_at=saved_search.created_at,
        updated_at=saved_search.updated_at,
    )


@router.get("", response_model=SavedSearchListRead)
def list_saved_searches(
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> SavedSearchListRead:
    rows = (
        db.query(SavedSearch)
        .filter(SavedSearch.user_id == user.id)
        .order_by(SavedSearch.updated_at.desc(), SavedSearch.id.desc())
        .all()
    )
    return SavedSearchListRead(items=[_serialize(row) for row in rows])


@router.post(
    "",
    response_model=SavedSearchRead,
    status_code=status.HTTP_201_CREATED,
)
def create_saved_search(
    payload: SavedSearchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> SavedSearchRead:
    saved_search = SavedSearch(
        user_id=user.id,
        name=payload.name.strip(),
        criteria=payload.criteria.model_dump(exclude_none=True),
        alert_frequency=payload.alert_frequency,
        alerts_enabled=payload.alerts_enabled,
    )
    db.add(saved_search)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A saved search with that name already exists",
        ) from exc

    db.refresh(saved_search)
    return _serialize(saved_search)


@router.put("/{search_id}", response_model=SavedSearchRead)
def update_saved_search(
    search_id: int,
    payload: SavedSearchUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> SavedSearchRead:
    saved_search = _owned_search_or_404(
        db,
        search_id=search_id,
        user_id=user.id,
    )

    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is not None:
        changes["name"] = changes["name"].strip()
    if payload.criteria is not None:
        changes["criteria"] = payload.criteria.model_dump(exclude_none=True)

    for key, value in changes.items():
        setattr(saved_search, key, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A saved search with that name already exists",
        ) from exc

    db.refresh(saved_search)
    return _serialize(saved_search)


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(
    search_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_public_user),
) -> Response:
    saved_search = _owned_search_or_404(
        db,
        search_id=search_id,
        user_id=user.id,
    )
    db.delete(saved_search)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
