import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { NormalisedVendor } from '../api/client';
import { VerifiedBadge, CompanyLogo, Chip } from './ui';
import {
  deploymentTags,
  priceLabel,
  thumbGradient,
} from '../lib/display';

export default function ProductCard({ product }: { product: NormalisedVendor }) {
  const navigate = useNavigate();
  const category =
    product.guard_categories[0]?.label || product.vendor_group || 'Security Intelligence';
  const tags = deploymentTags(product);
  // Real Defence Rating (or "—" when not yet computed / still provisional).
  const dr = product.defense_rating;
  const drDisplay = dr && dr.status !== 'provisional' ? String(dr.rating) : '—';
  // Prefer the vendor's real pricing model; fall back to the display label.
  const price = product.optional_metadata?.pricing_model || priceLabel(product);

  // Hover-to-play: the YouTube <iframe> is only mounted on hover, so nothing
  // loads until the user hovers the thumbnail (lazy). The poster image is the
  // real YouTube thumbnail (maxres → hqdefault → branded gradient fallback).
  const ytId = product.video_id || null;
  const [hover, setHover] = useState(false);
  const [thumbLevel, setThumbLevel] = useState(0); // 0=maxres 1=hq 2=gradient
  const thumbUrl = ytId
    ? `https://img.youtube.com/vi/${ytId}/${thumbLevel === 0 ? 'maxresdefault' : 'hqdefault'}.jpg`
    : null;
  const showGradient = !ytId || thumbLevel >= 2;

  return (
    <Link
      to={`/marketplace/product/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-surface shadow-[0_1px_2px_rgba(28,27,25,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-accent-yellow/60 hover:shadow-[0_14px_36px_rgba(28,27,25,0.10)]"
    >
      {/* ── Thumbnail / demo (hover to play) ── */}
      <div
        className="relative aspect-video w-full overflow-hidden bg-[#1C1B19]"
        style={showGradient ? { background: thumbGradient(product) } : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* poster thumbnail */}
        {thumbUrl && !showGradient && (
          <img
            src={thumbUrl}
            alt={`${product.product_name} preview`}
            loading="lazy"
            onError={() => setThumbLevel((l) => l + 1)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* hover preview — lazy YouTube embed (muted autoplay loop) */}
        {hover && ytId && (
          <iframe
            title={`${product.product_name} demo`}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&modestbranding=1&playsinline=1&rel=0`}
            allow="autoplay; encrypted-media"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
        {/* play button (hidden while previewing) */}
        {!hover && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-yellow shadow-lg transition-transform duration-300 group-hover:scale-110">
              <Play className="h-5 w-5 translate-x-0.5 fill-[#1C1B19] text-[#1C1B19]" />
            </span>
          </div>
        )}
        {!hover && (
          <span className="absolute bottom-3 right-3 rounded bg-[#1C1B19]/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Demo
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col p-5">
        {/* logo + title */}
        <div className="mb-2.5 flex items-start gap-3">
          <CompanyLogo
            name={product.vendor_name}
            logo={product.vendor_logo}
            domain={product.vendor_domain}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[16px] font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent-yellow [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box] overflow-hidden">
                {product.product_name}
                {product.verified && <VerifiedBadge className="ml-1 inline-flex translate-y-0.5" />}
              </h3>
              {!product.verified && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/onboarding'); }}
                  className="shrink-0 rounded-full border border-accent-yellow/50 bg-accent-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7A5B00] transition-colors hover:bg-accent-yellow hover:text-[#1C1B19]"
                >
                  Claim
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-text-secondary">
              <span className="text-text-muted">by</span>
              <span className="truncate font-medium text-text-primary">{product.vendor_name}</span>
              <span className="text-text-muted">·</span>
              <span className="truncate text-text-secondary">{category}</span>
            </div>
          </div>
        </div>

        {/* description */}
        <p className="mb-4 line-clamp-2 text-[13.5px] leading-relaxed text-text-secondary">
          {product.description}
        </p>

        {/* deployment tags */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>

        {/* control chips */}
        {product.controls.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {product.controls.slice(0, 3).map((c) => (
              <span
                key={c}
                className="truncate rounded-md border border-dashed border-bg-border bg-bg-elevated px-2 py-1 font-mono text-[10.5px] text-text-muted"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* footer stats */}
        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-bg-border pt-4 text-center">
          <div>
            <div className="text-lg font-bold text-accent-yellow">{drDisplay}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Defence Rating
            </div>
          </div>
          <div className="border-l border-bg-border">
            <div className="truncate text-lg font-bold text-text-primary">{price}</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Price
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
