"""
Defence Rating scoring engine.
Pure functions — no DB access, no AI, no side effects.

Implements the "Defense Rating Methodology — AI-Assisted Evidence Grading &
Deterministic Scoring" reference, EXACTLY:

  Step 2  AI grades each evidence item → signals only (tier, verified,
          supports_control, independent). NEVER a score — that is the integrity
          guarantee. (Lives in evidence_grading.py, not here.)
  Step 3  Normalise signals → per-item strength (deterministic).
  Step 4  Five dimensions, each 0–100 (deterministic).
  Step 5  Weighted combine + guardrails → 0–100 + band (deterministic).
  Step 6  Breakdown + evidence traceability for full auditability.

CRITICAL RULES:
  - AI NEVER returns a score. This module is the ONLY source of Defence Ratings.
  - Paid tier (bronze/silver/gold) NEVER affects the Defence Rating.
"""
from __future__ import annotations

from datetime import date
from typing import Any, Optional

# ── Step 3 · Tier weights ─────────────────────────────────────────────
TIER_WEIGHTS: dict[str, float] = {
    "E1": 1.00,  # Independent audit / certification / red-team test
    "E2": 0.85,  # Named customer deployment / case study with outcome
    "E3": 0.70,  # Analyst recognition / peer-reviewed research
    "E4": 0.50,  # Vendor self-attestation — not independently verified
    "E5": 0.20,  # Marketing claim / unverifiable statement
}

# Tier crosswalk: stored A–D UI band → internal E1–E5.
TRUST_TIER_CROSSWALK: dict[str, str] = {"A": "E1", "B": "E2", "C": "E4", "D": "E5"}

# Default rubric tier per evidence `type` (fallback when no AI/admin tier).
EVIDENCE_TYPE_TIER: dict[str, str] = {
    "research_report": "E3",
    "case_study": "E2",
    "customer_success": "E2",
    "reference_customer": "E2",
    "benchmark": "E2",
    "deployment_proof": "E2",
    "customer_review": "E3",
    "testimonial": "E4",
    "supporting_document": "E4",
    "certification": "E1",
    "article": "E5",
    "news": "E5",
    "blog": "E5",
}

# Evidence types that count toward Demonstrated Efficacy (Step 4).
EFFICACY_TYPES = {
    "case_study", "benchmark", "deployment_proof",
    "customer_success", "reference_customer",
}

# ── Step 4 · Dimension weights ────────────────────────────────────────
DIMENSION_WEIGHTS: dict[str, float] = {
    "control_coverage": 0.30,
    "evidence_strength": 0.25,
    "demonstrated_efficacy": 0.20,
    "independent_corroboration": 0.15,
    "recency": 0.10,
}

TARGET_CONTROLS = 15          # Control Coverage "target" for the 80-pt breadth term
DIVERSITY_MIN_TYPES = 3       # ≥3 distinct evidence types → diversity bonus
DIVERSITY_BONUS = 0.10        # capped bonus to Evidence Strength
WEAK_ONLY_STRENGTH_CAP = 50.0  # E4/E5-only evidence cannot dominate

# ── Step 5 · Bands ────────────────────────────────────────────────────
SCORE_BANDS: list[dict[str, Any]] = [
    {"min": 85, "max": 100, "label": "Authoritative"},
    {"min": 70, "max": 84, "label": "Proven"},
    {"min": 60, "max": 69, "label": "Eligible"},
    {"min": 40, "max": 59, "label": "Sub-floor"},
    {"min": 0, "max": 39, "label": "Insufficient"},
]


def get_score_band(score: int) -> str:
    """Map a 0-100 score to its band label."""
    for band in SCORE_BANDS:
        if band["min"] <= score <= band["max"]:
            return band["label"]
    return "Insufficient"


