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
    DEMO_PASSWORD: str | None = None

    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")


settings = Settings()
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session():
    with SessionLocal() as session:
        yield session