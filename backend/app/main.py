"""
Attacked.ai Defence Layer — FastAPI Backend
Data served from a local PostgreSQL database (seeded from the vendor
enrichment workbook). Supabase has been fully removed.
"""
import os
import re
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, field_validator

from .config import settings
from .database import execute, query, query_one, wait_for_db
from .migrations import run_migrations
from .portal import router as portal_router
from .admin import router as admin_router
from .auth import router as auth_router
from .scoring import SCORE_BANDS, TIER_WEIGHTS, get_score_band


@asynccontextmanager
async def lifespan(app: FastAPI):
    wait_for_db()
    try:
        run_migrations()
    except Exception:  # noqa: BLE001 — non-fatal on startup
        pass
    yield


def youtube_id(url: str | None) -> str | None:
    """Extract an 11-char YouTube id from a watch / youtu.be / embed URL."""
    if not url:
        return None
    m = re.search(r"(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


app = FastAPI(title="Attacked.ai Defence Layer API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Vendor portal (verification + product enhancement + evidence + defense rating)
app.include_router(portal_router)
# Hidden admin review dashboard (auth-gated; no app links point here)
app.include_router(admin_router)
# User accounts (email+password auth for vendors & buyers)
app.include_router(auth_router)

# Serve uploaded supporting-evidence documents.
_UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOAD_DIR), name="uploads")

# ── GUARD categories (static, spec-defined) ───────────────────────────
GUARD_CATEGORIES = [
    {"code": "STR", "label": "Strategic"},
    {"code": "OPS", "label": "Operational"},
    {"code": "FIN", "label": "Financial"},
    {"code": "REG", "label": "Regulatory"},
    {"code": "CYB", "label": "Cyber"},
    {"code": "REP", "label": "Reputational"},
    {"code": "PHY", "label": "Physical"},
    {"code": "DAT", "label": "Data"},
    {"code": "TPR", "label": "Third-Party"},
    {"code": "PPL", "label": "People"},
    {"code": "TEC", "label": "Technology"},
    {"code": "GEO", "label": "Geopolitical"},
    {"code": "ENV", "label": "Environmental"},
]
GUARD_MAP = {g["code"]: g["label"] for g in GUARD_CATEGORIES}


def extract_guard_code(control_ref: str) -> str | None:
    """Extract a GUARD category code from a control ref like MC-CYB-017."""
    if not control_ref:
        return None
    parts = control_ref.replace("MC-", "").replace("AC-", "").split("-")
    code = parts[0] if parts else None
    return code if code in GUARD_MAP else None


# ── Row → API shape ───────────────────────────────────────────────────
PRODUCT_SELECT = """
    SELECT p.id, p.name AS product_name, p.what_they_do, p.product_url,
           p.vendor_group, p.role, p.primary_mc, p.covers_controls,
           p.ai_verdict, p.confidence, p.fit, p.how_it_mitigates,
           p.known_limits, p.score_rationale, p.incident_id, p.video_url,
           p.logo_url AS product_logo_url, p.product_images, p.product_videos,
           p.optional_metadata, p.listing_type, p.verified,
           v.id AS vendor_id, v.name AS vendor_name, v.entity_type,
           v.hq, v.website, v.logo_url, v.domain,
           i.name AS incident_name,
           dr.defense_rating AS dr_rating, dr.score_band AS dr_band,
           dr.status AS dr_status, dr.per_dimension AS dr_dimensions,
           dr.breakdown AS dr_breakdown, dr.evidence_traceability AS dr_trace,
           dr.notes AS dr_notes, dr.computed_at AS dr_computed_at
    FROM products p
    JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN incidents i ON i.id = p.incident_id
    LEFT JOIN defense_ratings dr ON dr.product_id = p.id
"""


