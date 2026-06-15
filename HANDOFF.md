# Attacked.ai Vendor Marketplace — Project Handoff / Context

> **Purpose:** read this first to resume work in a new chat with full context.
> A fresh session has the repo on disk, so this captures the *decisions and
> state* that aren't obvious from the code alone. Pair with
> `docs/defense-rating-methodology.md`.

---

## 1. What this is
A Vendor Intelligence Marketplace for **Attacked.ai** ("The Defence Layer").
Vendors onboard products; products are mapped to the **GUARD** risk framework by
AI; a **Defence Rating** (foundation built, scoring not computed yet) expresses
defensive strength from evidence.

Originally fetched data from Supabase — **migrated entirely to a local
PostgreSQL database in Docker.** The app has **no runtime Supabase/MCP
connection** (critical org requirement).

---

## 2. Stack & how to run
- **Backend:** FastAPI + `psycopg` (v3) + `psycopg_pool` → local Postgres. Sync endpoints.
- **Frontend:** React 19 + Vite + Tailwind v4 (`@theme` tokens) + react-router + TanStack Query + recharts + lucide-react.
- **DB:** Postgres 16 (Docker).
- **AI:** Google **Gemini** (`gemini-2.5-flash-lite`, cheapest) for GUARD Mapping, with a deterministic local fallback engine.

**Run:** `docker compose up -d --build` from project root.
- Frontend (nginx): **http://localhost:8080**
- Backend API: **http://localhost:8000** (also proxied at `:8080/api` and `/uploads`)
- Postgres: host port **5433** → container 5432 (host 5432 was taken by a local PG install)
- Dev server (optional): `cd frontend && npm run dev` → :5173 (proxies /api & /uploads to :8000)

**Type-check frontend:** `cd frontend && npx tsc -b`
**Regenerate marketplace seed from Excel:** `python db/generate_init_sql.py` (source: `vendor_enrichment_CLEANED.xlsx`)

---

## 3. Environment / secrets
- **Gemini key** lives in TWO places:
  - `backend/.env` → `GEMINI_API_KEY=...` (for running backend outside Docker)
  - root `.env` (next to docker-compose.yml) → `GEMINI_API_KEY=...` (docker-compose passes it to the backend container)
  - `GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta`, `GEMINI_MODEL=gemini-2.5-flash-lite`
- If `GEMINI_API_KEY` is empty → the local fallback engine runs automatically.
- `.env.example` files document both.

---

## 4. Directory map (key files)
```
docker-compose.yml          db(5433)+backend(8000)+frontend(8080); mounts init.sql + guard_framework.sql; uploads volume; GEMINI_* env
.env / .env.example         root — GEMINI vars for compose
db/
  init.sql                  generated marketplace seed (incidents/vendors/products/evidence)
  generate_init_sql.py      Excel → init.sql generator
  guard_framework.sql       LOCAL GUARD taxonomy mirror (categories/subcategories/master_controls) — static, no Supabase
backend/app/
  main.py                   FastAPI app, lifespan(run_migrations), CORS, StaticFiles /uploads, marketplace + onboarding endpoints, PRODUCT_SELECT/normalise_product
  config.py                 settings (DATABASE_URL, CORS, GEMINI_*)
  database.py               psycopg pool: query/query_one/execute/cursor/wait_for_db
  migrations.py             idempotent DDL run on startup (products extensions, product_evidence, defense_ratings, snapshots, audit log) + seeds demo video_url
  portal.py                 /api/portal/* router: verify, vendor update, product create/update, evidence CRUD+verify, defense-rating get/put/history, audit, file upload, guard-mapping/step, guard/context
  schemas.py                Pydantic models (incl. EVIDENCE_TYPES, GuardMapStep)
  guard_mapping.py          AI GUARD mapping engine (Gemini + local fallback), reads local guard_* taxonomy
  scoring.py                Defence Rating rubric (pure functions) — NOT wired to compute yet
frontend/src/
  api/client.ts             all API calls + types (NormalisedVendor, OnboardingState, portal fns, verifyVendor/createPortalProduct/updatePortalProduct/addPortalEvidence/uploadEvidenceFile/guardMappingStep)
  pages/OnboardingPage.tsx  THE big one — multi-product onboarding flow (see §6)
  pages/MarketplacePage / ProductDetailPage / VendorsPage / VendorProfilePage / PricingPage / HomePage
  components/ProductCard, VendorCard, Layout, Footer, ui.tsx (CompanyLogo, StarRating, badges, etc.)
  lib/display.ts            pseudo ratings/aps/deployment tags, thumbGradient
  index.css                 light off-white theme tokens (@theme), buttons, base typography in @layer base
  public/attacked-mark.svg  dark shield logo (transparent); attacked-logo.svg (black-box variant)
docs/defense-rating-methodology.md   current scoring documentation
```

