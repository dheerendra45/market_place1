import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { ChevronDown, ChevronUp, Check, Shield, Star, BadgeCheck, Radar, Sparkles } from 'lucide-react';
import { RECOGNITION_BADGES } from '../components/RecognitionBadges';

type Billing = 'monthly' | 'annual';

const PLANS = [
  {
    name: 'BRONZE',
    price: { monthly: '£0', annual: '£0' },
    sub: 'Get listed, mapped, and discovered.',
    btnText: 'Get started free',
    accent: false,
    popular: false,
    features: [
      'Verified company profile',
      'Products mapped to the 13 GUARD categories',
      'Evidence-tiered Defence Rating',
      'Appears in live incident matches',
      'Basic analytics',
    ],
  },
  {
    name: 'SILVER',
    price: { monthly: '£499', annual: '£399' },
    sub: 'Stand out across the marketplace.',
    btnText: 'Upgrade to Silver',
    accent: true,
    popular: true,
    features: [
      'Everything in Bronze',
      'Featured placement in category browse',
      'Priority evidence verification (24h)',
      '“Request a demo” button on your profile',
      'Advanced analytics & lead insights',
      'Sponsored incident spotlight (clearly labelled)',
    ],
  },
  {
    name: 'GOLD',
    price: { monthly: '£1,499', annual: '£1,199' },
    sub: 'Lead the Defence Layer.',
    btnText: 'Go Gold',
    accent: false,
    popular: false,
    features: [
      'Everything in Silver',
      'Top featured spotlight across the marketplace',
      'Customer-proof showcases',
      'Coverage-gap intelligence',
      'Dedicated success manager',
      'API access',
    ],
  },
];

const UPGRADES = [
  { icon: Star, title: 'Featured placement', body: 'Rise to the top of category browse and search results.' },
  { icon: BadgeCheck, title: 'Priority verification', body: 'Your evidence reviewed and confirmed within 24 hours.' },
  { icon: Sparkles, title: 'Incident spotlight', body: 'Surface first when a matching incident goes live — always labelled.' },
  { icon: Radar, title: 'Coverage-gap intelligence', body: 'See exactly where buyers have unmet GUARD coverage.' },
];

const COMPARE: { feature: string; bronze: string | boolean; silver: string | boolean; gold: string | boolean }[] = [
  { feature: 'Marketplace placement', bronze: 'Standard', silver: 'Featured', gold: 'Hero spotlight' },
  { feature: 'GUARD mapping + Defence Rating', bronze: true, silver: true, gold: true },
  { feature: 'Priority verification (24h)', bronze: false, silver: true, gold: true },
  { feature: 'Sponsored incident spotlight', bronze: false, silver: true, gold: true },
  { feature: 'Customer-proof showcases', bronze: false, silver: false, gold: true },
  { feature: 'Coverage-gap intelligence', bronze: false, silver: false, gold: true },
];