def normalise_product(row: dict) -> dict:
    """Map a joined product row into the normalised API shape used by the UI."""
    controls = row.get("covers_controls") or []
    guard_codes = list({extract_guard_code(c) for c in controls if extract_guard_code(c)})
    score = row.get("ai_verdict")
    # Top scorers earn the spotlight (gold) treatment — never paid, purely earned.
    placement = "sponsored_spotlight" if (score or 0) >= 80 else None
    vid = youtube_id(row.get("video_url"))

    # Computed (hybrid) Defence Rating — present only once the engine has run.
    # When present it is the CANONICAL rating; legacy products fall back to ai_verdict.
    defense_rating = None
    if row.get("dr_computed_at") is not None:
        dr_score = row.get("dr_rating") or 0
        defense_rating = {
            "rating": dr_score,
            "band": row.get("dr_band") or get_score_band(dr_score),
            "status": row.get("dr_status") or "provisional",
            "per_dimension": row.get("dr_dimensions") or {},
            "breakdown": row.get("dr_breakdown") or [],
            "evidence_traceability": row.get("dr_trace") or [],
            "notes": row.get("dr_notes") or [],
            "computed_at": row.get("dr_computed_at"),
        }

    return {
        "_source": "vi_vendors",
        "_id": f"prod_{row['id']}",
        "id": row["id"],
        "vendor_id": row["vendor_id"],
        "vendor_name": row.get("vendor_name") or "Unknown Vendor",
        "product_name": row.get("product_name") or "Product",
        "product_url": row.get("product_url") or row.get("website") or "#",
        "vendor_url": row.get("website") or row.get("product_url") or "#",
        "vendor_logo": row.get("logo_url"),
        "vendor_domain": row.get("domain"),
        "product_logo": row.get("product_logo_url"),
        "product_images": row.get("product_images") or [],
        "product_videos": row.get("product_videos") or [],
        "optional_metadata": row.get("optional_metadata") or {},
        "listing_type": row.get("listing_type") or (row.get("optional_metadata") or {}).get("listing_type") or "product",
        "entity_type": row.get("entity_type"),
        "headquarters": row.get("hq") or "Unknown",
        "description": row.get("what_they_do") or "No description available.",
        "controls": controls,
        "guard_categories": [{"code": c, "label": GUARD_MAP.get(c, c)} for c in guard_codes],
        "fit_level": row.get("fit"),
        "confidence": row.get("confidence"),
        "placement": placement,
        "vendor_group": row.get("vendor_group"),
        "role": row.get("role"),
        "primary_mc": row.get("primary_mc"),
        "ai_verdict": score,
        "score_band": get_score_band(score) if score is not None else None,
        "verified": bool(row.get("verified")),
        "defense_rating": defense_rating,
        "score_rationale": row.get("score_rationale"),
        "incident_id": row.get("incident_id"),
        "incident_name": row.get("incident_name"),
        "video_url": row.get("video_url"),
        "video_id": vid,
        "video_thumbnail": f"https://img.youtube.com/vi/{vid}/hqdefault.jpg" if vid else None,
        "video_embed": f"https://www.youtube.com/embed/{vid}" if vid else None,
        "mitigation_mechanism": {
            "how_it_mitigates": row.get("how_it_mitigates"),
            "known_limits": row.get("known_limits"),
        },
        # legacy/rich fields kept for frontend type-compatibility
        "capability_claims": [],
        "framework_alignments": {},
        "validation_stats": {},
        "compliance_certifications": [],
        "dimension_coverage": {},
        "enabling_features": [],
        "workflow_steps": [],
    }


def evidence_for(vendor_id: int, incident_id: int | None) -> list[dict]:
    rows = query(
        """SELECT addresses_control, verified_claim, source_span, source_url
           FROM evidence
           WHERE vendor_id = %s AND (%s::int IS NULL OR incident_id = %s)
           ORDER BY id""",
        (vendor_id, incident_id, incident_id),
    )
    return [
        {
            "control": r["addresses_control"],
            "claim": r["verified_claim"],
            "source_span": r["source_span"],
            "source_url": r["source_url"],
            "evidence_type": r["addresses_control"],
        }
        for r in rows
    ]


# ══════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════
@app.get("/api/health")
def health():
    try:
        query_one("SELECT 1 AS ok")
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=str(exc))


