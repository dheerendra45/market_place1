"""
AI-powered GUARD Mapping engine — grounded in the LOCAL GUARD framework mirror.

Primary engine: Gemini (Google). Fallback: deterministic local engine. The
taxonomy (categories / subcategories / master controls) is read from the local
Postgres `guard_*` tables — never from Supabase/MCP at runtime.

Output (when mapping): shape + touched categories (primary + strength) +
matched subcategories + AI-generated adaptive controls grounded in master
controls (master controls themselves are never exposed to the vendor).
"""
from __future__ import annotations

import json
import re
import urllib.request

from .config import settings
from .database import query as db_query

# ── Fallback category keyword signals (used only when the DB/LLM is unavailable)
GUARD_DEFS: list[tuple[str, str, list[str]]] = [
    ("CYB", "Cyber", ["threat", "detect", "endpoint", "edr", "siem", "malware", "intrusion", "mfa", "firewall", "vulnerability", "security", "soc", "ransomware", "phishing", "xdr"]),
    ("DAT", "Data", ["data", "pii", "privacy", "encryption", "dlp", "classification", "gdpr", "retention", "biometric"]),
    ("TEC", "Technology", ["cloud", "api", "integration", "infrastructure", "network", "kubernetes", "platform", "devops", "dns", "workload", "ai"]),
    ("REG", "Regulatory", ["compliance", "iso", "soc 2", "hipaa", "pci", "audit", "regulatory", "nist", "sox", "gdpr", "enforcement", "licensing"]),
    ("OPS", "Operational", ["incident", "response", "monitoring", "observability", "uptime", "resilience", "recovery", "continuity", "supply chain", "process"]),
    ("TPR", "Third-Party", ["third-party", "third party", "vendor", "supply chain", "supplier", "contractor", "due diligence", "tprm"]),
    ("PPL", "People", ["training", "awareness", "phishing", "human", "insider", "workforce", "safety", "ethics", "labour"]),
    ("FIN", "Financial", ["fraud", "payment", "financial", "credit", "insurance", "treasury", "sanctions", "tax", "bankruptcy"]),
    ("REP", "Reputational", ["reputation", "brand", "communication", "crisis", "media", "sentiment", "stakeholder"]),
    ("GEO", "Geopolitical", ["geopolitical", "sanction", "country", "export", "tariff", "political", "conflict"]),
    ("PHY", "Physical", ["physical", "facility", "badge", "surveillance", "premises", "safety", "explosive"]),
    ("ENV", "Environmental", ["environmental", "spill", "emission", "osha", "hazard", "pollution", "biodiversity"]),
    ("STR", "Strategic", ["strategy", "governance", "board", "roadmap", "acquisition", "merger", "innovation", "portfolio"]),
]
GUARD_LABEL = {c: l for c, l, _ in GUARD_DEFS}
VERBS = ["DETECTS", "MONITORS", "PROTECTS", "ENFORCES", "GOVERNS", "RESPONDS"]

DIMENSIONS: list[tuple[str, str, list[str]]] = [
    ("security_capabilities", "What core security capabilities does {p} provide?", ["threat", "detect", "encrypt", "access", "siem", "edr", "firewall", "vulnerability", "mfa", "monitor", "intrusion", "malware", "security"]),
    ("threat_coverage", "Which threats or attack types does {p} defend against?", ["ransomware", "phishing", "mfa-bypass", "insider", "supply chain", "ddos", "exploit", "zero-day", "attack", "breach"]),
    ("compliance_coverage", "Which compliance frameworks does {p} help address?", ["soc 2", "iso", "gdpr", "hipaa", "pci", "compliance", "regulation", "nist", "audit"]),
    ("data_handling", "What data does {p} process or protect, and how?", ["data", "pii", "encryption", "storage", "dlp", "classification", "privacy", "retention"]),
    ("integration_methods", "How does {p} integrate with existing systems?", ["api", "integration", "agent", "webhook", "cloud", "aws", "azure", "gcp", "siem", "sso", "identity", "connector"]),
    ("risk_management", "What risk-management / incident-response capabilities does {p} offer?", ["risk", "incident", "response", "remediation", "recovery", "resilience", "continuity", "assessment", "mitigation"]),
    ("deployment_context", "Who are {p}'s customers and how does it deploy?", ["cloud", "on-prem", "hybrid", "saas", "enterprise", "smb", "deploy", "scale"]),
]
WHY = {d: "Needed for accurate GUARD mapping." for d, _, _ in DIMENSIONS}
OPTIONS = {
    "security_capabilities": ["Threat detection", "Access control / IAM", "Encryption", "Monitoring / logging", "Vulnerability management", "Firewall / network security"],
    "threat_coverage": ["Ransomware", "Phishing / social engineering", "MFA-bypass / account takeover", "Insider threats", "Supply-chain", "DDoS", "Zero-day exploits"],
    "compliance_coverage": ["SOC 2", "ISO 27001", "GDPR", "HIPAA", "PCI DSS", "NIST", "None / not sure"],
    "data_handling": ["Encryption at rest & in transit", "Data classification / DLP", "PII protection", "Data residency controls", "No data stored", "Not sure"],
    "integration_methods": ["REST API", "Agents / sensors", "Cloud (AWS/Azure/GCP)", "SIEM integration", "Identity / SSO", "Webhooks"],
    "risk_management": ["Real-time detection", "Automated remediation", "Incident response", "Recovery / continuity", "Risk scoring / assessment", "None"],
    "deployment_context": ["Cloud / SaaS", "On-premise", "Hybrid", "SMB", "Mid-market", "Enterprise"],
}
MIN_QUESTIONS = 5
MAX_QUESTIONS = 6

