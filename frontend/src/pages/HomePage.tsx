import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStats, useGuardCategories, useProducts } from '../hooks/useData';
import PageContainer from '../components/PageContainer';
import { CompanyLogo, VerifiedBadge } from '../components/ui';
import {
  Shield,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Award,
  FileCheck2,
  BadgeCheck,
  Building2,
  SearchX,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    title: 'Earned, not bought',
    body: 'Vendors surface because our system determined they are genuinely relevant to what just happened — never because they paid for placement.',
  },
  {
    icon: CheckCircle2,
    title: 'Control mapping',
    body: 'Every product is indexed against 13 GUARD risk categories and mapped to the specific adaptive controls implicated in each live incident.',
  },
  {
    icon: Award,
    title: 'Evidence-tiered rating',
    body: 'A computed, evidence-tiered Defence Rating — E1 audits through E5 claims — that tells buyers exactly how strong a defensive capability really is.',
  },
];

// GUARD taxonomy — 13 categories / sub-categories (static; the public API only
// returns code+label, so the descriptions + subs are embedded for the drilldown).
const GUARD_TAXONOMY: { code: string; name: string; desc: string; subs: string[] }[] = [
  { code: 'CYB', name: 'Cyber Security', desc: 'Cyber attacks, system compromise, threat actors, intrusions.', subs: ['Application Security', 'Cloud Security', 'Cryptography & Key Management', 'Endpoint & Device Security', 'Identity & Access Management', 'Network & Perimeter Security', 'Security Operations & Governance', 'Threat Detection & Response'] },
  { code: 'DAT', name: 'Data & Privacy', desc: 'Data breaches, privacy violations, data governance failures.', subs: ['Data Classification & Handling', 'Data Governance & Stewardship', 'Data Lifecycle & Retention', 'Privacy Rights & Consent', 'Data Quality & Integrity', 'Cross-Border Data Transfer'] },
  { code: 'ENV', name: 'Environmental', desc: 'Climate, emissions, pollution, ESG disclosure, biodiversity.', subs: ['Biodiversity & Nature', 'Climate Physical Risk', 'Climate Transition Risk', 'Emissions & Pollution', 'ESG Reporting', 'Waste Management'] },
  { code: 'FIN', name: 'Financial', desc: 'Liquidity, credit, market, revenue volatility, fraud, AML.', subs: ['Anti-Money Laundering', 'Bribery & Corruption', 'Fraud Prevention', 'Investment & Market Risk', 'Model Risk', 'Pensions & Post-Employment Liabilities', 'Financial Reporting Integrity', 'Sanctions & Trade Finance', 'Tax Compliance', 'Treasury & Liquidity'] },
  { code: 'GEO', name: 'Geopolitical', desc: 'Political instability, sanctions, macro shocks, trade restrictions.', subs: ['Regional Conflict', 'Nation-State Threat', 'Political Instability', 'Sanctions & Export Controls', 'Trade & Tariff Risk'] },
  { code: 'OPS', name: 'Operations', desc: 'Process failures, execution risk, service delivery, capacity.', subs: ['Business Continuity', 'Crisis Management', 'Customer Operations', 'Process Management', 'Product & Service Delivery', 'Quality Management', 'Supply Chain Operations'] },
  { code: 'PHY', name: 'Physical Security', desc: 'Site security, asset protection, executive safety, workplace violence.', subs: ['Site Access Control', 'Critical Asset Protection', 'Executive Protection', 'Physical Surveillance & Monitoring', 'Workplace Violence & Emergency Response'] },
  { code: 'PPL', name: 'People', desc: 'Talent gaps, insider threats, conduct, wellbeing, succession.', subs: ['DEI & Culture', 'Employee Conduct & Ethics', 'Health, Safety & Wellbeing', 'Insider Risk (People-led)', 'Labour Relations', 'Workforce Planning & Talent'] },
  { code: 'REG', name: 'Regulatory', desc: 'Laws, regulations, non-compliance, legal exposure, enforcement.', subs: ['Antitrust & Competition Law', 'Regulatory Change Management', 'Enforcement & Investigation', 'Licensing & Authorisations', 'Regulatory Reporting', 'Cross-Border Regulatory Arbitrage'] },
  { code: 'REP', name: 'Reputation', desc: 'Brand damage, public perception, media impact, trust erosion.', subs: ['Brand & Media Management', 'Crisis Communications', 'Customer Trust & Experience', 'Executive Reputation', 'Social Media & Digital Presence', 'Stakeholder Communications'] },
  { code: 'STR', name: 'Strategic', desc: 'Market shifts, competition, business model disruption.', subs: ['Risk Appetite & Governance', 'Competitive & Market Risk', 'Innovation & Disruption Risk', 'Intellectual Property Strategy', 'M&A Risk', 'Strategic Planning Risk', 'Enterprise Portfolio Risk'] },
  { code: 'TEC', name: 'Technology', desc: 'System failures, IT complexity, AI/model risk, technology obsolescence.', subs: ['AI & Emerging Tech', 'Capacity & Scalability', 'Change & Release Management', 'Infrastructure Resilience', 'IT Asset Management', 'Legacy & Technical Debt', 'Platform Engineering', 'Service Availability & Performance'] },
  { code: 'TPR', name: 'Third Party', desc: 'Vendor failures, outsourcing risk, supply chain disruption.', subs: ['Fourth-Party & Supply Chain Software', 'Concentration & Single-Source', 'Contractual Risk', 'Vendor Due Diligence', 'Vendor Offboarding & Exit', 'Vendor Onboarding'] },
];

