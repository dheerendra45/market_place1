import { useState } from 'react';
import { useProducts, useStats } from '../hooks/useData';
import ProductCard from '../components/ProductCard';
import PageContainer from '../components/PageContainer';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { Search, SlidersHorizontal } from 'lucide-react';

const FILTER_PILLS = [
  { id: 'all', label: 'All Products' },
  { id: 'verified', label: 'Full Fit' },
  { id: 'gold', label: 'Gold Tier' },
  { id: 'incident_handler', label: 'Incident Handlers' },
  { id: 'risk_coverage', label: 'Risk Coverage' },
];

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(0);

  const fitLevelParam = activeFilter === 'verified' ? 'full' : undefined;
  const vendorGroupParam = ['incident_handler', 'risk_coverage'].includes(activeFilter)
    ? activeFilter
    : undefined;

  const { data: productsData, isLoading, isError, refetch } = useProducts({
    search: searchQuery || undefined,
    page,
    page_size: 24,
    fit_level: fitLevelParam,
    vendor_group: vendorGroupParam,
  });

  const { data: stats } = useStats();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const handleFilterClick = (filterId: string) => {
    setActiveFilter(filterId);
    setPage(0);
  };

  let products = productsData?.data || [];
  if (activeFilter === 'gold') {
    products = products.filter((p) => p.placement === 'sponsored_spotlight');
  }

  return (
    <PageContainer className="py-14 sm:py-16">
      {/* ── Header ── */}
      <div className="mb-9">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
          Verified Marketplace
        </span>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Defence Intelligence Marketplace
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-text-secondary">
          Discover security products mapped to live incidents, compare GUARD-category
          alignment, and inspect defence readiness backed by verified field evidence.
        </p>
      </div>

      {/* ── Controls ── */}
      <div className="mb-10 space-y-6 border-t border-bg-border pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-lg">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-text-muted" />
            </div>
            <input
              type="text"
              className="block h-12 w-full rounded-xl border border-bg-border bg-bg-surface pl-11 pr-4 text-[15px] text-text-primary transition-colors placeholder:text-text-muted focus:border-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/20"
              placeholder="Search products, vendors, or capabilities…"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-bg-border bg-bg-surface px-4 py-3 font-mono text-[13px] text-text-secondary">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-accent-yellow" />
            <span>
              {stats?.product_count ?? 55} products · {stats?.vendor_count ?? 46} vendors
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.id}
              onClick={() => handleFilterClick(pill.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === pill.id
                  ? 'border-accent-yellow bg-accent-yellow text-[#1C1B19] shadow-sm'
                  : 'border-bg-border bg-bg-surface text-text-secondary hover:border-accent-yellow/50 hover:text-text-primary'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid / States ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Could not retrieve products from the database." onRetry={refetch} />
      ) : products.length === 0 ? (
        <EmptyState message="No products found matching the search parameters." />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {products.map((prod) => (
              <ProductCard key={prod._id} product={prod} />
            ))}
          </div>

          {(productsData?.total ?? 0) > 24 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-bg-border bg-bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-text-muted">Page {page + 1}</span>
              <button
                disabled={(page + 1) * 24 >= (productsData?.total ?? 0)}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-bg-border bg-bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