---

## 5. Database schema (local Postgres)
**Marketplace (seeded from Excel):**
- `incidents`(id,name,…) · `vendors`(id,name,entity_type,hq,domain,website,logo_url,status)
- `products`(id,vendor_id,incident_id,name,what_they_do,product_url,vendor_group,role,primary_mc,covers_controls[],ai_verdict,confidence,fit,how_it_mitigates,known_limits,score_rationale,video_url, **logo_url, product_images[], product_videos[], optional_metadata jsonb, created_at, updated_at**)
- `evidence`(id,vendor_id,incident_id,addresses_control,verified_claim,source_span,source_url) — the original incident evidence (157 rows). **Do not confuse with `product_evidence`.**

**Onboarding / portal (added via migrations.py):**
- `vendor_onboarding`(work_email UNIQUE, company_name, …, evidence jsonb, extra_products jsonb, **extra jsonb**, current_step, status) — draft autosave/resume by email
- `product_evidence`(evidence_id UUID, product_id, vendor_id, type, title, description, file_url, source_type, issuer, issued_date, trust_tier, verified, verified_at/by, created_at) — **immutable once verified** (DB trigger `trg_product_evidence_guard`)
- `defense_ratings`(product_id PK, defense_rating default 0, breakdown jsonb, evidence_traceability jsonb, updated_at) — **foundation only, never computed**
- `defense_rating_snapshots`(history) · `product_audit_log`(action, detail, actor)

**GUARD framework MIRROR (static, from `db/guard_framework.sql`):**
- `guard_categories`(code PK, label) — 13
- `guard_subcategories`(id, category, code, name) — 227 rows / 76 distinct codes
- `guard_master_controls`(mc_id PK, category, statement) — 85
> Mirrored read-only from the source Supabase GUARD DB (via MCP, by the assistant) and embedded as a static seed. **App never connects to Supabase.**

---

## 6. Onboarding flow (OnboardingPage.tsx) — current state
Steps (constants): `Start(0) → Company(1=CO) → Products(2=PROD) → Media(3=MEDIA) → Evidence(4=EVID) → Guard Mapping(5=GUARD) → Review(6=REVIEW) → Done(7=DONE)`.

