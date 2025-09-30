from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRead(UserBase):
    id: int
    created_at: Optional[datetime] = None
    roles: list[str] = []  # List of role names

    class Config:
        from_attributes = True
