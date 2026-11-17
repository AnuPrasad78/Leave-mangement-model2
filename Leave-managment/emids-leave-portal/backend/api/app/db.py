from pathlib import Path
import secrets

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    ACCESS_TOKEN_MINUTES: int = 720
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Browsers authenticate only with the HttpOnly session cookie. The
    # Authorization-header fallback exists for non-browser clients (tests,
    # scripts) and is disabled in the deployed compose configuration.
    AUTH_BEARER_FALLBACK: bool = True
    # HttpOnly session-cookie settings (set by /auth/login, cleared by /auth/logout)
    SESSION_COOKIE_NAME: str = "leave_portal_session"
    SESSION_COOKIE_SECURE: bool = False  # True behind HTTPS in production
    SESSION_COOKIE_SAMESITE: str = "lax"  # "none" + SESSION_COOKIE_SECURE=True for cross-site deployments
    SESSION_COOKIE_DOMAIN: str | None = None  # e.g. "example.com" when frontend and api share a domain
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""
    DEMO_PASSWORD: str | None = None
    PASSWORD_RESET_TTL_MINUTES: int = 60

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")


settings = Settings()
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session():
    with SessionLocal() as session:
        yield session