- **Multi-product**: add/edit/remove/navigate products via tabs; each product has its own media/evidence/guard mapping.
- **Vendor verification (STRICT)**: Company step calls `POST /api/portal/verify` (by company_name) against existing vendors — onboarding is verification-only, **no vendor creation**. Datalist of existing vendor names provided. On verify, **existing products load** for editing (so editing updates via PATCH, new ones POST).
- **Company certifications**: dynamic list, each entry **requires proof** (file upload OR URL).
- **Products**: name, description, **Category (vendor free-text, mandatory)**, pricing, target market, product_url, key_features/use_cases/benefits/tags (Add-More lists), version, sku. (No GUARD-category dropdown; no deployment field.)
- **Media**: **Logo** (URL **validated** as http(s)/uploads OR **PNG/JPG upload** with **live preview**), product images & videos (Add-More).
- **Evidence (redesigned)**: 3 groups — **Links** (article/news/blog/research/customer_success/case_study), **Customer validation** (review/testimonial/reference_customer), **Supporting documents** (PDF/DOC/XLS/PPT upload). Certifications removed from here (they're company-level).
- **Guard Mapping** (after Evidence): AI conversational MCQ (5–6 questions), then result UI = **Shape + 13-category grid (primary + strength bars) + subcategories + removable adaptive controls** + Accept / Re-evaluate / Override(admin). See §7.
- **Review & Preview**: shows **every field** + full guard mapping, with per-section jump-to-edit buttons.
- **Submit**: verify → for each product create (POST) or update (PATCH) → add evidence → defense_ratings auto-initialised. New products **surface first** in marketplace (ordered by `created_at DESC`).
- **EVERY STEP IS MANDATORY**: `validate(target)` gates each step (company fields + certs proof; each product needs name/description/category; each needs ≥1 media incl. valid logo; each needs ≥1 evidence; each needs an **accepted** guard mapping). Errors jump `activeIdx` to the offending product.
- **Draft autosave/resume** by work email (`/api/onboarding`), state stored in `extra` jsonb.

---

## 7. AI GUARD Mapping (guard_mapping.py + /api/portal/guard-mapping/step)
- **Stateless**: frontend posts `{product, vendor, answers[]}` each turn; backend returns next MCQ question or the final mapping.
- **Engine**: Gemini primary (reads taxonomy from local `guard_*` tables, never Supabase) → local deterministic fallback on any error.
- **Questions**: 5–6 MCQ, product-specific, GUARD-relevant only.
- **Context sent to AI**: product (name, desc, category, product_url, version, sku, key_features, use_cases, benefits, metadata) + **certifications** + **evidence** + vendor + Q&A transcript + the **GUARD taxonomy** (categories + subcategories + master controls).
- **Output (mapping)**: `shape`, `categories[]`(code,label,primary,strength), `subcategories[]`(category,code,name,confidence), `adaptive_controls[]`(verb,code,label,grounded_in mc_id), `explanation`.
- **Rules**: AI selects real category/subcategory codes from the taxonomy; **generates short adaptive-control labels grounded in master controls**; **master controls (mc_id/statements) are NEVER exposed** to the vendor.
- **Frontend shows NO score numbers** — confidence rendered as qualitative labels (High/Medium/Low); category strength only drives bar width.

---

## 8. Defence Rating — STATUS = methodology only, not computed
- `scoring.py` has a rubric (dimensions/weights/tier-weights/bands) but is **not wired**.
- `defense_ratings` rows are initialised to 0 on product create.
- **Agreed methodology (HYBRID)** — documented; **next to implement**:
  1. **AI grades evidence** (per item: trust_tier, verified, supports_control) — returns *signals, never a score*.
  2. **Deterministic rubric** computes the number from those signals + the guard mapping (dimensions: control coverage 30%, evidence strength 25%, independent corroboration 15%, demonstrated efficacy 20%, recency 10%) → 0–100 → band.
  3. Guardrails: minimum-to-surface gate, weighted mean (not sum), cap self-attestation, cap cert bump.
  4. Store breakdown + evidence_traceability + snapshot; show Provisional vs Verified.
- See `docs/defense-rating-methodology.md` for the full write-up and the step-by-step hybrid prompt/payload design (also given in chat).
- **Open decisions:** tier crosswalk A–D ↔ E1–E5; who flips `verified` (AI proposes, admin confirms → immutable); recompute on evidence change.

---

## 9. Design rules / conventions (DO NOT BREAK)
- **Brand:** Attacked.ai → gold **#F5B800**, **off-white** page (#F6F4EF), cards white, **Inter** font, near-black text #1C1B19. NOT crimson, NOT dark obsidian (light-mode adaptation per user). Headings moderate weight (no font-extrabold). Logo = `/attacked-mark.svg` + wordmark `Attacked.ai™`.
- **No scoring math on the frontend** (display only).
- **Master controls never exposed** to vendors (only adaptive controls + categories).
- **No Supabase/MCP at runtime** — local Postgres only.
- Tailwind v4: base rules must live in `@layer base` so utilities (mb-*, font-*) override them (this caused a real spacing bug — keep it layered).
- File uploads: `POST /api/portal/upload` (pdf/doc/docx/xls/xlsx/ppt/pptx/png/jpg/jpeg, ≤25MB) → `/uploads/<uuid>`; served by backend StaticFiles, proxied by nginx + vite.

---

## 10. Test data (existing vendor + product)
Verify **`CrowdStrike`** (exact name) in Company step.
- New product: **CrowdStrike Falcon Cloud Security** (CNAPP) — see chat for full field set.
- Existing product (loads on verify): **CrowdStrike Falcon® Insight XDR – Automated Remediation** (id #17) — edit + fill mandatory fields.
- Logo: `https://www.crowdstrike.com/wp-content/uploads/2023/01/crowdstrike-logo.png` or upload a PNG/JPG.
- Any well-formed URL passes validation.

---

## 11. Known issues / notes
- **Gemini free tier rate limits**: firing 5–6 guard-mapping calls in a tight loop can hit 429 → it falls back to local for that turn (graceful). Normal vendor pacing is fine. Could add retry/backoff on 429.
- The earlier Kimi/Moonshot key is removed (account had no balance); Gemini replaced it.
- Security: the source Supabase project has RLS disabled on many tables (flagged to user; not our local DB).
- A "Fill demo data" button for onboarding was offered but not built.

---

## 12. Suggested first message for the new chat
> "Read `HANDOFF.md` and `docs/defense-rating-methodology.md` for full context. The app is running via `docker compose up` (frontend :8080, backend :8000, postgres :5433). Next task: implement the Defence Rating (hybrid: AI grades evidence → deterministic rubric in scoring.py → store in defense_ratings with breakdown/snapshots → surface on product page). Don't break the conventions in §9."
