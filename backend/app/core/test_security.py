# backend/app/core/test_security.py

"""
Unit tests for JWT token creation and verification.

These tests confirm that:
- create_access_token() produces a valid JWT string
- verify_access_token() decodes it correctly
- Invalid or expired tokens raise the expected errors
"""

import pytest
from jwt.exceptions import InvalidTokenError

from app.core.security import create_access_token, verify_access_token


def test_create_and_verify_token():
    """Verify that a token created with valid data can be decoded successfully."""
    subject = "user123"
    token = create_access_token(subject, role="admin")
    decoded = verify_access_token(token)

    assert decoded["sub"] == subject
    assert decoded["role"] == "admin"


def test_invalid_token():
    """Verify that an invalid token raises the JWT library's token error."""
    with pytest.raises(InvalidTokenError):
        verify_access_token("this.is.not.a.valid.token")


def test_expired_token():
    """Verify that an expired token raises the JWT library's token error."""
    token = create_access_token(
        "expired_user",
        expires_delta=-1,
        role="admin",
    )

    with pytest.raises(InvalidTokenError):
        verify_access_token(token)
