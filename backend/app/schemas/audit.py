"""Read-only schemas for administrator audit history."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditLogRead(BaseModel):
    """One immutable audit-history entry."""

    id: int
    actor_email: str
    action: str
    target_type: str
    target_id: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedAuditLogRead(BaseModel):
    """Paginated audit-history response."""

    items: list[AuditLogRead]
    total: int
    page: int
    per_page: int
