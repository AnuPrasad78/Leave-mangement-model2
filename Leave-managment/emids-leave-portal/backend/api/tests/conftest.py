"""Test harness for the Leave Portal API.

Database strategy
-----------------
Every integration test runs against a real PostgreSQL 16 instance, because the
schema relies on Postgres-only features (GIST exclusion constraints, advisory
locks, sequences, `gen_random_uuid`). In-memory alternatives (SQLite) would
silently skip the rules the API is built on.

Two supported modes:

1. Default (recommended locally): an *ephemeral* `postgres:16` container is
   started via the Docker Engine (the same runtime that powers `compose.yaml`),
   migrated with Alembic, and removed when the process exits. No state ever
   touches your development `leave_portal` database.

2. CI / pinned server: set ``TEST_DATABASE_URL`` to point at an external
   Postgres instance (e.g. the `postgres:16` service in GitHub Actions, or a
   locally started `docker compose up -d db`). As a safety net, the URL must
   point at a database whose name contains ``test`` — the harness refuses to
   operate on your development database.

Import-order note: ``app.db`` reads ``DATABASE_URL`` at import time, so the
environment is configured here *before* any application import.
"""

import atexit
import os
import time
import uuid
from pathlib import Path

import pytest  # pyright: ignore[reportMissingImports]

API_DIR = Path(__file__).resolve().parents[1]

CONTAINER_LABEL = "emids-leave-portal-tests"
PG_USER = "leave_test"
PG_PASSWORD = "leave_test"
PG_DB = "leave_test"
PG_IMAGE = "postgres:16"

DEFAULT_PASSWORD = "TestPassword123!"


# --------------------------------------------------------------------------
# Database acquisition (must run before `app.db` is imported anywhere)
# --------------------------------------------------------------------------
def _container_url(container) -> str:
    host_port = container.attrs["NetworkSettings"]["Ports"]["5432/tcp"][0]["HostPort"]
    return f"postgresql+psycopg://{PG_USER}:{PG_PASSWORD}@localhost:{host_port}/{PG_DB}"


