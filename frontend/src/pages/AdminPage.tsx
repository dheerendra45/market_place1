import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import type { AdminStats, ReviewStatus } from '../api/client';
import {
  Lock, LogOut, Loader2, CheckCircle2, XCircle, Clock, HelpCircle,
  Inbox, FileText, Link2, BadgeCheck, AlertTriangle, RefreshCw, Mail, Box, X, Send,
} from 'lucide-react';

const TABS: { key: ReviewStatus; label: string; icon: any }[] = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'needs_info', label: 'Needs info', icon: HelpCircle },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
];

const STATUS_TONE: Record<string, string> = {
  pending: 'border-status-amber/30 bg-status-amber/10 text-status-amber',
  needs_info: 'border-status-blue/30 bg-status-blue/10 text-status-blue',
  approved: 'border-status-green/30 bg-status-green/10 text-status-green',
  rejected: 'border-status-red/30 bg-status-red/10 text-status-red',
};

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return String(iso); }
};
const arr = (x: any): string[] => (Array.isArray(x) ? x.filter(Boolean) : []);

/* ════════════════════════════════════════════════════════════════════ */
export default function AdminPage() {
  const [authed, setAuthed] = useState(!!api.getAdminToken());
  const [checking, setChecking] = useState(!!api.getAdminToken());

  useEffect(() => {
    if (!api.getAdminToken()) { setChecking(false); return; }
    api.adminCheckSession()
      .then(() => setAuthed(true))
      .catch(() => { api.clearAdminToken(); setAuthed(false); })
      .finally(() => setChecking(false));
  }, []);

  // Document title hint (still hidden — no nav points here).
  useEffect(() => { document.title = 'Admin · Attacked.ai'; }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <Loader2 className="h-7 w-7 animate-spin text-accent-yellow" />
      </div>
    );
  }
  if (!authed) return <AdminLogin onAuthed={() => setAuthed(true)} />;
  return <AdminConsole onLogout={() => { api.clearAdminToken(); setAuthed(false); }} />;
}

