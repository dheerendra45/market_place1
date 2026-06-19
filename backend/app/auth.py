"""
User authentication API — email + password accounts for vendors and buyers.

Self-contained, no external services or new dependencies:
  • Passwords are hashed with pbkdf2_sha256 (stdlib hashlib).
  • Sessions are stateless, HMAC-signed bearer tokens (see _make_token), mirroring
    the admin token approach but with an embedded payload (uid/email/role/exp).

Endpoints (prefix /api/auth):
  POST /register  → create an account, returns {token, user}
  POST /login     → authenticate, returns {token, user}
  GET  /me        → current user from the bearer token

Roles: 'buyer' (browse + future saved/alert features) and 'vendor' (returning
account holders who onboard products). Onboarding itself stays open — login is
optional — so these accounts are additive and do not gate the existing flow.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, field_validator

from .config import settings
from .database import execute, query_one

router = APIRouter(prefix="/api/auth", tags=["auth"])

ROLES = ("buyer", "vendor")
TOKEN_TTL_DAYS = 30
_PBKDF2_ITERATIONS = 200_000


# ── base64url helpers (no padding) ────────────────────────────────────
def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(txt: str) -> bytes:
    return base64.urlsafe_b64decode(txt + "=" * (-len(txt) % 4))


# ── password hashing (pbkdf2_sha256) ──────────────────────────────────
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${_b64e(salt)}${_b64e(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), _b64d(salt_b64), int(iters))
        return hmac.compare_digest(_b64e(dk), hash_b64)
    except Exception:  # noqa: BLE001
        return False


# ── signed bearer tokens ──────────────────────────────────────────────
def _sign(raw: str) -> str:
    return hmac.new(settings.AUTH_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()


def _make_token(uid: int, email: str, role: str) -> str:
    payload = {
        "uid": uid,
        "email": email,
        "role": role,
        "exp": int(time.time()) + TOKEN_TTL_DAYS * 86400,
    }
    raw = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    return f"{raw}.{_sign(raw)}"


def _parse_token(token: str) -> dict | None:
    try:
        raw, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sign(raw)):
            return None
        payload = json.loads(_b64d(raw))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:  # noqa: BLE001
        return None


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency — resolve the user from the Authorization header or 401."""
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    payload = _parse_token(token) if token else None
    if not payload:
        raise HTTPException(status_code=401, detail="Authentication required.")
    user = query_one(
        "SELECT id, email, name, role, company_name, vendor_id, created_at, last_login_at "
        "FROM users WHERE id = %s",
        (payload["uid"],),
    )
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return user


# ── request bodies ────────────────────────────────────────────────────
class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None
    # Single sign-up form — no buyer/vendor choice is shown. Role is classified
    # internally (see _classify). `role`/`company_name` remain accepted for
    # back-compat / admin use but are normally omitted by the client.
    role: str | None = None
    company_name: str | None = None

    @field_validator("password")
    @classmethod
    def _min_len(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

    @field_validator("role")
    @classmethod
    def _valid_role(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.lower()
        if v not in ROLES:
            raise ValueError("Role must be 'buyer' or 'vendor'.")
        return v


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ClaimBody(BaseModel):
    vendor_id: int


# ── endpoints ─────────────────────────────────────────────────────────
def _public(user: dict) -> dict:
    """Strip never-expose fields (defensive — selects already omit the hash)."""
    return {k: v for k, v in user.items() if k != "password_hash"}


@router.post("/register")
def register(body: RegisterBody):
    email = body.email.lower()
    if query_one("SELECT 1 FROM users WHERE lower(email) = %s", (email,)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    # Everyone starts as a BUYER. Being from a vendor's email domain is not
    # enough — a person at a listed vendor may simply be here to buy. Vendor
    # status is EARNED by claiming a profile (see /claim, called from
    # onboarding), so a buyer is never wrongly granted vendor access. An
    # explicit role is still honoured for admin/back-compat use.
    role = body.role or "buyer"
    company_name = body.company_name

    user = execute(
        "INSERT INTO users (email, password_hash, name, role, company_name, last_login_at) "
        "VALUES (%s, %s, %s, %s, %s, now()) "
        "RETURNING id, email, name, role, company_name, vendor_id, created_at, last_login_at",
        (email, hash_password(body.password), body.name, role, company_name),
    )
    token = _make_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": _public(user)}


@router.post("/login")
def login(body: LoginBody):
    row = query_one(
        "SELECT id, email, password_hash, name, role, company_name, vendor_id, created_at "
        "FROM users WHERE lower(email) = %s",
        (body.email.lower(),),
    )
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    execute("UPDATE users SET last_login_at = now() WHERE id = %s", (row["id"],))
    token = _make_token(row["id"], row["email"], row["role"])
    return {"token": token, "user": _public(row)}


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    return {"user": current_user(authorization)}


@router.post("/claim")
def claim_vendor(body: ClaimBody, authorization: str | None = Header(default=None)):
    """Promote the signed-in user to a VENDOR by claiming a vendor profile.

    Called by the onboarding flow after a successful submission. This is the
    ONLY way an account becomes a vendor — registration alone never grants it.
    The vendor must already exist (onboarding verifies against the registry),
    so a buyer can't self-promote against an arbitrary id.
    """
    user = current_user(authorization)
    vendor = query_one("SELECT id, name FROM vendors WHERE id = %s", (body.vendor_id,))
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    updated = execute(
        "UPDATE users SET role = 'vendor', vendor_id = %s, "
        "company_name = COALESCE(company_name, %s) "
        "WHERE id = %s "
        "RETURNING id, email, name, role, company_name, vendor_id, created_at, last_login_at",
        (vendor["id"], vendor["name"], user["id"]),
    )
    return {"user": updated}
