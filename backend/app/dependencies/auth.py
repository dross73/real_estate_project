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
from fastapi.security import HTTPBearer

from typing import Any

oauth2_scheme = HTTPBearer()


def get_current_user(token: Any = Depends(oauth2_scheme)) -> str:
    """
    Verify and decode the JWT from the Authorization header.

    Returns:
        str: The 'sub' claim (subject) from the token, which identifies the user.

    Raises:
        HTTPException: If the token is missing, expired, or invalid.
    """

    # Attempt to decode the token and extract its payload
    # NOTE: HTTPBearer returns an object with a .credentials attribute,
    # while OAuth2PasswordBearer returns a plain string. This supports both.
    raw_token: str = getattr(token, "credentials", token)

    try:
        payload = verify_access_token(raw_token)
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



def require_admin(token: Any = Depends(oauth2_scheme)) -> str:
    """
    Dependency that restricts access to admin-only routes.

    Verifies the JWT from the Authorization header, checks the 'role' claim,
    and raises 403 for non-admins. Returns the 'sub' (email) for logging/auditing.
    """
    # HTTPBearer provides an object with .credentials; support both object and raw str
    raw_token: str = getattr(token, "credentials", token)

    # Decode the JWT directly from the header token
    payload = verify_access_token(raw_token)

    role = payload.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return sub