def crosswalk_tier(
    type_: Optional[str] = None,
    trust_tier: Optional[str] = None,
    ai_tier: Optional[str] = None,
) -> str:
    """Resolve a rubric tier (E1–E5): AI grade → admin A–C band → type default → E5."""
    if ai_tier in TIER_WEIGHTS:
        return ai_tier  # type: ignore[return-value]
    if trust_tier in ("A", "B", "C"):
        return TRUST_TIER_CROSSWALK[trust_tier]  # type: ignore[index]
    return EVIDENCE_TYPE_TIER.get(type_ or "", "E5")


def _months_between(then: Any, now: date) -> Optional[int]:
    if not then:
        return None
    if isinstance(then, str):
        try:
            then = date.fromisoformat(then[:10])
        except ValueError:
            return None
    if not isinstance(then, date):
        return None
    return max(0, (now.year - then.year) * 12 + (now.month - then.month))


def recency_factor(issued_date: Any, as_of: Optional[date] = None) -> float:
    """Step 3 stepped recency factor (undated → oldest band, 0.70)."""
    months = _months_between(issued_date, as_of or date.today())
    if months is None:
        return 0.70
    if months < 12:
        return 1.00
    if months < 24:
        return 0.85
    return 0.70


def item_strength(item: dict, as_of: Optional[date] = None) -> float:
    """Step 3 · strength_i = TIER_WEIGHT × (1.0 verified else 0.5) × recency_i (0–1)."""
    weight = TIER_WEIGHTS.get(item.get("tier", "E5"), 0.20)
    verified = 1.0 if item.get("verified") else 0.5
    return weight * verified * recency_factor(item.get("issued_date"), as_of)


# ── Step 4 · Dimensions ───────────────────────────────────────────────
def compute_control_coverage(adaptive_controls: list[dict], guard_categories: list[dict]) -> float:
    control_count = len(adaptive_controls or [])
    category_count = len(guard_categories or [])
    if control_count == 0 and category_count == 0:
        return 0.0
    base = min(control_count / TARGET_CONTROLS * 80, 80)
    category_bonus = min(category_count / 13 * 20, 20)
    return round(base + category_bonus, 1)


def compute_evidence_strength(evidence_items: list[dict], as_of: Optional[date] = None) -> float:
    """100 × weighted_mean(strength_i) × (1 + diversity_bonus), with E4/E5 cap."""
    if not evidence_items:
        return 0.0
    strengths = [item_strength(e, as_of) for e in evidence_items]
    weighted_mean = sum(strengths) / len(strengths)
    distinct_types = len({(e.get("type") or "") for e in evidence_items})
    bonus = DIVERSITY_BONUS if distinct_types >= DIVERSITY_MIN_TYPES else 0.0
    score = 100 * weighted_mean * (1 + bonus)
    # Cap: self-attested / marketing-only evidence cannot dominate a strong audit.
    if not any(e.get("tier") in ("E1", "E2", "E3") for e in evidence_items):
        score = min(score, WEAK_ONLY_STRENGTH_CAP)
    return round(min(score, 100), 1)


def compute_demonstrated_efficacy(evidence_items: list[dict]) -> float:
    count = sum(
        1 for e in evidence_items
        if (e.get("type") in EFFICACY_TYPES) and e.get("verified")
    )
    return float(min(count * 25, 100))


def compute_independent_corroboration(evidence_items: list[dict]) -> float:
    count = sum(
        1 for e in evidence_items
        if e.get("independent") and e.get("tier") in ("E1", "E2")
    )
    return float(min(count * 50, 100))


def compute_recency(evidence_items: list[dict], as_of: Optional[date] = None) -> float:
    if not evidence_items:
        return 0.0
    factors = [recency_factor(e.get("issued_date"), as_of) for e in evidence_items]
    return round(sum(factors) / len(factors) * 100, 1)


