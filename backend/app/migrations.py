"""
Idempotent schema migrations for the Vendor Onboarding + Product Evidence +
Defense Rating infrastructure.

Runs on every backend start (see main.lifespan). Each statement is safe to
re-run, so it both upgrades an existing database and provisions a fresh one.
We deliberately ADD/EXTEND only — no existing tables are redesigned.
"""
from .database import execute

# Demo product-video pool (real YouTube IDs) — placeholder media only.
PRODUCT_VIDEO_POOL = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=9bZkp7q19f0",
    "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    "https://www.youtube.com/watch?v=OPf0YbXqDm0",
    "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
    "https://www.youtube.com/watch?v=JGwWNGJdvx8",
    "https://www.youtube.com/watch?v=CevxZvSJLk8",
    "https://www.youtube.com/watch?v=RgKAFK5djSk",
    "https://www.youtube.com/watch?v=L_jWHffIx5E",
    "https://www.youtube.com/watch?v=YQHsXMglC9A",
    "https://www.youtube.com/watch?v=hT_nvWreIhg",
    "https://www.youtube.com/watch?v=09R8_2nJtjg",
]

STATEMENTS: list[str] = [
    # UUID generator for evidence ids (built-in on PG13+, extension is a no-op safety net)
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",

    # ── vendors: lifecycle status (verification-only onboarding) ──
    "ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'",

    # ── onboarding draft state (existing flow) ──
    "ALTER TABLE vendor_onboarding ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'::jsonb",

    # ── products: enhancement module fields ──
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS logo_url TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS product_images TEXT[] DEFAULT '{}'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS product_videos TEXT[] DEFAULT '{}'",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS optional_metadata JSONB DEFAULT '{}'::jsonb",
    # ── products: listing type (product | service | hybrid) ──
    # Promoted from optional_metadata.listing_type into a real column so the
    # marketplace/vendor profile can filter products vs services in SQL. The
    # backfill syncs existing rows from the JSON value they already carry.
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'product'",
    "UPDATE products SET listing_type = optional_metadata->>'listing_type' "
    "WHERE optional_metadata->>'listing_type' IN ('product','service','hybrid') "
    "AND listing_type IS DISTINCT FROM optional_metadata->>'listing_type'",
    "CREATE INDEX IF NOT EXISTS idx_products_listing_type ON products(listing_type)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",

    # ── products: admin review workflow ──
    # Existing/seeded products default to 'approved' so they stay live; new vendor
    # submissions are set to 'pending' by the onboarding endpoints.
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'approved'",
    # Claim/verification badge: products start UNVERIFIED ('claim this product'),
    # and become verified once a vendor claims them and an admin approves.
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS review_note TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS submitter_email TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewed_by TEXT",
    "CREATE INDEX IF NOT EXISTS idx_products_review_status ON products(review_status)",

    # ── product_evidence (NEW) ──
    # NOTE: named product_evidence (not "evidence") to avoid colliding with the
    # existing seed `evidence` table that holds incident-derived evidence.
    """
    CREATE TABLE IF NOT EXISTS product_evidence (
      evidence_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      vendor_id    INT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      type         TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT,
      file_url     TEXT,
      source_type  TEXT NOT NULL DEFAULT 'text',   -- upload | link | text
      issuer       TEXT,
      issued_date  DATE,
      trust_tier   TEXT NOT NULL DEFAULT 'D',       -- A | B | C | D
      verified     BOOLEAN NOT NULL DEFAULT false,
      verified_at  TIMESTAMPTZ,
      verified_by  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_pevidence_product ON product_evidence(product_id)",
    "CREATE INDEX IF NOT EXISTS idx_pevidence_vendor ON product_evidence(vendor_id)",

    # AI grading signals (Step 2c) — written by the scoring engine, advisory only.
    "ALTER TABLE product_evidence ADD COLUMN IF NOT EXISTS ai_tier TEXT",
    "ALTER TABLE product_evidence ADD COLUMN IF NOT EXISTS ai_verified BOOLEAN",
    "ALTER TABLE product_evidence ADD COLUMN IF NOT EXISTS supports_control TEXT",
    "ALTER TABLE product_evidence ADD COLUMN IF NOT EXISTS independent BOOLEAN",
    "ALTER TABLE product_evidence ADD COLUMN IF NOT EXISTS ai_reason TEXT",

    # Immutability: once verified, the CLAIM is frozen (title/description/file/
    # type/tier/dates) and the row cannot be deleted or un-verified. Advisory AI
    # signal columns (ai_*, supports_control, independent) may still be refreshed.
    """
    CREATE OR REPLACE FUNCTION product_evidence_guard() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        IF OLD.verified THEN
          RAISE EXCEPTION 'verified evidence is immutable (evidence_id=%)', OLD.evidence_id;
        END IF;
        RETURN OLD;
      END IF;
      IF OLD.verified AND (
           NEW.title       IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.file_url    IS DISTINCT FROM OLD.file_url
        OR NEW.type        IS DISTINCT FROM OLD.type
        OR NEW.trust_tier  IS DISTINCT FROM OLD.trust_tier
        OR NEW.source_type IS DISTINCT FROM OLD.source_type
        OR NEW.issuer      IS DISTINCT FROM OLD.issuer
        OR NEW.issued_date IS DISTINCT FROM OLD.issued_date
        OR NEW.verified    IS DISTINCT FROM OLD.verified
      ) THEN
        RAISE EXCEPTION 'verified evidence is immutable (evidence_id=%)', OLD.evidence_id;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_product_evidence_guard ON product_evidence",
    """
    CREATE TRIGGER trg_product_evidence_guard
      BEFORE UPDATE OR DELETE ON product_evidence
      FOR EACH ROW EXECUTE FUNCTION product_evidence_guard()
    """,

    # ── defense_ratings (NEW) — foundation only, never computed here ──
    """
    CREATE TABLE IF NOT EXISTS defense_ratings (
      product_id            INT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
      defense_rating        INT NOT NULL DEFAULT 0,
      breakdown             JSONB NOT NULL DEFAULT '[]'::jsonb,
      evidence_traceability JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    # Hybrid-rating columns (added incrementally — engine writes these on compute).
    "ALTER TABLE defense_ratings ADD COLUMN IF NOT EXISTS score_band TEXT",
    "ALTER TABLE defense_ratings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'provisional'",
    "ALTER TABLE defense_ratings ADD COLUMN IF NOT EXISTS per_dimension JSONB DEFAULT '{}'::jsonb",
    "ALTER TABLE defense_ratings ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb",
    "ALTER TABLE defense_ratings ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ",

    # ── historical score snapshots (NEW) ──
    """
    CREATE TABLE IF NOT EXISTS defense_rating_snapshots (
      id                    BIGSERIAL PRIMARY KEY,
      product_id            INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      defense_rating        INT NOT NULL DEFAULT 0,
      breakdown             JSONB NOT NULL DEFAULT '[]'::jsonb,
      evidence_traceability JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "ALTER TABLE defense_rating_snapshots ADD COLUMN IF NOT EXISTS score_band TEXT",
    "ALTER TABLE defense_rating_snapshots ADD COLUMN IF NOT EXISTS status TEXT",
    "ALTER TABLE defense_rating_snapshots ADD COLUMN IF NOT EXISTS per_dimension JSONB DEFAULT '{}'::jsonb",
    "CREATE INDEX IF NOT EXISTS idx_rating_snap_product ON defense_rating_snapshots(product_id)",

    # ── full audit trail (NEW) ──
    """
    CREATE TABLE IF NOT EXISTS product_audit_log (
      id          BIGSERIAL PRIMARY KEY,
      product_id  INT,
      vendor_id   INT,
      action      TEXT NOT NULL,
      detail      JSONB DEFAULT '{}'::jsonb,
      actor       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_audit_product ON product_audit_log(product_id)",

    # ── admin notification log (vendor emails) ──
    """
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id          BIGSERIAL PRIMARY KEY,
      product_id  INT,
      vendor_id   INT,
      to_email    TEXT,
      kind        TEXT NOT NULL,                 -- received | approved | rejected | needs_info
      subject     TEXT,
      body        TEXT,
      status      TEXT NOT NULL DEFAULT 'queued', -- sent | queued | failed
      error       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_notif_product ON admin_notifications(product_id)",

    # ── user accounts (NEW) — email+password auth for vendors & buyers ──
    # Self-contained: password_hash is pbkdf2_sha256 (stdlib), tokens are HMAC-
    # signed (see auth.py). vendor_id links a vendor account to its vendors row
    # (best-effort, set when the company name matches an existing vendor).
    """
    CREATE TABLE IF NOT EXISTS users (
      id            BIGSERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT,
      role          TEXT NOT NULL DEFAULT 'buyer',   -- buyer | vendor
      company_name  TEXT,
      vendor_id     INT REFERENCES vendors(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login_at TIMESTAMPTZ
    )
    """,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email))",
    # Social-login provider ('google' | 'microsoft'); NULL for password accounts.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT",
]


def run_migrations() -> None:
    for stmt in STATEMENTS:
        execute(stmt)
    _seed_product_videos()


def _seed_product_videos() -> None:
    """Backfill demo video URLs for products that don't have one yet."""
    arr = "ARRAY[" + ",".join("'" + u + "'" for u in PRODUCT_VIDEO_POOL) + "]"
    execute(
        f"UPDATE products SET video_url = ({arr})[mod(id, {len(PRODUCT_VIDEO_POOL)}) + 1] "
        "WHERE video_url IS NULL"
    )
