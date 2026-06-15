import { useState } from 'react';
import { useVendors, useStats } from '../hooks/useData';
import VendorCard from '../components/VendorCard';
import PageContainer from '../components/PageContainer';
import { CardSkeleton, ErrorState, EmptyState } from '../components/ui';
import { Search } from 'lucide-react';

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  const { data: vendorsData, isLoading, isError, refetch } = useVendors({
    search: searchQuery || undefined,
    page,
    page_size: 24,
  });

  const { data: stats } = useStats();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0); // reset page on search
  };

  const vendors = vendorsData?.data || [];

  return (
    <PageContainer className="py-14 sm:py-16">
      {/* Header */}
      <div className="mb-9">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent-yellow/40 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A5B00]">
          Vendor Directory
        </span>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
          Explore Vendors
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-text-secondary">
          Browse the security and resilience companies behind every product — explore their
          portfolios and inspect verified operational footprint.
        </p>
      </div>

      {/* Search and stats bar */}
      <div className="mb-10 flex flex-col gap-5 border-b border-bg-border pb-8 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className="h-5 w-5 text-text-muted" />
          </div>
          <input
            type="text"
            className="block h-14 w-full rounded-lg border border-bg-border bg-bg-elevated py-3 pl-12 pr-4 text-base text-text-primary placeholder-text-muted transition-colors focus:border-accent-yellow focus:outline-none"
            placeholder="Search vendors by name, headquarters, or role..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <div className="rounded-xl border border-bg-border bg-bg-surface px-4 py-3 font-mono text-[13px] text-text-secondary">
          {stats?.vendor_count ?? 46} vendors · {stats?.product_count ?? 55} products
        </div>
      </div>

      {/* Grid or States */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Could not retrieve vendors from database." onRetry={refetch} />
      ) : vendors.length === 0 ? (
        <EmptyState message="No vendors found matching your search parameters." />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {vendors.map((vendor) => (
              <VendorCard key={vendor._id} vendor={vendor} />
            ))}
          </div>

          {/* Pagination */}
          {vendors.length >= 24 && (
            <div className="mt-12 flex justify-center gap-4">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 border border-bg-border rounded text-xs font-bold text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                className="px-4 py-2 border border-bg-border rounded text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
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