# ── Step 5 + 6 · Combine, guardrails, traceability ────────────────────
def compute_defence_rating(
    evidence_items: list[dict],
    adaptive_controls: list[dict],
    guard_categories: Optional[list[dict]] = None,
    as_of: Optional[date] = None,
) -> dict:
    """
    evidence_items: normalised signals — each
      {evidence_id, type, tier (E1-E5), verified (bool), independent (bool),
       issued_date (ISO str|date|None)}

    Returns: overall, band, status (provisional|verified), score_withheld,
    can_surface, per_dimension, weights, breakdown, evidence_traceability, notes.
    """
    guard_categories = guard_categories or []
    items = evidence_items or []

    per_dimension = {
        "control_coverage": compute_control_coverage(adaptive_controls, guard_categories),
        "evidence_strength": compute_evidence_strength(items, as_of),
        "demonstrated_efficacy": compute_demonstrated_efficacy(items),
        "independent_corroboration": compute_independent_corroboration(items),
        "recency": compute_recency(items, as_of),
    }

    overall = round(min(sum(per_dimension[d] * w for d, w in DIMENSION_WEIGHTS.items()), 100))
    band = get_score_band(overall)

    # Guardrail · minimum-to-surface gate: a *verified* item above E5 must exist,
    # otherwise the rating is Provisional and the number is withheld in the UI.
    has_verified_above_e5 = any(
        e.get("verified") and e.get("tier") != "E5" for e in items
    )
    status = "verified" if has_verified_above_e5 else "provisional"
    score_withheld = status == "provisional"

    notes: list[str] = []
    if not items:
        notes.append("No evidence submitted — evidence-driven dimensions score 0.")
    elif not has_verified_above_e5:
        notes.append(
            "Provisional: no verified evidence above E5 — score withheld until a "
            "qualifying item is confirmed."
        )
    if items and not any(e.get("tier") in ("E1", "E2", "E3") for e in items):
        notes.append("Evidence Strength capped: only self-attestation / marketing evidence (E4/E5).")

    breakdown = _build_breakdown(per_dimension, items)
    traceability = _build_traceability(items, as_of)

    return {
        "overall": overall,
        "band": band,
        "status": status,
        "score_withheld": score_withheld,
        "can_surface": has_verified_above_e5 and len(adaptive_controls or []) >= 1,
        "per_dimension": per_dimension,
        "weights": DIMENSION_WEIGHTS,
        "breakdown": breakdown,
        "evidence_traceability": traceability,
        "notes": notes,
    }


def _ids(items: list[dict]) -> list[str]:
    return [str(e["evidence_id"]) for e in items if e.get("evidence_id") is not None]


def _build_breakdown(per_dimension: dict, items: list[dict]) -> list[dict]:
    dim_ids = {
        "control_coverage": [],
        "evidence_strength": _ids(items),
        "demonstrated_efficacy": _ids([e for e in items if e.get("type") in EFFICACY_TYPES and e.get("verified")]),
        "independent_corroboration": _ids([e for e in items if e.get("independent") and e.get("tier") in ("E1", "E2")]),
        "recency": _ids(items),
    }
    return [
        {"category": d, "score": per_dimension[d], "weight": DIMENSION_WEIGHTS[d], "evidence_ids": dim_ids[d]}
        for d in DIMENSION_WEIGHTS
    ]


def _build_traceability(items: list[dict], as_of: Optional[date] = None) -> list[dict]:
    out = []
    for e in items:
        if e.get("evidence_id") is None:
            continue
        out.append({
            "evidence_id": str(e["evidence_id"]),
            "tier": e.get("tier", "E5"),
            "verified": bool(e.get("verified")),
            "independent": bool(e.get("independent")),
            "impact": round(item_strength(e, as_of) * 100, 1),
        })
    return out


def can_surface(product: dict) -> bool:
    """
    Public-listing hard rule (separate from the score):
    1. what_it_does present
    2. ≥1 adaptive control
    3. ≥1 verified evidence item above E5
    """
    what_it_does = product.get("what_it_does") or product.get("what_they_do") or ""
    controls = product.get("adaptive_controls") or product.get("covers_controls") or []
    evidence = product.get("evidence") or []
    return bool(
        len(what_it_does) > 0
        and len(controls) >= 1
        and any(e.get("tier") != "E5" and e.get("verified") for e in evidence)
    )
