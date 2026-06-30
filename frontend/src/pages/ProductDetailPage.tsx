import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct, useProducts } from '../hooks/useData';
import PageContainer from '../components/PageContainer';
import ProductCard from '../components/ProductCard';
import IndustryRecognition from '../components/IndustryRecognition';
import {
  VerifiedBadge,
  ErrorState,
  FitLevelBadge,
  ConfidenceBadge,
  CompanyLogo,
  Chip,
  ComplianceBadges,
} from '../components/ui';
import { ArrowLeft, Globe, Play, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { deploymentTags, listingType, LISTING_TYPE_LABEL } from '../lib/display';
import { DEFENSE_DIMENSIONS } from '../api/client';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: 'Evidence' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'tasks', label: 'Controls' },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2.5 text-xl font-semibold tracking-tight text-text-primary">
      <span className="h-5 w-1.5 rounded-full bg-accent-yellow" />
      {children}
    </h3>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const product_id = Number(slug);
  const { data: product, isLoading, isError, refetch } = useProduct(product_id);
  const { data: poolData } = useProducts({ page_size: 60 });
  const [activeTab, setActiveTab] = useState('overview');
  const [playing, setPlaying] = useState(false);

  // Scroll-spy: highlight the section currently in view as the page scrolls.
  useEffect(() => {
    const els = TABS.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveTab(visible[0].target.id);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.2, 0.5, 1] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [product]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <PageContainer className="flex min-h-[50vh] items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-yellow border-t-transparent" />
      </PageContainer>
    );
  }
  if (isError || !product) {
    return (
      <PageContainer className="py-12">
        <ErrorState message="Failed to load product detail." onRetry={refetch} />
      </PageContainer>
    );
  }

  const confidence = product.confidence || 'INFERRED';
  const fitLevel = product.fit_level || 'partial';
  const score = product.ai_verdict ?? 0;
  // Computed (hybrid) Defence Rating is canonical when present; else legacy ai_verdict.
  const dr = product.defense_rating ?? null;
  const drProvisional = dr?.status === 'provisional';
  const headerScore = dr ? (drProvisional ? '—' : dr.rating) : score;
  const headerBand = dr ? dr.band : product.score_band;
  const mitig = product.mitigation_mechanism || {};

  // Everything the vendor submitted (from optional_metadata + guard mapping).
  const meta: Record<string, any> = product.optional_metadata || {};
  const lType = listingType(product);
  const gm = meta.guard_mapping || null;
  const features: string[] = meta.key_features || [];
  const useCases: string[] = meta.use_cases || [];
  const benefits: string[] = meta.benefits || [];
  const tags: string[] = meta.tags || [];
  const integrations: string[] = meta.integrations || [];
  // "Request demo" routes to the vendor's booking link, else a pre-filled email.
  const demoHref: string | null =
    meta.demo_url ||
    (meta.contact_email
      ? `mailto:${meta.contact_email}?subject=${encodeURIComponent('Demo request: ' + product.product_name)}`
      : null);
  const adaptiveControls: any[] = gm?.adaptive_controls || [];
  const guardCats: any[] = gm?.categories || [];
  const guardSubs: any[] = gm?.subcategories || [];
  const evidence: any[] = product.product_evidence || [];
  // Only evidence an admin has verified is shown publicly on the profile.
  const verifiedEvidence: any[] = evidence.filter((e: any) => e.verified);

  // Similar products — prefer ones that share a GUARD category; fall back to
  // other products so the section still appears for unmapped products.
  const myCodes = new Set((product.guard_categories ?? []).map((g: any) => g.code));
  const pool = (poolData?.data ?? []).filter((p) => p.id !== product.id);
  const sameCat = pool.filter((p) => (p.guard_categories ?? []).some((g: any) => myCodes.has(g.code)));
  const similar = (sameCat.length ? sameCat : pool).slice(0, 3);

  return (
    <PageContainer className="py-12 sm:py-14">
      {/* Breadcrumb */}
      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
        <Link to="/marketplace" className="flex items-center gap-1.5 hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Marketplace
        </Link>
        <span className="text-text-muted">/</span>
        <Link to={`/vendors/${product.vendor_id}`} className="hover:text-text-primary">
          {product.vendor_name}
        </Link>
        <span className="text-text-muted">/</span>
        <span className="font-medium text-text-primary">{product.product_name}</span>
      </div>

      {/* Header card */}
      <div className="mb-8 rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <CompanyLogo
              name={product.vendor_name}
              logo={product.vendor_logo}
              domain={product.vendor_domain}
              size={64}
            />
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                  {product.product_name}
                </h1>
                {product.verified ? (
                  <VerifiedBadge className="scale-110" />
                ) : (
                  <Link to="/onboarding" className="inline-flex items-center gap-1.5 rounded-full border border-accent-yellow/50 bg-accent-soft px-3 py-1 text-[12px] font-semibold text-[#7A5B00] hover:bg-accent-yellow/20">
                    <ShieldCheck className="h-3.5 w-3.5" /> Claim this product
                  </Link>
                )}
              </div>
              <p className="text-[15px] text-text-secondary">
                by{' '}
                <Link to={`/vendors/${product.vendor_id}`} className="font-semibold text-text-primary hover:text-accent-yellow">
                  {product.vendor_name}
                </Link>{' '}
                · {product.headquarters}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Chip tone="gold">
                  {LISTING_TYPE_LABEL[lType]}
                  {lType !== 'product' && meta.service_type ? ` · ${meta.service_type}` : ''}
                </Chip>
                <ConfidenceBadge confidence={confidence} />
                <FitLevelBadge level={fitLevel} />
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:items-end">
            <div className="flex items-center gap-3 rounded-xl border border-accent-yellow/40 bg-accent-soft px-4 py-2.5">
              <ShieldCheck className="h-5 w-5 text-accent-yellow" />
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold leading-none text-text-primary">{headerScore}</span>
                  {!drProvisional && <span className="text-sm text-text-muted">/100</span>}
                  {dr && (
                    drProvisional ? (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-status-amber/30 bg-status-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-status-amber"><AlertTriangle className="h-2.5 w-2.5" /> Provisional</span>
                    ) : (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-status-green/30 bg-status-green/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-status-green"><Check className="h-2.5 w-2.5" /> Verified</span>
                    )
                  )}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Defence Rating{headerBand ? ` · ${headerBand}` : ''}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm flex-1">
                <Globe className="h-4 w-4" /> Website
              </a>
              {demoHref ? (
                <a
                  href={demoHref}
                  target={demoHref.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="btn btn-accent btn-sm flex-1"
                >
                  Request Demo
                </a>
              ) : (
                <Link to="/onboarding" className="btn btn-accent btn-sm flex-1">
                  Request Demo
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {deploymentTags(product).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
          {product.incident_name && (
            <Chip tone="gold">Surfaced · {product.incident_name.slice(0, 46)}…</Chip>
          )}
        </div>
      </div>

      {/* Industry Recognition */}
      <IndustryRecognition className="mb-6" />

      {/* Certifications & compliance */}
      <div className="mb-8 rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-text-primary">
          <ShieldCheck className="h-5 w-5 text-accent-yellow" />
          Certifications &amp; compliance
        </h2>
        <ComplianceBadges />
        <p className="mt-4 text-xs text-text-muted">Placeholder certifications — illustrative.</p>
      </div>

      {/* Scroll-spy nav + stacked sections */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-4">
        <div className="sticky top-20 z-10 -mx-1 flex flex-row gap-1 overflow-x-auto bg-white/80 px-1 py-2 backdrop-blur lg:top-24 lg:col-span-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l lg:border-bg-border lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id)}
                className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-left text-[15px] font-semibold transition-all lg:-ml-px lg:rounded-none lg:border-l-2 lg:py-3 lg:pl-4 lg:pr-2 ${
                  isActive
                    ? 'bg-accent-soft text-text-primary lg:border-accent-yellow lg:bg-transparent lg:text-accent-yellow'
                    : 'text-text-secondary hover:text-text-primary lg:border-transparent lg:text-text-primary lg:hover:border-accent-yellow/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-14 lg:col-span-3">
          <section id="overview" className="scroll-mt-28 space-y-9">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-bg-border bg-black">
                {playing && product.video_id ? (
                  <iframe
                    title={`${product.product_name} demo`}
                    src={`https://www.youtube.com/embed/${product.video_id}?autoplay=1&rel=0&modestbranding=1`}
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => product.video_id && setPlaying(true)}
                    className="group absolute inset-0 flex flex-col items-center justify-center"
                    style={
                      product.video_id
                        ? {
                            backgroundImage: `url(https://img.youtube.com/vi/${product.video_id}/hqdefault.jpg)`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : { background: 'linear-gradient(135deg,#2A2620,#4a4133)' }
                    }
                  >
                    <span className="absolute inset-0 bg-black/45 transition-colors group-hover:bg-black/30" />
                    <span className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-yellow shadow-lg transition-transform group-hover:scale-110">
                      <Play className="h-6 w-6 translate-x-0.5 fill-[#1C1B19] text-[#1C1B19]" />
                    </span>
                    <p className="relative text-sm text-white/90">Product overview · {product.product_name}</p>
                  </button>
                )}
              </div>

              {(product.product_images && product.product_images.length > 0) && (
                <div>
                  <SectionTitle>Screenshots</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {product.product_images.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-bg-border bg-bg-surface transition-colors hover:border-accent-yellow/40">
                        <img src={src} alt={`${product.product_name} screenshot ${i + 1}`} className="aspect-video w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <SectionTitle>What it does</SectionTitle>
                <p className="text-[15.5px] leading-relaxed text-text-secondary">{product.description}</p>
              </div>

              {/* At a glance — everything the vendor submitted */}
              {(meta.category || meta.pricing_model || meta.target_market || meta.version || meta.sku) && (
                <div>
                  <SectionTitle>At a glance</SectionTitle>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {([
                      ['Listing type', LISTING_TYPE_LABEL[lType]],
                      ['Category', meta.category],
                      ['Pricing', meta.pricing_model],
                      ['Starting price', meta.starting_price],
                      ['Free trial', meta.free_trial ? 'Yes' : ''],
                      ['Service type', meta.service_type],
                      ['Engagement', meta.engagement_model],
                      ['Target users', meta.target_market],
                      ['Version', meta.version],
                      ['SKU', meta.sku],
                    ] as [string, string][])
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="rounded-xl border border-bg-border bg-bg-surface p-4 transition-colors hover:border-accent-yellow/40">
                          <div className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted">{k}</div>
                          <div className="mt-1.5 text-[15px] font-medium text-text-primary">{v}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Integrations */}
              {integrations.length > 0 && (
                <div>
                  <SectionTitle>Integrations</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {integrations.map((i) => (
                      <Chip key={i}>{i}</Chip>
                    ))}
                  </div>
                </div>
              )}

              {([['Key features', features], ['Use cases', useCases], ['Benefits', benefits]] as [string, string[]][])
                .filter(([, items]) => items.length > 0)
                .map(([title, items]) => (
                  <div key={title}>
                    <SectionTitle>{title}</SectionTitle>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {items.map((it, i) => (
                        <div key={i} className="flex items-start gap-2.5 rounded-xl border border-bg-border bg-bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-text-secondary transition-colors hover:border-accent-yellow/40">
                          <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-yellow" />
                          <span>{it}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {tags.length > 0 && (
                <div>
                  <SectionTitle>Tags</SectionTitle>
                  <div className="flex flex-wrap gap-2">{tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
                </div>
              )}

              {mitig.how_it_mitigates && (
                <div className="rounded-xl border-l-2 border-accent-yellow bg-accent-soft/50 p-5">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-primary">
                    <ShieldCheck className="h-4 w-4 text-accent-yellow" /> How it mitigates
                  </h4>
                  <p className="text-[14px] leading-relaxed text-text-secondary">{mitig.how_it_mitigates}</p>
                </div>
              )}

              {mitig.known_limits && (
                <div className="rounded-xl border border-bg-border bg-bg-surface p-5">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-primary">
                    <AlertTriangle className="h-4 w-4 text-status-amber" /> Known limits
                  </h4>
                  <p className="text-[14px] leading-relaxed text-text-secondary">{mitig.known_limits}</p>
                </div>
              )}

              {product.score_rationale && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-text-primary">Score rationale</h3>
                  <p className="text-[14px] leading-relaxed text-text-secondary">{product.score_rationale}</p>
                </div>
              )}

          </section>

          <section id="features" className="scroll-mt-28 space-y-4">
              <SectionTitle>Verified evidence</SectionTitle>
              <p className="-mt-1 text-[14px] leading-relaxed text-text-secondary">
                Only proof that our team has independently reviewed and verified appears here — so what
                you see is checked, not just claimed.
              </p>

              {(verifiedEvidence.length > 0 || product.capability_claims.length > 0) ? (
                <div className="space-y-3">
                  {verifiedEvidence.map((e: any) => (
                    <div key={e.evidence_id} className="rounded-xl border border-bg-border bg-bg-surface p-5">
                      <div className="mb-1.5 flex items-start justify-between gap-3">
                        <h4 className="text-[15px] font-semibold text-text-primary">{e.title}</h4>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 font-mono text-[11px] uppercase text-text-muted">{String(e.type).replace(/_/g, ' ')}</span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-status-green/30 bg-status-green/10 px-2 py-0.5 text-[11px] font-semibold text-status-green"><CheckCircle2 className="h-3 w-3" /> Verified</span>
                        </div>
                      </div>
                      {e.description && <p className="text-[14px] leading-relaxed text-text-secondary">{e.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-text-muted">
                        {e.issuer && <span>Issued by {e.issuer}</span>}
                        {e.issued_date && <span>· {String(e.issued_date).slice(0, 10)}</span>}
                        {e.file_url && (
                          <a href={e.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-status-blue hover:underline">
                            <FileText className="h-3.5 w-3.5" /> View
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {product.capability_claims.map((claim, idx) => (
                    <div key={`c${idx}`} className="rounded-xl border border-bg-border bg-bg-surface p-5">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                          <CheckCircle2 className="h-4 w-4 text-status-green" /> Verified claim
                        </h4>
                        {claim.control && (
                          <span className="rounded-md border border-accent-yellow/30 bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-[#7A5B00]">{claim.control}</span>
                        )}
                      </div>
                      <p className="text-[14px] leading-relaxed text-text-secondary">{claim.claim}</p>
                      {claim.source_url && (
                        <a href={claim.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-status-blue hover:underline">
                          <FileText className="h-3.5 w-3.5" /> View source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-bg-border bg-bg-surface py-12 text-center text-sm text-text-secondary">
                  No verified evidence yet — this product's proof is still under review.
                </div>
              )}
          </section>

          <section id="ratings" className="scroll-mt-28 space-y-5">
              {dr && (
                <div className="rounded-xl border border-bg-border bg-bg-surface p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                      <ShieldCheck className="h-5 w-5 text-accent-yellow" /> Defence Rating
                    </h3>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-text-primary">{drProvisional ? '—' : dr.rating}</span>
                      {!drProvisional && <span className="text-xs text-text-muted">/100</span>}
                      <span className="ml-1 rounded-md border border-accent-yellow/40 bg-accent-soft px-2 py-0.5 text-xs font-semibold text-[#7A5B00]">{dr.band}</span>
                    </div>
                  </div>
                  {drProvisional && (
                    <p className="mb-4 flex items-start gap-2 rounded-lg border border-status-amber/30 bg-status-amber/5 p-3 text-[13px] text-text-secondary">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-amber" />
                      Provisional — the numeric score is withheld until a verified evidence item above tier E5 is confirmed.
                    </p>
                  )}
                  <div className="space-y-3.5">
                    {DEFENSE_DIMENSIONS.map((dim) => {
                      const v = Math.round(dr.per_dimension?.[dim.key] ?? 0);
                      const w = Math.round((dr.breakdown?.find((b) => b.category === dim.key)?.weight ?? 0) * 100);
                      return (
                        <div key={dim.key}>
                          <div className="mb-1 flex items-center justify-between text-[13px]">
                            <span className="font-medium text-text-primary">{dim.label} <span className="font-mono text-[11px] text-text-muted">· {w}%</span></span>
                            <span className="font-mono text-text-secondary">{v}/100</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
                            <div className="h-full rounded-full bg-accent-yellow" style={{ width: `${v}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {dr.notes?.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {dr.notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-text-muted"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" /> {n}</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-4 text-[11px] text-text-muted">AI grades evidence into tiers (signals only); a deterministic rubric sets the number. Paid tier never affects this rating.</p>
                </div>
              )}
              {!dr && (
                <div className="rounded-xl border border-bg-border bg-bg-surface py-12 text-center text-sm text-text-secondary">
                  No Defence Rating has been computed for this product yet.
                </div>
              )}
          </section>

          <section id="tasks" className="scroll-mt-28 space-y-6">
              {/* What GUARD is — detailed explainer */}
              <div className="rounded-xl border border-accent-yellow/30 bg-accent-soft/40 p-5 sm:p-6">
                <h3 className="mb-2.5 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <ShieldCheck className="h-5 w-5 text-accent-yellow" /> How this product maps to risk
                </h3>
                <p className="text-[14.5px] leading-relaxed text-text-secondary">
                  <b>GUARD</b> is the Attacked.ai risk framework. It gives every product on the marketplace a common
                  language for describing <i>which risks it helps defend against</i>. Instead of vague marketing terms,
                  every product is mapped to the same structured set of risk areas — so you can compare products
                  like-for-like and quickly see where one genuinely helps.
                </p>
                <dl className="mt-4 space-y-3.5 border-t border-accent-yellow/20 pt-4">
                  {([
                    ['Category', 'The broadest level. GUARD groups all business risk into 13 categories — Cyber, Data, Technology, Operational, Third-Party, Regulatory, Financial, Strategic, People, Reputational, Geopolitical, Physical and Environmental. A product is tagged with the categories it addresses, and one is marked “Primary” — the risk area it is mainly built for.'],
                    ['Sub-category', 'A more specific risk inside a category. Within Cyber, for example, you will find sub-categories like Network & Perimeter Security or Identity & Access Management. These pinpoint exactly which part of a broad risk the product covers.'],
                    ['Control', 'The concrete thing the product actually does to reduce a risk, written as a short statement led by a verb (DETECTS, PROTECTS, RESPONDS, ENFORCES, GOVERNS, MONITORS) — for example, “DETECTS real-time attack traffic patterns.” Controls are the real capabilities behind the mapping, not just a label.'],
                  ] as [string, string][]).map(([term, def]) => (
                    <div key={term} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                      <span className="mt-0.5 inline-flex h-fit w-fit shrink-0 rounded-md border border-accent-yellow/40 bg-bg-surface px-2 py-0.5 text-[12px] font-semibold text-[#7A5B00] sm:w-28">{term}</span>
                      <p className="text-[14px] leading-relaxed text-text-secondary">{def}</p>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 border-t border-accent-yellow/20 pt-3.5 text-[13.5px] leading-relaxed text-text-muted">
                  Put together: the <b>category</b> tells you the broad area, the <b>sub-category</b> narrows it down,
                  and the <b>controls</b> show the specific protections — so you can judge this product on what it
                  genuinely does, not on how it markets itself.
                </p>
              </div>

              {/* GUARD categories */}
              {guardCats.length > 0 && (
                <div>
                  <SectionTitle>Risk categories it defends</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {guardCats.map((c: any) => (
                      <span key={c.code} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium ${c.primary ? 'border-accent-yellow/50 bg-accent-soft text-text-primary' : 'border-bg-border bg-bg-surface text-text-secondary'}`}>
                        {c.label} <span className="font-mono text-[11px] text-text-muted">{c.code}</span>
                        {c.primary && <span className="rounded bg-accent-yellow px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#1C1B19]">Primary</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* GUARD sub-categories */}
              {guardSubs.length > 0 && (
                <div>
                  <SectionTitle>Specific risk sub-categories</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {guardSubs.map((s: any, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-[13px] text-text-secondary">
                        <span className="font-mono text-[11px] text-accent-yellow">{s.code}</span> {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Adaptive controls */}
              <div>
                <SectionTitle>Protections it provides (controls)</SectionTitle>
                {adaptiveControls.length > 0 ? (
                  <div className="space-y-2.5">
                    {adaptiveControls.map((a: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-bg-border bg-bg-surface p-4">
                        <span className="shrink-0 rounded-md border border-accent-yellow/30 bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-[#7A5B00]">{a.verb}</span>
                        <div>
                          <div className="text-[14.5px] text-text-primary">{a.label}</div>
                          {a.code && <div className="mt-0.5 font-mono text-[11px] text-text-muted">{a.code}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : product.controls.length > 0 ? (
                  <div className="space-y-2">
                    {product.controls.map((c) => (
                      <div key={c} className="flex items-center gap-4 rounded-xl border border-bg-border bg-bg-surface p-4 text-sm">
                        <span className="font-mono font-semibold text-accent-yellow">{c}</span>
                        <span className="font-medium text-text-primary">Control mapping confirmed</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-bg-border bg-bg-surface py-12 text-center text-sm text-text-secondary">
                    No controls mapped to this product yet.
                  </div>
                )}
              </div>
          </section>
        </div>
      </div>

      {/* Similar products (same GUARD category) */}
      {similar.length > 0 && (
        <div className="mt-16 border-t border-bg-border pt-12">
          <div className="mb-7 flex items-end justify-between gap-4">
            <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-text-primary">
              <span className="h-5 w-1.5 rounded-full bg-accent-yellow" />
              Similar products
            </h2>
            <Link
              to="/marketplace"
              className="shrink-0 text-sm font-semibold text-accent-yellow hover:text-accent-yellow-hover"
            >
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
