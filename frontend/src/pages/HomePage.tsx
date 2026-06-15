import { Link } from 'react-router-dom';
import { useStats } from '../hooks/useData';
import PageContainer from '../components/PageContainer';
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  Award,
  Sparkles,
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

      {/* ── CTA strip ── */}
      <PageContainer className="pb-24">
        <div className="surface-card flex flex-col items-center gap-6 p-10 text-center sm:p-14">
          <Shield className="h-11 w-11 text-accent-yellow" strokeWidth={2} />
          <h2 className="max-w-xl text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Your product belongs where the buyers already are.
          </h2>
          <p className="max-w-lg text-base leading-relaxed text-text-secondary">
            Claim your profile, map your coverage, and surface to enterprises the moment an
            incident makes you relevant — free during the founding phase.
          </p>
          <Link to="/onboarding" className="btn btn-primary btn-lg group">
            Get Your Product Listed
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