_TAXONOMY: dict | None = None


def load_taxonomy() -> dict:
    """Read the GUARD taxonomy from the LOCAL guard_* tables (cached)."""
    global _TAXONOMY
    if _TAXONOMY is not None:
        return _TAXONOMY
    try:
        cats = db_query("SELECT code, label FROM guard_categories ORDER BY code")
        subs = db_query("SELECT DISTINCT ON (code) category, code, name FROM guard_subcategories ORDER BY code")
        mcs = db_query("SELECT mc_id, category, statement FROM guard_master_controls ORDER BY mc_id")
        _TAXONOMY = {
            "categories": [(c["code"], c["label"]) for c in cats],
            "subcategories": [(s["category"], s["code"], s["name"]) for s in subs],
            "master_controls": [(m["mc_id"], m["category"], m["statement"]) for m in mcs],
        }
    except Exception:  # noqa: BLE001 — fall back to the static category list
        _TAXONOMY = {
            "categories": [(c, l) for c, l, _ in GUARD_DEFS],
            "subcategories": [], "master_controls": [],
        }
    return _TAXONOMY


def guard_categories() -> list[dict]:
    return [{"code": c, "label": l} for c, l in load_taxonomy()["categories"]]


def taxonomy_prompt() -> str:
    t = load_taxonomy()
    cats = "\n".join(f"- {c}: {l}" for c, l in t["categories"])
    subs = "\n".join(f"- {cat} · {code}: {name}" for cat, code, name in t["subcategories"])
    mcs = "\n".join(f"- {mc} ({cat}): {stmt}" for mc, cat, stmt in t["master_controls"])
    out = f"GUARD CATEGORIES (13):\n{cats}"
    if subs:
        out += f"\n\nGUARD SUBCATEGORIES:\n{subs}"
    if mcs:
        out += ("\n\nMASTER CONTROLS (INTERNAL — never expose mc_id or these statements to the "
                f"vendor; use ONLY to ground the adaptive controls you generate):\n{mcs}")
    return out


def _corpus(product: dict, vendor: dict, answers: list[dict]) -> str:
    md = product.get("optional_metadata") or {}
    parts = [
        product.get("product_name", ""), product.get("product_description", ""),
        product.get("category", ""), product.get("product_url", ""),
        " ".join(product.get("key_features", []) or []),
        " ".join(product.get("use_cases", []) or []),
        " ".join(product.get("benefits", []) or []),
        " ".join(str(v) for v in md.values()),
        " ".join(product.get("certifications", []) or []),
        " ".join(str(e.get("title", "")) + " " + str(e.get("type", "")) + " " + str(e.get("description", ""))
                 for e in (product.get("evidence") or [])),
        vendor.get("company_name", ""), vendor.get("entity_type", ""),
    ]
    for a in answers:
        parts.append(str(a.get("answer", "")))
    return " ".join(parts).lower()


