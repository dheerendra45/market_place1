import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVendor } from '../hooks/useData';
import PageContainer from '../components/PageContainer';
import {
  VerifiedBadge,
  ErrorState,
  TierBadge,
  TrustScore,
  CompanyLogo,
  GuardTag,
} from '../components/ui';
import { ArrowLeft, Globe, MapPin, Building2, Package, ShieldCheck } from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'trust', label: 'Trust & Verification' },
  { id: 'about', label: 'About Company' },
];

export default function VendorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const vendor_id = Number(slug);
  const { data: vendor, isLoading, isError, refetch } = useVendor(vendor_id);
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <PageContainer className="flex min-h-[50vh] items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-yellow border-t-transparent" />
      </PageContainer>
    );
  }
  if (isError || !vendor) {
    return (
      <PageContainer className="py-12">
        <ErrorState message="Failed to load vendor profile." onRetry={refetch} />
      </PageContainer>
    );
  }

  const isGold = vendor.placement === 'sponsored_spotlight';
  const products = vendor.products || [];
  const topScore = vendor.ai_verdict ?? 0;
  const avgScore = vendor.avg_score ?? topScore;
  const entity = vendor.entity_type ? vendor.entity_type.replace(/_/g, ' ') : 'vendor';

  return (
    <PageContainer className="py-12 sm:py-14">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm text-text-secondary">
        <Link to="/vendors" className="flex items-center gap-1.5 hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Vendor Directory
        </Link>
        <span className="text-text-muted">/</span>
        <span className="font-medium text-text-primary">{vendor.vendor_name}</span>
      </div>

      {/* Header card */}
      <div className="mb-8 rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-9">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <CompanyLogo
              name={vendor.vendor_name}
              logo={vendor.vendor_logo}
              domain={vendor.vendor_domain}
              size={80}
            />
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                  {vendor.vendor_name}
                </h1>
                <VerifiedBadge className="scale-110" />
                {isGold && <TierBadge tier="gold" />}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-text-muted" />
                  {vendor.headquarters || 'Location unknown'}
                </span>
                <span className="flex items-center gap-1.5 capitalize">
                  <Building2 className="h-4 w-4 text-text-muted" />
                  {entity}
                </span>
                <span className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-text-muted" />
                  {vendor.product_count ?? products.length} products
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-3 md:w-auto">
            <a href={vendor.vendor_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline flex-1 md:flex-initial">
              <Globe className="h-4 w-4" /> Visit Website
            </a>
            <Link to="/onboarding" className="btn btn-accent flex-1 md:flex-initial">
              Contact Vendor
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div className="flex flex-row gap-1 overflow-x-auto border-bg-border lg:col-span-1 lg:flex-col lg:border-r lg:pr-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-left text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-accent-soft text-text-primary lg:border-l-2 lg:border-accent-yellow'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3">
          {activeTab === 'overview' && (
            <div className="animate-fade-in space-y-8">
              <div>
                <h3 className="mb-3 text-lg font-semibold text-text-primary">Company profile</h3>
                <p className="text-[15px] leading-relaxed text-text-secondary">
                  {vendor.description ||
                    'This vendor offers specialised security capability mapped under the Attacked.ai Defence Layer.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-bg-border bg-bg-surface p-5">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Top Defence Rating</div>
                  <div className="text-3xl font-bold text-accent-yellow">{topScore}</div>
                </div>
                <div className="rounded-xl border border-bg-border bg-bg-surface p-5">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Average Rating</div>
                  <div className="text-3xl font-bold text-text-primary">{avgScore}</div>
                </div>
                <div className="rounded-xl border border-bg-border bg-bg-surface p-5">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Products</div>
                  <div className="text-3xl font-bold text-text-primary">{vendor.product_count ?? products.length}</div>
                </div>
              </div>

              {vendor.guard_categories.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-text-primary">GUARD coverage</h3>
                  <div className="flex flex-wrap gap-2">
                    {vendor.guard_categories.map((c) => (
                      <GuardTag key={c.code} code={c.code} label={c.label} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <div className="animate-fade-in space-y-4">
              <h3 className="mb-1 text-lg font-semibold text-text-primary">Product portfolio</h3>
              {products.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      to={`/marketplace/product/${p.id}`}
                      className="group rounded-xl border border-bg-border bg-bg-surface p-5 transition-all hover:border-accent-yellow/60 hover:shadow-md"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-text-primary group-hover:text-accent-yellow">{p.product_name}</h4>
                        <span className="flex items-center gap-1 rounded-md border border-accent-yellow/30 bg-accent-soft px-2 py-0.5 text-xs font-bold text-[#7A5B00]">
                          <ShieldCheck className="h-3 w-3" /> {p.ai_verdict}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-sm leading-relaxed text-text-secondary">{p.description}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-bg-border bg-bg-surface py-12 text-center text-sm text-text-secondary">
                  No products listed for this vendor.
                </div>
              )}
            </div>
          )}

          {activeTab === 'trust' && (
            <div className="animate-fade-in">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">Trust & verification</h3>
              <div className="flex flex-col items-center gap-6 rounded-xl border border-bg-border bg-bg-surface p-8 sm:flex-row">
                <TrustScore score={topScore || 70} />
                <div>
                  <h4 className="mb-2 text-base font-semibold text-text-primary">
                    {topScore >= 80 ? 'High confidence' : topScore >= 60 ? 'Established' : 'Provisional'} standing
                  </h4>
                  <p className="max-w-md text-sm leading-relaxed text-text-secondary">
                    This vendor's capabilities are scored from verified field evidence mapped to the
                    controls implicated in live incidents — independently determined, never paid for.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="animate-fade-in">
              <h3 className="mb-4 text-lg font-semibold text-text-primary">Company details</h3>
              <div className="divide-y divide-bg-border rounded-xl border border-bg-border bg-bg-surface text-sm">
                {[
                  ['Legal name', vendor.vendor_name],
                  ['Headquarters', vendor.headquarters || 'Unknown'],
                  ['Entity type', entity],
                  ['Products listed', String(vendor.product_count ?? products.length)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between p-5">
                    <span className="font-medium text-text-secondary capitalize">{k}</span>
                    <span className="font-semibold text-text-primary">{v}</span>
                  </div>
                ))}
                <div className="flex justify-between p-5">
                  <span className="font-medium text-text-secondary">Website</span>
                  <a href={vendor.vendor_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-yellow hover:underline">
                    {vendor.vendor_domain || vendor.vendor_url}
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
