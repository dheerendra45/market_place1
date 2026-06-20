import { useState, useMemo } from 'react';
import { Shield, CheckCircle, Circle, AlertCircle, Star } from 'lucide-react';

// ── Tier Badge ────────────────────────────────────
const tierColors: Record<string, string> = {
  gold: 'bg-accent-yellow text-[#1C1B19]',
  silver: 'bg-silver-badge text-white',
  bronze: 'bg-bronze-badge text-white',
};

export function TierBadge({ tier }: { tier: string }) {
  const cls = tierColors[tier?.toLowerCase()] || tierColors.bronze;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${cls}`}>
      {tier}
    </span>
  );
}

// ── Verified Badge ────────────────────────────────
export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} title="Verified">
      <CheckCircle className="h-4 w-4 text-status-blue" />
    </span>
  );
}

// ── Company Logo (with graceful initials fallback) ─
/** Reduce a hostname to its registrable root so favicon lookups resolve
 *  (e.g. support.atlassian.com → atlassian.com, foo.co.uk stays foo.co.uk). */
function rootDomain(domain: string): string {
  const parts = domain.split('.').filter(Boolean);
  if (parts.length <= 2) return domain;
  const twoLevel = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
  if (twoLevel.has(parts[parts.length - 2])) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export function CompanyLogo({
  name,
  logo: _logo,
  domain,
  size = 48,
  className = '',
}: {
  name: string;
  logo?: string | null;
  domain?: string | null;
  size?: number;
  className?: string;
}) {
  // Google's favicon service returns a real logo where it has one, and a tiny
  // (~16px) generic globe where it doesn't. We render the image, then gate on
  // the natural pixel size: anything smaller than a real logo is treated as
  // "missing" and we fall back to a branded gold monogram. This avoids the
  // grey placeholder problem (services return 200 + a generic icon, so onError
  // alone never fires).
  const src = useMemo(() => {
    if (!domain) return null;
    return `https://www.google.com/s2/favicons?domain=${rootDomain(domain)}&sz=64`;
  }, [domain]);

  // 'probe' = loading/measuring, 'ok' = real logo, 'fallback' = monogram
  const [status, setStatus] = useState<'probe' | 'ok' | 'fallback'>(src ? 'probe' : 'fallback');

  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const box = `relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-bg-border bg-white ${className}`;

  return (
    <div className={box} style={{ width: size, height: size }}>
      {status !== 'ok' && (
        <span
          className="font-bold text-accent-yellow"
          style={{ fontSize: size * 0.34 }}
        >
          {initials}
        </span>
      )}
      {src && status !== 'fallback' && (
        <img
          src={src}
          alt={`${name} logo`}
          loading="lazy"
          onLoad={(e) => {
            // Real favicons come back ≥ ~24px; the generic globe is ~16px.
            const w = (e.currentTarget as HTMLImageElement).naturalWidth;
            setStatus(w >= 24 ? 'ok' : 'fallback');
          }}
          onError={() => setStatus('fallback')}
          className={`absolute inset-0 h-full w-full object-contain p-1.5 ${
            status === 'ok' ? '' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

// ── Star Rating ───────────────────────────────────
export function StarRating({
  rating,
  count,
  size = 14,
}: {
  rating: number;
  count?: number;
  size?: number;
}) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold text-text-primary">{rating.toFixed(1)}</span>
      <div className="flex items-center" style={{ gap: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < full || (i === full && half);
          return (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className={filled ? 'fill-accent-yellow text-accent-yellow' : 'fill-bg-border text-bg-border'}
            />
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-xs text-text-muted">({count.toLocaleString()})</span>
      )}
    </div>
  );
}

// ── Trust Score ───────────────────────────────────
export function TrustScore({ score }: { score: number }) {
  const color = score >= 80 ? '#15803D' : score >= 60 ? '#B45309' : '#DC2626';
  const circumference = 2 * Math.PI * 36;
  const dashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#E6E1D6" strokeWidth="5" />
        <circle
          cx="40" cy="40" r="36" fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Guard Tag ─────────────────────────────────────
export function GuardTag({ code, label }: { code: string; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary"
      title={code}
    >
      <span className="font-mono text-[10px] font-semibold text-accent-yellow">{code}</span>
      {label && <span className="text-text-secondary">{label}</span>}
    </span>
  );
}

// ── Tag chip (deployment / feature pills) ─────────
export function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'gold' | 'green';
}) {
  const tones = {
    neutral: 'border-bg-border bg-bg-elevated text-text-secondary',
    gold: 'border-accent-yellow/40 bg-accent-soft text-[#7A5B00]',
    green: 'border-status-green/30 bg-status-green/10 text-status-green',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ── Fit Level Badge ───────────────────────────────
const fitColors: Record<string, string> = {
  full: 'bg-status-green/10 text-status-green border-status-green/30',
  partial: 'bg-status-amber/10 text-status-amber border-status-amber/30',
  enabling: 'bg-status-blue/10 text-status-blue border-status-blue/30',
  weak: 'bg-status-red/10 text-status-red border-status-red/30',
};

export function FitLevelBadge({ level }: { level: string }) {
  const cls = fitColors[level?.toLowerCase()] || fitColors.weak;
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {level} fit
    </span>
  );
}

// ── Confidence Badge ──────────────────────────────
export function ConfidenceBadge({ confidence }: { confidence: string }) {
  const color =
    confidence === 'DOCUMENTED'
      ? 'text-status-green'
      : confidence === 'DIRECTIONAL'
        ? 'text-text-muted'
        : 'text-status-amber';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${color}`}>
      <Shield className="h-3.5 w-3.5" /> {confidence}
    </span>
  );
}

// ── Surface Status Badge ──────────────────────────
export function SurfaceStatus({ status }: { status: string }) {
  const map: Record<string, { icon: typeof Circle; color: string; label: string }> = {
    surfacing: { icon: Circle, color: 'text-status-green', label: 'SURFACING' },
    dormant: { icon: Circle, color: 'text-text-muted', label: 'DORMANT' },
    ready: { icon: AlertCircle, color: 'text-status-amber', label: 'READY' },
  };
  const cfg = map[status] || map.dormant;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

// ── Loading Skeleton (mirrors the redesigned ProductCard) ──
export function CardSkeleton() {
  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-bg-border bg-bg-surface">
      <div className="skeleton aspect-video w-full rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="skeleton h-5 w-1/2" />
          <div className="skeleton h-5 w-12 rounded" />
        </div>
        <div className="skeleton mb-4 h-3.5 w-1/3" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="skeleton h-6 w-16 rounded" />
          <div className="skeleton h-6 w-16 rounded" />
        </div>
        <div className="mt-auto grid grid-cols-3 gap-3 border-t border-bg-border pt-4">
          <div className="skeleton h-9 w-full" />
          <div className="skeleton h-9 w-full" />
          <div className="skeleton h-9 w-full" />
        </div>
      </div>
    </div>
  );
}

// ── Error State ───────────────────────────────────
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-20 text-center">
      <div className="text-5xl">⚠</div>
      <p className="text-base text-text-secondary">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-accent">
          Try again
        </button>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────
export function EmptyState({ message = 'No results found.' }: { message?: string }) {
  return <div className="py-20 text-center text-base text-text-muted">{message}</div>;
}

// ── Compliance / certification badges (placeholders) ──────────────────
const COMPLIANCE = ['SOC 2 Type II', 'ISO 27001', 'GDPR', 'HIPAA', 'PCI DSS'];

export function ComplianceBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {COMPLIANCE.map((c) => (
        <span
          key={c}
          className="inline-flex items-center gap-2 rounded-md border border-bg-border bg-bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary"
        >
          <Shield className="h-3.5 w-3.5 text-accent-yellow" />
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Pip Badge (small status badge with a coloured dot) ─────────────────
type PipTone = 'gold' | 'green' | 'blue' | 'neutral';
const pipTones: Record<PipTone, { box: string; dot: string }> = {
  gold: { box: 'border-accent-yellow/40 bg-accent-soft text-[#7A5B00]', dot: 'bg-accent-yellow' },
  green: { box: 'border-status-green/30 bg-status-green/10 text-status-green', dot: 'bg-status-green' },
  blue: { box: 'border-status-blue/30 bg-status-blue/10 text-status-blue', dot: 'bg-status-blue' },
  neutral: { box: 'border-bg-border bg-bg-elevated text-text-secondary', dot: 'bg-text-muted' },
};

export function PipBadge({ label, tone = 'gold' }: { label: string; tone?: PipTone }) {
  const t = pipTones[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${t.box}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

// ── Vendor Badges (cosmetic placeholders — label-only, never affect rating) ──
export function VendorBadges({
  verified = true,
  guardMapped = true,
  foundingPartner = true,
  gold = false,
  className = '',
}: {
  verified?: boolean;
  guardMapped?: boolean;
  foundingPartner?: boolean;
  gold?: boolean;
  className?: string;
}) {
  const items: { label: string; tone: PipTone }[] = [];
  if (verified) items.push({ label: 'Verified', tone: 'blue' });
  if (guardMapped) items.push({ label: 'GUARD-Mapped', tone: 'gold' });
  if (gold) items.push({ label: 'Gold Tier', tone: 'gold' });
  if (foundingPartner) items.push({ label: 'Founding Partner', tone: 'neutral' });
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.map((b) => (
        <PipBadge key={b.label} label={b.label} tone={b.tone} />
      ))}
    </div>
  );
}
