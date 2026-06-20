import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import type { NormalisedVendor } from '../api/client';
import { VerifiedBadge, CompanyLogo, VendorBadges } from './ui';

export default function VendorCard({ vendor }: { vendor: NormalisedVendor }) {
  const products = vendor.product_count ?? 1;
  const score = vendor.ai_verdict;

  return (
    <Link
      to={`/vendors/${vendor.id}`}
      className="group flex h-full flex-col rounded-2xl border border-bg-border bg-bg-surface p-6 shadow-[0_1px_2px_rgba(28,27,25,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-accent-yellow/60 hover:shadow-[0_14px_36px_rgba(28,27,25,0.10)]"
    >
      {/* header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo
            name={vendor.vendor_name}
            logo={vendor.vendor_logo}
            domain={vendor.vendor_domain}
            size={48}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-semibold text-text-primary transition-colors group-hover:text-accent-yellow">
                {vendor.vendor_name}
              </h3>
              <VerifiedBadge className="shrink-0" />
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{vendor.headquarters || 'Location unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* badges (cosmetic placeholders) */}
      <VendorBadges
        className="mb-4"
        gold={vendor.placement === 'sponsored_spotlight'}
      />

      {/* description */}
      <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-text-secondary">
        {vendor.description || 'Verified vendor within the Attacked.ai Defence Layer framework.'}
      </p>

      {/* stats */}
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-bg-border pt-4 text-center">
        <div>
          <div className="text-base font-bold text-text-primary">{products}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Products
          </div>
        </div>
        <div className="border-x border-bg-border">
          <div className="text-base font-bold text-text-primary">
            {vendor.entity_type ? vendor.entity_type.split('_')[0] : '—'}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Type
          </div>
        </div>
        <div>
          <div className="text-base font-bold text-accent-yellow">{score ?? '—'}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Top Score
          </div>
        </div>
      </div>

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary transition-colors group-hover:text-accent-yellow">
        View profile
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
