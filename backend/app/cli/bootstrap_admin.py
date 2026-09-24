"""Secure one-time bootstrap command for the first administrator."""

import argparse
import getpass
import sys

from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import User
from app.db.session import SessionLocal
from app.schemas.user import UserCreate


class AdminBootstrapError(RuntimeError):
    """Raised when the one-time admin bootstrap is not allowed."""


def _normalized_email(email: str) -> str:
    return email.strip().lower()


def assert_bootstrap_available(db: Session, email: str) -> None:
    """Refuse bootstrap after an administrator exists or for a duplicate email."""
    if db.query(User.id).filter(User.role == "admin").first() is not None:
        raise AdminBootstrapError(
            "An administrator already exists. Use normal admin user management "
            "instead of the bootstrap command."
        )

    normalized_email = _normalized_email(email)
    if db.query(User.id).filter(User.email == normalized_email).first() is not None:
        raise AdminBootstrapError("That email address is already registered.")


def create_initial_admin(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str | None = None,
) -> User:
    """Create exactly one initial administrator in an otherwise admin-less database."""
    assert_bootstrap_available(db, email)

    # Reuse the normal internal-user schema so validation remains aligned with
    # the administrator user-management API.
    payload = UserCreate(
        email=_normalized_email(email),
        full_name=full_name.strip() if full_name else None,
        password=password,
        role="admin",
        is_active=True,
    )

    user = User(
        email=_normalized_email(str(payload.email)),
        full_name=payload.full_name or None,
        hashed_password=get_password_hash(payload.password),
        is_active=True,
        role="admin",
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError as exc:
        db.rollback()
        raise AdminBootstrapError(
            "Unable to create the initial administrator."
        ) from exc

    return user


def _prompt_password() -> str:
    """Read and confirm the password without placing it in shell history."""
    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm admin password: ")

    if password != confirmation:
        raise AdminBootstrapError("Passwords do not match.")

    return password


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create the first administrator for a new database.",
    )
    parser.add_argument(
        "--email",
        required=True,
        help="Email address for the initial administrator.",
    )
    parser.add_argument(
        "--name",
        default=None,
        help="Optional display name for the initial administrator.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run the one-time interactive bootstrap command."""
    args = _parser().parse_args(argv)

    try:
        with SessionLocal() as db:
            # Fail immediately when bootstrap is already locked.
            assert_bootstrap_available(db, args.email)
            password = _prompt_password()
            user = create_initial_admin(
                db,
                email=args.email,
                password=password,
                full_name=args.name,
            )
    except (AdminBootstrapError, ValidationError) as exc:
        print(f"Admin bootstrap failed: {exc}", file=sys.stderr)
        return 1

    print(
        f"Initial administrator created for {user.email}. "
        "Sign in and configure MFA from Admin > Security."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
