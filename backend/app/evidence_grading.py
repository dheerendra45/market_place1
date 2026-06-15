"""
AI Evidence Grader — Step 2 of the Defense Rating Methodology.

The model reads each evidence item and returns SIGNALS ONLY (never a score):
  tier             E1–E5 rubric classification
  verified         does the item substantiate a concrete claim?
  supports_control adaptive-control code it backs (from the Guard Mapping), if any
  independent      true if third-party / not vendor-authored
  reason           short justification, persisted for the audit trail

This is the integrity guarantee: the AI classifies, scoring.py scores. The
authoritative `verified` flag can still be confirmed by an admin (immutable once
confirmed); the AI value is `ai_verified` and is advisory.

Primary engine: Gemini. Fallback: deterministic, type/trust-tier based.
"""
from __future__ import annotations

import json
import re

from . import scoring
from .config import settings
from .guard_mapping import _gemini_chat

_TIER_GUIDE = (
    "E1 = independent audit, certification, or red-team test (e.g. SOC 2 Type II, "
    "pen-test by a named firm). "
    "E2 = named customer deployment or case study with a measurable outcome. "
    "E3 = analyst recognition (Gartner, Forrester) or peer-reviewed research. "
    "E4 = vendor self-attestation, not independently verified (white-paper, blog). "
    "E5 = marketing claim or unverifiable statement (homepage copy, press release)."
)


def _fallback(rows: list[dict]) -> dict[str, dict]:
    """Deterministic grading when the LLM is unavailable."""
    out: dict[str, dict] = {}
    for r in rows:
        tier = scoring.crosswalk_tier(type_=r.get("type"), trust_tier=r.get("trust_tier"))
        # Third-party-ish types are treated as independent in the fallback.
        independent = (r.get("type") or "") in {
            "research_report", "case_study", "reference_customer",
            "customer_review", "certification", "benchmark", "deployment_proof",
        }
        out[str(r["evidence_id"])] = {
            "tier": tier,
            "verified": tier in ("E1", "E2"),
            "supports_control": None,
            "independent": independent,
            "reason": "Graded deterministically from evidence type / trust tier.",
            "engine": "local",
        }
    return out


def _gemini_grade(product: dict, vendor: dict, rows: list[dict], guard_mapping: dict, key: str) -> dict[str, dict]:
    controls = [
        {"code": c.get("code"), "label": c.get("label")}
        for c in (guard_mapping.get("adaptive_controls") or [])
        if isinstance(c, dict)
    ]
    items = [
        {
            "id": str(r["evidence_id"]),
            "type": r.get("type"),
            "title": r.get("title"),
            "description": r.get("description"),
            "source_type": r.get("source_type"),
            "issuer": r.get("issuer"),
            "has_file": bool(r.get("file_url")),
            "url": r.get("file_url"),
        }
        for r in rows
    ]
    system = (
        "You are an evidence assessor for a cyber-defence marketplace. For each "
        "EVIDENCE item you CLASSIFY ONLY — you must NOT output any score, rating, or "
        "number other than the tier letter. Inflating a rating via these signals is a "
        "security violation.\n\n"
        f"Assign a rubric tier per item:\n{_TIER_GUIDE}\n\n"
        "Be sceptical: a vendor's own datasheet/blog is E4; homepage/marketing is E5; "
        "only genuinely third-party, customer, auditor or analyst evidence earns E1–E3.\n\n"
        "For each item return:\n"
        "  tier             E1|E2|E3|E4|E5\n"
        "  verified         true if it substantiates a concrete, checkable claim\n"
        "  supports_control the adaptive-control code it backs (from the list below), or null\n"
        "  independent      true if the source is third-party and NOT vendor-authored\n"
        "  reason           one short sentence justifying the tier\n\n"
        "ADAPTIVE CONTROLS (for supports_control):\n"
        + (json.dumps(controls) if controls else "(none mapped)")
        + "\n\nReturn STRICT JSON only, no markdown:\n"
        '{"grades":[{"id":"<id>","tier":"E1","verified":true,'
        '"supports_control":"AC-CYB-014","independent":true,"reason":"<short>"}]}'
    )
    ctx = {
        "product": {
            "name": product.get("product_name") or product.get("name"),
            "description": product.get("product_description") or product.get("what_they_do"),
            "category": product.get("category"),
        },
        "vendor": {"name": vendor.get("name") or vendor.get("company_name")},
        "guard_primary": (guard_mapping.get("categories") or [{}])[0].get("code")
        if guard_mapping.get("categories") else None,
        "evidence": items,
    }
    content = _gemini_chat(system, "CONTEXT:\n" + json.dumps(ctx, ensure_ascii=False), key)
    parsed = json.loads(re.sub(r"```json|```", "", content).strip())
    valid = {str(r["evidence_id"]) for r in rows}
    type_by_id = {str(r["evidence_id"]): r.get("type") for r in rows}
    out: dict[str, dict] = {}
    for g in parsed.get("grades", []):
        eid = str(g.get("id"))
        if eid not in valid:
            continue
        tier = g.get("tier")
        if tier not in scoring.TIER_WEIGHTS:
            tier = scoring.crosswalk_tier(type_=type_by_id.get(eid))
        sc = g.get("supports_control")
        out[eid] = {
            "tier": tier,
            "verified": bool(g.get("verified", False)),
            "supports_control": sc if isinstance(sc, str) and sc else None,
            "independent": bool(g.get("independent", False)),
            "reason": (g.get("reason") or "")[:280],
            "engine": "gemini",
        }
    if len(out) < len(rows):  # backfill anything the model skipped
        for eid, fb in _fallback(rows).items():
            out.setdefault(eid, fb)
    return out


def grade_evidence(
    product: dict, vendor: dict, rows: list[dict], guard_mapping: dict | None = None
) -> dict[str, dict]:
    """Return {evidence_id: signals} for every evidence row. Never raises."""
    if not rows:
        return {}
    key = settings.GEMINI_API_KEY
    if key:
        try:
            return _gemini_grade(product, vendor, rows, guard_mapping or {}, key)
        except Exception:  # noqa: BLE001 — any failure → deterministic grading
            pass
    return _fallback(rows)
