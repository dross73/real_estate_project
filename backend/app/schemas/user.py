from pydantic import BaseModel, EmailStr
from typing import List, Optional


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True


# ------------------------------------------------------------------------------
# Schema: UserUpdate
# Used for updating existing user records.
#
# All fields are optional so the client can send only the fields that need
# modification. This supports partial updates and avoids overwriting existing
# data unintentionally.
# ------------------------------------------------------------------------------


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# -----------------------------------------------
# ROLE SCHEMA
# -----------------------------------------------
# This schema defines how role data is represented
# when included in user responses (e.g., UserRead).
# It maps directly to the Role model fields we care about.
class RoleRead(BaseModel):
    # Role ID from the database
    id: int

    # The role name (e.g., "admin", "staff", "user")
    name: str

    # Optional description for clarity in the API
    description: Optional[str] = None

    # orm_mode allows returning SQLAlchemy objects directly
    class Config:
        orm_mode = True


# -----------------------------------------------
# USER READ SCHEMA
# -----------------------------------------------
# Used when returning user data to clients.
# Adds the user's assigned roles for clarity.
class UserRead(BaseModel):
    # User's unique ID
    id: int

    # User's email address
    email: str

    # Full name of the user
    full_name: Optional[str] = None

    # Whether the account is active
    is_active: bool

    # List of role objects (each is a RoleRead)
    roles: Optional[List[RoleRead]] = []

    # Allows ORM objects to be converted to this schema
    class Config:
        orm_mode = True


# -----------------------------------------------
# USER CREATE SCHEMA
# -----------------------------------------------
# Used for validating incoming data when registering
# or creating new users in the admin area.
class UserCreate(BaseModel):
    # Email address for the new account
    email: str

    # Plaintext password (will be hashed before saving)
    password: str

    # Optional full name
    full_name: Optional[str] = None

    # Optional list of role IDs to assign on creation
    role_ids: Optional[List[int]] = None
