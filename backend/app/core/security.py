# backend/app/core/security.py

"""
Password hashing and JWT utilities.

This module provides secure password hashing and JWT creation functions
for user authentication.

Part 1: Password Hashing
- get_password_hash(password): returns a secure bcrypt hash suitable for storage
- verify_password(plain_password, hashed_password): verifies a user login attempt

Part 2: JWT Creation
- create_access_token(subject): generates a signed JSON Web Token for
  authenticated users.

Why these tools:
- Passlib (for password hashing) provides strong, upgradable security.
- JWT (JSON Web Tokens) provides stateless authentication between backend and frontend.
"""

# =========================================================
# Imports
# =========================================================
# Password hashing library
from passlib.context import CryptContext

# JWT handling and time utilities
from datetime import datetime, timedelta, timezone
from jose import jwt

# Application settings (loads secret key, algorithm, issuer, etc.)
from app.core.config import get_settings

# Exceptions for invalid or expired JWTs
from jose.exceptions import JWTError, ExpiredSignatureError


# =========================================================
# Password Hashing Utilities
# =========================================================
# A single, app-wide password hashing context.
# Using bcrypt for broad compatibility and security.
# "deprecated"='auto' future-proofs the setup by allowing Passlib
# to flag older hashes for rehashing if the algorithm is ever updated.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """
    Hash a plaintext password using the configured CryptContext.

    Returns:
        str: A salted, versioned hash string (e.g., starting with $2b$ for bcrypt)
             that is safe to store in the database.
    """
    return _pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a user-supplied password against the stored hash.

    Returns:
        bool: True if the password is correct, otherwise False.
    """

    return _pwd_context.verify(plain_password, hashed_password)


# =========================================================
# JWT Creation Utility
# =========================================================
# This section handles generating JSON Web Tokens (JWTs)
# after a user successfully logs in.
# Each token includes:
# - sub (subject): identifies the user (e.g., user ID or email)
# - iat (issued at): time of creation
# - exp (expiration): when the token expires
# - iss / aud: issuer and audience identifiers for validation
# =========================================================

# Load settings so the app can read SECRET_KEY, algorithm, issuer, audience, and expiry time.
settings = get_settings()


def create_access_token(subject: str, expires_delta: int | None = None) -> str:
    """
    Create a signed JWT for the authenticated user.

    Args:
        subject (str): Unique user identifier (e.g., user ID or email)
        expires_delta (int | None): Optional number of minutes until expiration.
                                    Used in testing or special cases.

    Returns:
        str: Encoded JWT token string
    """

    # Capture the current time in UTC for token issue time
    issued_at = datetime.now(timezone.utc)

    # Determine expiration time — either from the override or settings
    if expires_delta is not None:
        expires_at = issued_at + timedelta(minutes=expires_delta)
    else:
        expires_at = issued_at + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Define the JWT payload (claims)
    payload = {
        "sub": subject,
        "iat": issued_at,
        "exp": expires_at,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }

    # Create and sign the JWT using the configured secret key and algorithm
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # Return the encoded token string to the caller
    return token


# =========================================================
# JWT VERIFICATION UTILITY
# =========================================================
# This section verifies and decodes incoming JSON Web Tokens (JWTs).
# The purpose is to ensure:
# - The token signature is valid and matches our SECRET_KEY.
# - The token has not expired.
# - The issuer (iss) and audience (aud) claims are correct.
# If any of these checks fail, an exception is raised.
# =========================================================


def verify_access_token(token: str) -> dict:
    """
    Decode and validate a JWT received from a client request.

    Args:
        token (str): The JWT string to verify.

    Returns:
        dict: The decoded payload (claims) if valid.

    Raises:
        ExpiredSignatureError: If the token has expired.
        JWTError: If the token is invalid or cannot be decoded.
    """

    # Attempt to decode and validate the token
    try:
        decoded_payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
        return decoded_payload

    # Handle expired tokens separately for clarity
    except ExpiredSignatureError:
        raise ExpiredSignatureError("Token has expired")

    # Handle all other JWT-related errors
    except JWTError:
        raise JWTError("Token is invalid or corrupted")
