# Defence Rating — Methodology (Current State)

> **Status:** documentation only. No scoring logic is changed by this document.
> It is intended for team review **before** any changes to the rating engine.
>
> Source of truth: `backend/app/scoring.py` (pure functions, no DB, no AI).

---

## 1. Overview

A **Defence Rating** is a 0–100 score that expresses how strong a product's
defensive capability is, judged from **evidence** and **control coverage** —
never from how much a vendor paid.

Two foundational rules are baked into the code:

1. **AI never returns a score.** Models may *classify* (map a product to GUARD
   categories/controls), but the numeric rating is produced **only** by
   `scoring.py`.
2. **Paid tier never affects the rating.** Bronze/Silver/Gold placement is
   cosmetic and is excluded from the calculation.

---

## 2. Where ratings currently come from (3 distinct sources)

There are presently **three** notions of "rating" in the codebase. This overlap
is the single biggest thing the team should resolve.

| # | Source | Where | Used for | Computed by |
|---|--------|-------|----------|-------------|
| A | `products.ai_verdict` (52–91) | seeded from the vendor enrichment Excel | the score shown on cards & product/vendor pages (`score_band` derived via `get_score_band`) | **pre-computed offline** (in the spreadsheet) |
| B | `compute_defence_rating()` | `scoring.py` | the canonical rubric (pure function) | live, but **not currently wired to any endpoint** |
| C | `defense_ratings` table | `migrations.py` / `portal.py` | the new per-product foundation (`defense_rating`, `breakdown`, `evidence_traceability`) | **not computed** — initialised to `0` |

> ⚠️ **Area needing review:** the UI displays **(A)** `ai_verdict`, the rubric
> **(B)** is dormant, and the new structured store **(C)** is empty/zero. These
> must be reconciled before "real" scoring goes live (see §7).

---

## 3. Inputs

### 3.1 Evidence tiers (rubric — `scoring.py`)

`TIER_WEIGHTS` — credit factor per evidence tier:

| Tier | Meaning | Weight |
|------|---------|--------|
| E1 | Independent audit / certification / red-team | **1.00** |
| E2 | Named customer deployment | **0.85** |
| E3 | Analyst recognition | **0.70** |
| E4 | Vendor self-attestation | **0.50** |
| E5 | Marketing claim | **0.20** |

Each evidence item also carries a `verified` boolean.

> ⚠️ **Mismatch:** the live `product_evidence` table uses a **A/B/C/D** trust
> tier, while the rubric uses **E1–E5**. A crosswalk (e.g. A→E1, B→E2/E3,
> C→E4, D→E5) is required before evidence can feed the rubric.

### 3.2 Control coverage

- `adaptive_controls` — list of controls a product addresses (e.g. `AC-CYB-014`).
- `guard_categories` — the GUARD categories implicated (13 total).

---

## 4. Dimensions, weights & formulas

`compute_defence_rating(evidence_items, adaptive_controls, guard_categories)`
produces five sub-scores (each 0–100), then a weighted sum.

### 4.1 Dimension weights (`DIMENSION_WEIGHTS`)

| Dimension | Weight |
|-----------|--------|
| `control_fit` | **0.30** |
| `evidence_strength` | **0.25** |
| `demonstrated_efficacy` | **0.20** |
| `deployment_maturity` | **0.15** |
| `independent_corroboration` | **0.10** |
| **Total** | **1.00** |

### 4.2 Formulas

**control_fit** (`compute_control_fit`)
```
base            = min(control_count / 15 * 80, 80)     # up to 15 controls → 80 pts
category_bonus  = min(category_count / 13 * 20, 20)    # all 13 GUARD cats → 20 pts
control_fit     = base + category_bonus                # max 100
# returns 0 if there are no controls
```

**evidence_strength** (`compute_evidence_strength`) — weighted mean across items
```
for each item:
    weight   = TIER_WEIGHTS[tier]           # default 0.20 (E5) if unknown
    verified = 1.0 if item.verified else 0.5
    contribution = weight * verified * 100
evidence_strength = mean(contribution)       # 0 if no evidence
```

**demonstrated_efficacy**
```
= min( count(items where tier in {E1,E2}) * 25, 100 )
```

**deployment_maturity**
```
= min( count(items where verified == true) * 20, 100 )
```

**independent_corroboration**
```
= min( count(items where tier == E1) * 50, 100 )
```

### 4.3 Overall

```
overall = round( min( Σ dimension[d] * DIMENSION_WEIGHTS[d], 100 ) )
```

---

## 5. Score bands (`SCORE_BANDS`)

| Range | Label |
|-------|-------|
| 85–100 | Authoritative |
| 70–84 | Proven |
| 60–69 | Eligible |
| 40–59 | Sub-floor |
| 0–39 | Insufficient |

`get_score_band(score)` maps a numeric score to its band.

---

## 6. Minimum-to-surface gate (`can_surface`)

Independent of the numeric score, a product may only surface publicly if **all**
of the following hold (HARD RULE):

1. `what_it_does` / `what_they_do` is present (non-empty).
2. At least **one** adaptive control is mapped.
3. At least **one** evidence item that is **above E5** *and* **verified**.

---

## 7. Areas needing review (before any scoring change)

1. **Reconcile the three rating sources** (§2). Decide whether the canonical
   score is the rubric (B) computing into the store (C), and retire the
   spreadsheet `ai_verdict` (A) — or define how they coexist.
2. **Tier crosswalk** — unify `product_evidence.trust_tier` (A–D) with the
   rubric's E1–E5, or migrate the rubric to A–D.
3. **Evidence taxonomy** — onboarding now collects *links / customer validation /
   supporting documents* (article, news, case_study, testimonial, …). Map each
   evidence `type` to a tier so it can feed `evidence_strength`.
4. **`verified` provenance** — define who/what flips `verified` (currently a
   manual portal action). The rubric leans heavily on it
   (`deployment_maturity`, `demonstrated_efficacy`, the surface gate).
5. **Wire the rubric to an endpoint** — `compute_defence_rating` is currently
   unreferenced; expose it (e.g. `POST /api/portal/products/{id}/defense-rating/compute`)
   that reads `product_evidence` + controls and writes a snapshot into
   `defense_ratings`.
6. **`control_fit` caps** — "15 controls = 80 pts" and "13 categories = 20 pts"
   are arbitrary anchors; validate against the real distribution of controls.
7. **No recency/decay** — evidence age (`issued_date`) is stored but unused.
   Consider decaying older evidence.
8. **Single evidence item can dominate** — one E1 verified item yields
   `independent_corroboration = 50` and `demonstrated_efficacy = 25`; confirm
   this is intended.

---

## 8. Data-model reference (current)

- `products.ai_verdict` — legacy/seeded score shown in the UI today.
- `product_evidence` — normalised evidence (`type`, `trust_tier` A–D, `verified`,
  `source_type`, `file_url`, `issued_date`, …); immutable once verified.
- `defense_ratings` — per-product foundation: `defense_rating` (0),
  `breakdown` JSONB `[{category, score, evidence_ids[]}]`,
  `evidence_traceability` JSONB `[{evidence_id, impact}]`.
- `defense_rating_snapshots` — historical copies for auditability.

_Last updated: documentation pass during the onboarding revamp. No engine code changed._
