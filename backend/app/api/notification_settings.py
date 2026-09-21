"""Administrator API for transactional notification preferences."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin
from app.schemas.notification import (
    NotificationSettingRead,
    NotificationSettingUpdate,
)
from app.services.audit import record_audit_event
from app.services.notification_service import (
    NOTIFICATION_DEFINITIONS,
    get_notification_definition,
    is_notification_enabled,
    set_notification_enabled,
)


router = APIRouter(
    prefix="/notification-settings",
    tags=["Notification Settings"],
    dependencies=[Depends(require_admin)],
)


def _read_setting(db: Session, key: str) -> NotificationSettingRead:
    """Build one effective setting response from definition + persisted value."""
    definition = get_notification_definition(key)
    if definition is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification setting not found",
        )

    return NotificationSettingRead(
        key=definition.key,
        description=definition.description,
        enabled=is_notification_enabled(db, definition.key),
        default_enabled=definition.default_enabled,
    )


@router.get(
    "",
    response_model=list[NotificationSettingRead],
    status_code=status.HTTP_200_OK,
)
def list_notification_settings(
    db: Session = Depends(get_db),
) -> list[NotificationSettingRead]:
    """Return every known notification and its effective enabled state."""
    return [
        _read_setting(db, definition.key)
        for definition in NOTIFICATION_DEFINITIONS
    ]


@router.put(
    "/{key}",
    response_model=NotificationSettingRead,
    status_code=status.HTTP_200_OK,
)
def update_notification_setting(
    key: str,
    payload: NotificationSettingUpdate,
    db: Session = Depends(get_db),
    actor_email: str = Depends(require_admin),
) -> NotificationSettingRead:
    """Persist one known notification override and audit the administrator."""
    if get_notification_definition(key) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification setting not found",
        )

    previous_enabled = is_notification_enabled(db, key)

    set_notification_enabled(
        db,
        key=key,
        enabled=payload.enabled,
        commit=False,
    )

    record_audit_event(
        db,
        actor_email=actor_email,
        action="settings.notification_updated",
        target_type="notification_setting",
        target_id=key,
        details={
            "previous_enabled": previous_enabled,
            "enabled": payload.enabled,
        },
    )

    db.commit()

    return _read_setting(db, key)
