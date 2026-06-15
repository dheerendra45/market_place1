"""
Vendor Portal — onboarding enhancement (verification + product + evidence +
defense-rating foundation), all under /api/portal.

Design rules honoured:
  • Vendors are NOT created here — onboarding is verification/update/enrichment only.
  • Evidence is normalised, multi-per-product, and immutable once verified.
  • Defense rating structure is initialised but never computed (no AI scoring).
  • Every mutation writes to product_audit_log for a full audit trail.
"""
import os
import uuid
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from psycopg.errors import RaiseException
from psycopg.types.json import Jsonb

from . import email_utils, evidence_grading, guard_mapping, scoring
from .database import execute, query, query_one
from .schemas import (
    DefenseRatingPreview,
    DefenseRatingUpsert,
    EvidenceCreate,
    EvidenceUpdate,
    EvidenceVerify,
    GuardMapStep,
    ProductCreate,
    ProductUpdate,
    VendorProfileUpdate,
    VerifyRequest,
)

router = APIRouter(prefix="/api/portal", tags=["vendor-portal"])

# ── File storage (supporting evidence documents) ──────────────────────
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
ALLOWED_EXT = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg",  # certification badges / proof images
}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Store a supporting-evidence document and return its URL + metadata."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXT))}",
        )
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB).")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as fh:
        fh.write(data)
    return {
        "file_url": f"/uploads/{stored}",
        "filename": file.filename,
        "size": len(data),
        "content_type": file.content_type,
    }


# ── helpers ───────────────────────────────────────────────────────────
def find_vendor(vendor_id: Optional[int], company_name: Optional[str]) -> Optional[dict]:
    """Resolve an EXISTING vendor by id or exact (case-insensitive) name."""
    if vendor_id is not None:
        return query_one("SELECT * FROM vendors WHERE id = %s", (vendor_id,))
    if company_name:
        return query_one(
            "SELECT * FROM vendors WHERE lower(name) = lower(%s) LIMIT 1",
            (company_name.strip(),),
        )
    return None


def require_vendor(vendor_id: Optional[int], company_name: Optional[str]) -> dict:
    v = find_vendor(vendor_id, company_name)
    if not v:
        raise HTTPException(
            status_code=404,
            detail="Vendor not found. Onboarding is verification-only — "
            "vendors cannot be created here.",
        )
    return v


def require_product(product_id: int) -> dict:
    p = query_one("SELECT * FROM products WHERE id = %s", (product_id,))
    if not p:
        raise HTTPException(status_code=404, detail="Product not found.")
    return p


def audit(action: str, *, product_id=None, vendor_id=None, detail=None, actor=None) -> None:
    execute(
        "INSERT INTO product_audit_log (product_id, vendor_id, action, detail, actor) "
        "VALUES (%s, %s, %s, %s, %s)",
        (product_id, vendor_id, action, Jsonb(detail or {}), actor),
    )


def init_defense_rating(product_id: int) -> None:
    """Create the (uncomputed) defense-rating row if absent — rating stays 0."""
    execute(
        "INSERT INTO defense_ratings (product_id) VALUES (%s) "
        "ON CONFLICT (product_id) DO NOTHING",
        (product_id,),
    )


# ── Defence Rating computation (hybrid: AI grades evidence → scoring rubric) ──
def _guard_inputs(product: dict) -> tuple[list, list]:
    """Pull adaptive controls + GUARD categories from the stored guard mapping."""
    meta = product.get("optional_metadata") or {}
    gm = meta.get("guard_mapping") or {}
    adaptive_controls = gm.get("adaptive_controls") or []
    if not adaptive_controls and product.get("covers_controls"):
        adaptive_controls = [{"code": c} for c in product["covers_controls"]]
    return adaptive_controls, (gm.get("categories") or [])


def _persist_signal(evidence_id: str, sig: dict) -> None:
    """Write Step-2c AI signals back onto product_evidence (best-effort)."""
    try:
        execute(
            "UPDATE product_evidence SET ai_tier=%s, ai_verified=%s, "
            "supports_control=%s, independent=%s, ai_reason=%s WHERE evidence_id=%s",
            (sig.get("tier"), sig.get("verified"), sig.get("supports_control"),
             sig.get("independent"), sig.get("reason"), evidence_id),
        )
    except Exception:  # noqa: BLE001 — immutability or transient error: skip
        pass


