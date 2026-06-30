import type { NormalisedVendor } from '../api/client';

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Stable star rating (3.9–4.9) derived from the product's score + id. */
export function pseudoRating(p: NormalisedVendor): number {
  const base = p.ai_verdict ? 3.6 + (p.ai_verdict / 100) * 1.2 : 4.0;
  const jitter = (seeded(p.id) - 0.5) * 0.3;
  return Math.min(4.9, Math.max(3.8, Math.round((base + jitter) * 10) / 10));
}

/** Stable review count (a few hundred → a few thousand). */
export function pseudoReviews(p: NormalisedVendor): number {
  return Math.round(280 + seeded(p.id + 7) * 5200);
}

/** "AVG APS" headline metric — earned-coverage proxy from controls + score. */
export function pseudoAps(p: NormalisedVendor): number {
  if (p.ai_verdict) return Math.min(98, Math.max(48, p.ai_verdict));
  return p.controls.length ? Math.min(95, 50 + p.controls.length * 11) : 55;
}

/** Number of mapped tasks/controls (min 1 for display). */
export function taskCount(p: NormalisedVendor): number {
  return p.controls.length || 1;
}

/** Listing type — product, service, or hybrid (both). Stored on the product's
 *  optional_metadata; defaults to 'product' for legacy rows that predate it. */
export type ListingType = 'product' | 'service' | 'hybrid';
export function listingType(p: NormalisedVendor): ListingType {
  // Prefer the promoted top-level column; fall back to optional_metadata for
  // any row not yet backfilled.
  const t = p.listing_type ?? p.optional_metadata?.listing_type;
  return t === 'service' || t === 'hybrid' ? t : 'product';
}
export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  product: 'Product',
  service: 'Service',
  hybrid: 'Hybrid',
};
/** Whether a listing should appear under the Services view (service or hybrid). */
export const isServiceListing = (p: NormalisedVendor) => listingType(p) !== 'product';
/** Whether a listing should appear under the Products view (product or hybrid). */
export const isProductListing = (p: NormalisedVendor) => listingType(p) !== 'service';

/** Deployment tags shown on the card — deployment TYPES only (not pricing). */
export function deploymentTags(p: NormalisedVendor): string[] {
  const tags = ['Cloud'];
  tags.push(seeded(p.id + 3) > 0.5 ? 'On-Premise' : 'Hybrid');
  if (seeded(p.id + 9) > 0.6) tags.push('SaaS');
  return Array.from(new Set(tags));
}

/** Pricing label — top-tier products read "Custom", others "Free Trial". */
export function priceLabel(p: NormalisedVendor): string {
  return (p.ai_verdict ?? 0) >= 80 ? 'Custom' : 'Free Trial';
}

/** A warm gradient for the product thumbnail, varied but on-brand. */
export function thumbGradient(p: NormalisedVendor): string {
  const hue = Math.floor(seeded(p.id + 5) * 30) + 38; // warm gold-ish band
  return `linear-gradient(135deg, hsl(${hue} 85% 60%) 0%, hsl(${hue - 8} 70% 48%) 55%, #2A2620 100%)`;
}

/** A stable preview clip per product (Google's public sample bucket — reliable,
 *  muted, lazy-loaded only on hover). Placeholder media until real demos exist. */
const PREVIEW_CLIPS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
];
export function previewVideo(p: NormalisedVendor): string {
  return PREVIEW_CLIPS[Math.floor(seeded(p.id + 13) * PREVIEW_CLIPS.length) % PREVIEW_CLIPS.length];
}