def _wait_for_postgres(container, timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = container.exec_run(["pg_isready", "-U", PG_USER, "-d", PG_DB])
        if result.exit_code == 0:
            return
        time.sleep(0.5)
    raise TimeoutError(f"Test Postgres container {container.short_id} did not become ready in {timeout}s")


def _acquire_test_database() -> tuple[str, object | None]:
    """Return (database URL, container-or-None). The container, when we started
    it, is removed again by an atexit hook when the test process ends."""
    if TEST_DATABASE_URL := os.environ.get("TEST_DATABASE_URL"):
        from sqlalchemy.engine import make_url

        database_name = make_url(TEST_DATABASE_URL).database or ""
        if "test" not in database_name.lower():
            raise RuntimeError(
                f"Refusing to run tests against database {database_name!r}. "
                "TEST_DATABASE_URL must point at a dedicated test database "
                "(name containing 'test') so your development data is never touched."
            )
        return TEST_DATABASE_URL, None

    try:
        import docker
    except ImportError as error:  # pragma: no cover - environmental guard
        raise RuntimeError(
            "No way to obtain a test Postgres. Either start Docker (tests spin up "
            "an ephemeral postgres:16 container automatically) or export "
            "TEST_DATABASE_URL, e.g. TEST_DATABASE_URL="
            "postgresql+psycopg://leave_app:root_345@localhost:5432/leave_portal_test"
        ) from error

    client = docker.from_env()

    # Reuse an orphaned container from a crashed test run instead of failing
    # on name/port collisions.
    orphans = client.containers.list(filters={"label": CONTAINER_LABEL})
    if orphans:
        container = orphans[0]
        _wait_for_postgres(container)
        return _container_url(container), container

    container = client.containers.run(
        PG_IMAGE,
        name=f"leave-portal-tests-{uuid.uuid4().hex[:8]}",
        environment={
            "POSTGRES_USER": PG_USER,
            "POSTGRES_PASSWORD": PG_PASSWORD,
            "POSTGRES_DB": PG_DB,
        },
        ports={"5432/tcp": None},  # random host port: safe for parallel runs
        detach=True,
        auto_remove=True,
        labels={CONTAINER_LABEL: "true"},
    )

    def _cleanup() -> None:
        try:
            container.stop(timeout=0)
        except Exception:
            pass

    atexit.register(_cleanup)
    _wait_for_postgres(container)
    return _container_url(container), container


TEST_DATABASE_URL, _owned_container = _acquire_test_database()

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
os.environ["ACCESS_TOKEN_MINUTES"] = os.environ.get("ACCESS_TOKEN_MINUTES", "720")
if "CORS_ORIGINS" not in os.environ:
    os.environ["CORS_ORIGINS"] = "http://localhost:5173"

if _owned_container is not None:
    import logging

    logging.getLogger("pytest.root").info(
        "Using ephemeral Postgres container %s (%s)",
        _owned_container.short_id,
        TEST_DATABASE_URL,
    )


# --------------------------------------------------------------------------
# Alembic migrations on the test database (session start)
# --------------------------------------------------------------------------
def _run_migrations() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(API_DIR / "alembic.ini")
    config.set_main_option("script_location", str(API_DIR / "migrations"))
    command.upgrade(config, "head")


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def db_engine():
    """Engine bound to the migrated test database."""
    _run_migrations()
    from app.db import engine

    yield engine


def _truncate_all(engine) -> None:
    from sqlalchemy import text

    from app.models import Base

    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE'))


@pytest.fixture(autouse=True)
def clean_database(db_engine):
    """Empty every table around each test: full isolation without the cost of
    re-migrating, and identity sequences restart so assertions stay stable."""
    _truncate_all(db_engine)
    yield
    _truncate_all(db_engine)


@pytest.fixture
def client(db_engine):
    """HTTP client against the real app, with sessions bound to the test DB."""
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import sessionmaker

    from app.db import get_session
    from app.main import app

    TestSessionLocal = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def override_get_session():
        with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture
def session(db_engine):
    """Direct-DB session maker for arranging state (balances, extra rows).

    Usage: `with session() as db: ...` — short-lived, committed by the test.
    """
    from sqlalchemy.orm import sessionmaker

    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    return factory


@pytest.fixture
def user_factory(db_engine):
    """Factory: creates a User only (no employee profile)."""
    from sqlalchemy.orm import sessionmaker

    from app.models import User

    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def _create(email: str, password: str = DEFAULT_PASSWORD, is_active: bool = True) -> User:
        from app.security import hash_password

        with factory() as db_session:
            user = User(email=email, password_hash=hash_password(password), is_active=is_active)
            db_session.add(user)
            db_session.commit()
            db_session.refresh(user)
            return user

    return _create


@pytest.fixture
def employee_factory(db_engine):
    """Factory: creates a User + linked Employee in one step."""
    from sqlalchemy.orm import sessionmaker

    from app.models import Employee, SystemRole, User

    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    hashed_password = {}

    def _hash(password):
        if password not in hashed_password:
            from app.security import hash_password

            hashed_password[password] = hash_password(password)
        return hashed_password[password]

    def _create(
        email: str,
        password: str = DEFAULT_PASSWORD,
        role: SystemRole = SystemRole.EMPLOYEE,
        manager: Employee | None = None,
        full_name: str | None = None,
        is_active: bool = True,
        link_user: bool = True,
    ) -> Employee:
        with factory() as db_session:
            user = User(email=email, password_hash=_hash(password), is_active=is_active)
            db_session.add(user)
            db_session.flush()
            employee = Employee(
                email=email,
                user_id=user.id if link_user else None,
                full_name=full_name or email.split("@")[0].replace(".", " ").title(),
                system_role=role,
                manager_id=manager.id if manager else None,
            )
            db_session.add(employee)
            db_session.commit()
            db_session.refresh(employee)
            return employee

    return _create


@pytest.fixture
def leave_types(db_engine):
    """Seed the production leave-type catalogue; returns {name: LeaveType}."""
    from sqlalchemy.orm import sessionmaker

    from app.models import LeaveType
    from app.seed_data import LEAVE_TYPES

    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    with factory() as db_session:
        mapping = {}
        for name in LEAVE_TYPES:
            leave_type = LeaveType(name=name, is_active=True)
            db_session.add(leave_type)
            mapping[name] = leave_type
        db_session.commit()
        for leave_type in mapping.values():
            db_session.refresh(leave_type)
    return mapping


@pytest.fixture
def make_holiday(session):
    """Factory: inserts a Holiday row. Defaults to an India optional holiday
    in 2027 — pass `holiday_date` and `name` explicitly, override anything else."""
    from app.models import Holiday

    defaults = {
        "country": "India",
        "location": None,
        "year": 2027,
        "kind": "optional",
        "holiday_date": None,
        "name": None,
    }

    def _create(**overrides) -> Holiday:
        values = {**defaults, **overrides}
        with session() as db_session:
            holiday = Holiday(**values)
            db_session.add(holiday)
            db_session.commit()
            db_session.refresh(holiday)
        return holiday

    return _create


@pytest.fixture
def auth_headers(client):
    """Returns a function: auth_headers(email) -> Authorization headers."""

    def _headers(email: str, password: str = DEFAULT_PASSWORD) -> dict[str, str]:
        response = client.post("/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _headers