def _row_to_item(r: dict) -> dict:
    """Normalise a stored evidence row (with AI signals) into rubric input.

    `verified` is effective = admin-confirmed OR AI-assessed (ai_verified)."""
    tier = scoring.crosswalk_tier(
        type_=r.get("type"), trust_tier=r.get("trust_tier"), ai_tier=r.get("ai_tier")
    )
    return {
        "evidence_id": str(r["evidence_id"]),
        "type": r.get("type"),
        "tier": tier,
        "verified": bool(r.get("verified")) or bool(r.get("ai_verified")),
        "independent": bool(r.get("independent")),
        "issued_date": r.get("issued_date"),
    }


def compute_defense_rating(product_id: int) -> dict:
    """Run the full pipeline for a product and persist the result + a snapshot.

    AI grading (Step 2) runs ONLY for evidence not yet graded (ai_tier IS NULL);
    the deterministic rubric (Steps 3-6) always recomputes from stored signals."""
    product = require_product(product_id)
    vendor = query_one("SELECT * FROM vendors WHERE id = %s", (product["vendor_id"],)) or {}
    adaptive_controls, guard_categories = _guard_inputs(product)
    gm = (product.get("optional_metadata") or {}).get("guard_mapping") or {}

    rows = query(
        "SELECT * FROM product_evidence WHERE product_id = %s ORDER BY created_at",
        (product_id,),
    )
    ungraded = [r for r in rows if not r.get("ai_tier")]
    if ungraded:
        signals = evidence_grading.grade_evidence(product, vendor, ungraded, gm)
        for r in ungraded:
            sig = signals.get(str(r["evidence_id"]))
            if sig:
                _persist_signal(str(r["evidence_id"]), sig)
        rows = query(
            "SELECT * FROM product_evidence WHERE product_id = %s ORDER BY created_at",
            (product_id,),
        )

    items = [_row_to_item(r) for r in rows]
    result = scoring.compute_defence_rating(items, adaptive_controls, guard_categories)

    row = execute(
        """
        INSERT INTO defense_ratings
          (product_id, defense_rating, score_band, status, per_dimension,
           breakdown, evidence_traceability, notes, updated_at, computed_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now(), now())
        ON CONFLICT (product_id) DO UPDATE SET
          defense_rating = EXCLUDED.defense_rating,
          score_band = EXCLUDED.score_band,
          status = EXCLUDED.status,
          per_dimension = EXCLUDED.per_dimension,
          breakdown = EXCLUDED.breakdown,
          evidence_traceability = EXCLUDED.evidence_traceability,
          notes = EXCLUDED.notes,
          updated_at = now(),
          computed_at = now()
        RETURNING *
        """,
        (
            product_id, result["overall"], result["band"], result["status"],
            Jsonb(result["per_dimension"]), Jsonb(result["breakdown"]),
            Jsonb(result["evidence_traceability"]), Jsonb(result["notes"]),
        ),
    )
    execute(
        "INSERT INTO defense_rating_snapshots "
        "(product_id, defense_rating, score_band, status, per_dimension, "
        " breakdown, evidence_traceability) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (
            product_id, result["overall"], result["band"], result["status"],
            Jsonb(result["per_dimension"]), Jsonb(result["breakdown"]),
            Jsonb(result["evidence_traceability"]),
        ),
    )
    audit(
        "rating_computed", product_id=product_id, vendor_id=product["vendor_id"],
        detail={"defense_rating": result["overall"], "band": result["band"],
                "status": result["status"], "engine_evidence_count": len(items)},
    )
    return row


def _safe_recompute(product_id: int) -> None:
    """Recompute after a mutation; never let a scoring failure break the request."""
    try:
        compute_defense_rating(product_id)
    except Exception:  # noqa: BLE001
        pass


