# Importing data into the marketplace

This guide walks you through pulling vendor/product records from **another
database** and loading only the fields the Attacked.ai marketplace needs.

Script: [`scripts/import_marketplace_data.py`](import_marketplace_data.py)

---

## What the marketplace actually needs

The importer writes to two tables. You only have to supply these fields:

### `vendors`
| field | required | notes |
|---|---|---|
| `name` | ✅ | dedup key (case-insensitive) — one row per company |
| `entity_type` | | e.g. `vendor`, `service_provider` |
| `hq` | | headquarters, shown on cards |
| `domain` | | used to fetch the logo (e.g. `crowdstrike.com`) |
| `website` | | vendor URL |
| `logo_url` | | direct logo image URL (optional if `domain` is set) |

### `products`
| field | required | drives… |
|---|---|---|
| `name` | ✅ | dedup key per vendor |
| `what_they_do` | | the description on the card / detail page |
| `product_url` | | "Visit" links |
| **`covers_controls[]`** | | **GUARD categories** (see below) — the most important field |
| `ai_verdict` (0–100) | | ≥ 80 → **Gold Tier** spotlight |
| `fit` (`full`/`partial`/`adjacent`) | | `full` → shows under the **Full Fit** filter |
| `logo_url`, `product_images[]`, `product_videos[]`, `video_url` | | media |
| `optional_metadata` (JSON) | | pricing, integrations, service vs product, free trial, demo link |

> **`review_status` is set to `approved` automatically** so imported products go
> live. Change `DEFAULT_REVIEW_STATUS` in the script to `'pending'` if you'd
> rather approve them in the admin queue first.

### GUARD mapping — the key bit
Your homepage Discover section, the GUARD filter, and category counts are **all
derived from `products.covers_controls`**. Each entry looks like `MC-CYB-017`,
and the marketplace reads the middle token (`CYB`) as the GUARD category.

The 13 valid codes:
`CYB DAT ENV FIN GEO OPS PHY PPL REG REP STR TEC TPR`

You have two options in `map_row`:
- Easiest: return `guard_codes: ["CYB", "TPR"]` and the script turns each into a
  control ref (`MC-CYB-001`) for you.
- Or return explicit refs in `controls: ["MC-CYB-017", "MC-DAT-004"]`.

If a product has **no** controls, it still imports — it just won't appear under
any GUARD category or the Discover counts.

### `optional_metadata` keys the UI understands
`pricing_model`, `listing_type` (`product` | `service`), `service_type`,
`engagement_model`, `integrations[]`, `starting_price`, `free_trial` (bool),
`pricing_url`, `demo_url`, `contact_email`.

---

## Step 1 — point the script at your two databases

Set these (env vars, or add them to `scripts/.env` or the repo-root `.env`):

```bash
# the OTHER database you're extracting FROM
export SOURCE_DATABASE_URL="postgresql://user:pass@host:5432/source_db"

# the marketplace DB to load INTO (defaults to DATABASE_URL / backend/.env)
export TARGET_DATABASE_URL="postgresql://...your Supabase URL..."
```

On Windows PowerShell:
```powershell
$env:SOURCE_DATABASE_URL = "postgresql://user:pass@host:5432/source_db"
```

> The script auto-falls back to the marketplace DB used by the backend
> (`DATABASE_URL` in `backend/.env`), so you usually only need to set
> `SOURCE_DATABASE_URL`.

---

## Step 2 — tell it what to read and how to map it

Open the script and edit **only two things** (both clearly marked):

1. **`SOURCE_QUERY`** — your `SELECT` against the source DB. Alias columns to
   whatever names are convenient:
   ```sql
   SELECT company        AS vendor_name,
          tool_name      AS product_name,
          summary        AS description,
          website,
          risk_tags      AS guard_codes,   -- e.g. 'CYB,TPR'
          rating         AS score
   FROM catalog
   WHERE is_active = true
   ```

2. **`map_row(src)`** — map those columns into the marketplace fields. The
   defaults already handle common names (`vendor_name`/`company`,
   `product_name`/`name`, `description`, `guard_codes`, …). Change the
   `src.get("…")` keys to match your `SOURCE_QUERY` aliases.

The script prints the source columns it found on the first run, so you can see
exactly what's available to map.

---

## Step 3 — dry run (writes nothing)

Run it with the backend's Python so `psycopg` is available:

```bash
# from the repo root
backend/.venv/Scripts/python.exe scripts/import_marketplace_data.py --limit 5
```

You'll see, per row, whether it would **insert/update**, and the GUARD
categories detected:

```
  [inserted ] CrowdStrike — Falcon  GUARD=['CYB', 'TPR']
  [updated  ] Okta — Workforce Identity  GUARD=['DAT']
• DRY RUN — nothing written. Re-run with --commit to apply.
```

Tune `map_row` until the mapping looks right. Drop `--limit` to preview all rows.

---

## Step 4 — commit

```bash
backend/.venv/Scripts/python.exe scripts/import_marketplace_data.py --commit
```

Idempotent: re-running updates the same rows instead of duplicating, so you can
import repeatedly as your source changes.

---

## Step 5 (optional) — compute Defence Ratings

The numeric **Defence Rating** on cards is produced by the backend scoring
engine, not the importer — so freshly imported products show `—` until you run
it. With the backend running locally:

```bash
# PowerShell — compute a rating for every approved product id
$ids = (Invoke-RestMethod "http://127.0.0.1:8000/api/products?page_size=100").data.id
foreach ($id in $ids) {
  Invoke-RestMethod -Method Post "http://127.0.0.1:8000/api/portal/products/$id/defense-rating/compute" | Out-Null
  Write-Host "computed $id"
}
```

(Ratings stay *provisional* until evidence is verified — that's by design.)

---

## Troubleshooting

| symptom | cause / fix |
|---|---|
| `psycopg is required` | run it with `backend/.venv/Scripts/python.exe`, not bare `python` |
| `set SOURCE_DATABASE_URL` | the source connection isn't set (env or `.env`) |
| product imported but not on site | `review_status` isn't `approved`, or it has no `covers_controls` so it's filtered out of a GUARD view |
| not under a GUARD category | `covers_controls`/`guard_codes` empty or code not in the 13 |
| not under "Full Fit" | `fit` isn't `'full'` |
| no Gold Tier badge | `ai_verdict` < 80 |
| Defence Rating shows `—` | run Step 5 (the scoring engine) |
| duplicate companies | source spells the name differently — names dedup case-insensitively but not fuzzily |

---

## Safety notes
- The script **never deletes** anything and **backfills vendor blanks only** — it
  won't overwrite curated vendor fields with source nulls.
- Keep real connection strings in `.env` (gitignored) — never commit them.
- Don't import real third-party company logos as "partners"; logos here are the
  vendor's own listing media.