const FAQS = [
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. Upgrade, downgrade, or cancel at any time from your dashboard — no lock-in contracts.',
  },
  {
    q: 'Does a paid plan improve my Defence Rating?',
    a: 'No. The Defence Rating is earned, not bought. Paid plans affect placement and presence only — never the rating, evidence verification, or ranking.',
  },
  {
    q: 'What does verification involve?',
    a: 'Linking valid evidence — independent audits, certifications, or named customer deployments — that matches your capability claims. Priority verification is processed within 24 hours.',
  },
  {
    q: 'Is there a free option?',
    a: 'Yes. Bronze is free, and listing is free during the founding phase. You only pay to upgrade placement and presence.',
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-accent-yellow" />;
  if (value === false) return <span className="text-text-muted">—</span>;
  return <span>{value}</span>;
}

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageContainer className="py-14 sm:py-16">
      {/* Hero */}
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <span className="mb-3 block text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#8A6D00]">
          Pricing
        </span>
        <h1 className="mb-5 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
          Surface when it <span className="text-accent-yellow">matters</span>
        </h1>
        <p className="text-base leading-relaxed text-text-secondary">
          From a free verified listing to full marketplace presence. Choose the plan that matches
          your growth stage — placement is paid, the Defence Rating never is.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mb-12 flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling('monthly')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            billing === 'monthly' ? 'bg-accent-yellow text-[#1C1B19]' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            billing === 'annual' ? 'bg-accent-yellow text-[#1C1B19]' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Annual
          <span className="rounded bg-status-green/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-green">
            Save 20%
          </span>
        </button>
      </div>

      {/* Pricing cards */}
      <div className="mb-20 grid grid-cols-1 items-stretch gap-7 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col justify-between rounded-xl border bg-bg-surface p-7 transition-all duration-300 sm:p-9 ${
              plan.popular
                ? 'border-accent-yellow shadow-[0_18px_44px_rgba(245,184,0,0.14)]'
                : 'border-bg-border hover:border-accent-yellow/50'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md bg-accent-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1C1B19]">
                Most popular
              </span>
            )}
            <div>
              <span className="mb-3 block text-sm font-bold tracking-[0.12em] text-text-secondary">
                {plan.name}
              </span>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight text-text-primary">
                  {plan.price[billing]}
                </span>
                {plan.price[billing] !== '£0' && (
                  <span className="text-sm text-text-secondary">/mo</span>
                )}
              </div>
              <p className="mb-7 text-sm text-text-secondary">
                {plan.sub}
                {billing === 'annual' && plan.price.annual !== '£0' && (
                  <span className="ml-1 text-text-muted">· billed annually</span>
                )}
              </p>
              <hr className="mb-7 border-bg-border" />
              <ul className="mb-9 space-y-3.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
                    <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-yellow" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className={`btn w-full ${plan.accent ? 'btn-accent' : 'btn-outline'}`}>
              {plan.btnText}
            </button>
          </div>
        ))}
      </div>

      {/* Upgrade features highlight */}
      <div className="mb-20">
        <div className="mb-8 text-center">
          <span className="mb-2.5 block text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#8A6D00]">
            Upgrade features
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            What you unlock with Silver &amp; Gold
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UPGRADES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-bg-border bg-bg-surface p-5">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-accent-yellow/30 bg-accent-soft">
                <Icon className="h-5 w-5 text-accent-yellow" />
              </span>
              <h3 className="mb-2 text-[15px] font-semibold text-text-primary">{title}</h3>
              <p className="text-[13px] leading-relaxed text-text-secondary">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Earned recognition badges (distinct from paid tiers) */}
      <div className="mb-20">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <span className="mb-2.5 block text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[#8A6D00]">
            Earned recognition
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Badges that prove your <span className="text-accent-yellow">defence</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
            These badges are different from the Bronze, Silver, and Gold plans. You earn them
            through your GUARD mapping and verified evidence, and they show real defensive strength.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RECOGNITION_BADGES.map(({ Badge, name, desc, signal, earn }) => (
            <div
              key={name}
              className="flex flex-col items-center rounded-2xl border border-bg-border bg-bg-surface p-7 text-center transition-colors hover:border-accent-yellow/50"
            >
              <Badge />
              <h3 className="mt-4 text-base font-semibold text-text-primary">{name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{desc}</p>
              <p className="mt-3 flex items-start gap-2 text-left text-[13px] leading-relaxed text-text-secondary">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-yellow" />
                <span>
                  <span className="font-semibold text-text-primary">What it signals: </span>
                  {signal}
                </span>
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-accent-yellow/40 bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-[#7A5B00]">
                How to earn: {earn}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div className="mb-20">
        <h2 className="mb-8 text-center text-lg font-bold uppercase tracking-wide text-text-primary">
          Compare plans
        </h2>
        <div className="overflow-x-auto rounded-xl border border-bg-border bg-bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-bg-border bg-bg-elevated text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                <th className="p-4">Feature</th>
                <th className="p-4 text-center">Bronze</th>
                <th className="p-4 text-center">Silver</th>
                <th className="p-4 text-center">Gold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border text-text-secondary">
              {COMPARE.map((row) => (
                <tr key={row.feature}>
                  <td className="p-4 font-medium text-text-primary">{row.feature}</td>
                  <td className="p-4 text-center"><Cell value={row.bronze} /></td>
                  <td className="p-4 text-center"><Cell value={row.silver} /></td>
                  <td className="p-4 text-center"><Cell value={row.gold} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-auto mb-16 max-w-3xl">
        <h2 className="mb-8 text-center text-lg font-bold uppercase tracking-wide text-text-primary">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="overflow-hidden rounded-xl border border-bg-border bg-bg-surface">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left text-[15px] font-semibold text-text-primary transition-colors hover:text-accent-yellow"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-accent-yellow" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-text-muted" />
                )}
              </button>
              {openFaq === idx && (
                <p className="px-5 pb-5 text-sm leading-relaxed text-text-secondary">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mx-auto max-w-4xl rounded-xl border border-bg-border bg-bg-surface p-10 text-center sm:p-14">
        <Shield className="mx-auto mb-5 h-11 w-11 text-accent-yellow" />
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          Ready to get discovered?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-text-secondary">
          List your product under the Defence Layer and reach enterprises at the moment an incident
          makes you relevant. Free during the founding phase.
        </p>
        <Link to="/onboarding" className="btn btn-accent btn-lg">
          Get Your Product Listed
        </Link>
      </div>
    </PageContainer>
  );
}
