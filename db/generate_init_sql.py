"""
Generate db/init.sql (schema DDL + seed data) from the vendor enrichment Excel.

Run:  python db/generate_init_sql.py "C:/path/to/vendor_enrichment_CLEANED (1).xlsx"

The output init.sql is mounted into the Postgres container's
/docker-entrypoint-initdb.d/ so the database self-seeds on first boot.
"""
import sys
import re
from collections import defaultdict
from urllib.parse import urlparse
import pandas as pd

DEFAULT_XLSX = r"C:\Users\dheer\Downloads\vendor_enrichment_CLEANED (1).xlsx"
OUT = "db/init.sql"


def sql_str(v) -> str:
    """Escape a Python value into a SQL string literal (or NULL)."""
    if v is None:
        return "NULL"
    s = str(v).strip()
    if s == "" or s.lower() == "nan":
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def sql_int(v) -> str:
    try:
        if v is None or str(v).strip() == "" or str(v).lower() == "nan":
            return "NULL"
        return str(int(float(v)))
    except (ValueError, TypeError):
        return "NULL"


def sql_text_array(items) -> str:
    """Build a Postgres text[] literal from a list of strings."""
    if not items:
        return "'{}'"
    cleaned = [i.strip() for i in items if i and i.strip()]
    if not cleaned:
        return "'{}'"
    inner = ",".join('"' + i.replace('"', '\\"') + '"' for i in cleaned)
    return "'{" + inner + "}'"


def parse_controls(raw) -> list[str]:
    if not raw or str(raw).strip().lower() in ("", "nan"):
        return []
    return [c.strip() for c in re.split(r"[,;]", str(raw)) if c.strip()]


def domain_of(url: str) -> str | None:
    if not url or str(url).strip().lower() in ("", "nan"):
        return None
    u = str(url).strip()
    if not u.startswith("http"):
        u = "https://" + u
    netloc = urlparse(u).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc or None