@app.get("/api/stats")
def get_stats():
    vendor_count = query_one("SELECT COUNT(*) AS c FROM vendors")["c"]
    product_count = query_one(
        "SELECT COUNT(*) AS c FROM products WHERE COALESCE(review_status,'approved')='approved'"
    )["c"]
    incident_count = query_one("SELECT COUNT(*) AS c FROM incidents")["c"]
    evidence_count = query_one("SELECT COUNT(*) AS c FROM evidence")["c"]
    return {
        "vendor_count": vendor_count,
        "product_count": product_count,
        "total_vendor_rows": product_count,
        "vi_vendor_count": product_count,
        "incident_count": incident_count,
        "evidence_count": evidence_count,
        "guard_categories": len(GUARD_CATEGORIES),
    }


@app.get("/api/guard/categories")
def get_guard_categories():
    return GUARD_CATEGORIES


@app.get("/api/incidents")
def list_incidents():
    return query(
        """SELECT i.*, COUNT(p.id) AS product_count
           FROM incidents i LEFT JOIN products p ON p.incident_id = i.id
           GROUP BY i.id ORDER BY i.id"""
    )


# ── Products ──────────────────────────────────────────────────────────
GROUP_MAP = {"risk_coverage": "Risk Coverage", "incident_handler": "Incident Handler"}


