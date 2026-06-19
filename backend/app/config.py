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

    # Server-side secret used to sign user (vendor/buyer) auth tokens. CHANGE in
    # production via env. Separate from ADMIN_SECRET so admin and user tokens
    # never cross-validate.
    AUTH_SECRET: str = os.getenv("AUTH_SECRET", "attacked-defence-layer-user-secret")

    # Public base URL used to build links inside notification emails AND as the
    # origin for OAuth redirect URIs (e.g. {APP_BASE_URL}/api/auth/oauth/google/callback).
    # Local (vite dev) should set this to http://localhost:5173.
    APP_BASE_URL: str = os.getenv("APP_BASE_URL", "http://localhost:8080")

    # ── Social login (OIDC) — leave blank to disable a provider. The frontend
    # hides each button until its client id + secret are present. ──
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    MS_CLIENT_ID: str = os.getenv("MS_CLIENT_ID", "")
    MS_CLIENT_SECRET: str = os.getenv("MS_CLIENT_SECRET", "")

    # Absolute URL of the email logo (must be publicly reachable — email clients
    # can't load localhost or relative paths). Defaults to the Vercel-hosted PNG.
    EMAIL_LOGO_URL: str = os.getenv(
        "EMAIL_LOGO_URL",
        "https://market-place-five-sepia.vercel.app/attacked-email-logo.png",
    )

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