def main():
    xlsx = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    xl = pd.ExcelFile(xlsx)
    summary = xl.parse("Summary").fillna("")
    vv = xl.parse("Validated Vendors").fillna("")
    ev = xl.parse("Verified Evidence").fillna("")
    sb = xl.parse("Score Breakdown").fillna("")
    ml = xl.parse("Mitigation & Limits").fillna("")

    # ── incidents ──────────────────────────────────────────────
    # Summary holds the canonical full incident names. Validated Vendors and
    # Verified Evidence truncate them to ~50 chars, so we resolve by prefix.
    incidents: dict[str, dict] = {}
    for _, r in summary.iterrows():
        name = str(r["Incident"]).strip()
        if not name:
            continue
        incidents[name] = {
            "risk_coverage": sql_int(r.get("Risk-Coverage Vendors")),
            "handler": sql_int(r.get("Incident-Handler Vendors")),
            "total": sql_int(r.get("Total")),
        }
    incident_id = {name: i + 1 for i, name in enumerate(incidents)}

    def resolve_incident(raw: str) -> str | None:
        """Map a (possibly truncated) incident name to a canonical Summary name."""
        raw = str(raw).strip()
        if raw in incident_id:
            return raw
        for canon in incident_id:
            if canon.startswith(raw) or raw.startswith(canon[: min(len(canon), 40)]):
                return canon
        return None

    # ── vendors (deduped by name) ──────────────────────────────
    vendors: dict[str, dict] = {}
    for _, r in vv.iterrows():
        vname = str(r["Vendor"]).strip()
        if not vname:
            continue
        if vname not in vendors:
            dom = domain_of(r.get("Product URL"))
            vendors[vname] = {
                "entity_type": str(r.get("Entity Type") or "").strip(),
                "hq": str(r.get("HQ") or "").strip(),
                "domain": dom,
            }
        else:
            # backfill a domain if first row lacked one
            if not vendors[vname]["domain"]:
                vendors[vname]["domain"] = domain_of(r.get("Product URL"))
            if not vendors[vname]["hq"]:
                vendors[vname]["hq"] = str(r.get("HQ") or "").strip()
    vendor_id = {name: i + 1 for i, name in enumerate(vendors)}

    # ── score / mitigation queues keyed by (incident, vendor) ──
    sb_q: dict[tuple, list] = defaultdict(list)
    for _, r in sb.iterrows():
        inc = resolve_incident(r["Incident"])
        sb_q[(inc, str(r["Vendor"]).strip())].append(
            str(r.get("Score Rationale") or "").strip()
        )
    ml_q: dict[tuple, list] = defaultdict(list)
    for _, r in ml.iterrows():
        inc = resolve_incident(r["Incident"])
        ml_q[(inc, str(r["Vendor"]).strip())].append(
            (str(r.get("How It Mitigates") or "").strip(), str(r.get("Known Limits") or "").strip())
        )
    # working copies we pop from
    sb_pop = {k: list(v) for k, v in sb_q.items()}
    ml_pop = {k: list(v) for k, v in ml_q.items()}

    # ── products (one per Validated Vendors row) ───────────────
    products = []
    for idx, r in vv.iterrows():
        inc_raw = str(r["Incident"]).strip()
        inc = resolve_incident(inc_raw)
        vname = str(r["Vendor"]).strip()
        if not vname or inc is None:
            continue
        key = (inc, vname)  # queues are keyed by canonical incident
        rationale = sb_pop.get(key, [None]).pop(0) if sb_pop.get(key) else None
        mit = ml_pop.get(key, [(None, None)]).pop(0) if ml_pop.get(key) else (None, None)
        products.append({
            "id": len(products) + 1,
            "vendor_id": vendor_id[vname],
            "incident_id": incident_id[inc],
            "name": str(r.get("Product") or vname).strip(),
            "what_they_do": str(r.get("What They Do") or "").strip(),
            "product_url": str(r.get("Product URL") or "").strip(),
            "grp": str(r.get("Group") or "").strip(),
            "role": str(r.get("Role") or "").strip(),
            "primary_mc": str(r.get("Primary MC") or "").strip(),
            "controls": parse_controls(r.get("Covers Controls")),
            "ai_verdict": sql_int(r.get("AI Verdict")),
            "confidence": str(r.get("Confidence") or "").strip(),
            "fit": str(r.get("Fit") or "").strip(),
            "how_it_mitigates": mit[0],
            "known_limits": mit[1],
            "score_rationale": rationale,
        })

    # ── evidence (keyed to vendor + incident) ──────────────────
    evidence = []
    for _, r in ev.iterrows():
        vname = str(r["Vendor"]).strip()
        inc_full = resolve_incident(r["Incident"])
        if vname not in vendor_id or inc_full is None:
            continue
        span_col = [c for c in ev.columns if c.startswith("Source Span")][0]
        evidence.append({
            "id": len(evidence) + 1,
            "vendor_id": vendor_id[vname],
            "incident_id": incident_id[inc_full],
            "addresses_control": str(r.get("Addresses Control") or "").strip(),
            "verified_claim": str(r.get("Verified Claim") or "").strip(),
            "source_span": str(r.get(span_col) or "").strip(),
            "source_url": str(r.get("Source URL") or "").strip(),
        })

    # ── emit SQL ───────────────────────────────────────────────
    lines: list[str] = []
    w = lines.append
    w("-- Auto-generated by db/generate_init_sql.py — DO NOT EDIT BY HAND")
    w("-- Source: vendor_enrichment_CLEANED.xlsx")
    w("SET client_encoding = 'UTF8';")
    w("")
    w("DROP TABLE IF EXISTS evidence, products, vendors, incidents, vendor_onboarding CASCADE;")
    w("")
    w("""CREATE TABLE incidents (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  risk_coverage_vendors    INT,
  incident_handler_vendors INT,
  total_vendors INT
);""")
    w("""CREATE TABLE vendors (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  entity_type TEXT,
  hq          TEXT,
  domain      TEXT,
  website     TEXT,
  logo_url    TEXT
);""")
    w("""CREATE TABLE products (
  id               SERIAL PRIMARY KEY,
  vendor_id        INT REFERENCES vendors(id) ON DELETE CASCADE,
  incident_id      INT REFERENCES incidents(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  what_they_do     TEXT,
  product_url      TEXT,
  vendor_group     TEXT,
  role             TEXT,
  primary_mc       TEXT,
  covers_controls  TEXT[] DEFAULT '{}',
  ai_verdict       INT,
  confidence       TEXT,
  fit              TEXT,
  how_it_mitigates TEXT,
  known_limits     TEXT,
  score_rationale  TEXT,
  video_url        TEXT
);""")
    w("""CREATE TABLE evidence (
  id                SERIAL PRIMARY KEY,
  vendor_id         INT REFERENCES vendors(id) ON DELETE CASCADE,
  incident_id       INT REFERENCES incidents(id) ON DELETE SET NULL,
  addresses_control TEXT,
  verified_claim    TEXT,
  source_span       TEXT,
  source_url        TEXT
);""")
    # vendor onboarding (new feature) — resume by work_email
    w("""CREATE TABLE vendor_onboarding (
  id                  SERIAL PRIMARY KEY,
  work_email          TEXT UNIQUE NOT NULL,
  company_name        TEXT,
  website             TEXT,
  hq                  TEXT,
  founded             TEXT,
  company_size        TEXT,
  certifications      TEXT,
  product_name        TEXT,
  product_description TEXT,
  product_shape       TEXT,
  video_state         TEXT DEFAULT 'none',
  video_url           TEXT,
  evidence            JSONB DEFAULT '[]',
  extra_products      JSONB DEFAULT '[]',
  extra               JSONB DEFAULT '{}',
  current_step        INT  DEFAULT 0,
  status              TEXT DEFAULT 'draft',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);""")
    w("")
    w("CREATE INDEX idx_products_vendor ON products(vendor_id);")
    w("CREATE INDEX idx_products_incident ON products(incident_id);")
    w("CREATE INDEX idx_evidence_vendor_incident ON evidence(vendor_id, incident_id);")
    w("")

    # incidents
    w("INSERT INTO incidents (id, name, risk_coverage_vendors, incident_handler_vendors, total_vendors) VALUES")
    rows = []
    for name, data in incidents.items():
        rows.append(f"  ({incident_id[name]}, {sql_str(name)}, {data['risk_coverage']}, {data['handler']}, {data['total']})")
    w(",\n".join(rows) + ";")
    w("")

    # vendors
    w("INSERT INTO vendors (id, name, entity_type, hq, domain, website, logo_url) VALUES")
    rows = []
    for name, data in vendors.items():
        dom = data["domain"]
        website = f"https://{dom}" if dom else None
        logo = f"https://logo.clearbit.com/{dom}" if dom else None
        rows.append(
            f"  ({vendor_id[name]}, {sql_str(name)}, {sql_str(data['entity_type'])}, "
            f"{sql_str(data['hq'])}, {sql_str(dom)}, {sql_str(website)}, {sql_str(logo)})"
        )
    w(",\n".join(rows) + ";")
    w("")

    # products
    w("INSERT INTO products (id, vendor_id, incident_id, name, what_they_do, product_url, vendor_group, role, primary_mc, covers_controls, ai_verdict, confidence, fit, how_it_mitigates, known_limits, score_rationale) VALUES")
    rows = []
    for p in products:
        rows.append(
            "  (" + ", ".join([
                str(p["id"]), str(p["vendor_id"]), str(p["incident_id"]),
                sql_str(p["name"]), sql_str(p["what_they_do"]), sql_str(p["product_url"]),
                sql_str(p["grp"]), sql_str(p["role"]), sql_str(p["primary_mc"]),
                sql_text_array(p["controls"]), p["ai_verdict"], sql_str(p["confidence"]),
                sql_str(p["fit"]), sql_str(p["how_it_mitigates"]), sql_str(p["known_limits"]),
                sql_str(p["score_rationale"]),
            ]) + ")"
        )
    w(",\n".join(rows) + ";")
    w("")

    # evidence
    w("INSERT INTO evidence (id, vendor_id, incident_id, addresses_control, verified_claim, source_span, source_url) VALUES")
    rows = []
    for e in evidence:
        rows.append(
            "  (" + ", ".join([
                str(e["id"]), str(e["vendor_id"]), str(e["incident_id"]),
                sql_str(e["addresses_control"]), sql_str(e["verified_claim"]),
                sql_str(e["source_span"]), sql_str(e["source_url"]),
            ]) + ")"
        )
    w(",\n".join(rows) + ";")
    w("")
    # reset sequences
    w("SELECT setval('incidents_id_seq', (SELECT MAX(id) FROM incidents));")
    w("SELECT setval('vendors_id_seq', (SELECT MAX(id) FROM vendors));")
    w("SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));")
    w("SELECT setval('evidence_id_seq', (SELECT MAX(id) FROM evidence));")
    w("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Wrote {OUT}")
    print(f"  incidents: {len(incidents)}")
    print(f"  vendors:   {len(vendors)}")
    print(f"  products:  {len(products)}")
    print(f"  evidence:  {len(evidence)}")


if __name__ == "__main__":
    main()
