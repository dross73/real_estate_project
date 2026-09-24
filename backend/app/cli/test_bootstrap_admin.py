"""Tests for the one-time initial administrator bootstrap."""

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.cli.bootstrap_admin import AdminBootstrapError, create_initial_admin
from app.core.security import verify_password
from app.db.base import Base
from app.db.models import User


@pytest.fixture()
def db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_bootstrap_creates_one_active_admin_with_hashed_password(db: Session):
    user = create_initial_admin(
        db,
        email="  FIRST.ADMIN@EXAMPLE.COM ",
        full_name="  First Admin  ",
        password="StrongPassword123!",
    )

    assert user.email == "first.admin@example.com"
    assert user.full_name == "First Admin"
    assert user.role == "admin"
    assert user.is_active is True
    assert user.hashed_password != "StrongPassword123!"
    assert verify_password("StrongPassword123!", user.hashed_password) is True


def test_bootstrap_refuses_a_second_admin(db: Session):
    create_initial_admin(
        db,
        email="first@example.com",
        password="StrongPassword123!",
    )

    with pytest.raises(AdminBootstrapError, match="administrator already exists"):
        create_initial_admin(
            db,
            email="second@example.com",
            password="AnotherPassword123!",
        )

    assert db.query(User).filter(User.role == "admin").count() == 1


def test_bootstrap_refuses_duplicate_existing_non_admin_email(db: Session):
    db.add(
        User(
            email="staff@example.com",
            full_name="Existing Staff",
            hashed_password="not-used-in-this-test",
            is_active=True,
            role="staff",
        )
    )
    db.commit()

    with pytest.raises(AdminBootstrapError, match="already registered"):
        create_initial_admin(
            db,
            email="STAFF@example.com",
            password="StrongPassword123!",
        )


@pytest.mark.parametrize(
    ("email", "password"),
    [
        ("not-an-email", "StrongPassword123!"),
        ("admin@example.com", "short"),
        ("admin@example.com", "é" * 40),
    ],
)
def test_bootstrap_reuses_normal_user_validation(
    db: Session,
    email: str,
    password: str,
):
    with pytest.raises(ValidationError):
        create_initial_admin(
            db,
            email=email,
            password=password,
        )

    assert db.query(User).count() == 0