/* ── Login ──────────────────────────────────────────────────────────── */
function AdminLogin({ onAuthed }: { onAuthed: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { token } = await api.adminLogin(pw);
      api.setAdminToken(token);
      onAuthed();
    } catch (e: any) { setErr(e.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-bg-border bg-bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/attacked-mark.svg" alt="Attacked.ai" className="mb-3 h-12 w-12" />
          <span className="flex items-baseline text-[22px] font-semibold tracking-tight text-text-primary">
            Attacked<span className="text-accent-yellow">.ai</span>
            <sup className="ml-0.5 text-[0.5em] font-medium text-text-muted">™</sup>
          </span>
          <p className="mt-1 text-sm text-text-secondary">Admin Review Console</p>
        </div>
        <label className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          Admin password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus
            placeholder="••••••••"
            className="w-full rounded-lg border border-bg-border bg-bg-primary py-2.5 pl-9 pr-3 text-sm text-text-primary focus:border-accent-yellow focus:outline-none"
          />
        </div>
        {err && <p className="mt-3 flex items-center gap-1.5 text-sm text-status-red"><AlertTriangle className="h-4 w-4" /> {err}</p>}
        <button type="submit" disabled={busy || !pw} className="btn btn-primary mt-5 w-full">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-[11px] text-text-muted">Authorised personnel only.</p>
      </form>
    </div>
  );
}

/* ── Console ─────────────────────────────────────────────────────────── */
function AdminConsole({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const [list, setList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const guardAuth = (e: any) => { if (e instanceof api.AdminAuthError) onLogout(); else setErr(e.message || 'Something went wrong.'); };

  const refreshStats = useCallback(() => { api.adminStats().then(setStats).catch(guardAuth); }, []);
  const refreshActivity = useCallback(() => { api.adminActivity().then(setActivity).catch(() => {}); }, []);

  const loadList = useCallback((t: ReviewStatus) => {
    setLoadingList(true);
    api.adminListSubmissions(t)
      .then((rows) => { setList(rows); if (rows[0]) setSelectedId((cur) => cur ?? rows[0].id); })
      .catch(guardAuth)
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => { refreshStats(); refreshActivity(); }, [refreshStats, refreshActivity]);
  useEffect(() => { setSelectedId(null); setDetail(null); loadList(tab); }, [tab, loadList]);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    setLoadingDetail(true);
    api.adminGetSubmission(selectedId).then(setDetail).catch(guardAuth).finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const afterAction = () => { refreshStats(); refreshActivity(); loadList(tab); if (selectedId) api.adminGetSubmission(selectedId).then(setDetail).catch(() => {}); };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-bg-border bg-bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img src="/attacked-mark.svg" alt="Attacked.ai" className="h-9 w-9" />
              <span className="flex items-baseline text-[19px] font-semibold tracking-tight text-text-primary">
                Attacked<span className="text-accent-yellow">.ai</span>
                <sup className="ml-0.5 text-[0.5em] font-medium text-text-muted">™</sup>
              </span>
            </div>
            <span className="hidden rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary sm:inline">
              Admin · Review Console
            </span>
          </div>
          <button onClick={onLogout} className="btn btn-outline btn-sm"><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6">
        {err && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-status-red/30 bg-status-red/5 px-4 py-2 text-sm text-status-red">
            <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> {err}</span>
            <button onClick={() => setErr('')} className="text-xs underline">dismiss</button>
          </div>
        )}

        {/* Stat row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Submissions" value={stats?.total_submissions} icon={Inbox} />
          <Stat label="Pending" value={stats?.pending} icon={Clock} tone="amber" />
          <Stat label="Needs info" value={stats?.needs_info} icon={HelpCircle} tone="blue" />
          <Stat label="Approved" value={stats?.approved} icon={CheckCircle2} tone="green" />
          <Stat label="Rejected" value={stats?.rejected} icon={XCircle} tone="red" />
          <Stat label="Vendors" value={stats?.total_vendors} icon={Box} />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr_300px]">
          {/* Pipeline */}
          <section className="lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {TABS.map((t) => {
                const count = stats ? (stats as any)[t.key] : undefined;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                      tab === t.key ? 'border-accent-yellow bg-accent-soft text-text-primary' : 'border-bg-border bg-bg-surface text-text-secondary hover:border-accent-yellow/50'
                    }`}>
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                    {count !== undefined && <span className="rounded-full bg-bg-elevated px-1.5 text-[10px] text-text-muted">{count}</span>}
                  </button>
                );
              })}
            </div>
            {loadingList ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-accent-yellow" /></div>
            ) : list.length === 0 ? (
              <div className="rounded-xl border border-dashed border-bg-border py-12 text-center text-sm text-text-muted">No {tab.replace('_', ' ')} submissions.</div>
            ) : (
              <div className="space-y-2">
                {list.map((s) => (
                  <button key={s.id} onClick={() => setSelectedId(s.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-all ${
                      selectedId === s.id ? 'border-accent-yellow bg-accent-soft/50' : 'border-bg-border bg-bg-surface hover:border-accent-yellow/50'
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">{s.product_name}</div>
                        <div className="truncate text-xs text-text-secondary">{s.vendor_name}</div>
                      </div>
                      <StatusChip status={s.review_status} small />
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-text-muted">
                      <Clock className="h-3 w-3" /> {fmt(s.submitted_at || s.created_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Dossier */}
          <section className="min-w-0">
            {loadingDetail ? (
              <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-accent-yellow" /></div>
            ) : !detail ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-bg-border text-sm text-text-muted">
                ← Select a submission to review the full dossier
              </div>
            ) : (
              <Dossier detail={detail} onAction={afterAction} onAuthError={onLogout} setErr={setErr} />
            )}
          </section>

          {/* Activity */}
          <section className="lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Activity</h3>
              <button onClick={refreshActivity} className="text-text-muted hover:text-accent-yellow"><RefreshCw className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-2">
              {activity.length === 0 && <p className="text-xs text-text-muted">No activity yet.</p>}
              {activity.map((a, i) => (
                <div key={i} className="rounded-lg border border-bg-border bg-bg-surface p-2.5 text-xs">
                  <div className="font-medium text-text-primary">{actionLabel(a.action)}</div>
                  {a.product_name && <div className="truncate text-text-secondary">{a.product_name}{a.vendor_name ? ` · ${a.vendor_name}` : ''}</div>}
                  <div className="mt-0.5 font-mono text-[10px] text-text-muted">{fmt(a.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ── Dossier ─────────────────────────────────────────────────────────── */
function Dossier({ detail, onAction, onAuthError, setErr }: { detail: any; onAction: () => void; onAuthError: () => void; setErr: (s: string) => void }) {
  const [composer, setComposer] = useState<null | 'approve' | 'reject' | 'info'>(null);
  const [busy, setBusy] = useState<string>('');
  const meta = detail.optional_metadata || {};
  const gm = meta.guard_mapping || null;
  const primary = gm?.categories?.find((c: any) => c.primary) || gm?.categories?.[0];
  const drProvisional = detail.dr_status === 'provisional';

  const verify = async (eid: string) => {
    setBusy('ev:' + eid);
    try { await api.adminVerifyEvidence(eid); onAction(); }
    catch (e: any) { if (e instanceof api.AdminAuthError) onAuthError(); else setErr(e.message || 'Verify failed.'); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-bg-border bg-bg-surface p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bg-border pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg-border bg-white">
            {detail.product_logo_url ? <img src={detail.product_logo_url} alt="" className="h-full w-full object-contain p-1" /> : <Box className="h-5 w-5 text-text-muted" />}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary">{detail.product_name}</h2>
            <p className="text-sm text-text-secondary">{detail.vendor_name}{detail.hq ? ` · ${detail.hq}` : ''}</p>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
              <Mail className="h-3 w-3" /> {detail.recipient_email || 'no email on file'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <StatusChip status={detail.review_status} />
          <div className="mt-1 font-mono text-[10px] text-text-muted">Submitted {fmt(detail.submitted_at || detail.created_at)}</div>
        </div>
      </div>

      {detail.review_note && (
        <div className="rounded-lg border border-bg-border bg-bg-elevated p-3 text-[13px] text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Last reviewer note · {detail.reviewed_by || 'admin'}</span>
          <p className="mt-1">{detail.review_note}</p>
        </div>
      )}

      {/* Details */}
      <div>
        <SectionTitle>Product details</SectionTitle>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <Field k="Category" v={meta.category} />
          <Field k="Pricing · Market" v={[meta.pricing_model, meta.target_market].filter(Boolean).join(' · ')} />
          <Field k="Version · SKU" v={[meta.version, meta.sku].filter(Boolean).join(' · ')} />
          <Field k="Product URL" v={detail.product_url} link />
          <Field k="Tags" v={arr(meta.tags).join(', ')} />
          <Field k="GUARD category" v={meta.guard_category} />
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-text-secondary"><span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Description</span><br />{detail.description}</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          <ListField k="Key features" items={arr(meta.key_features)} />
          <ListField k="Use cases" items={arr(meta.use_cases)} />
          <ListField k="Benefits" items={arr(meta.benefits)} />
        </div>
      </div>

      {/* Media */}
      {(arr(detail.product_images).length > 0 || arr(detail.product_videos).length > 0) && (
        <div>
          <SectionTitle>Media</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {arr(detail.product_images).map((src) => (
              <div key={src} className="h-16 w-24 overflow-hidden rounded-lg border border-bg-border bg-white"><img src={src} alt="" className="h-full w-full object-contain p-0.5" /></div>
            ))}
            {arr(detail.product_videos).map((v) => (
              <a key={v} href={v} target="_blank" rel="noreferrer" className="flex h-16 w-24 items-center justify-center rounded-lg border border-bg-border bg-bg-elevated text-xs text-status-blue hover:underline">Video ↗</a>
            ))}
          </div>
        </div>
      )}

      {/* GUARD mapping */}
      {gm && (
        <div>
          <SectionTitle>GUARD mapping</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            {primary && <span className="rounded-md border border-accent-yellow/40 bg-accent-soft px-2 py-0.5 text-xs font-semibold text-[#7A5B00]">{primary.label} ({primary.code})</span>}
            {(gm.categories || []).filter((c: any) => !c.primary).map((c: any) => (
              <span key={c.code} className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">{c.code}</span>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {(gm.adaptive_controls || []).map((a: any, i: number) => (
              <div key={i} className="text-[12px] text-text-secondary"><span className="font-mono text-[10px] text-[#7A5B00]">{a.verb}</span> <span className="font-mono text-[11px] text-text-primary">{a.code}</span> — {a.label}</div>
            ))}
          </div>
        </div>
      )}

      {/* Defence rating */}
      <div>
        <SectionTitle>Defence Rating</SectionTitle>
        {detail.dr_computed_at ? (
          <div className="rounded-xl border border-bg-border bg-bg-elevated p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl font-bold text-text-primary">{drProvisional ? '—' : detail.dr_rating}</span>
              {!drProvisional && <span className="text-xs text-text-muted">/100</span>}
              <span className="rounded-md border border-accent-yellow/40 bg-accent-soft px-2 py-0.5 text-xs font-semibold text-[#7A5B00]">{detail.dr_band}</span>
              <StatusChip status={detail.dr_status === 'verified' ? 'approved' : 'pending'} small label={detail.dr_status} />
            </div>
            <div className="space-y-2">
              {api.DEFENSE_DIMENSIONS.map((dim) => {
                const val = Math.round(detail.dr_dimensions?.[dim.key] ?? 0);
                return (
                  <div key={dim.key}>
                    <div className="mb-0.5 flex justify-between text-[12px]"><span className="text-text-secondary">{dim.label}</span><span className="font-mono text-text-muted">{val}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg-surface"><div className="h-full rounded-full bg-accent-yellow" style={{ width: `${val}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <p className="text-[13px] text-text-muted">Not computed yet.</p>}
      </div>

      {/* Evidence */}
      <div>
        <SectionTitle>Evidence ({(detail.evidence || []).length})</SectionTitle>
        {(detail.evidence || []).length === 0 ? (
          <p className="text-[13px] text-text-muted">No evidence submitted.</p>
        ) : (
          <div className="space-y-2">
            {detail.evidence.map((ev: any) => (
              <div key={ev.evidence_id} className="flex items-center gap-3 rounded-lg border border-bg-border bg-bg-elevated p-3">
                <span className="shrink-0 rounded-md border border-bg-border bg-bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-primary">{ev.ai_tier || ev.trust_tier || '—'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-text-primary">{ev.title}</div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted">
                    {ev.source_type === 'upload' ? <FileText className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}{ev.type}
                    {ev.independent && <span className="text-status-blue">independent</span>}
                  </div>
                </div>
                {ev.file_url && <a href={ev.file_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-status-blue hover:underline">open ↗</a>}
                {ev.verified ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-status-green"><BadgeCheck className="h-4 w-4" /> Verified</span>
                ) : (
                  <button onClick={() => verify(ev.evidence_id)} disabled={busy === 'ev:' + ev.evidence_id}
                    className="btn btn-outline btn-sm shrink-0">
                    {busy === 'ev:' + ev.evidence_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision bar */}
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-4">
        <SectionTitle>Decision</SectionTitle>
        <p className="mb-3 text-[13px] text-text-secondary">Choose an action — you'll review and edit the email to the vendor before it sends.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setComposer('approve')} className="btn btn-primary btn-sm">
            <CheckCircle2 className="h-4 w-4" /> Approve & publish
          </button>
          <button onClick={() => setComposer('info')} className="btn btn-outline btn-sm">
            <HelpCircle className="h-4 w-4" /> Request info
          </button>
          <button onClick={() => setComposer('reject')}
            className="btn btn-sm border border-status-red/40 bg-status-red/5 text-status-red hover:bg-status-red/10">
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">Approving publishes this product to the marketplace. Each decision emails the vendor and is logged.</p>
      </div>

      {composer && (
        <EmailComposer
          kind={composer}
          detail={detail}
          onClose={() => setComposer(null)}
          onDone={() => { setComposer(null); onAction(); }}
          onAuthError={onAuthError}
        />
      )}

      {/* Notifications */}
      {(detail.notifications || []).length > 0 && (
        <div>
          <SectionTitle>Emails sent</SectionTitle>
          <div className="space-y-1.5">
            {detail.notifications.map((n: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-text-secondary"><Mail className="h-3 w-3 text-text-muted" /> {n.subject}</span>
                <span className={`font-mono text-[10px] ${n.status === 'sent' ? 'text-status-green' : n.status === 'failed' ? 'text-status-red' : 'text-status-amber'}`}>{n.status}</span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-text-muted">“queued” = recorded but not delivered (no SMTP configured).</p>
        </div>
      )}
    </div>
  );
}

/* ── Email composer modal ────────────────────────────────────────────── */
const KIND_META: Record<string, { emailKind: string; title: string; verb: string; noteLabel: string; noteRequired: boolean; danger?: boolean }> = {
  approve: { emailKind: 'approved', title: 'Approve & publish', verb: 'Send & approve', noteLabel: 'Note to the vendor (optional)', noteRequired: false },
  info: { emailKind: 'needs_info', title: 'Request more information', verb: 'Send request', noteLabel: 'What information do you need from the vendor?', noteRequired: true },
  reject: { emailKind: 'rejected', title: 'Reject submission', verb: 'Send & reject', noteLabel: 'Reason for rejection (shared with the vendor)', noteRequired: true, danger: true },
};

function EmailComposer({ kind, detail, onClose, onDone, onAuthError }:
  { kind: 'approve' | 'reject' | 'info'; detail: any; onClose: () => void; onDone: () => void; onAuthError: () => void }) {
  const m = KIND_META[kind];
  const [reason, setReason] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const loadPreview = useCallback((note: string) => {
    setLoading(true);
    api.adminEmailPreview(detail.id, m.emailKind, note)
      .then((p) => { setToEmail((cur) => cur || p.to_email || ''); setSubject(p.subject); setBody(p.body); })
      .catch((e: any) => { if (e instanceof api.AdminAuthError) onAuthError(); else setErr(e.message || 'Could not load template.'); })
      .finally(() => setLoading(false));
  }, [detail.id, m.emailKind, onAuthError]);

  useEffect(() => { loadPreview(''); }, [loadPreview]);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail);
  const valid = emailOk && (!m.noteRequired || !!reason.trim());

  const send = async () => {
    setBusy(true); setErr('');
    try {
      const email = { to_email: toEmail, subject, body };
      if (kind === 'approve') await api.adminApprove(detail.id, { note: reason || undefined, ...email });
      else if (kind === 'reject') await api.adminReject(detail.id, { reason, ...email });
      else await api.adminRequestInfo(detail.id, { message: reason, ...email });
      setSent(true);
    } catch (e: any) { if (e instanceof api.AdminAuthError) onAuthError(); else setErr(e.message || 'Send failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-bg-border bg-bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-bg-border bg-bg-surface px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-accent-yellow" />
            <h3 className="text-lg font-semibold text-text-primary">{m.title}</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X className="h-5 w-5" /></button>
        </div>

        {sent ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-green"><CheckCircle2 className="h-7 w-7 text-white" strokeWidth={3} /></div>
            <h4 className="text-lg font-semibold text-text-primary">Email sent</h4>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-secondary">The vendor has been notified at <b className="text-text-primary">{toEmail}</b>, and the submission was {kind === 'approve' ? 'approved and published' : kind === 'reject' ? 'rejected' : 'marked as needing more info'}.</p>
            <button onClick={onDone} className="btn btn-primary mt-6">Done</button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent-yellow" /></div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            {/* recipient */}
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Send to</label>
              <input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="vendor@company.com"
                className={`w-full rounded-lg border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none ${toEmail && !emailOk ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'}`} />
              {toEmail && !emailOk && <p className="mt-1 text-[11px] text-status-red">Enter a valid email address.</p>}
            </div>
            {/* reason / note */}
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{m.noteLabel} {m.noteRequired && <span className="text-status-red">*</span>}</label>
              <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={kind === 'reject' ? 'e.g. We couldn’t verify the audit document provided.' : kind === 'info' ? 'e.g. Please share a SOC 2 report or a named customer reference.' : 'Optional note shown in the email.'}
                className="w-full rounded-lg border border-bg-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-yellow focus:outline-none" />
              <button onClick={() => loadPreview(reason)} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-accent-yellow hover:underline">
                <RefreshCw className="h-3 w-3" /> Build the email from this
              </button>
            </div>
            {/* subject */}
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-bg-border bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-yellow focus:outline-none" />
            </div>
            {/* branded body */}
            <div>
              <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Message (editable)</label>
              <div className="overflow-hidden rounded-xl border border-bg-border">
                <div className="flex items-center gap-2 border-b border-bg-border bg-bg-elevated px-4 py-2.5">
                  <img src="/attacked-mark.svg" alt="" className="h-5 w-5" />
                  <span className="flex items-baseline text-[13px] font-semibold text-text-primary">Attacked<span className="text-accent-yellow">.ai</span></span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">· The Defence Layer</span>
                </div>
                <textarea rows={11} value={body} onChange={(e) => setBody(e.target.value)}
                  className="w-full resize-y bg-bg-primary px-4 py-3 font-mono text-[12.5px] leading-relaxed text-text-primary focus:outline-none" />
              </div>
            </div>
            {err && <p className="flex items-center gap-1.5 text-sm text-status-red"><AlertTriangle className="h-4 w-4" /> {err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="btn btn-outline btn-sm">Cancel</button>
              <button onClick={send} disabled={!valid || busy}
                className={`btn btn-sm ${m.danger ? 'border border-status-red/40 bg-status-red/5 text-status-red hover:bg-status-red/10' : 'btn-primary'}`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {m.verb}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── atoms ───────────────────────────────────────────────────────────── */
function Stat({ label, value, icon: Icon, tone }: { label: string; value?: number; icon: any; tone?: string }) {
  const c = tone === 'amber' ? 'text-status-amber' : tone === 'green' ? 'text-status-green' : tone === 'red' ? 'text-status-red' : tone === 'blue' ? 'text-status-blue' : 'text-text-primary';
  return (
    <div className="rounded-xl border border-bg-border bg-bg-surface p-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-text-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value ?? '—'}</div>
    </div>
  );
}

function StatusChip({ status, small, label }: { status: string; small?: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${STATUS_TONE[status] || 'border-bg-border text-text-muted'} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'}`}>
      {(label || status).replace('_', ' ')}
    </span>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{children}</h3>
);

function Field({ k, v, link }: { k: string; v?: string; link?: boolean }) {
  if (!v) return null;
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">{k}</span>
      {link ? <a href={v} target="_blank" rel="noreferrer" className="break-all text-status-blue hover:underline">{v}</a> : <span className="text-text-primary">{v}</span>}
    </div>
  );
}

function ListField({ k, items }: { k: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{k}</span>
      <ul className="mt-0.5 space-y-0.5">{items.map((it, i) => <li key={i} className="text-[12.5px] text-text-secondary">• {it}</li>)}</ul>
    </div>
  );
}

function actionLabel(a: string): string {
  const m: Record<string, string> = {
    submission_approved: 'Approved & published', submission_rejected: 'Rejected',
    submission_needs_info: 'Requested more info', product_submitted: 'New submission',
    evidence_verified: 'Evidence verified', product_deduped: 'Product updated',
    rating_computed: 'Rating computed', product_updated: 'Product updated',
  };
  return m[a] || a.replace(/_/g, ' ');
}