// Live-incident ticker — sample data (wired to the incident DB in production).
const HERO_INCIDENTS: { sev: 'c' | 'h' | 'm'; code: string; vector: string; ready: string }[] = [
  { sev: 'c', code: 'CYB', vector: 'Credential-stuffing surge on patient portals', ready: '4 vendors ready →' },
  { sev: 'h', code: 'GEO', vector: 'Fresh export controls hit semiconductor supply', ready: '3 advisors ready →' },
  { sev: 'c', code: 'TPR', vector: 'Tier-1 logistics provider breached', ready: '6 vendors ready →' },
  { sev: 'h', code: 'ENV', vector: 'Flooding disrupts coastal manufacturing sites', ready: '2 advisors ready →' },
  { sev: 'm', code: 'REG', vector: 'New AI disclosure rule enters into force', ready: '5 advisors ready →' },
  { sev: 'h', code: 'PHY', vector: 'Site-access breach at a critical data centre', ready: '3 vendors ready →' },
  { sev: 'c', code: 'DAT', vector: 'Public storage bucket exposes customer records', ready: '7 vendors ready →' },
];

const HERO_PROMPTS = [
  'Search by category, control, vendor, or incident…',
  'who closes the control that just failed?',
  'geopolitical exposure across the supply chain',
  'physical security at critical sites',
  'climate & environmental risk advisors',
  'AML & sanctions screening',
  'third-party / vendor due diligence',
  'ransomware containment, fast',
];