# ── Fallback (deterministic) ──────────────────────────────────────────
def _score_categories(corpus: str) -> list[tuple[str, int]]:
    scored = []
    for code, _label, kws in GUARD_DEFS:
        hits = sum(1 for kw in kws if kw in corpus)
        if hits:
            scored.append((code, hits))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


def _local_mapping(corpus: str, covered: int) -> dict:
    t = load_taxonomy()
    scored = _score_categories(corpus) or [("CYB", 1)]
    top = scored[:4]
    primary = top[0][0]
    categories = [
        {"code": c, "label": GUARD_LABEL.get(c, c), "primary": i == 0,
         "strength": min(95, 45 + h * 10 + (covered * 3 if i == 0 else 0))}
        for i, (c, h) in enumerate(top)
    ]
    subs_primary = [(code, name) for cat, code, name in t["subcategories"] if cat == primary]
    matched = [
        {"category": primary, "code": code, "name": name, "confidence": 70}
        for code, name in subs_primary
        if any(w in corpus for w in name.lower().split() if len(w) > 3)
    ][:4]
    if not matched and subs_primary:
        matched = [{"category": primary, "code": subs_primary[0][0], "name": subs_primary[0][1], "confidence": 55}]
    mcs_primary = [(mc, stmt) for mc, cat, stmt in t["master_controls"] if cat == primary][:3]
    adaptive = [
        {"verb": VERBS[i % len(VERBS)], "code": mc.replace("MC-", "AC-"),
         "label": " ".join((stmt or "").split()[:7]).rstrip(".,;"), "grounded_in": mc}
        for i, (mc, stmt) in enumerate(mcs_primary)
    ]
    return {
        "shape": f"VERTICAL SPECIALIST · deep in {GUARD_LABEL.get(primary, primary).lower()}",
        "categories": categories, "subcategories": matched, "adaptive_controls": adaptive,
        "explanation": f"Mapped from product context, evidence and answers; dominant signal aligns with {GUARD_LABEL.get(primary, primary)}.",
    }


def _local_step(product: dict, vendor: dict, answers: list[dict]) -> dict:
    corpus = _corpus(product, vendor, answers)
    pname = (product.get("product_name") or "the product").strip()
    asked = {str(a.get("question", "")) for a in answers}
    questions = [(dim, tmpl.format(p=pname), kws) for dim, tmpl, kws in DIMENSIONS]
    covered = {dim: any(kw in corpus for kw in kws) for dim, _t, kws in DIMENSIONS}
    covered_count = sum(covered.values())
    n = len(answers)
    scored = _score_categories(corpus)
    top_hits = scored[0][1] if scored else 0
    confidence = {
        "product_understanding": min(100, 22 + covered_count * 7 + min(n, MAX_QUESTIONS) * 9),
        "mapping_confidence": min(96, 24 + covered_count * 11 + min(top_hits, 6) * 6 + n * 3),
        "missing_info": max(0, (len(DIMENSIONS) - covered_count) * 16),
    }
    has_unasked = any(q not in asked for _d, q, _k in questions)
    done = n >= MIN_QUESTIONS and (confidence["mapping_confidence"] >= 82 or n >= MAX_QUESTIONS or not has_unasked)
    if done or not has_unasked:
        return {"confidence": confidence, "done": True, "question": None,
                "mapping": _local_mapping(corpus, covered_count), "engine": "local"}
    nxt = next(((d, q) for d, q, _k in questions if not covered[d] and q not in asked), None) \
        or next(((d, q) for d, q, _k in questions if q not in asked), None)
    dim, text = nxt
    return {"confidence": confidence, "done": False,
            "question": {"text": text, "why": WHY.get(dim, "Needed for accurate GUARD mapping."),
                         "options": OPTIONS.get(dim, []), "multi": True},
            "mapping": None, "engine": "local"}


# ── Gemini engine ─────────────────────────────────────────────────────
def _gemini_chat(system: str, user_text: str, key: str) -> str:
    body = json.dumps({
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
    }).encode()
    url = f"{settings.GEMINI_BASE_URL.rstrip('/')}/models/{settings.GEMINI_MODEL}:generateContent"
    req = urllib.request.Request(url, data=body, headers={"x-goog-api-key": key, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read().decode())
    parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts)
    if not text:
        raise RuntimeError(f"Empty Gemini response: {str(data)[:200]}")
    return text


