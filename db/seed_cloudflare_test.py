"""
One-off test seeder for the Cloudflare WAF product (vendor #34, product #39).
Fills the data missing for an end-to-end onboarding test: product metadata,
GUARD mapping, E1-E5 evidence (with issued dates), then computes the Defence
Rating. Logo is intentionally left blank (the tester uploads a PNG).

Run:  python db/seed_cloudflare_test.py   (backend must be up on :8000)
"""
import json
import urllib.request

BASE = "http://localhost:8000"
PRODUCT_ID = 39

GUARD_MAPPING = {
    "shape": "VERTICAL SPECIALIST · deep in Cyber web & API protection",
    "categories": [
        {"code": "CYB", "label": "Cyber", "primary": True, "strength": 92},
        {"code": "TEC", "label": "Technology", "primary": False, "strength": 64},
        {"code": "DAT", "label": "Data", "primary": False, "strength": 50},
    ],
    "subcategories": [
        {"category": "CYB", "code": "CYB-APP", "name": "Application Security", "confidence": 85},
        {"category": "CYB", "code": "CYB-NET", "name": "Network & Perimeter Security", "confidence": 72},
    ],
    "adaptive_controls": [
        {"verb": "PROTECTS", "code": "AC-CYB-038", "label": "Web & API request filtering", "grounded_in": "MC-CYB-038"},
        {"verb": "DETECTS", "code": "AC-CYB-019", "label": "Malicious-traffic detection (XSS / SQLi)", "grounded_in": "MC-CYB-019"},
        {"verb": "ENFORCES", "code": "AC-CYB-001", "label": "Managed ruleset enforcement & virtual patching", "grounded_in": "MC-CYB-001"},
    ],
    "explanation": "Cloudflare WAF inspects and filters web/API traffic against OWASP threats with managed, "
                   "auto-updated rulesets — a Cyber vertical specialist with Technology and Data adjacency.",
    "accepted": True,
}

OPTIONAL_METADATA = {
    "category": "Web Application Firewall (WAF)",
    "guard_category": "CYB",
    "product_url": "https://developers.cloudflare.com/waf/get-started/",
    "pricing_model": "Subscription",
    "target_market": "Mid-market & Enterprise",
    "key_features": ["Managed rulesets", "Zero-day virtual patching", "OWASP Core Ruleset",
                     "Custom WAF rules", "Rate limiting"],
    "use_cases": ["Block SQL injection & XSS", "Protect web & API endpoints",
                  "Virtual patching for zero-days"],
    "benefits": ["Reduced web attack surface", "Automatic protection updates", "Lower breach risk"],
    "version": "2024.2",
    "sku": "CF-WAF-ENT",
    "tags": ["waf", "appsec", "owasp", "api-security"],
    "guard_mapping": GUARD_MAPPING,
}

PRODUCT_PATCH = {
    "optional_metadata": OPTIONAL_METADATA,
    "product_images": [
        "https://logo.clearbit.com/cloudflare.com",
        "https://www.cloudflare.com/img/cf-facebook-card.png",
    ],
    "product_videos": ["https://www.youtube.com/watch?v=2c3eC8GIYjo"],
}

EVIDENCE = [
    {"type": "supporting_document", "title": "SOC 2 Type II Report (independent audit)",
     "description": "Independent SOC 2 Type II attestation covering WAF controls.",
     "source_type": "upload", "issuer": "Independent auditor", "issued_date": "2024-09-01", "trust_tier": "A"},
    {"type": "supporting_document", "title": "Third-party penetration test report",
     "description": "Red-team / pen-test by a named firm against WAF rulesets.",
     "source_type": "upload", "issuer": "NCC Group", "issued_date": "2024-11-01", "trust_tier": "A"},
    {"type": "research_report", "title": "Gartner names Cloudflare a Leader in WAAP",
     "description": "Analyst recognition in the WAAP Magic Quadrant.",
     "file_url": "https://www.cloudflare.com/gartner-magic-quadrant-waap/",
     "source_type": "link", "issuer": "Gartner", "issued_date": "2024-08-01", "trust_tier": "B"},
    {"type": "case_study", "title": "Customer blocked 10B malicious requests with WAF",
     "description": "Named customer deployment with a measurable outcome.",
     "file_url": "https://www.cloudflare.com/case-studies/", "source_type": "link",
     "issued_date": "2024-05-15", "trust_tier": "B"},
    {"type": "reference_customer", "title": "Shopify protects storefronts with Cloudflare WAF",
     "description": "Reference customer deployment at scale.",
     "source_type": "text", "issued_date": "2024-03-01", "trust_tier": "C"},
    {"type": "testimonial", "title": "Cut web attacks 90% in 30 days",
     "description": "Security lead testimonial (vendor-collected).",
     "source_type": "text", "issued_date": "2024-07-01", "trust_tier": "D"},
    {"type": "news", "title": "Cloudflare blocks record DDoS + WAF wave",
     "description": "Press / blog mention.", "file_url": "https://blog.cloudflare.com/",
     "source_type": "link", "issued_date": "2025-01-10", "trust_tier": "D"},
]


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


def main():
    print("PATCH product metadata + GUARD mapping + media …")
    call("PATCH", f"/api/portal/products/{PRODUCT_ID}", PRODUCT_PATCH)

    print("Adding evidence (E1–E5) …")
    ids = []
    for ev in EVIDENCE:
        row = call("POST", f"/api/portal/products/{PRODUCT_ID}/evidence", ev)
        ids.append(row["evidence_id"])
        print(f"  + {ev['type']:<20} {ev['title'][:42]}")

    # Admin-verify the two independent audit docs → un-withholds the score.
    print("Admin-verifying the two audit documents …")
    for eid in ids[:2]:
        call("POST", f"/api/portal/evidence/{eid}/verify", {"verified_by": "test-admin"})

    print("Computing Defence Rating …")
    res = call("POST", f"/api/portal/products/{PRODUCT_ID}/defense-rating/compute")
    print(json.dumps({
        "defense_rating": res.get("defense_rating"),
        "band": res.get("score_band"),
        "status": res.get("status"),
        "per_dimension": res.get("per_dimension"),
    }, indent=2))
    print("\nDone. View: http://localhost:8080/marketplace/product/39  "
          "(verify Cloudflare, Inc. in onboarding to see GUARD + Defence preview).")


if __name__ == "__main__":
    main()
