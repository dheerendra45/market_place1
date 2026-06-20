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
  UserPlus,
  Workflow,
  Zap,
  Star,
  AlertTriangle,
  Quote,
  ChevronDown,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    title: 'Earned, not bought',
    body: 'Vendors surface because our system determined they are genuinely relevant to what just happened, never because they paid for placement.',
  },
  {
    icon: CheckCircle2,
    title: 'Control mapping',
    body: 'Every product is indexed against 13 GUARD risk categories and mapped to the specific adaptive controls implicated in each live incident.',
  },
  {
    icon: Award,
    title: 'Evidence-tiered rating',
    body: 'A computed, evidence-tiered Defence Rating, from E1 audits to E5 claims, that tells buyers exactly how strong a defensive capability really is.',
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

// Hero headline, typed out on load (line 1 black, line 2 gold).
const HERO_LINE1 = 'When an incident hits,';
const HERO_LINE2 = 'find who can respond.';

// ── Hero — event-driven marketplace (ported design, exact text + animations) ──
function HeroSection() {
  const { data: stats } = useStats();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholder, setPlaceholder] = useState(HERO_PROMPTS[0]);
  const [fade, setFade] = useState(false);
  const [typed, setTyped] = useState(0);

  // Typewriter for the headline — types line 1 then line 2. Skips for users
  // who prefer reduced motion.
  useEffect(() => {
    const total = HERO_LINE1.length + HERO_LINE2.length;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setTyped(total);
      return;
    }
    if (typed >= total) return;
    const id = window.setTimeout(
      () => setTyped((t) => t + 1),
      typed < HERO_LINE1.length ? 48 : 52,
    );
    return () => window.clearTimeout(id);
  }, [typed]);

  const t1 = HERO_LINE1.slice(0, Math.min(typed, HERO_LINE1.length));
  const t2 = typed > HERO_LINE1.length ? HERO_LINE2.slice(0, typed - HERO_LINE1.length) : '';
  const typingDone = typed >= HERO_LINE1.length + HERO_LINE2.length;
  const caretOnLine1 = typed < HERO_LINE1.length;

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

        <h1 aria-label={`${HERO_LINE1} ${HERO_LINE2}`}>
          <span aria-hidden="true">
            {t1}
            {caretOnLine1 && !typingDone && <span className="type-caret" />}
          </span>
          <span className="accent" aria-hidden="true">
            {t2 || ' '}
            {!caretOnLine1 && !typingDone && <span className="type-caret" />}
          </span>
        </h1>

        <p className="subhead">
          The event-driven marketplace for <strong>enterprise risk, not just cyber</strong>.
          The moment a control fails across any of the 13 GUARD categories, from data and
          geopolitical to physical and environmental, Attacked.ai surfaces the exact{' '}
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

        <Link className="browse-link" to="/marketplace">
          or browse all {products} products &amp; services across {vendors} vendors →
        </Link>

        <div className="ticker-section">
          <div className="ticker-head">
            <span className="live-dot" />
            <span>Live incident feed</span>
            <span className="caption">sample data, wired to the incident DB in production</span>
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

        <div className="stats-block">
          <div className="stats-head">
            <span className="stats-eyebrow">Coverage at a glance</span>
            <h2 className="stats-title">The Defence Layer, in numbers</h2>
          </div>
          <div className="stats">
            <div className="stat">
              <span className="stat-ico">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="num">{vendors}</span>
              <span className="lbl">Vendors mapped</span>
            </div>
            <div className="stat">
              <span className="stat-ico">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="num">{products}</span>
              <span className="lbl">Products &amp; services</span>
            </div>
            <div className="stat">
              <span className="stat-ico">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <span className="num">{incidents}</span>
              <span className="lbl">Live incidents</span>
            </div>
            <div className="stat accent">
              <span className="stat-ico">
                <FileCheck2 className="h-5 w-5" />
              </span>
              <span className="num">{evidence}</span>
              <span className="lbl">Evidence items</span>
            </div>
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
          <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-yellow/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent-yellow">
            <Shield className="h-3.5 w-3.5 text-accent-yellow" />
            Discover the Defence Layer
          </span>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
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
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/50">
              GUARD Risk Categories
            </h3>
            <span className="text-xs font-semibold text-white/40">
              {cats.length || 13} total
            </span>
          </div>

          <div className="guard-rail flex max-h-[560px] flex-col gap-1.5 overflow-y-auto pr-1.5">
            {catsLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 w-full rounded-xl" />
                ))
              : cats.map((cat, i) => {
                  const count = vendorsByCode[cat.code]?.size ?? 0;
                  const isActive = active === i;
                  const desc = GUARD_TAXONOMY.find((g) => g.code === cat.code)?.desc;
                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onMouseEnter={() => {
                        touched.current = true;
                        setActive(i);
                      }}
                      onClick={() => {
                        touched.current = true;
                        setActive(i);
                      }}
                      className={`group relative flex shrink-0 flex-col gap-2 overflow-hidden rounded-xl border py-3 pl-5 pr-3 text-left transition-all duration-200 ${
                        isActive
                          ? 'border-accent-yellow bg-gradient-to-r from-accent-soft to-white shadow-[0_4px_16px_rgba(245,184,0,0.20)]'
                          : 'border-bg-border bg-bg-surface hover:border-accent-yellow/50'
                      }`}
                    >
                      {/* left accent bar */}
                      <span
                        className={`absolute inset-y-0 left-0 w-1 bg-accent-yellow transition-opacity duration-200 ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                        }`}
                      />
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-all duration-200 ${
                              isActive
                                ? 'bg-accent-yellow text-[#1C1B19] shadow-sm'
                                : 'border border-bg-border bg-bg-elevated text-accent-yellow group-hover:border-accent-yellow/40'
                            }`}
                          >
                            {cat.code}
                          </span>
                          <span className="block min-w-0 truncate text-sm font-semibold text-text-primary">
                            {cat.label}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors ${
                              isActive
                                ? 'bg-[#1C1B19] text-white'
                                : 'bg-bg-elevated text-text-muted group-hover:text-text-secondary'
                            }`}
                          >
                            {count}
                          </span>
                          <ArrowRight
                            className={`h-4 w-4 transition-all duration-200 ${
                              isActive
                                ? 'translate-x-0 text-accent-yellow opacity-100'
                                : '-translate-x-2 text-text-muted opacity-0 group-hover:translate-x-0 group-hover:opacity-70'
                            }`}
                          />
                        </span>
                      </span>
                      {/* small description for the active category */}
                      {isActive && desc && (
                        <p className="pl-11 text-xs leading-snug text-text-secondary">{desc}</p>
                      )}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* ── Right: vendor logos for the selected category ── */}
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white/50">
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
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Every claim, <span className="text-accent-yellow">backed by evidence.</span>
          </h2>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-white/65">
            We don't run on star ratings. Each product earns a Defence Rating from tiered,
            admin-verified evidence: independent audits, named customer deployments and analyst
            recognition, so buyers see exactly how strong a capability really is.
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
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            There's an Attacked.ai profile with{' '}
            <span className="text-accent-yellow">your name on it.</span>
          </h2>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-white/70">
            Claim your product, map your coverage against the 13 GUARD categories, and surface to
            enterprises the moment an incident makes you relevant, free during the founding phase.
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

