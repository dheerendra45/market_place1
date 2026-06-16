"""
Admin review dashboard API (hidden /admin route).

Auth: a single shared password (settings.ADMIN_PASSWORD). POST /login returns an
opaque bearer token derived from the password + server secret; every other
endpoint requires it via `Authorization: Bearer <token>`. No links to this
router exist anywhere in the app — it is reached only by the /admin URL.

Workflow: vendor submissions land as products with review_status='pending'.
Admin can verify evidence, request more info, reject (with reason), or approve
(which publishes to the marketplace). Each decision emails the vendor.
"""
from __future__ import annotations

import hashlib
import hmac

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from . import email_utils
from .config import settings
from .database import execute, query, query_one
from .portal import compute_defense_rating

router = APIRouter(prefix="/api/admin", tags=["admin"])

REVIEW_STATES = ("pending", "needs_info", "approved", "rejected")


# ── auth ──────────────────────────────────────────────────────────────
def _expected_token() -> str:
    return hmac.new(
        settings.ADMIN_SECRET.encode(),
        settings.ADMIN_PASSWORD.encode(),
        hashlib.sha256,
    ).hexdigest()


def require_admin(authorization: str | None = Header(default=None)) -> None:
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token or not hmac.compare_digest(token, _expected_token()):
        raise HTTPException(status_code=401, detail="Admin authentication required.")


class LoginBody(BaseModel):
    password: str


