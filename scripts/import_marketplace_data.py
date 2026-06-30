#!/usr/bin/env python3
"""
import_marketplace_data.py
==========================

Extract vendor/product records from ANOTHER (source) database and load only the
exact fields the Attacked.ai marketplace needs into THIS marketplace's Postgres.

It is:
  • Configuration-driven — you edit ONE function (`map_row`) to match your
    source's column names. Nothing else needs to change.
  • Idempotent — re-running updates existing rows instead of duplicating
    (vendors dedup by name, products dedup by vendor + product name), exactly
    like the live onboarding endpoint does.
  • Safe by default — runs as a DRY RUN (no writes) until you pass --commit.

Target schema it writes (discovered from the live DB):

  vendors(  name, entity_type, hq, domain, website, logo_url, status )
  products( vendor_id, name, what_they_do, product_url, covers_controls[],
            ai_verdict, confidence, fit, logo_url, product_images[],
            product_videos[], video_url, optional_metadata(jsonb),
            review_status )

How the marketplace USES those fields (so you map the right things):
  • covers_controls — drives GUARD categories. Use refs like 'MC-CYB-001'.
    The category is the middle token (CYB, DAT, FIN, ...). The Discover section,
    GUARD filter, and category counts all come from this. If your source has a
    list of GUARD category codes instead, pass them via `guard_codes` and this
    script synthesises the control refs for you.
  • ai_verdict (0-100) — products with >= 80 get the "Gold Tier" spotlight.
  • fit ('full' | 'partial' | 'adjacent') — 'full' shows under the "Full Fit" filter.
  • review_status — MUST be 'approved' for a product to appear publicly. The
    script sets this for you (see DEFAULT_REVIEW_STATUS).
  • optional_metadata — flexible JSON: pricing_model, listing_type ('product' |
    'service'), service_type, engagement_model, integrations[], starting_price,
    free_trial, pricing_url, demo_url, contact_email, etc.

NOTE — Defence Rating: the numeric Defence Rating shown on cards is produced by
the backend scoring engine, not by this importer. After importing, trigger it
per product via POST /api/portal/products/{id}/defense-rating/compute (the guide
shows a loop). Until then cards show "—", which is correct.

Usage
-----
  # 1) dry run (default) — prints exactly what WOULD be written, writes nothing
  python scripts/import_marketplace_data.py

  # 2) only the first 5 rows, still a dry run — good for checking your mapping
  python scripts/import_marketplace_data.py --limit 5

  # 3) actually write
  python scripts/import_marketplace_data.py --commit

Connections (env vars)
----------------------
  SOURCE_DATABASE_URL   the OTHER database you are extracting from
  TARGET_DATABASE_URL   the marketplace DB to load into
                        (falls back to DATABASE_URL, then to backend/.env)

Both can also be put in a .env file next to this script or at the repo root.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Iterable

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb
except ImportError:
    sys.exit(
        "psycopg is required. Run it with the backend venv, e.g.:\n"
        "  backend/.venv/Scripts/python.exe scripts/import_marketplace_data.py"
    )

REPO_ROOT = Path(__file__).resolve().parent.parent

# Valid GUARD category codes (the 13). Used to validate/synthesise control refs.
GUARD_CODES = {
    "CYB", "DAT", "ENV", "FIN", "GEO", "OPS", "PHY",
    "PPL", "REG", "REP", "STR", "TEC", "TPR",
}

# Imported products are published immediately. Set to 'pending' if you would
# rather review them in the admin queue before they go live.
DEFAULT_REVIEW_STATUS = "approved"


# ══════════════════════════════════════════════════════════════════════════
#  THE ONLY PART YOU NEED TO EDIT
#  ----------------------------------------------------------------------
#  1. SOURCE_QUERY  — the SELECT against YOUR other database.
#  2. map_row(src)  — turn one source row into marketplace fields.
# ══════════════════════════════════════════════════════════════════════════

# Edit this to select from your source DB. Alias columns to whatever names you
# find convenient — map_row() below reads from this row dict.
SOURCE_QUERY = """
    SELECT *
    FROM your_source_table
    -- WHERE published = true
    -- ORDER BY id
