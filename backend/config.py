import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


class Config:
    ENVIRONMENT = os.getenv("FLASK_ENV", "development").strip().lower()

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-me")

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        minutes=_int_env("ACCESS_TOKEN_EXPIRES_MINUTES", 60)
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=_int_env("REFRESH_TOKEN_EXPIRES_DAYS", 30)
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False
    MAX_CONTENT_LENGTH = _int_env(
        "MAX_CONTENT_LENGTH_BYTES", 5 * 1024 * 1024
    )

    FRONTEND_URL = os.getenv(
        "FRONTEND_URL", "http://localhost:5173"
    )

    PAYMENT_PROVIDER = os.getenv(
        "PAYMENT_PROVIDER", "demo"
    ).strip().lower()

    PAYSTACK_SECRET_KEY = os.getenv(
        "PAYSTACK_SECRET_KEY", ""
    )

    PAYSTACK_CALLBACK_URL = os.getenv(
        "PAYSTACK_CALLBACK_URL",
        "http://localhost:5173/payments/verify",
    )

    RATELIMIT_STORAGE_URI = os.getenv(
        "RATELIMIT_STORAGE_URI", "memory://"
    )

    raw_database_url = os.getenv(
        "DATABASE_URL", "sqlite:///smartwaste.db"
    )

    if raw_database_url.startswith("postgres://"):
        raw_database_url = raw_database_url.replace(
            "postgres://", "postgresql+psycopg://", 1
        )
    elif raw_database_url.startswith("postgresql://"):
        raw_database_url = raw_database_url.replace(
            "postgresql://", "postgresql+psycopg://", 1
        )

    SQLALCHEMY_DATABASE_URI = raw_database_url

    @classmethod
    def validate_production(cls):
        if cls.ENVIRONMENT != "production":
            return

        if cls.SECRET_KEY in {"", "dev-secret-change-me"}:
            raise RuntimeError(
                "Production SECRET_KEY is missing or uses the development default."
            )

        if cls.JWT_SECRET_KEY in {"", "dev-jwt-secret-change-me"}:
            raise RuntimeError(
                "Production JWT_SECRET_KEY is missing or uses the development default."
            )

        if cls.SECRET_KEY == cls.JWT_SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY and JWT_SECRET_KEY must be different."
            )

        if cls.SQLALCHEMY_DATABASE_URI.startswith("sqlite:///"):
            raise RuntimeError(
                "Production must use PostgreSQL, not SQLite."
            )

        if cls.FRONTEND_URL.startswith("http://localhost"):
            raise RuntimeError(
                "Production FRONTEND_URL must be the deployed HTTPS frontend."
            )

        if cls.PAYMENT_PROVIDER == "demo":
            raise RuntimeError(
                "Production PAYMENT_PROVIDER cannot be demo."
            )

        if cls.PAYMENT_PROVIDER == "paystack":
            if not cls.PAYSTACK_SECRET_KEY:
                raise RuntimeError(
                    "Production Paystack configuration requires PAYSTACK_SECRET_KEY."
                )

            if not cls.PAYSTACK_CALLBACK_URL.startswith("https://"):
                raise RuntimeError(
                    "Production PAYSTACK_CALLBACK_URL must use HTTPS."
                )

        if cls.PAYMENT_PROVIDER not in {"demo", "paystack"}:
            raise RuntimeError(
                f"Unsupported PAYMENT_PROVIDER: {cls.PAYMENT_PROVIDER}"
            )

        if cls.RATELIMIT_STORAGE_URI.startswith("memory://"):
            raise RuntimeError(
                "Production rate limiting must use a persistent store such as Redis."
            )


class TestConfig(Config):
    TESTING = True
    ENVIRONMENT = "testing"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=10)
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_STORAGE_URI = "memory://"
    PAYMENT_PROVIDER = "demo"
