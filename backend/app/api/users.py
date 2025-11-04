# backend/app/api/users.py

"""
User API Router

This module defines the FastAPI router for all **User CRUD operations**.
It is responsible for handling creation, retrieval, updates, and deletion
of users in the system.

Current phase:
- No JWT authentication yet (routes are open for testing).
- Uses SQLAlchemy ORM for database access.
- Uses Pydantic schemas for request and response validation.

Later phases:
- Integrate JWT authentication to protect endpoints.
- Enforce role-based access control (RBAC) using the User-Role relationship.

File location:
    backend/app/api/users.py
"""

# --- FastAPI imports ---
# APIRouter is used to organize endpoints into logical modules.
# Depends allows injecting dependencies (like the DB session) into endpoints.
# HTTPException is used for standardized error responses.
# status provides readable HTTP status code constants.
from fastapi import APIRouter, Depends, HTTPException, status

# --- SQLAlchemy imports ---
# Session represents the database connection context for each request.
from sqlalchemy.orm import Session

# --- Local project imports ---
# Pydantic schemas define input/output validation and shape.
from app.schemas.user import UserCreate, UserRead, UserUpdate

# Database model for direct ORM interaction
from app.db.models import User

# Database dependency that provides a session and ensures it's closed.
from app.db.session import get_db

# Password hashing helper to securely store user passwords.
from app.core.security import get_password_hash

# Role-based access control dependency (admin-only routes)
from app.dependencies.auth import require_admin

# --- Router setup ---
# Each router groups related endpoints under a common prefix and tag.
router = APIRouter(
    prefix="/users",  # URL prefix for all endpoints in this router
    tags=["Users"],  # Label shown in Swagger UI
)


# ------------------------------------------------------------------------------
# GET /users
# List all users in the system.
#
# This endpoint retrieves every user record from the database and returns
# them as a list of `UserRead` Pydantic models.
#
# No authentication is required at this stage. The route is primarily used
# to confirm database connectivity and ORM–schema mapping before enabling
# JWT or role-based restrictions.
# ------------------------------------------------------------------------------


@router.get("/", response_model=list[UserRead], status_code=status.HTTP_200_OK)
def get_all_users(db: Session = Depends(get_db)):
    # Query all users from the database.
    # SQLAlchemy ORM returns a list of User model instances.
    users = db.query(User).all()
    # Return the list. FastAPI automatically serializes ORM objects into
    # the defined Pydantic schema (UserRead) using its `from_attributes` config.
    return users


# ------------------------------------------------------------------------------
# GET /users/{user_id}
# Retrieve a single user by their unique ID.
#
# This endpoint looks up one user record in the database by primary key (id).
# It returns the user's details if found, or raises a 404 error if not.
#
# Purpose:
#   - Provides detail view for a specific user.
#   - Confirms that ID-based lookups and error handling are functional.
#
# No authentication or role enforcement yet — these will be added later
# once JWT integration is in place.
# ------------------------------------------------------------------------------
@router.get("{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_user_by_id(user_id: int, db: Session = Depends(get_db)):
    # Query the database for a user matching the provided ID.
    user = db.query(User).filter(User.id == user_id).first()

    # If the user does not exist, raise a standardized 404 HTTP exception.
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    # Return the ORM object. FastAPI automatically serializes it into
    # a UserRead Pydantic model for the response
    return user


# ------------------------------------------------------------------------------
# POST /users
# Create a new user in the system.
#
# This endpoint registers a new user by validating the request payload,
# ensuring the email is unique, hashing the password, and storing the
# resulting record in the database.
#
# Notes:
# - No authentication yet (open for testing).
# - Passwords are never stored in plaintext.
# - Email uniqueness is enforced both in the route and by DB constraints.
# ------------------------------------------------------------------------------


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    # Normalize the email to lowercase for consistency and uniqueness enforcement.
    normalized_email = payload.email.lower()

    # Check if a user with the same Email already registered.
    existing_user = (
        db.query(User).filter(User.email == normalized_email.strip()).first()
    )
    if existing_user:
        # Raise a standardized HTTP 409 Conflict if email is already taken.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Securely hash the provided plaintext password before storing it.
    hashed_password = get_password_hash(payload.password)

    # Create a new User ORM object from the validated payload.
    # Pydantic's model_dump() turns the object into a plain dict.
    # We explicitly assign the hashed password to avoid including plaintext.
    new_user = User(
        email=normalized_email,
        full_name=payload.full_name,
        hashed_password=hashed_password,
        is_active=payload.is_active,
        role=payload.role or "staff",  # Include role from payload (default to "staff" if not provided)
    )

    # Add the new user to the session and commit to persist it.
    db.add(new_user)
    db.commit()

    # Refresh the instance so it reflects any DB-generated values
    # (like auto-incremented ID or timestamps).
    db.refresh(new_user)

    # Return the new user as a Pydantic model.
    # FastAPI automatically converts the ORM object into the response model.
    return new_user



# ------------------------------------------------------------------------------
# PUT /users/{user_id}
# Update an existing user's profile fields.
#
# This endpoint allows modifying a user's full name or active status.
# Email and password updates are intentionally locked to prevent accidental
# changes to critical account data. Role management will be handled later
# in a dedicated admin route.
#
# Notes:
# - Returns 404 if the user ID doesn't exist.
# - Returns the updated record as a UserRead schema.
# ------------------------------------------------------------------------------
# ------------------------------------------------------------------------------
# PUT /users/{user_id}
# Update an existing user's profile fields.
#
# This endpoint allows modifying a user's full name or active status.
# Email and password updates are intentionally locked to prevent accidental
# changes to critical account data. Role management will be handled later
# in a dedicated admin route.
#
# Notes:
# - Returns 404 if the user ID doesn't exist.
# - Returns the updated record as a UserRead schema.
# ------------------------------------------------------------------------------


@router.put(
    "/{user_id}",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],  # Restrict access to admin users only
)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):

    # Query the database for the user by ID.
    user = db.query(User).filter(User.id == user_id).first()

    # If no user is found, raise a standardized 404 Not Found error.
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    # Update only allowed fields.
    # Email is intentionally locked to prevent accidental reassignment.
    user.full_name = payload.full_name

    # Only update is_active if the payload explicitly provides a value.
    # This avoids assigning None to the SQLAlchemy instrumented attribute.
    if payload.is_active is not None:
        user.is_active = payload.is_active

    # Commit changes to the database so they persist.
    db.commit()

    # Refresh ensures we return the most up-to-date version of the record.
    db.refresh(user)

    # Return the updated user record.
    return user



# ------------------------------------------------------------------------------
# DELETE /users/{user_id}
# Remove an existing user from the system.
#
# This endpoint permanently deletes the specified user from the database.
# It returns a 204 No Content response if successful, or a 404 error if
# the user does not exist.
#
# Notes:
# - This is a hard delete (record is fully removed).
# - Future versions may replace this with a soft delete to preserve history.
# ------------------------------------------------------------------------------

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    # Look up the user by ID.
    user = db.query(User).filter(User.id == user_id).first()

    # If the user doesn't exist, raise a 404 error.
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found",
        )

    # Delete the user from the session and commit the change.
    db.delete(user)
    db.commit()

    # Return no content as per HTTP 204 semantics.
    return None
# Protected route example