def _gemini_step(product: dict, vendor: dict, answers: list[dict], key: str) -> dict:
    system = (
        "You are a GUARD Mapping analyst. Map a security/risk PRODUCT to the GUARD framework "
        "using ONLY the taxonomy below.\n\n" + taxonomy_prompt() + "\n\n"
        "Each turn: decide if you have enough information to map accurately. If not, ask ONE "
        "MULTIPLE-CHOICE question (4-6 concrete options, multi=true) about a GUARD-relevant gap "
        "(security capabilities, threat coverage, compliance, data handling, integration, risk "
        "management, deployment). Never ask random, duplicate, or out-of-scope questions; make "
        "options specific to this product. "
        f"Ask AT LEAST {MIN_QUESTIONS} and AT MOST {MAX_QUESTIONS} questions before mapping; do not "
        f"finish until at least {MIN_QUESTIONS} are answered.\n\n"
        "When mapping, output: a SHAPE label; the touched CATEGORIES (exactly one primary + the "
        "secondaries) each with strength 0-100; matched SUBCATEGORIES using EXACT codes from the "
        "list; and ADAPTIVE CONTROLS that YOU generate as short vendor-facing labels — each grounded "
        "in one master control (put its mc_id in grounded_in) but NEVER expose master controls or "
        "mc_ids as the shown control. For each, create an AC-<CAT>-<n> code, a short label, and a "
        "verb (DETECTS/MONITORS/PROTECTS/ENFORCES/GOVERNS/RESPONDS).\n\n"
        "Return STRICT JSON only, no markdown:\n"
        '{"confidence":{"product_understanding":0-100,"mapping_confidence":0-100,"missing_info":0-100},'
        '"done":bool,'
        '"question":{"text":"...","why":"...","options":["o1","o2","o3","o4"],"multi":true}|null,'
        '"mapping":{"shape":"...",'
        '"categories":[{"code":"CYB","label":"Cyber","primary":true,"strength":88}],'
        '"subcategories":[{"category":"CYB","code":"CYB-TDR","name":"Threat Detection & Response","confidence":80}],'
        '"adaptive_controls":[{"verb":"DETECTS","code":"AC-CYB-014","label":"Endpoint detection & log analytics","grounded_in":"MC-CYB-019"}],'
        '"explanation":"..."}|null}\n'
        "done=true → question null, mapping present. done=false → mapping null, question present with options. "
        "Use only category codes and subcategory codes that appear in the taxonomy."
    )
    md = product.get("optional_metadata") or {}
    ctx = {
        "product": {
            "name": product.get("product_name"), "description": product.get("product_description"),
            "category": product.get("category"), "product_url": product.get("product_url"),
            "version": md.get("version"), "sku": md.get("sku"),
            "key_features": product.get("key_features"), "use_cases": product.get("use_cases"),
            "benefits": product.get("benefits"), "metadata": md,
        },
        "certifications": product.get("certifications"),
        "evidence": product.get("evidence"),
        "vendor": vendor,
        "qa_transcript": answers,
        "questions_asked": len(answers),
    }
    content = _gemini_chat(system, "CONTEXT:\n" + json.dumps(ctx, ensure_ascii=False), key)
    parsed = json.loads(re.sub(r"```json|```", "", content).strip())
    parsed["engine"] = "gemini"
    if parsed.get("done") and len(answers) < MIN_QUESTIONS:
        nxt = _local_step(product, vendor, answers)
        nxt["engine"] = "gemini"
        return nxt
    if len(answers) >= MAX_QUESTIONS and not parsed.get("mapping"):
        return _local_step(product, vendor, answers)
    # Guarantee a stable shape so the UI never gets a missing array.
    parsed.setdefault("confidence", {"product_understanding": 50, "mapping_confidence": 50, "missing_info": 50})
    mp = parsed.get("mapping")
    if mp:
        mp.setdefault("shape", "")
        mp.setdefault("categories", [])
        mp.setdefault("subcategories", [])
        mp.setdefault("adaptive_controls", [])
        mp.setdefault("explanation", "")
        if not mp["categories"]:  # model returned nothing usable → fall back
            return _local_step(product, vendor, answers)
    return parsed


def run_step(product: dict, vendor: dict, answers: list[dict]) -> dict:
    key = settings.GEMINI_API_KEY
    if key:
        try:
            return _gemini_step(product, vendor, answers, key)
        except Exception:  # noqa: BLE001 — any failure → deterministic fallback
            pass
    return _local_step(product, vendor, answers)