// ── Hero — event-driven marketplace (ported design, exact text + animations) ──
function HeroSection() {
  const { data: stats } = useStats();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState(HERO_PROMPTS[0]);
  const [fade, setFade] = useState(false);

  // Cycling placeholder — pauses while the field is focused or has text.
  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      const el = inputRef.current;
      if (!el || document.activeElement === el || el.value) return;
      setFade(true);
      window.setTimeout(() => {
        i = (i + 1) % HERO_PROMPTS.length;
        setPlaceholder(HERO_PROMPTS[i]);
        setFade(false);
      }, 220);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  const activeCat = active ? GUARD_TAXONOMY.find((c) => c.code === active) : null;
  const submitSearch = () => navigate('/marketplace');

  const vendors = stats?.vendor_count ?? 46;
  const products = stats?.product_count ?? 57;
  const incidents = stats?.incident_count ?? 10;
  const evidence = stats?.evidence_count ?? 157;

  return (
    <header className="home-hero">
      <div className="hero-inner">
        <div className="live-pill">
          <span className="live-dot" />
          {incidents} incidents live now
          <span className="sep">·</span>
          <span className="stamp">refreshed 2 min ago</span>
        </div>

        <h1>
          When an incident hits,
          <span className="accent">find who can respond.</span>
        </h1>

        <p className="subhead">
          The event-driven marketplace for <strong>enterprise risk — not just cyber</strong>.
          The moment a control fails across any of the 13 GUARD categories — from data and
          geopolitical to physical and environmental — Attacked.ai surfaces the exact{' '}
          <strong>vendors and advisors</strong> proven to close that gap.
        </p>

        <div className="search-wrap">
          <div className="search">
            <span className="glass" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              aria-label="Search vendors, controls, categories or incidents"
              placeholder={placeholder}
              style={{ opacity: fade ? 0.35 : 1, transition: 'opacity 220ms' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch();
              }}
            />
            <button type="button" onClick={submitSearch}>
              <span className="label-full">Search</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="trust">
            <span className="tick">✓</span> Evidence-based
            <span className="dot" /> Never sponsored
            <span className="dot" /> 13 GUARD categories
          </div>
        </div>

        <div className="browse-label">
          Browse by GUARD category — pick one to drill into sub-categories
        </div>
        <div className="chips">
          {GUARD_TAXONOMY.map((c) => (
            <button
              key={c.code}
              type="button"
              className={`chip cat-chip${active === c.code ? ' active' : ''}`}
              onClick={() => setActive(active === c.code ? null : c.code)}
            >
              <span className="chip-code">{c.code}</span>
              {c.name}
            </button>
          ))}
        </div>

        <div className={`drilldown${activeCat ? ' open' : ''}`}>
          {activeCat && (
            <div className="drill-card">
              <div className="drill-head">
                <span className="chip-code lg">{activeCat.code}</span>
                <span className="drill-name">{activeCat.name}</span>
                <span className="drill-desc">{activeCat.desc}</span>
              </div>
              <div className="sub-chips">
                {activeCat.subs.map((s) => (
                  <Link key={s} className="chip sub-chip" to="/marketplace">
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <Link className="browse-link" to="/marketplace">
          or browse all {products} products &amp; services across {vendors} vendors →
        </Link>

        <div className="ticker-section">
          <div className="ticker-head">
            <span className="live-dot" />
            <span>Live incident feed</span>
            <span className="caption">— sample data, wired to the incident DB in production</span>
          </div>
          <div className="ticker">
            <div className="ticker-track">
              {[...HERO_INCIDENTS, ...HERO_INCIDENTS].map((it, i) => (
                <div className="incident" key={i}>
                  <span className={`sev ${it.sev}`} />
                  <span className="chip-code lg">{it.code}</span>
                  <span className="vector">{it.vector}</span>
                  <span className="ready">{it.ready}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="num">{vendors}</span>
            <span className="lbl">Vendors mapped</span>
          </div>
          <div className="stat">
            <span className="num">{products}</span>
            <span className="lbl">Products &amp; services</span>
          </div>
          <div className="stat">
            <span className="num">
              <span className="live-dot" />
              {incidents}
            </span>
            <span className="lbl">Live incidents</span>
          </div>
          <div className="stat accent">
            <span className="num">{evidence}</span>
            <span className="lbl">Evidence items</span>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Discover section — GUARD categories (left) filter the vendor logos (right) ──
// Clicking a category filters the companies shown; it does NOT navigate away.
function DiscoverSection() {
  const { data: categories, isLoading: catsLoading } = useGuardCategories();
  const { data: productData, isLoading: productsLoading } = useProducts({ page_size: 100 });
  const [active, setActive] = useState(0);
  const touched = useRef(false);

  const cats = categories ?? [];
  const products = productData?.data ?? [];

  // distinct vendors mapped to each GUARD category code
  const vendorsByCode: Record<string, Map<number | string, (typeof products)[number]>> = {};
  for (const p of products) {
    for (const g of p.guard_categories ?? []) {
      const m = (vendorsByCode[g.code] ??= new Map());
      const key = p.vendor_id ?? p.vendor_name;
      if (!m.has(key)) m.set(key, p);
    }
  }

  // On first load, jump to the most-populated category so the grid isn't empty.
  useEffect(() => {
    if (touched.current || !cats.length || !products.length) return;
    let best = 0;
    let bestN = -1;
    cats.forEach((c, i) => {
      const n = vendorsByCode[c.code]?.size ?? 0;
      if (n > bestN) {
        bestN = n;
        best = i;
      }
    });
    setActive(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.length, products.length]);

  const activeCat = cats[active];
  const activeVendors = activeCat
    ? Array.from(vendorsByCode[activeCat.code]?.values() ?? []).slice(0, 12)
    : [];

  return (
    <PageContainer className="py-20">
      <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
            <Shield className="h-3.5 w-3.5 text-accent-yellow" />
            Discover the Defence Layer
          </span>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Browse by risk category, backed by trusted vendors
          </h2>
        </div>
        <Link
          to="/vendors"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-yellow transition-colors hover:text-accent-yellow-hover"
        >
          See all vendors
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-12">
        {/* ── Left: 13 GUARD categories (filter buttons) ── */}
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
              GUARD Risk Categories
            </h3>
            <span className="text-xs font-semibold text-text-muted">
              {cats.length || 13} total
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {catsLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 w-full rounded-xl" />
                ))
              : cats.map((cat, i) => {
                  const count = vendorsByCode[cat.code]?.size ?? 0;
                  const isActive = active === i;
                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => {
                        touched.current = true;
                        setActive(i);
                      }}
                      className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'border-accent-yellow bg-accent-soft shadow-[0_2px_10px_rgba(245,184,0,0.18)]'
                          : 'border-bg-border bg-bg-surface hover:border-accent-yellow/50'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors ${
                            isActive
                              ? 'border-accent-yellow/50 bg-white text-[#7A5B00]'
                              : 'border-bg-border bg-bg-elevated text-accent-yellow'
                          }`}
                        >
                          {cat.code}
                        </span>
                        <span className="block min-w-0 truncate text-sm font-semibold text-text-primary">
                          {cat.label}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                          isActive
                            ? 'bg-accent-yellow text-[#1C1B19]'
                            : 'bg-bg-elevated text-text-muted'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
          </div>
        </div>

        {/* ── Right: vendor logos for the selected category ── */}
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
              {activeCat ? `Vendors in ${activeCat.label}` : 'Trusted Vendors'}
            </h3>
            <Link
              to="/marketplace"
              className="text-xs font-semibold text-accent-yellow transition-colors hover:text-accent-yellow-hover"
            >
              Explore marketplace →
            </Link>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="skeleton h-[148px] w-full rounded-2xl" />
              ))}
            </div>
          ) : activeVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-bg-border bg-bg-surface px-6 py-16 text-center">
              <SearchX className="h-7 w-7 text-text-muted" />
              <p className="text-sm text-text-secondary">
                No vendors are mapped to this category yet.
              </p>
              <Link
                to="/onboarding"
                className="text-sm font-semibold text-accent-yellow hover:text-accent-yellow-hover"
              >
                List a product →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {activeVendors.map((p) => (
                <Link
                  key={p.vendor_id ?? p.vendor_name}
                  to={`/vendors/${p.vendor_id}`}
                  className="group flex flex-col rounded-2xl border border-bg-border bg-bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-yellow/60 hover:shadow-[0_14px_36px_rgba(28,27,25,0.10)]"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent-yellow">
                      {p.vendor_name}
                    </h4>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mb-4 flex items-center gap-1.5 text-xs text-text-muted">
                    {p.verified && <VerifiedBadge />}
                    <span className="truncate">{p.product_name}</span>
                  </div>
                  <div className="mt-auto flex items-end justify-center pt-2">
                    <CompanyLogo
                      name={p.vendor_name}
                      logo={p.vendor_logo}
                      domain={p.vendor_domain}
                      size={56}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

// ── Evidence section — verified-evidence cards (left) + copy/CTA (right) ──
// Our brand equivalent of "leave a review": trust comes from tiered, verified
// evidence, not star ratings.
function EvidenceSection() {
  return (
    <PageContainer className="py-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left: overlapping evidence-card mockup */}
        <div className="relative mx-auto h-[360px] w-full max-w-md">
          {/* back card */}
          <div className="surface-card absolute left-0 top-0 w-[80%] p-5 opacity-90">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-bg-border bg-bg-elevated">
                  <Building2 className="h-4 w-4 text-text-muted" />
                </span>
                <div>
                  <div className="text-xs font-semibold text-text-primary">Acme Bank</div>
                  <div className="text-[10px] text-text-muted">Named customer deployment</div>
                </div>
              </div>
              <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-bold text-[#7A5B00]">
                E2
              </span>
            </div>
            <div className="text-sm font-semibold text-text-primary">Production rollout, 18 months</div>
          </div>

          {/* mid card */}
          <div className="surface-card absolute right-0 top-16 w-[82%] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-yellow/30 bg-accent-soft">
                  <FileCheck2 className="h-4 w-4 text-accent-yellow" />
                </span>
                <div>
                  <div className="text-xs font-semibold text-text-primary">SOC 2 Type II</div>
                  <div className="text-[10px] text-text-muted">Independent audit</div>
                </div>
              </div>
              <span className="rounded-md bg-accent-yellow px-2 py-0.5 font-mono text-[10px] font-bold text-[#1C1B19]">
                E1
              </span>
            </div>
            <div className="mb-2 text-sm font-semibold text-text-primary">
              Controls verified by third party
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-status-green">
              <BadgeCheck className="h-4 w-4" /> Admin-verified
            </div>
          </div>

          {/* front card — defence rating */}
          <div className="surface-card absolute bottom-0 left-6 w-[72%] p-5 shadow-[0_18px_44px_rgba(28,27,25,0.14)]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Defence Rating
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold tracking-tight text-text-primary">82</span>
              <span className="mb-1 rounded-md bg-status-green/10 px-2 py-0.5 text-[11px] font-bold text-status-green">
                Proven
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-border">
              <div className="h-full rounded-full bg-accent-yellow" style={{ width: '82%' }} />
            </div>
          </div>
        </div>

        {/* Right: copy + CTA */}
        <div>
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Every claim, <span className="text-accent-yellow">backed by evidence.</span>
          </h2>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-text-secondary">
            We don't run on star ratings. Each product earns a Defence Rating from tiered,
            admin-verified evidence — independent audits, named customer deployments and analyst
            recognition — so buyers see exactly how strong a capability really is.
          </p>
          <Link to="/marketplace" className="btn btn-primary btn-lg group">
            Explore the Marketplace
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

// ── Claim section — copy/CTA (left) + onboarding form mockup (right) ──
function ClaimSection() {
  return (
    <PageContainer className="py-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left: copy + CTA */}
        <div>
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            There's an Attacked.ai profile with{' '}
            <span className="text-accent-yellow">your name on it.</span>
          </h2>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-text-secondary">
            Claim your product, map your coverage against the 13 GUARD categories, and surface to
            enterprises the moment an incident makes you relevant — free during the founding phase.
          </p>
          <Link to="/onboarding" className="btn btn-primary btn-lg group">
            Claim Your Product
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Right: onboarding form mockup */}
        <div className="relative mx-auto w-full max-w-md">
          <div
            className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl"
            style={{
              background:
                'radial-gradient(60% 60% at 70% 20%, rgba(245,184,0,0.18) 0%, transparent 70%)',
            }}
          />
          <div className="surface-card p-6 shadow-[0_18px_44px_rgba(28,27,25,0.12)]">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent-yellow" />
              <h3 className="text-base font-semibold text-text-primary">
                Add your product to Attacked.ai
              </h3>
            </div>
            <p className="mb-5 text-sm text-text-muted">
              A few details and our AI maps you to the GUARD framework.
            </p>

            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold text-text-secondary">
                What are you listing?
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2.5 rounded-lg border border-accent-yellow bg-accent-soft px-3 py-2.5 text-sm font-medium text-text-primary">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-accent-yellow">
                    <span className="h-2 w-2 rounded-full bg-accent-yellow" />
                  </span>
                  Security product
                </label>
                <label className="flex items-center gap-2.5 rounded-lg border border-bg-border bg-bg-surface px-3 py-2.5 text-sm text-text-secondary">
                  <span className="h-4 w-4 rounded-full border-2 border-bg-border" />
                  Managed service
                </label>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold text-text-secondary">
                Is it generally available?
              </div>
              <div className="flex gap-2">
                <span className="flex items-center gap-2 rounded-lg border border-accent-yellow bg-accent-soft px-3 py-2 text-sm font-medium text-text-primary">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-accent-yellow">
                    <span className="h-2 w-2 rounded-full bg-accent-yellow" />
                  </span>
                  GA
                </span>
                <span className="flex items-center gap-2 rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm text-text-secondary">
                  <span className="h-4 w-4 rounded-full border-2 border-bg-border" />
                  Beta
                </span>
              </div>
            </div>

            <div className="btn btn-primary w-full justify-center">Continue</div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default function HomePage() {
  return (
    <div className="w-full bg-white">
      {/* ── Hero ── */}
      <HeroSection />

      {/* ── Features ── */}
      <PageContainer className="py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="surface-card flex flex-col p-7 text-left"
            >
              <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-accent-yellow/30 bg-accent-soft">
                <Icon className="h-5 w-5 text-accent-yellow" />
              </span>
              <h3 className="mb-3 text-lg font-semibold text-text-primary">{title}</h3>
              <p className="text-[15px] leading-relaxed text-text-secondary">{body}</p>
            </div>
          ))}
        </div>
      </PageContainer>

      {/* ── Discover: GUARD categories + vendor logos ── */}
      <div className="border-y border-bg-border bg-bg-elevated">
        <DiscoverSection />
      </div>

      {/* ── Evidence-backed trust ── */}
      <EvidenceSection />

      {/* ── Claim your profile ── */}
      <div className="border-t border-bg-border bg-bg-elevated">
        <ClaimSection />
      </div>
    </div>
  );
}