def preview_defense_rating(product: dict, vendor: dict, evidence: list[dict], guard_mapping: dict) -> dict:
    """Compute the rating from an in-flight onboarding draft WITHOUT persisting —
    same engine (AI grading → deterministic rubric) used at submit time."""
    rows = []
    for i, ev in enumerate(evidence or []):
        rows.append({
            "evidence_id": ev.get("id") or f"draft-{i}",
            "type": ev.get("type"),
            "title": ev.get("title"),
            "description": ev.get("description"),
            "file_url": ev.get("file_url") or ev.get("url"),
            "source_type": ev.get("source_type"),
            "issuer": ev.get("issuer"),
            "issued_date": ev.get("issued_date"),
            "trust_tier": ev.get("trust_tier"),
        })
    signals = evidence_grading.grade_evidence(product, vendor, rows, guard_mapping)

    adaptive_controls = guard_mapping.get("adaptive_controls") or []
    guard_categories = guard_mapping.get("categories") or []
    items = []
    for r in rows:
        sig = signals.get(str(r["evidence_id"]), {})
        tier = scoring.crosswalk_tier(
            type_=r.get("type"), trust_tier=r.get("trust_tier"), ai_tier=sig.get("tier")
        )
        items.append({
            "evidence_id": str(r["evidence_id"]),
            "type": r.get("type"),
            "tier": tier,
            # No admin confirmation during onboarding → use the AI assessment.
            "verified": bool(sig.get("verified")),
            "independent": bool(sig.get("independent")),
            "issued_date": r.get("issued_date"),
            "title": r.get("title"),
        })
    result = scoring.compute_defence_rating(items, adaptive_controls, guard_categories)
    # Echo the graded evidence so the UI can show per-item tiers in the breakdown.
    result["graded_evidence"] = [
        {"evidence_id": it["evidence_id"], "title": it.get("title"), "type": it.get("type"),
         "tier": it["tier"], "verified": it["verified"], "independent": it["independent"]}
        for it in items
    ]
    return result


# ══════════════════════════════════════════════════════════════════════
# AI GUARD MAPPING (Kimi-orchestrated, conversational, stateless)
# ══════════════════════════════════════════════════════════════════════
@router.get("/guard/context")
def guard_context():
    """The GUARD framework categories (from the local taxonomy mirror)."""
    return guard_mapping.guard_categories()


@router.post("/guard-mapping/step")
def guard_mapping_step(body: GuardMapStep):
    """Run one turn: returns the next question, or the final mapping when confident."""
    answers = [a.model_dump() for a in body.answers]
    return guard_mapping.run_step(body.product, body.vendor, answers)


# ══════════════════════════════════════════════════════════════════════
# 1 · VENDOR VERIFICATION (STRICT)
# ══════════════════════════════════════════════════════════════════════
@router.post("/verify")
def verify_vendor(body: VerifyRequest):
    if body.vendor_id is None and not body.company_name:
        raise HTTPException(status_code=422, detail="Provide vendor_id or company_name.")
    v = require_vendor(body.vendor_id, body.company_name)
    return {
        "verified": True,
        "vendor_id": v["id"],
        "company_name": v["name"],
        "status": v.get("status") or "active",
    }


# ══════════════════════════════════════════════════════════════════════
# VENDOR PROFILE UPDATE (no creation)
# ══════════════════════════════════════════════════════════════════════
@router.patch("/vendors/{vendor_id}")
def update_vendor_profile(vendor_id: int, body: VendorProfileUpdate):
    require_vendor(vendor_id, None)
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=422, detail="No fields to update.")
    sets = ", ".join(f"{k} = %s" for k in fields)
    row = execute(
        f"UPDATE vendors SET {sets} WHERE id = %s RETURNING *",
        (*fields.values(), vendor_id),
    )
    audit("vendor_updated", vendor_id=vendor_id, detail=fields)
    return row