// ── What is GUARD — explainer + 13-category grid + hierarchy ──
function GuardExplainerSection() {
  const subCount = GUARD_TAXONOMY.reduce((n, c) => n + c.subs.length, 0);
  const [active, setActive] = useState(0);
  const cat = GUARD_TAXONOMY[active];
  const N = GUARD_TAXONOMY.length;
  const flow = [
    { kind: 'Category', value: 'CYB · Cyber Security', mono: true },
    { kind: 'Sub-category', value: 'Identity & Access Management' },
    { kind: 'Adaptive control', value: 'Enforce phishing-resistant MFA' },
  ];

  return (
    <PageContainer className="py-20">
      {/* Header */}
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
          The GUARD framework
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          One language for <span className="text-accent-yellow">every enterprise risk</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-text-secondary">
          GUARD is our risk framework: a single taxonomy that organises the entire enterprise risk
          surface into 13 categories that reach far beyond cyber, covering data, geopolitical,
          physical, environmental, people and more. Because every incident and every product is
          indexed the same way, you can see exactly which risk a control addresses and compare
          coverage like for like.
        </p>
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-full border border-white/10 bg-[#1C1B19] px-5 py-2.5 text-sm font-semibold text-white/70">
          <span><span className="text-accent-yellow">13</span> categories</span>
          <span className="h-3 w-px bg-white/15" />
          <span><span className="text-accent-yellow">{subCount}</span> sub-categories</span>
          <span className="h-3 w-px bg-white/15" />
          <span>evidence-mapped controls</span>
        </div>
      </div>

      {/* Hierarchy flow */}
      <div className="mb-14">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          {flow.map((step, i) => (
            <div key={step.kind} className="contents">
              <div className="flex-1 rounded-2xl border border-white/10 bg-[#1C1B19] p-5 text-center sm:max-w-[230px]">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-yellow/80">
                  {step.kind}
                </div>
                <div
                  className={`text-sm font-semibold ${step.mono ? 'font-mono text-accent-yellow' : 'text-white'}`}
                >
                  {step.value}
                </div>
              </div>
              {i < flow.length - 1 && (
                <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-accent-yellow sm:rotate-0" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">
          Every product and incident is mapped down to this control level, so coverage is precise,
          comparable, and never hand-wavy.
        </p>
      </div>

      {/* Orbital map — incidents & risks revolve around GUARD */}
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Orbit */}
        <div className="relative mx-auto aspect-square w-full max-w-[460px]">
          {/* rotating dashed rings with orbiting incident/risk dots */}
          <div className="orbit-spin absolute inset-[5%] rounded-full border border-dashed border-accent-yellow/25">
            <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-status-red shadow-[0_0_10px_rgba(220,38,38,0.7)]" />
            <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent-yellow shadow-[0_0_10px_rgba(245,184,0,0.7)]" />
          </div>
          <div className="orbit-spin-rev absolute inset-[23%] rounded-full border border-dashed border-accent-yellow/15">
            <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent-yellow/80" />
          </div>

          {/* spokes */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
            {GUARD_TAXONOMY.map((c, i) => {
              const a = (i / N) * 2 * Math.PI - Math.PI / 2;
              const x = 50 + 44 * Math.cos(a);
              const y = 50 + 44 * Math.sin(a);
              const on = active === i;
              return (
                <line
                  key={c.code}
                  x1="50"
                  y1="50"
                  x2={x}
                  y2={y}
                  stroke={on ? '#F5B800' : '#E6E1D6'}
                  strokeWidth={on ? 0.7 : 0.35}
                />
              );
            })}
          </svg>

          {/* center core */}
          <div className="orbit-core absolute left-1/2 top-1/2 flex h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent-yellow/50 bg-[#1C1B19]">
            <span className="font-mono text-sm font-bold tracking-wide text-accent-yellow sm:text-base">
              GUARD
            </span>
          </div>

          {/* category nodes */}
          {GUARD_TAXONOMY.map((c, i) => {
            const a = (i / N) * 2 * Math.PI - Math.PI / 2;
            const x = 50 + 44 * Math.cos(a);
            const y = 50 + 44 * Math.sin(a);
            const on = active === i;
            return (
              <button
                key={c.code}
                type="button"
                title={c.name}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-all duration-200 ${
                  on
                    ? 'scale-110 border border-accent-yellow bg-accent-yellow text-[#1C1B19] shadow-[0_0_18px_rgba(245,184,0,0.55)]'
                    : 'border border-bg-border bg-white text-accent-yellow hover:border-accent-yellow hover:text-accent-yellow-hover'
                }`}
              >
                {c.code}
              </button>
            );
          })}
        </div>

        {/* active category detail */}
        <div className="rounded-2xl border border-white/10 bg-[#1C1B19] p-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-yellow font-mono text-sm font-bold text-[#1C1B19]">
              {cat.code}
            </span>
            <div>
              <h3 className="text-xl font-bold text-white">{cat.name}</h3>
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-yellow/80">
                {cat.subs.length} sub-categories
              </span>
            </div>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-white/65">{cat.desc}</p>
          <div className="flex flex-wrap gap-2">
            {cat.subs.map((s) => (
              <span
                key={s}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12px] text-white/75"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-white/40">
            Hover a node to explore each GUARD category.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}

// ── Service promotion cards (reference enterprise-intelligence style) ──
const SERVICES: { icon: typeof Zap; badge: string; title: string; body: string }[] = [
  {
    icon: Zap,
    badge: 'Core',
    title: 'Live incident matching',
    body: 'The moment a control fails in a live incident, we surface the vendors with verified evidence of closing that exact gap.',
  },
  {
    icon: ShieldCheck,
    badge: 'Verified',
    title: 'Defence Rating verification',
    body: 'Independent, evidence-tiered scoring from E1 audits to E5 claims, confirmed by our analysts before it counts.',
  },
  {
    icon: FileCheck2,
    badge: 'New',
    title: 'Intelligence briefings',
    body: 'Filing-derived risk intelligence and incident briefings, with every finding mapped to a GUARD category.',
  },
  {
    icon: Building2,
    badge: 'Free',
    title: 'Vendor onboarding',
    body: 'Claim your profile, map your product to GUARD, submit evidence, and publish a verified listing.',
  },
];

function ServicesSection() {
  return (
    <PageContainer className="py-20">
      <div className="mb-10 text-center">
        <span className="mb-2.5 block text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent-yellow">
          What we do
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Services built on the <span className="text-accent-yellow">Defence Layer</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map(({ icon: Icon, badge, title, body }) => (
          <div
            key={title}
            className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-200 hover:border-accent-yellow/60 hover:bg-white/[0.07]"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent-yellow/30 bg-accent-yellow/10">
                <Icon className="h-5 w-5 text-accent-yellow" />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-yellow">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-yellow" />
                {badge}
              </span>
            </div>
            <h3 className="mb-2 text-[15px] font-semibold text-white">{title}</h3>
            <p className="mb-4 flex-1 text-[13px] leading-relaxed text-white/55">{body}</p>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-yellow transition-colors hover:text-accent-yellow-hover"
            >
              Learn more
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

// ── Featured (Sponsored) spotlight — DUMMY placeholder, clearly labelled ──
function FeaturedSpotlightSection() {
  const SPOTLIGHT = {
    name: 'Sentinel Aegis Cloud',
    domain: 'sentinelone.com',
    tagline:
      'Autonomous endpoint and cloud-workload protection with always-on detection and one-click rollback.',
    guard: ['CYB', 'DAT', 'TEC'],
    url: '/marketplace',
  };
  return (
    <PageContainer className="py-20">
      <div className="relative overflow-hidden rounded-3xl border border-accent-yellow/40 bg-gradient-to-br from-accent-soft via-white to-white p-7 shadow-[0_18px_44px_rgba(28,27,25,0.08)] sm:p-9">
        {/* Sponsored flag */}
        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-[#1C1B19] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-yellow">
          Sponsored
        </span>

        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <CompanyLogo name={SPOTLIGHT.name} domain={SPOTLIGHT.domain} size={64} />
            <div className="min-w-0">
              <span className="mb-1 inline-block text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
                Featured partner
              </span>
              <h3 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                {SPOTLIGHT.name}
              </h3>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-text-secondary">
                {SPOTLIGHT.tagline}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SPOTLIGHT.guard.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-bg-border bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-accent-yellow"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Link to={SPOTLIGHT.url} className="btn btn-primary btn-lg group shrink-0">
            Visit vendor
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-6 border-t border-accent-yellow/20 pt-4 text-[11px] text-text-muted">
          Sponsored placement. Paid slots never influence Defence Ratings, evidence verification, or
          marketplace ranking — only earned, evidence-backed results affect those.
        </p>
      </div>
    </PageContainer>
  );
}

// ── Featured vendors — "Verified & mapped" (real logos + GUARD + Defence Rating) ──
// Band tone is display-only (no scoring math on the frontend).
const BAND_TONE: Record<string, string> = {
  Authoritative: 'bg-status-green/10 text-status-green',
  Proven: 'bg-status-green/10 text-status-green',
  Eligible: 'bg-accent-soft text-[#7A5B00]',
  'Sub-floor': 'bg-status-amber/10 text-status-amber',
  Insufficient: 'bg-bg-elevated text-text-muted',
};

function FeaturedVendorsSection() {
  const { data, isLoading } = useProducts({ page_size: 60 });
  const products = data?.data ?? [];

  // One card per vendor — keep the strongest product (verified + highest rating).
  const byVendor = new Map<number | string, { p: (typeof products)[number]; score: number }>();
  for (const p of products) {
    const key = p.vendor_id ?? p.vendor_name;
    const rated = p.defense_rating && p.defense_rating.status !== 'provisional';
    const score = (rated ? p.defense_rating!.rating : p.ai_verdict ?? 0) + (p.verified ? 0.5 : 0);
    const cur = byVendor.get(key);
    if (!cur || score > cur.score) byVendor.set(key, { p, score });
  }
  const featured = [...byVendor.values()].sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.p);

  return (
    <PageContainer className="py-20">
      <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
            Featured vendors
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Verified &amp; <span className="text-accent-yellow">mapped</span>
          </h2>
        </div>
        <Link
          to="/vendors"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-yellow transition-colors hover:text-accent-yellow-hover"
        >
          View all vendors
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[196px] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => {
            const dr = p.defense_rating;
            const rated = dr && dr.status !== 'provisional';
            const ratingVal = rated ? String(dr!.rating) : '—';
            const band = rated ? dr!.band : 'Provisional';
            const subtitle =
              p.optional_metadata?.category || p.guard_categories[0]?.label || 'Security product';
            return (
              <Link
                key={p.vendor_id ?? p.vendor_name}
                to={`/vendors/${p.vendor_id}`}
                className="group flex flex-col rounded-2xl border border-bg-border bg-bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-yellow/60 hover:shadow-[0_14px_36px_rgba(28,27,25,0.10)]"
              >
                {/* header */}
                <div className="mb-4 flex items-start gap-3">
                  <CompanyLogo
                    name={p.vendor_name}
                    logo={p.vendor_logo}
                    domain={p.vendor_domain}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-[15px] font-semibold text-text-primary transition-colors group-hover:text-accent-yellow">
                        {p.vendor_name}
                      </h3>
                      {p.verified && <VerifiedBadge className="shrink-0" />}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-text-muted">{subtitle}</div>
                  </div>
                </div>

                {/* GUARD category chips */}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {p.guard_categories.length > 0 ? (
                    p.guard_categories.slice(0, 4).map((g) => (
                      <span
                        key={g.code}
                        className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 font-mono text-[10px] font-bold text-accent-yellow"
                        title={g.label}
                      >
                        {g.code}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-text-muted">GUARD mapping pending</span>
                  )}
                </div>

                {/* footer: Defence Rating + band */}
                <div className="mt-auto flex items-end justify-between border-t border-bg-border pt-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-accent-yellow">{ratingVal}</span>
                      <span className="text-xs text-text-muted">/100</span>
                    </div>
                    <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Defence Rating
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                      BAND_TONE[band] || 'bg-bg-elevated text-text-muted'
                    }`}
                  >
                    {band}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

// ── Vendor journey — "From claim to verified listing" (4 steps) ──
const JOURNEY: { n: string; icon: typeof UserPlus; title: string; body: string }[] = [
  {
    n: '01',
    icon: UserPlus,
    title: 'Claim your profile',
    body: 'Vendors arrive via outreach or discovery. Claim your company, verify your work email, and start mapping your defensive coverage.',
  },
  {
    n: '02',
    icon: Workflow,
    title: 'Map to GUARD',
    body: 'Our AI maps your product against the 13 GUARD risk categories and the specific adaptive controls it addresses. No arbitrary claims.',
  },
  {
    n: '03',
    icon: ShieldCheck,
    title: 'Get verified',
    body: 'The hybrid Defence Rating engine grades your evidence E1–E5, and our team verifies every submission before it counts.',
  },
  {
    n: '04',
    icon: Zap,
    title: 'Go live',
    body: 'Your verified listing publishes to the marketplace. Buyers discover you the moment an incident makes you relevant.',
  },
];

function VendorJourneySection() {
  return (
    <PageContainer className="py-20">
      <div className="mb-12 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-yellow/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent-yellow">
          For vendors
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          From claim to <span className="text-accent-yellow">verified listing</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {JOURNEY.map(({ n, icon: Icon, title, body }, i) => (
          <div key={n} className="relative flex flex-col">
            {/* connector line (desktop) */}
            {i < JOURNEY.length - 1 && (
              <span className="absolute left-[calc(50%+28px)] right-[-24px] top-6 hidden h-px bg-white/15 lg:block" />
            )}
            <span className="mb-4 font-mono text-xs font-bold tracking-widest text-accent-yellow">
              {n}
            </span>
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-accent-yellow/30 bg-accent-yellow/10">
              <Icon className="h-5 w-5 text-accent-yellow" />
            </span>
            <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-white/55">{body}</p>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

// ── Incident → vendor mapping — a live incident record surfaces defenders ──
const INCIDENT_RECORD: { label: string; value: string; accent?: boolean }[] = [
  { label: 'Incident', value: 'Public storage bucket exposes customer records' },
  { label: 'Sector', value: 'Financial services' },
  { label: 'GUARD category', value: 'DAT · Data & Privacy', accent: true },
  { label: 'Failed control', value: 'AC-DAT-014 · Storage access governance' },
  { label: 'Severity', value: 'Critical' },
  { label: 'Disclosed', value: '12 Jun 2026' },
];

function IncidentMappingSection() {
  return (
    <PageContainer className="py-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left: copy */}
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
            Incident → vendor mapping
          </span>
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            When a control fails, the{' '}
            <span className="text-accent-yellow">right defenders surface.</span>
          </h2>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-text-secondary">
            Every live incident is decomposed to the exact GUARD category and adaptive control
            that failed. Attacked.ai then surfaces only the vendors with verified evidence of
            closing that specific gap, automatically, the moment it happens.
          </p>
          <Link to="/marketplace" className="btn btn-primary btn-lg group">
            Explore the Marketplace
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Right: incident record card */}
        <div className="mx-auto w-full max-w-md">
          <div className="surface-card overflow-hidden p-0 shadow-[0_18px_44px_rgba(28,27,25,0.12)]">
            <div className="flex items-center justify-between bg-[#1C1B19] px-5 py-3.5">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70">
                <AlertTriangle className="h-3.5 w-3.5 text-accent-yellow" />
                Live incident record
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-status-red">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-red/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-status-red" />
                </span>
                CRITICAL
              </span>
            </div>
            <div className="divide-y divide-bg-border">
              {INCIDENT_RECORD.map((r) => (
                <div key={r.label} className="px-5 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {r.label}
                  </div>
                  <div
                    className={`mt-0.5 text-sm font-medium ${
                      r.accent ? 'font-mono text-accent-yellow' : 'text-text-primary'
                    }`}
                  >
                    {r.value}
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/marketplace"
              className="flex items-center justify-between gap-2 border-t border-bg-border bg-accent-soft px-5 py-3.5 text-sm font-semibold text-[#7A5B00] transition-colors hover:bg-accent-yellow/20"
            >
              7 vendors ready to respond
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-3 px-1 text-xs leading-relaxed text-text-muted">
            Generated from a live incident record. Explore it interactively: filter by GUARD
            category, expand every cause.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}

// ── For practitioners — "Set the record straight" (validate vendor claims) ──
const PRACTITIONER_POINTS: { title: string; body: string }[] = [
  {
    title: 'Validate vendor claims',
    body: 'Score how well a product’s coverage matches your real-world deployment.',
  },
  {
    title: 'Confirm control coverage',
    body: 'Tell us which GUARD controls it genuinely closes, and which still need work.',
  },
  {
    title: 'Earn early access',
    body: 'Get priority access to incident intelligence, reports, and new evidence tooling.',
  },
];

function PractitionerSection() {
  return (
    <PageContainer className="py-20">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left: testimonial card */}
        <div className="relative mx-auto w-full max-w-md">
          <div
            className="pointer-events-none absolute -inset-5 -z-10 rounded-3xl"
            style={{
              background:
                'radial-gradient(60% 60% at 30% 20%, rgba(245,184,0,0.16) 0%, transparent 70%)',
            }}
          />
          <div className="surface-card p-6 shadow-[0_18px_44px_rgba(28,27,25,0.12)]">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-yellow">
                AK
              </span>
              <div>
                <div className="text-sm font-semibold text-text-primary">Anna K.</div>
                <div className="text-xs text-text-muted">Security Lead · Enterprise (5,000+)</div>
              </div>
              <Quote className="ml-auto h-6 w-6 text-accent-yellow/40" />
            </div>
            <div className="mb-3 flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-accent-yellow text-accent-yellow" />
              ))}
            </div>
            <h4 className="mb-2 text-base font-semibold text-text-primary">
              Finally, clarity on what a product actually covers
            </h4>
            <p className="text-sm leading-relaxed text-text-secondary">
              The control-level mapping is what sold me. Instead of vague vendor claims, I can see
              exactly which GUARD controls are genuinely closed and which still need attention.
              Changed how we plan our defensive stack entirely.
            </p>
          </div>
        </div>

        {/* Right: copy + checklist + CTA */}
        <div>
          <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
            For practitioners
          </span>
          <h2 className="mb-5 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Use a security product?{' '}
            <span className="text-accent-yellow">Set the record straight.</span>
          </h2>
          <p className="mb-7 max-w-lg text-base leading-relaxed text-text-secondary">
            Help defenders make the right call. Your frontline perspective validates what vendors
            claim, and reveals what they don’t. Join the practitioner network that shapes the
            intelligence that matters.
          </p>
          <div className="mb-8 flex flex-col gap-4">
            {PRACTITIONER_POINTS.map((p) => (
              <div key={p.title} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-yellow" />
                <div>
                  <div className="text-sm font-semibold text-text-primary">{p.title}</div>
                  <div className="text-sm leading-relaxed text-text-secondary">{p.body}</div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/register" className="btn btn-primary btn-lg group">
            Share your experience
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

// ── FAQ (accordion) ──
const FAQS: { q: string; a: string }[] = [
  {
    q: 'What exactly is Attacked.ai?',
    a: 'Attacked.ai is an event-driven defence marketplace. The moment a control fails in a live incident, we surface the exact vendors and advisors with verified evidence of closing that specific gap, so buyers find the right help fast.',
  },
  {
    q: 'What is the GUARD framework?',
    a: 'GUARD is our risk taxonomy. It organises the entire enterprise risk surface into 13 categories that reach well beyond cyber, covering data, geopolitical, physical, environmental, people and more. Every incident and every product is indexed against it, so coverage is precise and comparable.',
  },
  {
    q: 'How is the Defence Rating calculated?',
    a: 'It is computed from tiered, admin-verified evidence, from E1 independent audits down to E5 marketing claims, and is never influenced by payment. Until an admin verifies a qualifying piece of evidence, the rating stays provisional and shows as a dash.',
  },
  {
    q: 'Do vendors pay to rank higher?',
    a: 'No. Placement is earned, not bought. Sponsored slots exist but are always clearly labelled and never affect Defence Ratings, evidence verification, or marketplace ranking. Only earned, evidence-backed results move those.',
  },
  {
    q: 'How do I list my product?',
    a: 'Claim your profile, let our AI map it to the GUARD framework, add your evidence, and submit. Our team verifies every submission before it publishes. Listing is free during the founding phase.',
  },
  {
    q: 'Is it free for buyers?',
    a: 'Yes. Browsing the marketplace, comparing vendors, and exploring GUARD coverage is free. You only need an account for saved views and tailored intelligence.',
  },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <PageContainer className="py-20">
      <div className="mb-10 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
          FAQ
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Frequently asked questions
        </h2>
      </div>

      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div
              key={f.q}
              className={`overflow-hidden rounded-2xl border bg-bg-surface transition-colors ${
                isOpen ? 'border-accent-yellow/50' : 'border-bg-border'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[15px] font-semibold text-text-primary">{f.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-accent-yellow transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <p className="px-5 pb-5 text-sm leading-relaxed text-text-secondary">{f.a}</p>
              )}
            </div>
          );
        })}
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
        <div className="mb-12 text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
            Why the Defence Layer
          </span>
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Defensibility you can <span className="text-accent-yellow">verify</span>, never buy
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-text-secondary">
            Every listing earns its place through control mapping and tiered evidence, not payment
            or sponsorship.
          </p>
        </div>
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

      {/* ── Service promotion cards (dark band) ── */}
      <div className="border-y border-white/10 bg-[#1C1B19]">
        <ServicesSection />
      </div>

      {/* ── Featured vendors: verified & mapped ── */}
      <div className="border-b border-bg-border bg-white">
        <FeaturedVendorsSection />
      </div>

      {/* ── Sponsored featured spotlight (dummy, clearly labelled) ── */}
      <FeaturedSpotlightSection />

      {/* ── Vendor journey: claim → verified listing (dark band) ── */}
      <div className="border-y border-white/10 bg-[#1C1B19]">
        <VendorJourneySection />
      </div>

      {/* ── What is GUARD (explainer) ── */}
      <div className="border-y border-bg-border bg-white">
        <GuardExplainerSection />
      </div>

      {/* ── Discover: GUARD categories + vendor logos (dark band) ── */}
      <div className="border-y border-white/10 bg-[#1C1B19]">
        <DiscoverSection />
      </div>

      {/* ── Incident → vendor mapping ── */}
      <div className="border-b border-bg-border bg-white">
        <IncidentMappingSection />
      </div>

      {/* ── Evidence-backed trust (dark band) ── */}
      <div className="border-y border-white/10 bg-[#1C1B19]">
        <EvidenceSection />
      </div>

      {/* ── For practitioners: set the record straight ── */}
      <div className="border-b border-bg-border bg-white">
        <PractitionerSection />
      </div>

      {/* ── Claim your profile (dark band) ── */}
      <div className="border-y border-white/10 bg-[#1C1B19]">
        <ClaimSection />
      </div>

      {/* ── FAQ ── */}
      <div className="border-t border-bg-border bg-white">
        <FaqSection />
      </div>
    </div>
  );
}
