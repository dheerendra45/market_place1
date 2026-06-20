import { Link, Navigate } from 'react-router-dom';
import {
  Building2,
  Search,
  ArrowRight,
  LogOut,
  Mail,
  ShieldCheck,
  Loader2,
  Workflow,
  FileCheck2,
  Video,
  Award,
  CheckCircle2,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PageContainer from '../components/PageContainer';

// Profile-completion steps (placeholder — `done` would come from real data).
const PROFILE_STEPS: { label: string; hint: string; done: boolean; icon: typeof Mail }[] = [
  { label: 'Verify work email', hint: 'Confirmed', done: true, icon: Mail },
  { label: 'Map product to GUARD', hint: '13 categories', done: true, icon: Workflow },
  { label: 'Add E1–E5 evidence', hint: 'Strengthens your rating', done: false, icon: FileCheck2 },
  { label: 'Upload a demo video', hint: 'Show your product', done: false, icon: Video },
  { label: 'Add certifications', hint: 'SOC 2, ISO 27001…', done: false, icon: Award },
  { label: 'Add customer proof', hint: 'Named deployments', done: false, icon: ShieldCheck },
];

// Placeholder qualifying questions shown on the vendor dashboard.
const PROFILE_QUESTIONS: { q: string; options: string[] }[] = [
  { q: 'Primary GUARD category?', options: ['Cyber', 'Data', 'Third-Party', 'Operations'] },
  { q: 'Company size?', options: ['1–50', '51–200', '201–1000', '1000+'] },
  { q: 'Deployment model?', options: ['SaaS', 'Self-hosted', 'Hybrid'] },
];

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

      {/* Profile completion + onboarding prompts (vendors) */}
      {isVendor && (
        <div className="mb-10 space-y-6">
          {(() => {
            const done = PROFILE_STEPS.filter((s) => s.done).length;
            const pct = Math.round((done / PROFILE_STEPS.length) * 100);
            return (
              <div className="rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">
                      Complete your vendor profile
                    </h2>
                    <p className="mt-0.5 text-sm text-text-muted">
                      A complete profile earns a stronger Defence Rating and better placement.
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-bold text-accent-yellow">{pct}%</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Complete
                    </div>
                  </div>
                </div>
                <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent-yellow transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PROFILE_STEPS.map((s) => {
                    const Icon = s.done ? CheckCircle2 : s.icon;
                    return (
                      <div
                        key={s.label}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                          s.done
                            ? 'border-bg-border bg-bg-elevated'
                            : 'border-accent-yellow/30 bg-accent-soft/40 hover:border-accent-yellow/60'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 ${s.done ? 'text-status-green' : 'text-accent-yellow'}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {s.label}
                          </div>
                          <div className="truncate text-xs text-text-muted">
                            {s.done ? 'Done' : s.hint}
                          </div>
                        </div>
                        {!s.done && <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Quick qualifying questions (placeholder) */}
          <div className="rounded-2xl border border-bg-border bg-bg-surface p-6">
            <div className="mb-1.5 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-accent-yellow" />
              <h3 className="text-base font-semibold text-text-primary">A few quick questions</h3>
            </div>
            <p className="mb-5 text-sm text-text-muted">
              Help us tailor your listing and incident matching.
            </p>
            <div className="space-y-4">
              {PROFILE_QUESTIONS.map((item, qi) => (
                <div key={item.q}>
                  <div className="mb-2 text-sm font-medium text-text-secondary">{item.q}</div>
                  <div className="flex flex-wrap gap-2">
                    {item.options.map((opt, oi) => (
                      <button
                        key={opt}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                          qi === 0 && oi === 0
                            ? 'border-accent-yellow bg-accent-soft text-[#7A5B00]'
                            : 'border-bg-border bg-bg-surface text-text-secondary hover:border-accent-yellow/50'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
