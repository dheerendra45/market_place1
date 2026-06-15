"""Application configuration — loads env vars and provides settings."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Local default works against the docker-compose Postgres exposed on 5432.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://attacked:attacked@localhost:5433/attacked",
    )
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://localhost:8080",
        ).split(",")
        if o.strip()
    ]

    # Gemini (Google) — primary engine for AI GUARD Mapping. Leave GEMINI_API_KEY
    # empty to use the deterministic local fallback engine. Default model is the
    # cheapest available tier.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_BASE_URL: str = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

    # ── Admin dashboard (hidden /admin route) ──────────────────────────
    # Single shared password gate. CHANGE in production via env.
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "attacked-admin")
    # Server-side secret used to derive the opaque bearer token from the password.
    ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "attacked-defence-layer-admin-secret")

    # Public base URL used to build links inside notification emails.
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://localhost:8080")

    # ── Outbound email (vendor notifications) ──────────────────────────
    # If SMTP_HOST is empty, emails are recorded (queued) but not sent — the
    # admin dashboard still shows them, so the flow works without a mail server.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "Attacked.ai Defence Layer <no-reply@attacked.ai>")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() in ("1", "true", "yes")


settings = Settings()