"""


def map_row(src: dict[str, Any]) -> dict[str, Any] | None:
    """Map ONE source row -> marketplace vendor + product fields.

    Return None to skip a row. Replace every src['...'] below with YOUR source
    column names (the keys returned by SOURCE_QUERY).

    Return shape:
      {
        "vendor": { name (required), entity_type, hq, domain, website, logo_url },
        "product": {
            name (required), what_they_do, product_url, ai_verdict (0-100),
            confidence, fit ('full'|'partial'|'adjacent'), logo_url,
            product_images (list[str]), product_videos (list[str]), video_url,
        },
        "guard_codes": ["CYB", "TPR", ...],   # -> becomes covers_controls
        "controls":    ["MC-CYB-017", ...],   # OR supply explicit control refs
        "metadata": {                          # -> optional_metadata (jsonb)
            "pricing_model": "...", "listing_type": "product"|"service",
            "service_type": "...", "engagement_model": "...",
            "integrations": [...], "starting_price": "...", "free_trial": bool,
            "pricing_url": "...", "demo_url": "...", "contact_email": "...",
        },
      }
    """
    vendor_name = (src.get("vendor_name") or src.get("company") or "").strip()
    product_name = (src.get("product_name") or src.get("name") or "").strip()
    if not vendor_name or not product_name:
        return None  # both are required; skip incomplete rows

    return {
        "vendor": {
            "name": vendor_name,
            "entity_type": src.get("entity_type") or "vendor",
            "hq": src.get("hq") or src.get("headquarters"),
            "domain": src.get("domain"),
            "website": src.get("website") or src.get("vendor_url"),
            "logo_url": src.get("vendor_logo") or src.get("logo_url"),
        },
        "product": {
            "name": product_name,
            "what_they_do": src.get("description") or src.get("what_they_do"),
            "product_url": src.get("product_url"),
            "ai_verdict": _as_int(src.get("score") or src.get("ai_verdict")),
            "confidence": src.get("confidence"),
            "fit": src.get("fit") or src.get("fit_level"),
            "logo_url": src.get("product_logo") or src.get("logo_url"),
            "product_images": _as_list(src.get("product_images")),
            "product_videos": _as_list(src.get("product_videos")),
            "video_url": src.get("video_url"),
        },
        # Provide ONE of these two. guard_codes is easiest; the script turns
        # each code into a control ref (e.g. 'CYB' -> 'MC-CYB-001').
        "guard_codes": _as_list(src.get("guard_codes")),
        "controls": _as_list(src.get("covers_controls") or src.get("controls")),
        "metadata": {
            "pricing_model": src.get("pricing_model"),
            "listing_type": src.get("listing_type") or "product",
            "service_type": src.get("service_type"),
            "engagement_model": src.get("engagement_model"),
            "integrations": _as_list(src.get("integrations")),
            "starting_price": src.get("starting_price"),
            "free_trial": bool(src.get("free_trial")),
            "pricing_url": src.get("pricing_url"),
            "demo_url": src.get("demo_url"),
            "contact_email": src.get("contact_email"),
        },
    }


# ══════════════════════════════════════════════════════════════════════════
#  Below here is the engine — you should not need to change it.
# ══════════════════════════════════════════════════════════════════════════

def _as_int(v: Any) -> int | None:
    try:
        return int(round(float(v))) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None


def _as_list(v: Any) -> list:
    """Coerce a value into a clean list of strings.

    Accepts a real list/tuple, a Postgres array, or a delimited string
    ('a, b; c' or 'a|b'). Returns [] for empty/None.
    """
    if v is None or v == "":
        return []
    if isinstance(v, (list, tuple)):
        return [str(x).strip() for x in v if str(x).strip()]
    s = str(v)
    for sep in ("|", ";", ","):
        if sep in s:
            return [p.strip() for p in s.split(sep) if p.strip()]
    return [s.strip()]


def controls_from(rec: dict) -> list[str]:
    """Build covers_controls[] — explicit controls win, else synth from codes."""
    explicit = [c for c in rec.get("controls", []) if c]
    if explicit:
        return explicit
    out = []
    for code in rec.get("guard_codes", []):
        code = str(code).strip().upper()
        if code in GUARD_CODES:
            out.append(f"MC-{code}-001")
        else:
            print(f"  ! skipping unknown GUARD code: {code!r}", file=sys.stderr)
    return out


def clean_meta(meta: dict) -> dict:
    """Drop empty values so optional_metadata stays tidy."""
    out = {}
    for k, v in (meta or {}).items():
        if v in (None, "", [], {}):
            continue
        out[k] = v
    return out


def load_dotenv_value(key: str) -> str | None:
    """Read KEY from a .env next to this script or at the repo root (no deps)."""
    for env_path in (Path(__file__).resolve().parent / ".env",
                     REPO_ROOT / ".env",
                     REPO_ROOT / "backend" / ".env"):
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def resolve_url(*env_keys: str, label: str) -> str:
    for key in env_keys:
        val = os.getenv(key) or load_dotenv_value(key)
        if val:
            return val
    sys.exit(f"ERROR: set {label} (tried env vars: {', '.join(env_keys)}).")


def read_source(limit: int | None) -> list[dict]:
    url = resolve_url("SOURCE_DATABASE_URL", label="SOURCE_DATABASE_URL")
    sql = SOURCE_QUERY.strip().rstrip(";")
    if limit:
        sql = f"SELECT * FROM ({sql}) AS _src LIMIT {int(limit)}"
    with psycopg.connect(url, row_factory=dict_row) as con:
        with con.cursor() as cur:
            cur.execute(sql)
            return cur.fetchall()


def upsert_vendor(cur, v: dict) -> int:
    """Find a vendor by case-insensitive name; insert if missing. Returns id."""
    cur.execute("SELECT id FROM vendors WHERE lower(name) = lower(%s) LIMIT 1",
                (v["name"],))
    found = cur.fetchone()
    if found:
        # Backfill blanks only — never overwrite curated vendor data.
        cur.execute(
            """UPDATE vendors SET
                 entity_type = COALESCE(entity_type, %s),
                 hq          = COALESCE(hq, %s),
                 domain      = COALESCE(domain, %s),
                 website     = COALESCE(website, %s),
                 logo_url    = COALESCE(logo_url, %s)
               WHERE id = %s""",
            (v.get("entity_type"), v.get("hq"), v.get("domain"),
             v.get("website"), v.get("logo_url"), found["id"]),
        )
        return found["id"]
    cur.execute(
        """INSERT INTO vendors (name, entity_type, hq, domain, website, logo_url, status)
           VALUES (%s, %s, %s, %s, %s, %s, 'active') RETURNING id""",
        (v["name"], v.get("entity_type"), v.get("hq"), v.get("domain"),
         v.get("website"), v.get("logo_url")),
    )
    return cur.fetchone()["id"]


def upsert_product(cur, vendor_id: int, p: dict, controls: list[str], meta: dict) -> str:
    """Insert or update one product (dedup by vendor + name). Returns action."""
    cur.execute(
        "SELECT id FROM products WHERE vendor_id = %s AND lower(name) = lower(%s) LIMIT 1",
        (vendor_id, p["name"]),
    )
    found = cur.fetchone()
    if found:
        cur.execute(
            """UPDATE products SET
                 what_they_do    = COALESCE(%s, what_they_do),
                 product_url     = COALESCE(%s, product_url),
                 covers_controls = %s,
                 ai_verdict      = COALESCE(%s, ai_verdict),
                 confidence      = COALESCE(%s, confidence),
                 fit             = COALESCE(%s, fit),
                 logo_url        = COALESCE(%s, logo_url),
                 product_images  = %s,
                 product_videos  = %s,
                 video_url       = COALESCE(%s, video_url),
                 optional_metadata = %s,
                 review_status   = %s,
                 updated_at      = now()
               WHERE id = %s""",
            (p.get("what_they_do"), p.get("product_url"), controls,
             p.get("ai_verdict"), p.get("confidence"), p.get("fit"),
             p.get("logo_url"), p.get("product_images") or [],
             p.get("product_videos") or [], p.get("video_url"),
             Jsonb(meta), DEFAULT_REVIEW_STATUS, found["id"]),
        )
        return "updated"
    cur.execute(
        """INSERT INTO products
             (vendor_id, name, what_they_do, product_url, covers_controls,
              ai_verdict, confidence, fit, logo_url, product_images,
              product_videos, video_url, optional_metadata, review_status,
              submitted_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())""",
        (vendor_id, p["name"], p.get("what_they_do"), p.get("product_url"),
         controls, p.get("ai_verdict"), p.get("confidence"), p.get("fit"),
         p.get("logo_url"), p.get("product_images") or [],
         p.get("product_videos") or [], p.get("video_url"),
         Jsonb(meta), DEFAULT_REVIEW_STATUS),
    )
    return "inserted"


def run(rows: Iterable[dict], commit: bool) -> None:
    url = resolve_url("TARGET_DATABASE_URL", "DATABASE_URL", label="TARGET_DATABASE_URL")
    stats = {"inserted": 0, "updated": 0, "skipped": 0, "vendors": set()}

    with psycopg.connect(url, row_factory=dict_row) as con:
        with con.cursor() as cur:
            for i, src in enumerate(rows):
                rec = map_row(src)
                if not rec:
                    stats["skipped"] += 1
                    continue
                controls = controls_from(rec)
                meta = clean_meta(rec.get("metadata", {}))
                vid = upsert_vendor(cur, rec["vendor"])
                action = upsert_product(cur, vid, rec["product"], controls, meta)
                stats[action] += 1
                stats["vendors"].add(vid)
                guard = sorted({c.split("-")[1] for c in controls if "-" in c})
                print(f"  [{action:8}] {rec['vendor']['name']} — "
                      f"{rec['product']['name']}  GUARD={guard or '—'}")
        if commit:
            con.commit()
            print("\n✓ COMMITTED.")
        else:
            con.rollback()
            print("\n• DRY RUN — nothing written. Re-run with --commit to apply.")

    print(f"  vendors touched: {len(stats['vendors'])}  "
          f"inserted: {stats['inserted']}  updated: {stats['updated']}  "
          f"skipped: {stats['skipped']}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import vendor/product data into the marketplace.")
    ap.add_argument("--commit", action="store_true", help="actually write (default is dry run)")
    ap.add_argument("--limit", type=int, default=None, help="only process the first N source rows")
    args = ap.parse_args()

    print("Reading source rows…")
    rows = read_source(args.limit)
    print(f"Fetched {len(rows)} source row(s).\n")
    if rows:
        print(f"Source columns available: {sorted(rows[0].keys())}\n")
    run(rows, commit=args.commit)


if __name__ == "__main__":
    main()
