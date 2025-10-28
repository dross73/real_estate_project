# backend/app/dependencies/auth.py

"""
Authentication dependencies.

This module provides reusable dependencies that validate JWT tokens
and identify the current authenticated user. These dependencies can be
attached to protected routes using FastAPI's Depends() mechanism.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose.exceptions import JWTError, ExpiredSignatureError

# Import the token verification function
from app.core.security import verify_access_token


# Define the token scheme expected by the app (Authorization: Bearer <token>)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Verify and decode the JWT from the Authorization header.

    Returns:
        str: The 'sub' claim (subject) from the token, which identifies the user.

    Raises:
        HTTPException: If the token is missing, expired, or invalid.
    """

    # Attempt to decode the token and extract its payload
    try:
        payload = verify_access_token(token)
        user_email = payload.get("sub")

        # Ensure the token has a subject claim
        if user_email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Return the verified user identity (email for now)
        return user_email

    # Handle token expiration separately for clarity
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Handle invalid or malformed tokens
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or corrupted token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_admin(current_user: dict = Depends(get_current_user)) -> str:
    """
    Dependency that restricts access to admin-only routes.

    Verifies that the current authenticated user has an admin role.
    If not, raises an HTTP 403 (Forbidden) error.

    Returns:
        str: The verified user's email (subject claim).
    """
    # Decode again only if a raw string was passed (for flexibility)
    payload = verify_access_token(current_user) if isinstance(current_user, str) else current_user
    role = payload.get("role")

    # Enforce admin-only access
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    # Safely extract and validate subject
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    return sub

