"""Shared isolated FastAPI/database fixtures for backend integration tests."""

from collections.abc import Callable, Generator, Iterable
from dataclasses import dataclass

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db


@dataclass
class IsolatedApi:
    """One FastAPI test client backed by a private in-memory database."""

    app: FastAPI
    client: TestClient
    db: Session
    engine: object


@pytest.fixture()
def isolated_api_factory() -> Generator[
    Callable[[Iterable[APIRouter]], IsolatedApi],
    None,
    None,
]:
    """Create clean API/database contexts that never share state between tests."""
    contexts: list[IsolatedApi] = []

    def create(routers: Iterable[APIRouter]) -> IsolatedApi:
        engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        testing_session = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine,
        )

        Base.metadata.create_all(bind=engine)
        db = testing_session()

        app = FastAPI()
        for router in routers:
            app.include_router(router)

        def override_get_db():
            yield db

        app.dependency_overrides[get_db] = override_get_db

        context = IsolatedApi(
            app=app,
            client=TestClient(app),
            db=db,
            engine=engine,
        )
        contexts.append(context)
        return context

    try:
        yield create
    finally:
        for context in reversed(contexts):
            context.db.close()
            Base.metadata.drop_all(bind=context.engine)
            context.engine.dispose()
