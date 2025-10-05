# backend/app/core/test_security.py

"""
Unit tests for JWT token creation and verification.

These tests confirm that:
- create_access_token() produces a valid JWT string
- verify_access_token() decodes it correctly
- Invalid or expired tokens raise the expected errors
"""

import time
import pytest
from jose import JWTError
from app.core.security import create_access_token, verify_access_token


def test_create_and_verify_token():
    """
    Verify that a token created with valid data can be decoded successfully.
    """
    subject = "user123"  
    token = create_access_token(subject)
    decoded = verify_access_token(token)
    assert decoded["sub"] == subject


def test_invalid_token():
    """
    Verify that an invalid token raises a JWTError.
    """
    with pytest.raises(JWTError):
        verify_access_token("this.is.not.a.valid.token")


def test_expired_token():
    """
    Verify that an expired token raises a JWTError.
    """
    subject = "expired_user"

    # Create a token that expired one minute ago
    token = create_access_token(subject, expires_delta=-1)

    with pytest.raises(JWTError):
        verify_access_token(token)

