"""Schemas for listing open-house scheduling."""

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


def _require_timezone(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Open-house times must include a timezone")
    return value


class PublicOpenHouseRead(BaseModel):
    id: int
    starts_at: datetime
    ends_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpenHouseRead(PublicOpenHouseRead):
    listing_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpenHouseCreate(BaseModel):
    starts_at: datetime
    ends_at: datetime

    @field_validator("starts_at", "ends_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        return _require_timezone(value)

    @model_validator(mode="after")
    def validate_schedule(self):
        now = datetime.now(timezone.utc)
        if self.starts_at <= now:
            raise ValueError("Open house must start in the future")
        if self.ends_at <= self.starts_at:
            raise ValueError("Open house end time must be after its start time")
        return self


class OpenHouseUpdate(BaseModel):
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        return _require_timezone(value) if value is not None else None
