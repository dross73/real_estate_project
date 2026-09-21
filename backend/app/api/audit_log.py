"""Read-only administrator API for audit history."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.models import AuditLog
from app.db.session import get_db
from app.dependencies.auth_dependencies import require_admin
from app.schemas.audit import AuditLogRead, PaginatedAuditLogRead


router = APIRouter(
    prefix="/audit-log",
    tags=["Audit Log"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "",
    response_model=PaginatedAuditLogRead,
    status_code=status.HTTP_200_OK,
)
def list_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    actor_email: str | None = Query(None, max_length=320),
    action: str | None = Query(None, max_length=100),
    target_type: str | None = Query(None, max_length=100),
    target_id: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
) -> PaginatedAuditLogRead:
    """Return newest-first append-only audit history to administrators."""
    query = db.query(AuditLog)

    if actor_email:
        query = query.filter(
            AuditLog.actor_email == actor_email.strip().lower()
        )
    if action:
        query = query.filter(AuditLog.action == action.strip())
    if target_type:
        query = query.filter(AuditLog.target_type == target_type.strip())
    if target_id:
        query = query.filter(AuditLog.target_id == target_id.strip())

    total = query.count()
    offset = (page - 1) * per_page
    rows = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    return PaginatedAuditLogRead(
        items=[AuditLogRead.model_validate(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
    )
