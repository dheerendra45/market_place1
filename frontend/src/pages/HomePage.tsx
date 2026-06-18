import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStats, useGuardCategories, useVendors } from '../hooks/useData';
import PageContainer from '../components/PageContainer';
import { CompanyLogo, VerifiedBadge } from '../components/ui';
import {
  Shield,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Award,
  Sparkles,
  FileCheck2,
  BadgeCheck,
  Building2,
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

// ── Discover section — GUARD categories (left) + real vendor logos (right) ──
function DiscoverSection() {
  const { data: categories, isLoading: catsLoading } = useGuardCategories();
  const { data: vendorData, isLoading: vendorsLoading } = useVendors({ page_size: 12 });
  const [active, setActive] = useState(0);

  const cats = categories ?? [];
  const vendors = (vendorData?.data ?? []).slice(0, 12);

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
        {/* ── Left: 13 GUARD categories ── */}
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
              : cats.map((cat, i) => (
                  <Link
                    key={cat.code}
                    to="/marketplace"
                    onMouseEnter={() => setActive(i)}
                    className={`group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all ${
                      active === i
                        ? 'border-accent-yellow bg-accent-soft shadow-[0_2px_10px_rgba(245,184,0,0.18)]'
                        : 'border-bg-border bg-bg-surface hover:border-accent-yellow/50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors ${
                          active === i
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
                    <ArrowRight
                      className={`h-4 w-4 shrink-0 transition-all ${
                        active === i
                          ? 'translate-x-0 text-accent-yellow opacity-100'
                          : '-translate-x-1 text-text-muted opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                      }`}
                    />
                  </Link>
                ))}
          </div>
        </div>

        {/* ── Right: real vendor logos ── */}
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
              Trusted Vendors
            </h3>
            <Link
              to="/marketplace"
              className="text-xs font-semibold text-accent-yellow transition-colors hover:text-accent-yellow-hover"
            >
              Explore marketplace →
            </Link>
          </div>

          {vendorsLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton h-[148px] w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {vendors.map((v) => (
                <Link
                  key={v.id}
                  to={`/vendors/${v.id}`}
                  className="group flex flex-col rounded-2xl border border-bg-border bg-bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent-yellow/60 hover:shadow-[0_14px_36px_rgba(28,27,25,0.10)]"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent-yellow">
                      {v.vendor_name}
                    </h4>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mb-4 flex items-center gap-1.5 text-xs text-text-muted">
                    <VerifiedBadge />
                    <span>
                      {v.product_count ?? 1} product{(v.product_count ?? 1) === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-auto flex items-end justify-center pt-2">
                    <CompanyLogo
                      name={v.vendor_name}
                      logo={v.vendor_logo}
                      domain={v.vendor_domain}
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
  const { data: stats, isLoading } = useStats();

  const statCards = [
    { value: stats?.vendor_count ?? 46, label: 'Vendors mapped' },
    { value: stats?.product_count ?? 55, label: 'Products tracked' },
    { value: stats?.incident_count ?? 10, label: 'Live incidents' },
    { value: stats?.evidence_count ?? 157, label: 'Evidence items', gold: true },
  ];

  return (
    <div className="w-full">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-bg-border">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 0%, rgba(245,184,0,0.16) 0%, rgba(245,184,0,0.04) 38%, transparent 70%)',
          }}
        />
        <PageContainer className="relative flex flex-col items-center py-24 text-center sm:py-28" center>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-yellow/40 bg-accent-soft px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
            <Sparkles className="h-3.5 w-3.5 text-accent-yellow" />
            The Defence Layer
          </div>

          <h1 className="mb-6 max-w-4xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
            The intelligence layer between{' '}
            <span className="text-accent-yellow">breach and response</span>
          </h1>

          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-text-secondary">
            When an incident hits, Attacked.ai surfaces the exact vendors whose products
            address the controls that failed — automatically, at the moment it happens.
            Evidence-based. Never sponsored.
          </p>

          <div className="cta-row">
            <Link to="/marketplace" className="btn btn-primary btn-lg group">
              Explore the Marketplace
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/onboarding" className="btn btn-secondary btn-lg">
              Get Your Product Listed
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mt-6 grid w-full max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-bg-border bg-bg-border md:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.label} className="bg-bg-surface px-6 py-7 text-center">
                <div
                  className={`text-3xl font-bold tracking-tight sm:text-4xl ${
                    s.gold ? 'text-accent-yellow' : 'text-text-primary'
                  }`}
                >
                  {isLoading ? '—' : s.value}
                </div>
                <div className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

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