@app.get("/api/products")
def list_products(
    search: Optional[str] = Query(None),
    page: int = Query(0, ge=0),
    page_size: int = Query(24, ge=1, le=100),
    fit_level: Optional[str] = Query(None),
    vendor_group: Optional[str] = Query(None),
):
    # Only APPROVED products are public (pending/needs_info/rejected are hidden).
    where, params = ["COALESCE(p.review_status, 'approved') = 'approved'"], []
    if search:
        where.append(
            "(v.name ILIKE %s OR p.name ILIKE %s OR p.what_they_do ILIKE %s)"
        )
        like = f"%{search}%"
        params += [like, like, like]
    if fit_level:
        where.append("p.fit = %s")
        params.append(fit_level)
    if vendor_group:
        where.append("p.vendor_group = %s")
        params.append(GROUP_MAP.get(vendor_group, vendor_group))

    clause = (" WHERE " + " AND ".join(where)) if where else ""
    # Newly onboarded products (later created_at) surface first; the seed batch
    # shares one created_at, so ties fall back to score order (unchanged browse).
    sql = (
        PRODUCT_SELECT
        + clause
        + " ORDER BY p.created_at DESC NULLS LAST, p.ai_verdict DESC NULLS LAST, p.id ASC"
        + " LIMIT %s OFFSET %s"
    )
    params += [page_size, page * page_size]
    rows = query(sql, tuple(params))

    total = query_one(
        "SELECT COUNT(*) AS c FROM products p JOIN vendors v ON v.id=p.vendor_id" + clause,
        tuple(params[:-2]),
    )["c"]

    return {
        "data": [normalise_product(r) for r in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@app.get("/api/products/{product_id}")
def get_product(product_id: int):
    # Public endpoint — unapproved submissions are not viewable here (admin uses
    # /api/admin/submissions/{id} to preview pending ones).
    row = query_one(
        PRODUCT_SELECT + " WHERE p.id = %s AND COALESCE(p.review_status,'approved')='approved'",
        (product_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    result = normalise_product(row)
    result["capability_claims"] = evidence_for(row["vendor_id"], row["incident_id"])
    # Onboarded evidence (public subset) — lets the UI label the rating breakdown.
    result["product_evidence"] = query(
        """SELECT evidence_id, type, title, description, source_type, issuer,
                  issued_date, trust_tier, verified, file_url
           FROM product_evidence WHERE product_id = %s ORDER BY created_at""",
        (product_id,),
    )
    return result


# ── Vendors ───────────────────────────────────────────────────────────
VENDOR_SELECT = """
    SELECT v.id, v.name, v.entity_type, v.hq, v.website, v.logo_url, v.domain,
           COUNT(p.id) AS product_count,
           ROUND(AVG(p.ai_verdict)) AS avg_score,
           MAX(p.ai_verdict) AS top_score
    FROM vendors v
    LEFT JOIN products p ON p.vendor_id = v.id AND COALESCE(p.review_status,'approved')='approved'
"""


def normalise_vendor_row(row: dict) -> dict:
    score = row.get("top_score")
    return {
        "_source": "vi_vendors",
        "_id": f"vendor_{row['id']}",
        "id": row["id"],
        "vendor_id": row["id"],
        "vendor_name": row.get("name") or "Unknown Vendor",
        "product_name": row.get("product_name") or "",
        "product_url": row.get("website") or "#",
        "vendor_url": row.get("website") or "#",
        "vendor_logo": row.get("logo_url"),
        "vendor_domain": row.get("domain"),
        "entity_type": row.get("entity_type"),
        "headquarters": row.get("hq") or "Unknown",
        "description": row.get("description") or "",
        "controls": [],
        "guard_categories": [],
        "product_count": row.get("product_count") or 0,
        "avg_score": int(row["avg_score"]) if row.get("avg_score") is not None else None,
        "ai_verdict": int(score) if score is not None else None,
        "placement": "sponsored_spotlight" if (score or 0) >= 80 else None,
        "fit_level": None,
        "confidence": None,
        "vendor_group": None,
        "capability_claims": [],
        "framework_alignments": {},
        "validation_stats": {},
        "compliance_certifications": [],
        "dimension_coverage": {},
        "mitigation_mechanism": {},
        "enabling_features": [],
        "workflow_steps": [],
    }


@app.get("/api/vendors")
def list_vendors(
    search: Optional[str] = Query(None),
    page: int = Query(0, ge=0),
    page_size: int = Query(24, ge=1, le=100),
    source: str = Query("all"),
):
    where, params = [], []
    if search:
        where.append("v.name ILIKE %s")
        params.append(f"%{search}%")
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    sql = (
        VENDOR_SELECT
        + clause
        + " GROUP BY v.id ORDER BY top_score DESC NULLS LAST, v.name ASC LIMIT %s OFFSET %s"
    )
    params += [page_size, page * page_size]
    rows = query(sql, tuple(params))

    # attach one representative description (longest what_they_do) per vendor
    for r in rows:
        rep = query_one(
            "SELECT name AS product_name, what_they_do FROM products WHERE vendor_id=%s "
            "AND COALESCE(review_status,'approved')='approved' "
            "ORDER BY length(what_they_do) DESC LIMIT 1",
            (r["id"],),
        )
        if rep:
            r["product_name"] = rep["product_name"]
            r["description"] = rep["what_they_do"]

    return {
        "data": [normalise_vendor_row(r) for r in rows],
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/vendors/{vendor_id}")
def get_vendor(vendor_id: int):
    row = query_one(VENDOR_SELECT + " WHERE v.id = %s GROUP BY v.id", (vendor_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Vendor not found")
    products = query(
        PRODUCT_SELECT
        + " WHERE p.vendor_id = %s AND COALESCE(p.review_status,'approved')='approved'"
        + " ORDER BY p.ai_verdict DESC",
        (vendor_id,),
    )
    result = normalise_vendor_row(row)
    result["products"] = [normalise_product(p) for p in products]
    if products:
        result["description"] = products[0]["what_they_do"]
        result["product_name"] = products[0]["product_name"]
        result["controls"] = products[0]["covers_controls"] or []
        result["guard_categories"] = normalise_product(products[0])["guard_categories"]
    return result


@app.get("/api/search")
def search(q: str = Query(..., min_length=1)):
    like = f"%{q}%"
    rows = query(
        PRODUCT_SELECT
        + " WHERE COALESCE(p.review_status,'approved')='approved'"
        + " AND (v.name ILIKE %s OR p.name ILIKE %s OR p.what_they_do ILIKE %s)"
        + " ORDER BY p.ai_verdict DESC NULLS LAST LIMIT 20",
        (like, like, like),
    )
    products = [normalise_product(r) for r in rows]
    return {"rich": products, "production": [], "total": len(products)}


# ── Scoring ───────────────────────────────────────────────────────────
@app.get("/api/scoring/bands")
def get_scoring_bands():
    return {"bands": SCORE_BANDS, "tier_weights": TIER_WEIGHTS}


# ══════════════════════════════════════════════════════════════════════
# VENDOR ONBOARDING — create / resume / edit
# ══════════════════════════════════════════════════════════════════════
FREE_EMAIL_DOMAINS = {"gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "aol.com"}


class OnboardingPayload(BaseModel):
    work_email: EmailStr
    company_name: Optional[str] = None
    website: Optional[str] = None
    hq: Optional[str] = None
    founded: Optional[str] = None
    company_size: Optional[str] = None
    certifications: Optional[str] = None
    product_name: Optional[str] = None
    product_description: Optional[str] = None
    product_shape: Optional[str] = None
    video_state: Optional[str] = "none"
    video_url: Optional[str] = None
    evidence: Optional[list] = None
    extra_products: Optional[list] = None
    extra: Optional[dict] = None
    current_step: Optional[int] = 0
    status: Optional[str] = "draft"

    @field_validator("work_email")
    @classmethod
    def reject_free_providers(cls, v: str) -> str:
        domain = v.split("@")[-1].lower()
        if domain in FREE_EMAIL_DOMAINS:
            raise ValueError("Please use a work email — free providers are not accepted.")
        return v.lower()


def _onboarding_to_dict(row: dict) -> dict:
    return dict(row) if row else {}


@app.get("/api/onboarding/{email}")
def resume_onboarding(email: str):
    row = query_one("SELECT * FROM vendor_onboarding WHERE work_email = %s", (email.lower(),))
    if not row:
        raise HTTPException(status_code=404, detail="No onboarding found for this email.")
    return _onboarding_to_dict(row)


@app.post("/api/onboarding")
def upsert_onboarding(payload: OnboardingPayload):
    import json

    data = payload.model_dump()
    data["evidence"] = json.dumps(data.get("evidence") or [])
    data["extra_products"] = json.dumps(data.get("extra_products") or [])
    data["extra"] = json.dumps(data.get("extra") or {})

    row = execute(
        """
        INSERT INTO vendor_onboarding
          (work_email, company_name, website, hq, founded, company_size, certifications,
           product_name, product_description, product_shape, video_state, video_url,
           evidence, extra_products, extra, current_step, status, updated_at)
        VALUES
          (%(work_email)s, %(company_name)s, %(website)s, %(hq)s, %(founded)s, %(company_size)s,
           %(certifications)s, %(product_name)s, %(product_description)s, %(product_shape)s,
           %(video_state)s, %(video_url)s, %(evidence)s, %(extra_products)s, %(extra)s,
           %(current_step)s, %(status)s, now())
        ON CONFLICT (work_email) DO UPDATE SET
           company_name = COALESCE(EXCLUDED.company_name, vendor_onboarding.company_name),
           website = COALESCE(EXCLUDED.website, vendor_onboarding.website),
           hq = COALESCE(EXCLUDED.hq, vendor_onboarding.hq),
           founded = COALESCE(EXCLUDED.founded, vendor_onboarding.founded),
           company_size = COALESCE(EXCLUDED.company_size, vendor_onboarding.company_size),
           certifications = COALESCE(EXCLUDED.certifications, vendor_onboarding.certifications),
           product_name = COALESCE(EXCLUDED.product_name, vendor_onboarding.product_name),
           product_description = COALESCE(EXCLUDED.product_description, vendor_onboarding.product_description),
           product_shape = COALESCE(EXCLUDED.product_shape, vendor_onboarding.product_shape),
           video_state = EXCLUDED.video_state,
           video_url = EXCLUDED.video_url,
           evidence = EXCLUDED.evidence,
           extra_products = EXCLUDED.extra_products,
           extra = EXCLUDED.extra,
           current_step = EXCLUDED.current_step,
           status = EXCLUDED.status,
           updated_at = now()
        RETURNING *
        """,
        data,
    )
    return _onboarding_to_dict(row)
