"""Schemas for administrator notification settings."""

from pydantic import BaseModel


class NotificationSettingRead(BaseModel):
    """Effective value and product default for one known notification."""

    key: str
    description: str
    enabled: bool
    default_enabled: bool


class NotificationSettingUpdate(BaseModel):
    """Administrator update for one notification switch."""

    enabled: bool