# ══════════════════════════════════════════════════════════════════════
# 2 · PRODUCT ENHANCEMENT MODULE
# ══════════════════════════════════════════════════════════════════════
@router.post("/products", status_code=201)
def create_product(body: ProductCreate):
    vendor = require_vendor(body.vendor_id, body.company_name)
    # Dedup: one product name per vendor. If it already exists, UPDATE it in place
    # instead of inserting a duplicate (onboarding re-submits are idempotent).
    existing = query_one(
        "SELECT * FROM products WHERE vendor_id = %s AND lower(name) = lower(%s) LIMIT 1",
        (vendor["id"], body.product_name.strip()),
    )
    if existing:
        # Editing an EXISTING product — keep its current review_status (an already
        # live product is NOT pulled from the marketplace just because it was edited).
        row = execute(
            """
            UPDATE products SET
              what_they_do = %s,
              logo_url = COALESCE(%s, logo_url),
              product_images = %s,
              product_videos = %s,
              optional_metadata = %s,
              submitter_email = COALESCE(%s, submitter_email),
              updated_at = now()
            WHERE id = %s
            RETURNING *
            """,
            (
                body.product_description,
                body.logo_url,
                body.product_images,
                body.product_videos,
                Jsonb(body.optional_metadata or {}),
                body.work_email,
                existing["id"],
            ),
        )
        init_defense_rating(row["id"])
        audit(
            "product_deduped",
            product_id=row["id"],
            vendor_id=vendor["id"],
            detail={"product_name": body.product_name, "merged_into": existing["id"]},
        )
        return row

    # NEW product → enters the admin review pipeline as 'pending'.
    row = execute(
        """
        INSERT INTO products
          (vendor_id, name, what_they_do, logo_url, product_images,
           product_videos, optional_metadata, review_status, submitted_at, submitter_email)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', now(), %s)
        RETURNING *
        """,
        (
            vendor["id"],
            body.product_name,
            body.product_description,
            body.logo_url,
            body.product_images,
            body.product_videos,
            Jsonb(body.optional_metadata or {}),
            body.work_email,
        ),
    )
    init_defense_rating(row["id"])
    audit(
        "product_submitted",
        product_id=row["id"],
        vendor_id=vendor["id"],
        detail={"product_name": body.product_name, "review_status": "pending"},
    )
    # Acknowledge receipt by email (best-effort; recorded either way).
    email_utils.notify(
        "received", to_email=body.work_email,
        ctx={"company": vendor.get("name"), "product": body.product_name},
        product_id=row["id"], vendor_id=vendor["id"],
    )
    return row


@router.patch("/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate):
    product = require_product(product_id)
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=422, detail="No fields to update.")
    # Map the API field name to the underlying column.
    col_map = {"product_name": "name", "product_description": "what_they_do"}
    sets, params = [], []
    for key, val in payload.items():
        col = col_map.get(key, key)
        if key == "optional_metadata":
            sets.append(f"{col} = %s")
            params.append(Jsonb(val))
        else:
            sets.append(f"{col} = %s")
            params.append(val)
    sets.append("updated_at = now()")
    row = execute(
        f"UPDATE products SET {', '.join(sets)} WHERE id = %s RETURNING *",
        (*params, product_id),
    )
    audit("product_updated", product_id=product_id, vendor_id=product["vendor_id"], detail=payload)
    return row


# ══════════════════════════════════════════════════════════════════════
# 3 · EVIDENCE UPLOAD SYSTEM
# ══════════════════════════════════════════════════════════════════════
@router.get("/products/{product_id}/evidence")
def list_evidence(product_id: int):
    require_product(product_id)
    return query("SELECT * FROM product_evidence WHERE product_id = %s ORDER BY created_at", (product_id,))