@router.post("/login")
def admin_login(body: LoginBody):
    if not hmac.compare_digest(body.password, settings.ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    return {"token": _expected_token()}


@router.get("/session")
def admin_session(authorization: str | None = Header(default=None)):
    """Cheap token-validity probe for the frontend (401 if the token is stale)."""
    require_admin(authorization)
    return {"ok": True}


# ── action bodies ─────────────────────────────────────────────────────
class ReviewNote(BaseModel):
    note: str | None = None
    actor: str | None = "admin"
    to_email: str | None = None
    subject: str | None = None
    body: str | None = None


class RejectBody(BaseModel):
    reason: str
    actor: str | None = "admin"
    to_email: str | None = None
    subject: str | None = None
    body: str | None = None


class RequestInfoBody(BaseModel):
    message: str
    actor: str | None = "admin"
    to_email: str | None = None
    subject: str | None = None
    body: str | None = None


class EmailPreviewBody(BaseModel):
    kind: str                 # approved | rejected | needs_info | received
    note: str | None = None


class VerifyBody(BaseModel):
    actor: str | None = "admin"


# ── helpers ───────────────────────────────────────────────────────────
SUBMISSION_SELECT = """
    SELECT p.id, p.name AS product_name, p.what_they_do AS description,
           p.product_url, p.logo_url AS product_logo_url, p.product_images,
           p.product_videos, p.optional_metadata, p.covers_controls,
           p.review_status, p.review_note, p.submitter_email,
           p.submitted_at, p.reviewed_at, p.reviewed_by, p.created_at, p.updated_at,
           v.id AS vendor_id, v.name AS vendor_name, v.entity_type, v.hq,
           v.website, v.domain, v.logo_url AS vendor_logo,
           dr.defense_rating AS dr_rating, dr.score_band AS dr_band,
           dr.status AS dr_status, dr.per_dimension AS dr_dimensions,
           dr.breakdown AS dr_breakdown, dr.computed_at AS dr_computed_at
    FROM products p
    JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN defense_ratings dr ON dr.product_id = p.id
"""


def _vendor_email(product: dict) -> str | None:
    if product.get("submitter_email"):
        return product["submitter_email"]
    # Fallback: most recent onboarding row for this company.
    row = query_one(
        "SELECT work_email FROM vendor_onboarding WHERE lower(company_name) = lower(%s) "
        "ORDER BY updated_at DESC LIMIT 1",
        (product.get("vendor_name") or "",),
    )
    return row["work_email"] if row else None


def _require_submission(product_id: int) -> dict:
    row = query_one(SUBMISSION_SELECT + " WHERE p.id = %s", (product_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return row


def _email_ctx(sub: dict, note: str | None = None) -> dict:
    """Rich context for the branded email (product summary card + greeting)."""
    meta = sub.get("optional_metadata") or {}
    return {
        "company": sub.get("vendor_name"),
        "vendor": sub.get("vendor_name"),
        "product": sub.get("product_name"),
        "category": meta.get("category"),
        "rating": sub.get("dr_rating") if sub.get("dr_status") == "verified" else None,
        "band": sub.get("dr_band"),
        "note": note,
    }


def _set_status(product_id: int, status: str, note: str | None, actor: str | None) -> dict:
    return execute(
        "UPDATE products SET review_status=%s, review_note=%s, reviewed_at=now(), "
        "reviewed_by=%s, updated_at=now() WHERE id=%s RETURNING *",
        (status, note, actor, product_id),
    )


def _audit(product_id, vendor_id, action, detail, actor):
    from psycopg.types.json import Jsonb
    execute(
        "INSERT INTO product_audit_log (product_id, vendor_id, action, detail, actor) "
        "VALUES (%s, %s, %s, %s, %s)",
        (product_id, vendor_id, action, Jsonb(detail or {}), actor),
    )


# ── dashboard reads ───────────────────────────────────────────────────
@router.get("/stats")
def admin_stats(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    counts = {s: 0 for s in REVIEW_STATES}
    for r in query("SELECT review_status, COUNT(*) AS c FROM products GROUP BY review_status"):
        if r["review_status"] in counts:
            counts[r["review_status"]] = r["c"]
    total_vendors = query_one("SELECT COUNT(*) AS c FROM vendors")["c"]
    return {
        "pending": counts["pending"],
        "needs_info": counts["needs_info"],
        "approved": counts["approved"],
        "rejected": counts["rejected"],
        "total_submissions": sum(counts.values()),
        "total_vendors": total_vendors,
    }


@router.get("/submissions")
def list_submissions(status: str = "pending", authorization: str | None = Header(default=None)):
    require_admin(authorization)
    where, params = "", ()
    if status in REVIEW_STATES:
        where = " WHERE p.review_status = %s"
        params = (status,)
    rows = query(
        SUBMISSION_SELECT + where + " ORDER BY COALESCE(p.submitted_at, p.created_at) DESC",
        params,
    )
    return rows


@router.get("/submissions/{product_id}")
def get_submission(product_id: int, authorization: str | None = Header(default=None)):
    require_admin(authorization)
    sub = _require_submission(product_id)
    sub["evidence"] = query(
        "SELECT evidence_id, type, title, description, source_type, issuer, "
        "issued_date, trust_tier, ai_tier, ai_verified, independent, supports_control, "
        "verified, verified_at, verified_by, file_url, created_at "
        "FROM product_evidence WHERE product_id=%s ORDER BY created_at",
        (product_id,),
    )
    sub["audit"] = query(
        "SELECT action, detail, actor, created_at FROM product_audit_log "
        "WHERE product_id=%s ORDER BY created_at DESC LIMIT 50",
        (product_id,),
    )
    sub["notifications"] = query(
        "SELECT kind, subject, status, to_email, created_at FROM admin_notifications "
        "WHERE product_id=%s ORDER BY created_at DESC",
        (product_id,),
    )
    sub["recipient_email"] = _vendor_email(sub)
    return sub


@router.get("/activity")
def admin_activity(authorization: str | None = Header(default=None)):
    require_admin(authorization)
    return query(
        "SELECT a.action, a.detail, a.actor, a.created_at, a.product_id, "
        "       p.name AS product_name, v.name AS vendor_name "
        "FROM product_audit_log a "
        "LEFT JOIN products p ON p.id = a.product_id "
        "LEFT JOIN vendors v ON v.id = a.vendor_id "
        "ORDER BY a.created_at DESC LIMIT 40"
    )


# ── decisions ─────────────────────────────────────────────────────────
@router.post("/submissions/{product_id}/approve")
def approve(product_id: int, body: ReviewNote, authorization: str | None = Header(default=None)):
    require_admin(authorization)
    sub = _require_submission(product_id)
    _set_status(product_id, "approved", body.note, body.actor)
    # Approval verifies the listing → shows the Verified badge instead of "Claim".
    execute("UPDATE products SET verified = true WHERE id = %s", (product_id,))
    # Recompute the rating now that an admin has reviewed it (best-effort).
    try:
        compute_defense_rating(product_id)
    except Exception:  # noqa: BLE001
        pass
    _audit(product_id, sub["vendor_id"], "submission_approved",
           {"note": body.note}, body.actor)
    notif = email_utils.notify(
        "approved", to_email=body.to_email or _vendor_email(sub),
        ctx=_email_ctx(sub, body.note),
        product_id=product_id, vendor_id=sub["vendor_id"],
        subject=body.subject, body=body.body,
    )
    return {"review_status": "approved", "notification": notif}


@router.post("/submissions/{product_id}/reject")
def reject(product_id: int, body: RejectBody, authorization: str | None = Header(default=None)):
    require_admin(authorization)
    sub = _require_submission(product_id)
    _set_status(product_id, "rejected", body.reason, body.actor)
    _audit(product_id, sub["vendor_id"], "submission_rejected",
           {"reason": body.reason}, body.actor)
    notif = email_utils.notify(
        "rejected", to_email=body.to_email or _vendor_email(sub),
        ctx=_email_ctx(sub, body.reason),
        product_id=product_id, vendor_id=sub["vendor_id"],
        subject=body.subject, body=body.body,
    )
    return {"review_status": "rejected", "notification": notif}


@router.post("/submissions/{product_id}/request-info")
def request_info(product_id: int, body: RequestInfoBody, authorization: str | None = Header(default=None)):
    require_admin(authorization)
    sub = _require_submission(product_id)
    _set_status(product_id, "needs_info", body.message, body.actor)
    _audit(product_id, sub["vendor_id"], "submission_needs_info",
           {"message": body.message}, body.actor)
    notif = email_utils.notify(
        "needs_info", to_email=body.to_email or _vendor_email(sub),
        ctx=_email_ctx(sub, body.message),
        product_id=product_id, vendor_id=sub["vendor_id"],
        subject=body.subject, body=body.body,
    )
    return {"review_status": "needs_info", "notification": notif}


@router.post("/submissions/{product_id}/email-preview")
def email_preview(product_id: int, body: EmailPreviewBody, authorization: str | None = Header(default=None)):
    """Return the branded email (subject + body + recipient) for an action, so the
    admin can review and edit it before sending."""
    require_admin(authorization)
    sub = _require_submission(product_id)
    subject, text = email_utils.build_email(body.kind, _email_ctx(sub, body.note))
    return {"to_email": _vendor_email(sub), "subject": subject, "body": text}


@router.post("/evidence/{evidence_id}/verify")
def admin_verify_evidence(evidence_id: str, body: VerifyBody, authorization: str | None = Header(default=None)):
    """Admin confirms an evidence item is genuine — feeds the Defence Rating."""
    require_admin(authorization)
    ev = query_one("SELECT * FROM product_evidence WHERE evidence_id=%s", (evidence_id,))
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    if not ev["verified"]:
        execute(
            "UPDATE product_evidence SET verified=true, verified_at=now(), verified_by=%s "
            "WHERE evidence_id=%s",
            (body.actor, evidence_id),
        )
        _audit(ev["product_id"], ev["vendor_id"], "evidence_verified",
               {"evidence_id": evidence_id}, body.actor)
    try:
        compute_defense_rating(ev["product_id"])
    except Exception:  # noqa: BLE001
        pass
    return query_one("SELECT * FROM product_evidence WHERE evidence_id=%s", (evidence_id,))


@router.get("/notifications")
def notifications(product_id: int | None = None, authorization: str | None = Header(default=None)):
    require_admin(authorization)
    if product_id is not None:
        return query("SELECT * FROM admin_notifications WHERE product_id=%s ORDER BY created_at DESC", (product_id,))
    return query("SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100")
