import { Link, Navigate } from 'react-router-dom';
import {
  Building2,
  Search,
  ArrowRight,
  LogOut,
  Mail,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PageContainer from '../components/PageContainer';

export default function AccountPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent-yellow" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/account' }} />;
  }

  const isVendor = user.role === 'vendor';
  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <PageContainer className="py-14 sm:py-16">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-yellow/30 bg-accent-soft text-lg font-bold text-accent-yellow">
            {initials}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              {user.name || 'Your account'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-text-muted">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
              <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-accent-yellow/40 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#7A5B00]">
                {isVendor ? <Building2 className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                {user.role}
              </span>
            </div>
          </div>
        </div>
        <button onClick={logout} className="btn btn-secondary btn-sm self-start sm:self-auto">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {/* Role-aware actions */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {isVendor ? (
          <>
            <ActionCard
              icon={<Building2 className="h-5 w-5 text-accent-yellow" />}
              title="List or manage your product"
              body="Onboard a product, map it to the GUARD framework, and submit it for review."
              to="/onboarding"
              cta="Go to onboarding"
            />
            <ActionCard
              icon={<ShieldCheck className="h-5 w-5 text-accent-yellow" />}
              title="See how the Defence Rating works"
              body="Understand the evidence tiers and how verified proof drives your rating."
              to="/marketplace"
              cta="Explore the marketplace"
            />
          </>
        ) : (
          <>
            <ActionCard
              icon={<Search className="h-5 w-5 text-accent-yellow" />}
              title="Explore the marketplace"
              body="Discover security products mapped to live incidents and verified by evidence."
              to="/marketplace"
              cta="Browse products"
            />
            <ActionCard
              icon={<Building2 className="h-5 w-5 text-accent-yellow" />}
              title="Browse vendors"
              body="Compare vendors across the 13 GUARD risk categories."
              to="/vendors"
              cta="View vendors"
            />
          </>
        )}
      </div>

      {/* Account details */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Account details
        </h2>
        <div className="surface-card divide-y divide-bg-border">
          <DetailRow label="Name" value={user.name || '—'} />
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Account type" value={user.role} capitalize />
          {isVendor && (
            <DetailRow
              label="Company"
              value={
                user.company_name
                  ? user.vendor_id
                    ? `${user.company_name} · linked to a verified vendor`
                    : user.company_name
                  : '—'
              }
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function ActionCard({
  icon,
  title,
  body,
  to,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  to: string;
  cta: string;
}) {
  return (
    <Link to={to} className="surface-card group flex flex-col p-6">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent-yellow/30 bg-accent-soft">
        {icon}
      </span>
      <h3 className="mb-2 text-base font-semibold text-text-primary">{title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-text-secondary">{body}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary transition-colors group-hover:text-accent-yellow">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function DetailRow({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm text-text-muted">{label}</span>
      <span className={`text-sm font-medium text-text-primary ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </span>
    </div>
  );
}
