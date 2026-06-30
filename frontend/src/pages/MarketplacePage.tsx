import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts, useStats, useGuardCategories } from '../hooks/useData';
import ProductCard from '../components/ProductCard';
import PageContainer from '../components/PageContainer';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { Search, SlidersHorizontal, Check } from 'lucide-react';

const FILTER_PILLS = [
  { id: 'all', label: 'All Products' },
  { id: 'verified', label: 'Full Fit' },
  { id: 'gold', label: 'Gold Tier' },
  { id: 'incident_handler', label: 'Incident Handlers' },
  { id: 'risk_coverage', label: 'Risk Coverage' },
];

const LISTING_TABS = [
  { id: 'all', label: 'All' },
  { id: 'product', label: 'Products' },
  { id: 'service', label: 'Services' },
];

const PAGE_SIZE = 24;

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [activeFilter, setActiveFilter] = useState('all');
  const [listingType, setListingType] = useState<'all' | 'product' | 'service'>(
    () => (searchParams.get('type') as 'product' | 'service') || 'all',
  );
  const [guardCode, setGuardCode] = useState(() => searchParams.get('guard') || '');
  const [freeTrial, setFreeTrial] = useState(false);
  const [page, setPage] = useState(0);

  // Keep the URL in sync so searches/filters are shareable + survive reloads.
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery) next.set('q', searchQuery);
    if (listingType !== 'all') next.set('type', listingType);
    if (guardCode) next.set('guard', guardCode);
    setSearchParams(next, { replace: true });
  }, [searchQuery, listingType, guardCode, setSearchParams]);

  // If the user arrives via a new hero search (?q=…), reflect it into the box.
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchQuery((prev) => (prev === q ? prev : q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('q')]);

  const fitLevelParam = activeFilter === 'verified' ? 'full' : undefined;
  const vendorGroupParam = ['incident_handler', 'risk_coverage'].includes(activeFilter)
    ? activeFilter
    : undefined;

  // Fetch the full matching catalog (server caps page_size at 100; the catalog
  // is well under that) so the type / GUARD / free-trial filters below apply
  // across everything, then paginate client-side.
  const { data: productsData, isLoading, isError, refetch } = useProducts({
    search: searchQuery || undefined,
    page: 0,
    page_size: 100,
    fit_level: fitLevelParam,
    vendor_group: vendorGroupParam,
  });

  const { data: stats } = useStats();
  const { data: guardCats } = useGuardCategories();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const handleFilterClick = (filterId: string) => {
    setActiveFilter(filterId);
    setPage(0);
  };

  // ── Client-side filtering across the fetched catalog ──
  let filtered = productsData?.data || [];
  if (activeFilter === 'gold') {
    filtered = filtered.filter((p) => p.placement === 'sponsored_spotlight');
  }
  if (listingType !== 'all') {
    filtered = filtered.filter((p) => {
      const t = p.optional_metadata?.listing_type === 'service' ? 'service' : 'product';
      return t === listingType;
    });
  }
  if (freeTrial) {
    filtered = filtered.filter((p) => !!p.optional_metadata?.free_trial);
  }
  if (guardCode) {
    filtered = filtered.filter((p) => p.guard_categories.some((g) => g.code === guardCode));
  }

  const total = filtered.length;
  const pageProducts = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveRefiners = listingType !== 'all' || !!guardCode || freeTrial;

  return (
    <PageContainer className="py-14 sm:py-16">
      {/* ── Header ── */}
      <div className="mb-9">
        <span className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
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

        {/* Listing type tabs + refiners */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex rounded-xl border border-bg-border bg-bg-surface p-1">
            {LISTING_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setListingType(tab.id as 'all' | 'product' | 'service');
                  setPage(0);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  listingType === tab.id
                    ? 'bg-accent-yellow text-[#1C1B19]'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={guardCode}
              onChange={(e) => {
                setGuardCode(e.target.value);
                setPage(0);
              }}
              className="h-10 rounded-lg border border-bg-border bg-bg-surface px-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent-yellow/50 focus:border-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/20"
            >
              <option value="">All GUARD categories</option>
              {(guardCats || []).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setFreeTrial((v) => !v);
                setPage(0);
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all ${
                freeTrial
                  ? 'border-accent-yellow bg-accent-yellow text-[#1C1B19]'
                  : 'border-bg-border bg-bg-surface text-text-secondary hover:border-accent-yellow/50 hover:text-text-primary'
              }`}
            >
              <Check className={`h-4 w-4 ${freeTrial ? 'opacity-100' : 'opacity-30'}`} />
              Free trial
            </button>
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
      ) : pageProducts.length === 0 ? (
        <EmptyState
          message={
            hasActiveRefiners || searchQuery
              ? 'No listings match these filters. Try clearing a filter or search.'
              : 'No products found matching the search parameters.'
          }
        />
      ) : (
        <div>
          <div className="mb-5 text-sm text-text-muted">
            {total} {total === 1 ? 'result' : 'results'}
            {searchQuery && (
              <>
                {' '}for <span className="font-semibold text-text-secondary">“{searchQuery}”</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pageProducts.map((prod) => (
              <ProductCard key={prod._id} product={prod} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-bg-border bg-bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-text-muted">
                Page {page + 1} of {pageCount}
              </span>
              <button
                disabled={page + 1 >= pageCount}
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