@router.post("/products/{product_id}/evidence", status_code=201)
def add_evidence(product_id: int, body: EvidenceCreate):
    product = require_product(product_id)  # vendor_id derived from product
    row = execute(
        """
        INSERT INTO product_evidence
          (product_id, vendor_id, type, title, description, file_url,
           source_type, issuer, issued_date, trust_tier)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            product_id,
            product["vendor_id"],
            body.type,
            body.title,
            body.description,
            body.file_url,
            body.source_type,
            body.issuer,
            body.issued_date or None,
            body.trust_tier,
        ),
    )
    audit(
        "evidence_added",
        product_id=product_id,
        vendor_id=product["vendor_id"],
        detail={"evidence_id": str(row["evidence_id"]), "type": body.type, "trust_tier": body.trust_tier},
    )
    return row


@router.patch("/evidence/{evidence_id}")
def update_evidence(evidence_id: str, body: EvidenceUpdate):
    ev = query_one("SELECT * FROM product_evidence WHERE evidence_id = %s", (evidence_id,))
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    if ev["verified"]:
        raise HTTPException(status_code=409, detail="Verified evidence is immutable.")
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=422, detail="No fields to update.")
    # Content changed → invalidate the cached AI grade so it is re-graded next compute.
    sets = ", ".join(f"{k} = %s" for k in payload) + ", ai_tier = NULL"
    try:
        row = execute(
            f"UPDATE product_evidence SET {sets} WHERE evidence_id = %s RETURNING *",
            (*payload.values(), evidence_id),
        )
    except RaiseException as exc:  # DB-level immutability guard
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    audit("evidence_updated", product_id=ev["product_id"], vendor_id=ev["vendor_id"], detail=payload)
    return row


@router.post("/evidence/{evidence_id}/verify")
def verify_evidence(evidence_id: str, body: EvidenceVerify):
    ev = query_one("SELECT * FROM product_evidence WHERE evidence_id = %s", (evidence_id,))
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found.")
    if ev["verified"]:
        return ev  # already verified & immutable
    row = execute(
        "UPDATE product_evidence SET verified = true, verified_at = now(), verified_by = %s "
        "WHERE evidence_id = %s RETURNING *",
        (body.verified_by, evidence_id),
    )
    audit(
        "evidence_verified",
        product_id=ev["product_id"],
        vendor_id=ev["vendor_id"],
        detail={"evidence_id": evidence_id, "verified_by": body.verified_by},
        actor=body.verified_by,
    )
    # Admin just confirmed evidence — the rating's verified-dependent dimensions
    # and provisional/verified status may change, so recompute.
    _safe_recompute(ev["product_id"])
    return row


# ══════════════════════════════════════════════════════════════════════
# 5 · DEFENSE RATING FOUNDATION (structure only — never computed here)
# ══════════════════════════════════════════════════════════════════════
@router.get("/products/{product_id}/defense-rating")
def get_defense_rating(product_id: int):
    require_product(product_id)
    init_defense_rating(product_id)
    row = query_one("SELECT * FROM defense_ratings WHERE product_id = %s", (product_id,))
    return row


@router.post("/products/{product_id}/defense-rating/compute")
def compute_defense_rating_endpoint(product_id: int):
    """Run the hybrid engine (AI grades evidence → deterministic rubric) and
    persist the rating + a history snapshot. Idempotent — safe to re-run."""
    return compute_defense_rating(product_id)


@router.post("/defense-rating/preview")
def defense_rating_preview(body: DefenseRatingPreview):
    """Compute (but don't persist) a Defence Rating for an in-progress onboarding
    draft — powers the Defence Rating step shown before Review."""
    return preview_defense_rating(body.product, body.vendor, body.evidence, body.guard_mapping)


@router.put("/products/{product_id}/defense-rating")
def upsert_defense_rating(product_id: int, body: DefenseRatingUpsert):
    product = require_product(product_id)
    breakdown = [b.model_dump() for b in body.score_breakdown]
    trace = [t.model_dump() for t in body.evidence_traceability]
    row = execute(
        """
        INSERT INTO defense_ratings (product_id, defense_rating, breakdown, evidence_traceability, updated_at)
        VALUES (%s, %s, %s, %s, now())
        ON CONFLICT (product_id) DO UPDATE SET
          defense_rating = EXCLUDED.defense_rating,
          breakdown = EXCLUDED.breakdown,
          evidence_traceability = EXCLUDED.evidence_traceability,
          updated_at = now()
        RETURNING *
        """,
        (product_id, body.defense_rating, Jsonb(breakdown), Jsonb(trace)),
    )
    if body.snapshot:
        execute(
            "INSERT INTO defense_rating_snapshots "
            "(product_id, defense_rating, breakdown, evidence_traceability) "
            "VALUES (%s, %s, %s, %s)",
            (product_id, body.defense_rating, Jsonb(breakdown), Jsonb(trace)),
        )
    audit("rating_updated", product_id=product_id, vendor_id=product["vendor_id"],
          detail={"defense_rating": body.defense_rating})
    return row


@router.get("/products/{product_id}/defense-rating/history")
def defense_rating_history(product_id: int):
    require_product(product_id)
    return query(
        "SELECT * FROM defense_rating_snapshots WHERE product_id = %s ORDER BY created_at DESC",
        (product_id,),
    )


# ══════════════════════════════════════════════════════════════════════
# AUDIT TRAIL
# ══════════════════════════════════════════════════════════════════════
@router.get("/products/{product_id}/audit")
def product_audit(product_id: int):
    return query(
        "SELECT * FROM product_audit_log WHERE product_id = %s ORDER BY created_at DESC",
        (product_id,),
    )
