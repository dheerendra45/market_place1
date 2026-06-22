import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import * as api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, ArrowLeft, Check, Plus, Trash2, ShieldCheck, AlertTriangle, Loader2,
  RotateCcw, X, Upload, FileText, Link2, MessageSquareQuote, Pencil, Building2, Box,
  Sparkles, Brain, RefreshCw, BadgeCheck, Play,
} from 'lucide-react';

/* ── Flow ─────────────────────────────────────────────────────────── */
const STEPS = ['Start', 'Company', 'Products', 'Media', 'Evidence', 'Guard Mapping', 'Review', 'Defence Rating', 'Done'];
const CO = 1, PROD = 2, MEDIA = 3, EVID = 4, GUARD = 5, REVIEW = 6, DEFENSE = 7, DONE = 8;

const GUARD_CATS: [string, string][] = [
  ['CYB', 'Cyber'], ['DAT', 'Data'], ['TEC', 'Technology'], ['OPS', 'Operational'],
  ['TPR', 'Third-Party'], ['REG', 'Regulatory'], ['FIN', 'Financial'], ['STR', 'Strategic'],
  ['PPL', 'People'], ['REP', 'Reputational'], ['GEO', 'Geopolitical'], ['ENV', 'Environmental'], ['PHY', 'Physical'],
];
const guardLabel = (c: string) => GUARD_CATS.find(([code]) => code === c)?.[1] || c;
const PRICING = ['Free', 'Freemium', 'Subscription', 'Usage-based', 'Custom / Enterprise'];

const LINK_TYPES = [
  ['article', 'Article'], ['news', 'News mention'], ['blog', 'Blog post'],
  ['research_report', 'Research report'], ['customer_success', 'Customer success story'], ['case_study', 'Case study'],
];
const CUSTOMER_TYPES = [
  ['customer_review', 'Customer review'], ['testimonial', 'Testimonial'], ['reference_customer', 'Reference customer'],
];
const LINK_CODES = LINK_TYPES.map(([v]) => v);
const CUSTOMER_CODES = CUSTOMER_TYPES.map(([v]) => v);

// Evidence tier rubric (E1–E5) — shown to vendors so they know what lifts the
// Defence Rating. Display/guidance only; the AI assigns the actual tier later.
const EVIDENCE_TIERS: { tier: string; label: string; example: string; tone: string }[] = [
  { tier: 'E1', label: 'Strongest: checked by an outside expert', example: 'A SOC 2 or ISO 27001 certificate, or a security test done by another company', tone: 'text-status-green border-status-green/30 bg-status-green/10' },
  { tier: 'E2', label: 'Very strong: a named customer with real results', example: 'A case study such as “Acme cut detection time by 40%”', tone: 'text-status-green border-status-green/30 bg-status-green/10' },
  { tier: 'E3', label: 'Strong: named by a research firm', example: 'Being listed by Gartner or Forrester, or in published research', tone: 'text-status-blue border-status-blue/30 bg-status-blue/10' },
  { tier: 'E4', label: 'Medium: your own statement, not yet checked', example: 'A white paper or a post on your own blog', tone: 'text-status-amber border-status-amber/30 bg-status-amber/10' },
  { tier: 'E5', label: 'Weakest: a claim with nothing to back it up', example: 'Text from your homepage or a press release', tone: 'text-text-muted border-bg-border bg-bg-elevated' },
];

// Friendly per-section intro shown at the top of each step's form — so anyone
// understands what they're entering and what happens next.
const STEP_HEADER: Record<number, { tag: string; title: string; desc: string }> = {
  [CO]: { tag: 'Company', title: 'Welcome. Let’s start with your company', desc: 'We’re glad to have you on the Attacked.ai Defence Layer. Please tell us a little about your organisation below. We use these details to confirm that your company is real and that you’re allowed to represent it. Once that’s done, we’ll take you to add your products.' },
  [PROD]: { tag: 'Products', title: 'Tell us about your products', desc: 'List the products you want to sell on the marketplace. For each one, explain what it does and who it is for. This is exactly what buyers will see on your product page, so clear, honest descriptions help you get found and trusted.' },
  [MEDIA]: { tag: 'Media', title: 'Add photos and a video', desc: 'Add your product logo, a few screenshots, and a short demo video if you have one. People decide quickly, so good visuals help buyers understand your product at a glance and trust that it is real.' },
  [EVID]: { tag: 'Evidence', title: 'Show proof that it works', desc: 'This is where you prove your product does what you say. Add things like audit reports, certifications, customer stories, and reviews. The stronger and more independent your proof is, the higher your Defence Rating (your trust score). We explain each type below.' },
  [GUARD]: { tag: 'Guard Mapping', title: 'The risks your product protects against', desc: 'GUARD is the way we group risk into 13 simple areas, such as Cyber, Data, and Operational. On this step we show you which of those risk areas your product helps protect against, along with the specific protections it provides. This is what buyers look at to quickly understand where your product helps.' },
  [REVIEW]: { tag: 'Review', title: 'Check everything over', desc: 'Here is a summary of everything you entered. Read it over and go back to fix anything that looks wrong. When it all looks right, continue to see your Defence Rating.' },
  [DEFENSE]: { tag: 'Defence Rating', title: 'Your Defence Rating, then submit', desc: 'This is your trust score from 0 to 100, based only on the evidence you provided and never on money. A higher score means stronger, more independent proof. Review it below, then submit. Our team checks every submission before it goes live, and we will email you the result.' },
};

// Left-rail journey model: one tight, product-voice line per step (not an essay).
const JOURNEY: { step: number; label: string; blurb: string }[] = [
  { step: CO, label: 'Company', blurb: 'Confirm your company is real and that you’re allowed to represent it.' },
  { step: PROD, label: 'Products', blurb: 'Add each product: what it does and who it’s for.' },
  { step: MEDIA, label: 'Media', blurb: 'Add a logo, a few screenshots, and a short video.' },
  { step: EVID, label: 'Evidence', blurb: 'Add proof your product works, such as audit reports, customer stories, and certifications. Stronger proof raises your rating.' },
  { step: GUARD, label: 'Guard Mapping', blurb: 'We match your product to the risk areas it protects against, so buyers know what you defend.' },
  { step: REVIEW, label: 'Review', blurb: 'Read everything over and fix anything that needs it.' },
  { step: DEFENSE, label: 'Defence Rating', blurb: 'See your trust score from 0 to 100, based only on your proof, then submit. You can never pay to raise it.' },
];

const FREE = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'aol.com'];
const LS_KEY = 'attacked_onboarding_email';
const uid = (seed: number) => `${seed}_${Math.floor(performance.now())}`;
const toArr = (x: any): string[] => Array.isArray(x) ? x : x ? String(x).split(/[,\n]/).map((t) => t.trim()).filter(Boolean) : [];
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim()) || v.trim().startsWith('/uploads/');
const ytId = (url: string): string | null => {
  const m = (url || '').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

type EvGroup = 'link' | 'customer' | 'document';
const evGroupFromType = (t: string): EvGroup => LINK_CODES.includes(t) ? 'link' : CUSTOMER_CODES.includes(t) ? 'customer' : 'document';

type EvidenceItem = {
  id: string; group: EvGroup; type: string; title: string; url: string; description: string;
  file_url: string; filename: string; size: number; issued_date?: string; existing?: boolean; evidence_id?: string;
};
type Certification = {
  id: string; name: string; proof_type: 'url' | 'file';
  url: string; file_url: string; filename: string; size: number;
};
type GuardCatHit = { code: string; label: string; primary?: boolean; strength: number };
type GuardSub = { category: string; code: string; name: string; confidence: number };
type AdaptiveControl = { verb: string; code: string; label: string; grounded_in?: string };
type GuardMapping = {
  shape?: string;
  categories: GuardCatHit[];
  subcategories: GuardSub[];
  adaptive_controls: AdaptiveControl[];
  explanation: string;
  accepted: boolean;
};
type Product = {
  id: string; backend_id?: number | null; existing?: boolean;
  product_name: string; product_description: string; category: string;
  product_url: string; pricing_model: string; target_market: string;
  key_features: string[]; use_cases: string[]; benefits: string[]; tags: string[];
  version: string; sku: string;
  logo_url: string; product_images: string[]; product_videos: string[];
  evidence: EvidenceItem[];
  // guard-mapping conversation state
  guard_started?: boolean;
  guard_answers: { question: string; answer: string }[];
  guard_question?: { text: string; why: string; options?: string[]; multi?: boolean } | null;
  guard_confidence?: { product_understanding: number; mapping_confidence: number; missing_info: number } | null;
  guard_engine?: string;
  guard_mapping?: GuardMapping | null;
};

function newProduct(i = 0): Product {
  return {
    id: uid(i), backend_id: null, existing: false,
    product_name: '', product_description: '', category: '',
    product_url: '', pricing_model: 'Subscription', target_market: '',
    key_features: [], use_cases: [], benefits: [], tags: [],
    version: '', sku: '', logo_url: '', product_images: [], product_videos: [],
    evidence: [], guard_started: false, guard_answers: [], guard_question: null,
    guard_confidence: null, guard_mapping: null,
  };
}

function defaults() {
  return {
    vendor_id: null as number | null, vendor_verified: false,
    company_name: 'Cloudflare, Inc.', work_email: 'security@cloudflare.com', website: 'https://www.cloudflare.com',
    hq: 'San Francisco, California, United States', founded: '2009', company_size: '~3,700 staff · Public (NYSE: NET)',
    certifications: [
      { id: 'c1', name: 'SOC 2 Type II', proof_type: 'url', url: 'https://www.cloudflare.com/trust-hub/compliance-resources/', file_url: '', filename: '', size: 0 },
    ] as Certification[],
    attested: false,
    products: [{
      ...newProduct(1),
      product_name: 'Cloudflare Web Application Firewall (WAF)',
      product_description: 'Cloudflare WAF inspects incoming web and API requests and filters malicious traffic — including XSS and SQL injection — using managed rulesets that are regularly updated with zero-day vulnerability protections, restricting unauthenticated or malicious access to web endpoints.',
      category: 'Web Application Firewall (WAF)',
      product_url: 'https://developers.cloudflare.com/waf/get-started/',
      target_market: 'Mid-market & Enterprise',
      key_features: ['Managed rulesets', 'Zero-day virtual patching', 'OWASP Core Ruleset', 'Custom WAF rules', 'Rate limiting'],
      use_cases: ['Block SQL injection & XSS', 'Protect web & API endpoints', 'Virtual patching for zero-days'],
      benefits: ['Reduced web attack surface', 'Automatic protection updates', 'Lower breach risk'],
      tags: ['waf', 'appsec', 'owasp', 'api-security'], version: '2024.2', sku: 'CF-WAF-ENT',
    }] as Product[],
    activeIdx: 0,
  };
}

/* ── atoms ────────────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text', required, error, hint, list }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; error?: string; hint?: string; list?: string;
}) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[12.5px] font-semibold uppercase tracking-wide text-text-secondary">{label} {required && <span className="text-status-red">*</span>}</label>
      <input type={type} value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-bg-surface px-4 py-3 text-[15.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-yellow/20 ${error ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'}`} />
      {hint && !error && <p className="mt-1.5 font-mono text-[11px] text-text-muted">{hint}</p>}
      {error && <p className="mt-1.5 flex items-center gap-1 text-xs text-status-red"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}
    </div>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-yellow">{children}</div>;
}
/* dynamic Add-More list */
function AddMoreList({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[12.5px] font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input value={it} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm focus:border-accent-yellow focus:outline-none" />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="flex w-10 items-center justify-center rounded-lg border border-bg-border text-text-muted hover:border-status-red hover:text-status-red"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...items, ''])} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent-yellow/50 py-2 text-[12px] font-semibold text-accent-yellow hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /> Add more</button>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const { user, claimVendor } = useAuth();
  const [params] = useSearchParams();
  const d = useMemo(defaults, []);
  const [s, setS] = useState(d);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [vendorMsg, setVendorMsg] = useState('');
  const [vendorNames, setVendorNames] = useState<string[]>([]);
  const [resumeEmail, setResumeEmail] = useState('');
  const [resumeMsg, setResumeMsg] = useState('');
  const [submitInfo, setSubmitInfo] = useState('');
  const [createdIds, setCreatedIds] = useState<number[]>([]);
  const [loadedExisting, setLoadedExisting] = useState(0);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadingCert, setUploadingCert] = useState<string | null>(null);
  const certFileInput = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const logoFileInput = useRef<HTMLInputElement>(null);
  // guard-mapping transient
  const [guardLoading, setGuardLoading] = useState(false);
  const [guardInput, setGuardInput] = useState('');
  const [guardSelected, setGuardSelected] = useState<string[]>([]);
  // defence-rating preview (keyed by product id) — computed, never user-entered
  const [defensePreviews, setDefensePreviews] = useState<Record<string, api.DefenseRatingResult>>({});
  const [defenseLoading, setDefenseLoading] = useState<Record<string, boolean>>({});
  const [defenseError, setDefenseError] = useState<Record<string, string>>({});

  const set = (patch: Partial<typeof s>) => setS((prev) => ({ ...prev, ...patch }));
  const active = s.products[s.activeIdx] || s.products[0];
  const setProduct = (idx: number, patch: Partial<Product>) =>
    setS((prev) => ({ ...prev, products: prev.products.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }));
  const patchActive = (patch: Partial<Product>) => setProduct(s.activeIdx, patch);

  useEffect(() => {
    api.getVendors({ page_size: 100 }).then((r) => setVendorNames(Array.from(new Set(r.data.map((v) => v.vendor_name))).sort())).catch(() => {});
    const email = params.get('email') || localStorage.getItem(LS_KEY) || '';
    if (email && email !== d.work_email) doResume(email, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doResume(email: string, silent = false) {
    try {
      const data = await api.resumeOnboarding(email);
      // A previously SUBMITTED form should start fresh, not auto-resume on refresh.
      if (silent && data.status === 'submitted') { localStorage.removeItem(LS_KEY); return; }
      const ex = (data.extra as any) || {};
      if (ex.products?.length) setS({ ...d, ...ex, company_name: data.company_name ?? ex.company_name ?? d.company_name, work_email: data.work_email });
      setStep(Math.min(data.current_step ?? CO, DEFENSE));
      localStorage.setItem(LS_KEY, email); setResumeMsg('');
    } catch { if (!silent) setResumeMsg('No saved onboarding found for that email.'); }
  }

  async function verifyVendorNow() {
    if (!s.company_name.trim()) { setVendorMsg('Enter your company name.'); return; }
    setVerifying(true); setVendorMsg('');
    try {
      const v = await api.verifyVendor({ company_name: s.company_name });
      set({ vendor_id: v.vendor_id, company_name: v.company_name, vendor_verified: true });
      await loadVendorProducts(v.vendor_id);
    } catch (e: any) {
      set({ vendor_verified: false, vendor_id: null });
      setVendorMsg(e.message || 'Vendor not found in the registry.');
    } finally { setVerifying(false); }
  }

  async function loadVendorProducts(vendorId: number) {
    try {
      const vendor = await api.getVendor(vendorId);
      const existing = vendor.products || [];
      if (!existing.length) { setLoadedExisting(0); return; }
      const mapped: Product[] = [];
      for (const p of existing) {
        let evidence: EvidenceItem[] = [];
        try {
          const evs = await api.listPortalEvidence(p.id);
          evidence = evs.map((e: any, i: number) => ({
            id: uid(i), existing: true, evidence_id: e.evidence_id, group: evGroupFromType(e.type), type: e.type,
            title: e.title || '', url: e.source_type !== 'upload' ? (e.file_url || '') : '', description: e.description || '',
            file_url: e.source_type === 'upload' ? (e.file_url || '') : '', filename: e.title || '', size: 0,
            issued_date: e.issued_date ? String(e.issued_date).slice(0, 10) : '',
          }));
        } catch { /* none */ }
        const meta: any = p.optional_metadata || {};
        mapped.push({
          ...newProduct(mapped.length + 1), backend_id: p.id, existing: true,
          product_name: p.product_name || '', product_description: p.description || '',
          category: meta.category || '',
          product_url: p.product_url || meta.product_url || '', pricing_model: meta.pricing_model || 'Subscription',
          target_market: meta.target_market || '',
          key_features: toArr(meta.key_features), use_cases: toArr(meta.use_cases), benefits: toArr(meta.benefits),
          tags: toArr(meta.tags), version: meta.version || '', sku: meta.sku || '',
          logo_url: p.product_logo || '', product_images: toArr(p.product_images), product_videos: toArr(p.product_videos),
          evidence, guard_mapping: meta.guard_mapping || null, guard_answers: [],
        });
      }
      setS((prev) => ({ ...prev, products: mapped, activeIdx: 0 }));
      setLoadedExisting(mapped.length);
    } catch { /* keep blank */ }
  }

  /* product list */
  const addProduct = () => setS((p) => ({ ...p, products: [...p.products, newProduct(p.products.length + 1)], activeIdx: p.products.length }));
  const removeProduct = (idx: number) => setS((p) => {
    if (p.products.length === 1) return p;
    const products = p.products.filter((_, i) => i !== idx);
    return { ...p, products, activeIdx: Math.max(0, Math.min(p.activeIdx, products.length - 1)) };
  });

  /* evidence */
  const addEvidence = (group: EvGroup) => {
    const type = group === 'link' ? 'article' : group === 'customer' ? 'testimonial' : 'supporting_document';
    patchActive({ evidence: [...active.evidence, { id: uid(active.evidence.length), group, type, title: '', url: '', description: '', file_url: '', filename: '', size: 0, issued_date: '' }] });
  };
  const updateEvidence = (eid: string, patch: Partial<EvidenceItem>) => patchActive({ evidence: active.evidence.map((e) => (e.id === eid ? { ...e, ...patch } : e)) });
  const removeEvidence = (eid: string) => patchActive({ evidence: active.evidence.filter((e) => e.id !== eid) });
  // Reusable "upload a file" control for any evidence item (URL is always optional too).
  const evidenceFile = (ev: EvidenceItem) => ev.file_url ? (
    <div className="flex items-center gap-2 rounded-lg border border-status-green/30 bg-status-green/5 px-3 py-2 text-sm text-text-primary">
      <FileText className="h-4 w-4 shrink-0 text-status-green" />
      <span className="flex-1 truncate">{ev.filename || 'Uploaded file'}</span>
      {ev.size > 0 && <span className="font-mono text-[10px] text-text-muted">{(ev.size / 1024).toFixed(0)} KB</span>}
      <button onClick={() => updateEvidence(ev.id, { file_url: '', filename: '', size: 0 })} className="text-text-muted hover:text-status-red"><X className="h-3.5 w-3.5" /></button>
    </div>
  ) : (
    <button onClick={() => { setUploadingFor(ev.id); fileInput.current?.click(); }} disabled={uploadingFor === ev.id}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-bg-border py-2 text-[13px] font-medium text-text-secondary hover:border-accent-yellow hover:text-accent-yellow disabled:opacity-50">
      {uploadingFor === ev.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Or upload a file (PDF, DOC, XLS, PPT)</>}
    </button>
  );
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !uploadingFor) return;
    const eid = uploadingFor;
    try {
      const res = await api.uploadEvidenceFile(file);
      updateEvidence(eid, { file_url: res.file_url, filename: res.filename, size: res.size, title: active.evidence.find((x) => x.id === eid)?.title || res.filename });
    } catch (err: any) { setSaveError(err.message || 'Upload failed.'); } finally { setUploadingFor(null); }
  }

  /* product logo upload (PNG/JPG) */
  async function onPickLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) { setUploadingLogo(false); return; }
    try {
      const res = await api.uploadEvidenceFile(file);
      setLogoLoadError(false);
      patchActive({ logo_url: res.file_url });
    } catch (err: any) { setSaveError(err.message || 'Logo upload failed.'); }
    finally { setUploadingLogo(false); }
  }

  /* company certifications (each needs proof: file or URL) */
  const addCert = () => set({ certifications: [...s.certifications, { id: uid(s.certifications.length), name: '', proof_type: 'url', url: '', file_url: '', filename: '', size: 0 }] });
  const updateCert = (id: string, patch: Partial<Certification>) => set({ certifications: s.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeCert = (id: string) => set({ certifications: s.certifications.filter((c) => c.id !== id) });
  async function onPickCertFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !uploadingCert) return;
    const id = uploadingCert;
    try {
      const res = await api.uploadEvidenceFile(file);
      updateCert(id, { file_url: res.file_url, filename: res.filename, size: res.size });
    } catch (err: any) { setSaveError(err.message || 'Upload failed.'); } finally { setUploadingCert(null); }
  }

  // Certifications editor — lives in the Evidence step (they are supporting evidence).
  function certList() {
    return (
      <div className="rounded-xl border border-bg-border bg-bg-elevated p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-accent-yellow" />
            <div>
              <div className="text-[15px] font-semibold text-text-primary">Certifications</div>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-text-secondary">Official security or compliance certificates, like SOC 2 or ISO 27001. These are the strongest proof you can give. For each one, type its name and either paste a link to the certificate or upload the file.</p>
            </div>
          </div>
          <span className="rounded-md bg-bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted">{s.certifications.filter((c) => c.name.trim()).length}</span>
        </div>
        <div className="space-y-2">
          {s.certifications.map((c) => {
            const noProof = !!c.name.trim() && !c.url.trim() && !c.file_url;
            return (
              <div key={c.id} className="space-y-2 rounded-lg border border-bg-border bg-bg-surface p-3">
                <div className="flex gap-2">
                  <input value={c.name} onChange={(e) => updateCert(c.id, { name: e.target.value })} placeholder="e.g. SOC 2 Type II"
                    className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm focus:border-accent-yellow focus:outline-none" />
                  <div className="flex overflow-hidden rounded-lg border border-bg-border">
                    {(['url', 'file'] as const).map((pt) => (
                      <button key={pt} onClick={() => updateCert(c.id, { proof_type: pt })}
                        className={`px-2.5 py-2 text-xs font-medium capitalize ${c.proof_type === pt ? 'bg-accent-soft text-text-primary' : 'bg-bg-surface text-text-secondary hover:text-text-primary'}`}>{pt}</button>
                    ))}
                  </div>
                  <button onClick={() => removeCert(c.id)} className="flex w-9 items-center justify-center rounded-lg border border-bg-border text-text-muted hover:border-status-red hover:text-status-red"><X className="h-4 w-4" /></button>
                </div>
                {c.proof_type === 'url' ? (
                  <input value={c.url} onChange={(e) => updateCert(c.id, { url: e.target.value })} placeholder="https://… verification / proof URL *"
                    className={`w-full rounded-lg border bg-bg-surface px-3 py-2 text-sm focus:outline-none ${noProof ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'}`} />
                ) : c.file_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-status-green/30 bg-status-green/5 px-3 py-2 text-sm text-text-primary"><FileText className="h-4 w-4 text-status-green" /><span className="flex-1 truncate">{c.filename}</span><span className="font-mono text-[10px] text-text-muted">{(c.size / 1024).toFixed(0)} KB</span></div>
                ) : (
                  <button onClick={() => { setUploadingCert(c.id); certFileInput.current?.click(); }} disabled={uploadingCert === c.id}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-sm font-semibold text-accent-yellow hover:bg-accent-soft disabled:opacity-50 ${noProof ? 'border-status-red' : 'border-accent-yellow/50'}`}>
                    {uploadingCert === c.id ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload proof *</>}
                  </button>
                )}
                {noProof && <p className="text-xs text-status-red">Proof (file or URL) is required for this certification.</p>}
              </div>
            );
          })}
        </div>
        <button onClick={addCert} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent-yellow/50 py-2 text-[12px] font-semibold text-accent-yellow hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /> Add certification</button>
        {errors.certs && <p className="mt-1.5 flex items-center gap-1 text-xs text-status-red"><AlertTriangle className="h-3.5 w-3.5" /> {errors.certs}</p>}
      </div>
    );
  }

  /* ── GUARD MAPPING conversation ── */
  function productContext(p: Product) {
    return {
      product_name: p.product_name, product_description: p.product_description,
      category: p.category, product_url: p.product_url,
      key_features: p.key_features.filter(Boolean), use_cases: p.use_cases.filter(Boolean),
      benefits: p.benefits.filter(Boolean),
      optional_metadata: {
        pricing_model: p.pricing_model, target_market: p.target_market,
        tags: p.tags.filter(Boolean), version: p.version, sku: p.sku,
      },
      certifications: s.certifications.filter((c) => c.name.trim()).map((c) => c.name),
      evidence: p.evidence
        .filter((e) => e.title.trim() || e.url.trim() || e.file_url)
        .map((e) => ({ type: e.type, title: e.title, description: e.description, url: e.url || e.file_url })),
    };
  }
  const vendorContext = () => ({ company_name: s.company_name, hq: s.hq, company_size: s.company_size });

  async function runGuardStep(answers: { question: string; answer: string }[]) {
    setGuardLoading(true); setSaveError('');
    try {
      const res = await api.guardMappingStep({ product: productContext(active), vendor: vendorContext(), answers });
      const m = res.mapping;
      const mapping: GuardMapping | null = m
        ? {
            shape: m.shape || '',
            categories: Array.isArray(m.categories) ? m.categories : [],
            subcategories: Array.isArray(m.subcategories) ? m.subcategories : [],
            adaptive_controls: Array.isArray(m.adaptive_controls) ? m.adaptive_controls : [],
            explanation: m.explanation || '',
            accepted: false,
          }
        : null;
      patchActive({
        guard_started: true, guard_answers: answers, guard_confidence: res.confidence, guard_engine: res.engine,
        guard_question: res.done ? null : res.question || null,
        guard_mapping: mapping ?? (res.done ? null : active.guard_mapping ?? null),
      });
    } catch (e: any) { setSaveError(e.message || 'Guard mapping failed.'); }
    finally { setGuardLoading(false); }
  }
  const startGuard = () => { setGuardInput(''); setGuardSelected([]); runGuardStep([]); };
  const submitGuardAnswer = () => {
    if (!active.guard_question) return;
    const opts = active.guard_question.options || [];
    const answer = opts.length
      ? [...guardSelected, guardInput.trim()].filter(Boolean).join(', ')
      : guardInput.trim();
    const answers = [...active.guard_answers, { question: active.guard_question.text, answer }];
    setGuardInput(''); setGuardSelected([]);
    runGuardStep(answers);
  };
  const acceptMapping = () => active.guard_mapping && patchActive({ guard_mapping: { ...active.guard_mapping, accepted: true } });
  const reEvaluate = () => { patchActive({ guard_started: false, guard_answers: [], guard_question: null, guard_mapping: null, guard_confidence: null }); setGuardInput(''); setGuardSelected([]); setDefensePreviews((m) => { const n = { ...m }; delete n[active.id]; return n; }); };
  const removeControl = (idx: number) => active.guard_mapping && patchActive({ guard_mapping: { ...active.guard_mapping, adaptive_controls: active.guard_mapping.adaptive_controls.filter((_, i) => i !== idx) } });
  const manualOverride = (code: string) => {
    const gm = active.guard_mapping;
    if (!gm) {
      patchActive({ guard_mapping: { shape: '', categories: [{ code, label: guardLabel(code), primary: true, strength: 100 }], subcategories: [], adaptive_controls: [], explanation: 'Manual override (admin).', accepted: true } });
      return;
    }
    let cats = gm.categories.map((c) => ({ ...c, primary: c.code === code }));
    if (!cats.find((c) => c.code === code)) cats = [{ code, label: guardLabel(code), primary: true, strength: 100 }, ...cats];
    patchActive({ guard_mapping: { ...gm, categories: cats, accepted: true } });
  };

  /* ── DEFENCE RATING preview (AI grades evidence → deterministic rubric) ── */
  async function runDefensePreview(p: Product) {
    setDefenseLoading((m) => ({ ...m, [p.id]: true }));
    setDefenseError((m) => ({ ...m, [p.id]: '' }));
    try {
      const res = await api.previewDefenseRating({
        product: productContext(p),
        vendor: vendorContext(),
        evidence: p.evidence
          .filter((e) => e.title.trim() || e.url.trim() || e.file_url)
          .map((e) => ({ type: e.type, title: e.title, description: e.description, url: e.url, file_url: e.file_url, issued_date: e.issued_date || undefined })),
        guard_mapping: p.guard_mapping || {},
      });
      setDefensePreviews((m) => ({ ...m, [p.id]: res }));
    } catch (err: any) {
      setDefenseError((m) => ({ ...m, [p.id]: err.message || 'Could not compute the Defence Rating.' }));
    } finally {
      setDefenseLoading((m) => ({ ...m, [p.id]: false }));
    }
  }
  // Auto-compute when the active product's Defence Rating step is shown.
  useEffect(() => {
    if (step !== DEFENSE || !active) return;
    if (!defensePreviews[active.id] && !defenseLoading[active.id]) runDefensePreview(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, s.activeIdx]);

  /* persistence */
  async function persist(nextStep: number, status = 'draft') {
    setSaving(true); setSaveError('');
    try {
      await api.saveOnboarding({
        work_email: s.work_email, company_name: s.company_name, product_name: s.products[0]?.product_name,
        current_step: nextStep, status,
        extra: {
          vendor_id: s.vendor_id, vendor_verified: s.vendor_verified, website: s.website, hq: s.hq, founded: s.founded,
          company_size: s.company_size, certifications: s.certifications, attested: s.attested, products: s.products, activeIdx: s.activeIdx,
        },
      });
      // Drafts are resumable; a submitted form should NOT auto-resume on refresh.
      if (status === 'submitted') localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, s.work_email);
      return true;
    } catch (err: any) { setSaveError(err.message || 'Could not save.'); return false; }
    finally { setSaving(false); }
  }

  async function submitAll() {
    setSaving(true); setSaveError(''); setSubmitInfo('');
    try {
      const v = await api.verifyVendor(s.vendor_id ? { vendor_id: s.vendor_id } : { company_name: s.company_name });
      const ids: number[] = [];
      const seenNames = new Set<string>();
      for (let i = 0; i < s.products.length; i++) {
        const p = s.products[i];
        // Skip same-name duplicates within this submission (the backend also dedups).
        const key = p.product_name.trim().toLowerCase();
        if (key && seenNames.has(key)) continue;
        if (key) seenNames.add(key);
        const label = p.product_name || `product ${i + 1}`;
        const payload = {
          product_name: p.product_name, product_description: p.product_description,
          logo_url: p.logo_url || undefined,
          product_images: p.product_images.filter(Boolean), product_videos: p.product_videos.filter(Boolean),
          optional_metadata: {
            category: p.category, // vendor's own product category (free text)
            guard_category: (p.guard_mapping?.categories.find((c) => c.primary) || p.guard_mapping?.categories[0])?.code || null, // AI-mapped GUARD code
            product_url: p.product_url, pricing_model: p.pricing_model,
            target_market: p.target_market, key_features: p.key_features.filter(Boolean),
            use_cases: p.use_cases.filter(Boolean), benefits: p.benefits.filter(Boolean),
            version: p.version, sku: p.sku, tags: p.tags.filter(Boolean),
            guard_mapping: p.guard_mapping || null,
          },
        };
        let productId: number;
        if (p.backend_id) { setSubmitInfo(`Updating ${label} (${i + 1}/${s.products.length})…`); await api.updatePortalProduct(p.backend_id, payload); productId = p.backend_id; }
        else { setSubmitInfo(`Creating ${label} (${i + 1}/${s.products.length})…`); const c = await api.createPortalProduct({ vendor_id: v.vendor_id, work_email: s.work_email, ...payload }); productId = c.id; }
        for (const ev of p.evidence) {
          if (ev.existing) continue;
          if (!ev.title.trim() && !ev.url.trim() && !ev.file_url) continue;
          await api.addPortalEvidence(productId, {
            type: ev.type, title: ev.title || ev.filename || ev.type, description: ev.description || undefined,
            file_url: ev.file_url || ev.url || undefined, source_type: ev.group === 'document' ? 'upload' : ev.url ? 'link' : 'text',
            issued_date: ev.issued_date || undefined,
          });
        }
        // Compute & persist the Defence Rating (AI grades evidence → rubric).
        try { await api.computeDefenseRating(productId); } catch { /* non-fatal */ }
        ids.push(productId);
      }
      setCreatedIds(ids);
      // Claiming a profile is what makes an account a vendor — promote the
      // signed-in user now (no-op for anonymous onboarding). Best-effort.
      if (user) { try { await claimVendor(v.vendor_id); } catch { /* non-fatal */ } }
      return true;
    } catch (err: any) { setSaveError(err.message || 'Submission failed.'); return false; }
    finally { setSaving(false); setSubmitInfo(''); }
  }

  function validate(target: number): boolean {
    const e: Record<string, string> = {};
    let jumpTo: number | null = null;
    const fwd = target > step;
    const pname = (p: Product, i: number) => p.product_name.trim() || `Product ${i + 1}`;

    if (step === CO) {
      if (!s.vendor_verified) e.company = 'Verify your company against the registry to continue.';
      if (!s.work_email) e.work_email = 'Work email is required.';
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.work_email)) e.work_email = 'Enter a valid email.';
      else if (FREE.includes(s.work_email.split('@')[1]?.toLowerCase())) e.work_email = 'Work emails only.';
      if (!s.website.trim()) e.website = 'Website is required.';
      if (!s.hq.trim()) e.hq = 'Headquarters is required.';
      if (!s.founded.trim()) e.founded = 'Founded year is required.';
      if (!s.company_size.trim()) e.company_size = 'Company size is required.';
      if (s.vendor_verified && !s.attested) e.attest = 'Confirm the authorisation statement.';
    }

    if (fwd && step === PROD) {
      // Block duplicate product names (a vendor can't list the same product twice).
      const nameCounts = new Map<string, number>();
      s.products.forEach((p) => { const k = p.product_name.trim().toLowerCase(); if (k) nameCounts.set(k, (nameCounts.get(k) || 0) + 1); });
      const dupIdx = s.products.findIndex((p) => (nameCounts.get(p.product_name.trim().toLowerCase()) || 0) > 1);
      if (dupIdx !== -1) {
        e.product = `“${s.products[dupIdx].product_name.trim()}” is added more than once — remove the duplicate or rename it.`;
        jumpTo = dupIdx;
      }
      for (let i = 0; jumpTo === null && i < s.products.length; i++) {
        const p = s.products[i];
        if (!p.product_name.trim()) e[`p${i}_name`] = 'Required.';
        if (!p.product_description.trim()) e[`p${i}_desc`] = 'Required.';
        if (!p.category.trim()) e[`p${i}_cat`] = 'Required.';
        if (!p.product_url.trim()) e[`p${i}_url`] = 'Required.';
        if (!p.target_market.trim()) e[`p${i}_mkt`] = 'Required.';
        if (!p.version.trim()) e[`p${i}_ver`] = 'Required.';
        if (!p.sku.trim()) e[`p${i}_sku`] = 'Required.';
        const miss: string[] = [];
        if (p.tags.filter(Boolean).length === 0) miss.push('a tag');
        if (p.key_features.filter(Boolean).length === 0) miss.push('a key feature');
        if (p.use_cases.filter(Boolean).length === 0) miss.push('a use case');
        if (p.benefits.filter(Boolean).length === 0) miss.push('a benefit');
        const fieldMissing = Object.keys(e).some((k) => k.startsWith(`p${i}_`));
        if (fieldMissing || miss.length) {
          e.product = `${pname(p, i)}: complete all fields${miss.length ? ` and add ${miss.join(', ')}` : ''}.`;
          jumpTo = i; break;
        }
      }
    }
    if (fwd && step === MEDIA) {
      for (let i = 0; i < s.products.length; i++) {
        const p = s.products[i];
        const miss: string[] = [];
        if (!p.logo_url.trim()) miss.push('a logo (valid URL or PNG/JPG upload)');
        else if (!isUrl(p.logo_url)) miss.push('a valid logo URL (or upload a PNG/JPG)');
        if (p.product_images.filter(Boolean).length === 0) miss.push('at least one image');
        if (p.product_videos.filter(Boolean).length === 0) miss.push('at least one video');
        if (miss.length) { e.media = `${pname(p, i)} needs ${miss.join(', ')}.`; jumpTo = i; break; }
      }
    }
    if (fwd && step === EVID) {
      for (let i = 0; i < s.products.length; i++) {
        const p = s.products[i];
        const links = p.evidence.filter((ev) => ev.group === 'link' && (ev.title.trim() || ev.url.trim()));
        const cust = p.evidence.filter((ev) => ev.group === 'customer' && (ev.title.trim() || ev.description.trim()));
        const miss: string[] = [];
        if (links.length === 0) miss.push('at least one Link');
        if (cust.length === 0) miss.push('at least one Customer reference');
        if (miss.length) { e.evidence = `${pname(p, i)} needs ${miss.join(' and ')}.`; jumpTo = i; break; }
        // Every evidence item that has content must carry an issued date.
        const undated = p.evidence.filter((ev) => (ev.title.trim() || ev.url.trim() || ev.description.trim() || ev.file_url) && !ev.issued_date);
        if (undated.length > 0) {
          e.evidence = `${pname(p, i)}: add an issued / published date to every evidence item.`;
          jumpTo = i; break;
        }
      }
      // Certifications are optional supporting evidence — but if named, need proof.
      if (s.certifications.some((c) => c.name.trim() && !c.url.trim() && !c.file_url))
        e.certs = 'Each certification needs proof — add a file or a URL (or remove it).';
    }
    if (fwd && step === GUARD) {
      for (let i = 0; i < s.products.length; i++) {
        const p = s.products[i];
        if (!p.guard_mapping || !p.guard_mapping.accepted) {
          e.guard = `${pname(p, i)}: run Guard Mapping and Accept the result before continuing.`; jumpTo = i; break;
        }
      }
    }

    setErrors(e);
    if (jumpTo !== null && jumpTo !== s.activeIdx) set({ activeIdx: jumpTo });
    return Object.keys(e).length === 0;
  }
  async function go(target: number) {
    if (target > step && !validate(target)) return;
    if (step === DEFENSE && target === DONE) { const ok = await submitAll(); if (!ok) return; }
    if (step >= CO && target >= step) { const ok = await persist(target, target === DONE ? 'submitted' : 'draft'); if (!ok) return; }
    setStep(target); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const next = () => go(step + 1);
  const back = () => { setStep((x) => Math.max(0, x - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const emailDomainOk = s.work_email.includes('@') && !FREE.includes(s.work_email.split('@')[1]?.toLowerCase() || '');

  function ProductTabs({ allowEdit = false }: { allowEdit?: boolean }) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {s.products.map((p, i) => (
          <span key={p.id} className={`group inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all ${i === s.activeIdx ? 'border-accent-yellow bg-accent-soft text-text-primary' : 'border-bg-border bg-bg-surface text-text-secondary hover:border-accent-yellow/50'}`}>
            <button onClick={() => set({ activeIdx: i })} className="font-medium">{p.product_name || `Product ${i + 1}`}</button>
            {allowEdit && s.products.length > 1 && <button onClick={() => removeProduct(i)} className="text-text-muted hover:text-status-red"><X className="h-3.5 w-3.5" /></button>}
          </span>
        ))}
        {allowEdit && <button onClick={addProduct} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-accent-yellow/50 px-3 py-1.5 text-sm font-semibold text-accent-yellow hover:bg-accent-soft"><Plus className="h-4 w-4" /> Add product</button>}
      </div>
    );
  }

  return (
    <PageContainer className="py-10 sm:py-14">
      <datalist id="vendor-registry">{vendorNames.map((n) => <option key={n} value={n} />)}</datalist>
      <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={onPickFile} />
      <input ref={certFileInput} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={onPickCertFile} />
      <input ref={logoFileInput} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={onPickLogoFile} />

      <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* LEFT · journey stepper + contextual guidance (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <SectionGuide step={step} />
          </div>
        </aside>

        {/* RIGHT · the form */}
        <div className="min-w-0">

      {/* progress — mobile only; the desktop sidebar replaces it */}
      <div className="mb-7 lg:hidden">
        <div className="flex gap-1.5">{STEPS.map((_, i) => (<div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i < step ? 'bg-accent-yellow' : i === step ? 'bg-accent-yellow shadow-[0_0_8px_rgba(245,184,0,0.5)]' : 'bg-bg-border'}`} />))}</div>
        <div className="mt-2 flex gap-1.5">{STEPS.map((label, i) => (<div key={label} className={`flex-1 text-center font-mono text-[8px] uppercase tracking-wide ${i === step ? 'text-accent-yellow' : 'text-text-muted'}`}>{label}</div>))}</div>
      </div>

      <div className="rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-8 animate-fade-in">
        {/* Start */}
        {step === 0 && (
          <div className="space-y-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-yellow/30 bg-accent-soft"><Box className="h-6 w-6 text-accent-yellow" /></span>
            <div><h1 className="mb-2 text-2xl font-bold tracking-tight text-text-primary">List your products on the Defence Layer.</h1>
              <p className="mx-auto max-w-md text-[15px] leading-relaxed text-text-secondary">Verify your company, add products, let AI map them to GUARD, add media and evidence, then review &amp; submit.</p></div>
            <button onClick={() => setStep(CO)} className="btn btn-primary btn-lg mx-auto group">Begin Onboarding <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" /></button>
            <div className="mx-auto max-w-sm rounded-xl border border-bg-border bg-bg-elevated p-4 text-left">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-text-secondary"><RotateCcw className="h-3.5 w-3.5" /> Already started?</p>
              <div className="flex gap-2"><input type="email" value={resumeEmail} onChange={(e) => setResumeEmail(e.target.value)} placeholder="you@company.com" className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm focus:border-accent-yellow focus:outline-none" />
                <button onClick={() => doResume(resumeEmail)} className="btn btn-outline btn-sm">Resume</button></div>
              {resumeMsg && <p className="mt-2 text-xs text-status-red">{resumeMsg}</p>}
            </div>
          </div>
        )}

        {/* Company */}
        {step === CO && (
          <div className="space-y-4">
            <StepHeader step={CO} />
            <div>
              <label className="mb-1.5 block font-mono text-[12.5px] font-semibold uppercase tracking-wide text-text-secondary">Company <span className="text-status-red">*</span></label>
              <div className="flex gap-2">
                <input list="vendor-registry" value={s.company_name} onChange={(e) => { set({ company_name: e.target.value, vendor_verified: false, vendor_id: null }); setVendorMsg(''); }}
                  placeholder="Start typing… (must match a registered vendor)"
                  className={`flex-1 rounded-lg border bg-bg-surface px-3.5 py-2.5 text-[15px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-yellow/20 ${errors.company && !s.vendor_verified ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'}`} />
                <button onClick={verifyVendorNow} disabled={verifying} className="btn btn-accent btn-sm shrink-0">{verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify</button>
              </div>
              {s.vendor_verified ? <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-status-green"><Check className="h-3.5 w-3.5" /> Verified — vendor #{s.vendor_id}</p>
                : vendorMsg ? <p className="mt-1.5 flex items-center gap-1 text-xs text-status-red"><AlertTriangle className="h-3.5 w-3.5" /> {vendorMsg}</p>
                : errors.company ? <p className="mt-1.5 flex items-center gap-1 text-xs text-status-red"><AlertTriangle className="h-3.5 w-3.5" /> {errors.company}</p>
                : <p className="mt-1.5 font-mono text-[10px] text-text-muted">e.g. Datadog, CrowdStrike, Cloudflare, BigID…</p>}
            </div>
            <Field label="Work email" type="email" value={s.work_email} onChange={(v) => set({ work_email: v })} required error={errors.work_email} hint={emailDomainOk ? '✓ work email' : undefined} />
            <div className="grid grid-cols-2 gap-4"><Field label="Website" value={s.website} onChange={(v) => set({ website: v })} required error={errors.website} /><Field label="HQ" value={s.hq} onChange={(v) => set({ hq: v })} required error={errors.hq} /></div>
            <div className="grid grid-cols-2 gap-4"><Field label="Founded" value={s.founded} onChange={(v) => set({ founded: v })} required error={errors.founded} /><Field label="Size · Stage" value={s.company_size} onChange={(v) => set({ company_size: v })} required error={errors.company_size} /></div>
            {s.vendor_verified && (
              <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-text-secondary">
                <input type="checkbox" checked={s.attested} onChange={(e) => set({ attested: e.target.checked })} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#F5B800]" />
                <span>I'm authorised to represent <b className="text-text-primary">{s.company_name}</b> and accept the <span className="text-accent-yellow">Vendor Terms</span>.</span>
              </label>
            )}
            {errors.attest && <p className="text-xs text-status-red">{errors.attest}</p>}
          </div>
        )}

        {/* Products */}
        {step === PROD && (
          <div className="space-y-5">
            <StepHeader step={PROD} />
            {loadedExisting > 0 && <div className="flex items-start gap-2 rounded-xl border border-accent-yellow/40 bg-accent-soft p-3.5 text-[13px] leading-relaxed text-text-primary"><Check className="mt-0.5 h-4 w-4 shrink-0 text-status-green" /><span>We found <b>{loadedExisting}</b> existing product(s) for <b>{s.company_name}</b> — edit them below (updates, not duplicates), or <b>Add product</b> for a new one.</span></div>}
            <ProductTabs allowEdit />
            <div>{active.existing ? <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-yellow/40 bg-accent-soft px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#7A5B00]"><Pencil className="h-3 w-3" /> Editing existing · product #{active.backend_id}</span>
              : <span className="inline-flex items-center gap-1.5 rounded-md border border-status-green/30 bg-status-green/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-status-green"><Plus className="h-3 w-3" /> New product</span>}</div>
            <div className="space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-4">
              <Field label="Product name" value={active.product_name} onChange={(v) => patchActive({ product_name: v })} required error={errors[`p${s.activeIdx}_name`]} />
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-text-secondary">Description <span className="text-status-red">*</span></label>
                <textarea rows={3} value={active.product_description} onChange={(e) => patchActive({ product_description: e.target.value })}
                  className={`w-full rounded-lg border bg-bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-yellow/20 ${errors[`p${s.activeIdx}_desc`] ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'}`} />
                {errors[`p${s.activeIdx}_desc`] && <p className="mt-1.5 text-xs text-status-red">{errors[`p${s.activeIdx}_desc`]}</p>}
              </div>
              {/* Category — vendor's own product category (free text), not the GUARD
                  category. The GUARD category is mapped separately by AI in Step 3. */}
              <Field label="Category" value={active.category} onChange={(v) => patchActive({ category: v })}
                placeholder="e.g. SIEM / Security Analytics" required error={errors[`p${s.activeIdx}_cat`]}
                hint="Your product category. (GUARD category is mapped by AI later.)" />
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-text-secondary">Pricing model</label>
                  <select value={active.pricing_model} onChange={(e) => patchActive({ pricing_model: e.target.value })} className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-2.5 text-[15px] text-text-primary focus:border-accent-yellow focus:outline-none">{PRICING.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                </div>
                <Field label="Target market" value={active.target_market} onChange={(v) => patchActive({ target_market: v })} placeholder="Mid-market & Enterprise" required error={errors[`p${s.activeIdx}_mkt`]} />
              </div>
              <Field label="Product URL" value={active.product_url} onChange={(v) => patchActive({ product_url: v })} placeholder="https://…" required error={errors[`p${s.activeIdx}_url`]} />
              <AddMoreList label="Key features / differentiators *" items={active.key_features} onChange={(v) => patchActive({ key_features: v })} placeholder="e.g. Anomaly detection" />
              <AddMoreList label="Use cases *" items={active.use_cases} onChange={(v) => patchActive({ use_cases: v })} placeholder="e.g. Detect MFA-bypass" />
              <AddMoreList label="Benefits *" items={active.benefits} onChange={(v) => patchActive({ benefits: v })} placeholder="e.g. Faster detection" />
              <AddMoreList label="Tags *" items={active.tags} onChange={(v) => patchActive({ tags: v })} placeholder="e.g. siem" />
              <div className="grid grid-cols-2 gap-3"><Field label="Version" value={active.version} onChange={(v) => patchActive({ version: v })} required error={errors[`p${s.activeIdx}_ver`]} /><Field label="SKU" value={active.sku} onChange={(v) => patchActive({ sku: v })} required error={errors[`p${s.activeIdx}_sku`]} /></div>
            </div>
          </div>
        )}

        {/* Guard Mapping */}
        {step === GUARD && (
          <div className="space-y-5">
            <StepHeader step={GUARD} />
            <DefineCard items={[
              { term: 'What is GUARD?', def: 'GUARD is our simple framework for grouping risk. Instead of vague labels, it sorts every kind of business risk into clear areas, so buyers can quickly see what your product helps with.' },
              { term: 'What are GUARD categories?', def: 'There are 13 categories, such as Cyber, Data, Operational, Financial and People. Each one is a type of risk. We tag your product with the categories it helps protect against.' },
              { term: 'What are controls?', def: 'Controls are the specific protections your product provides inside a category, for example “detects malicious traffic”. We write these in plain language so buyers understand exactly what you do.' },
            ]} />
            <ProductTabs />

            {!active.guard_started && (
              <div className="rounded-xl border border-dashed border-accent-yellow/50 bg-bg-elevated p-6 text-center">
                <Sparkles className="mx-auto mb-3 h-7 w-7 text-accent-yellow" />
                <p className="mx-auto mb-4 max-w-md text-sm text-text-secondary">The AI gathers your product, company and GUARD context, asks only what it needs, then maps with confidence scores.</p>
                <button onClick={startGuard} disabled={guardLoading} className="btn btn-primary mx-auto">{guardLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</> : <><Brain className="h-4 w-4" /> Start Guard Mapping</>}</button>
              </div>
            )}

            {active.guard_started && (
              <>
                {/* transcript */}
                {active.guard_answers.length > 0 && (
                  <div className="space-y-2">
                    {active.guard_answers.map((qa, i) => (
                      <div key={i} className="rounded-xl border border-bg-border bg-bg-surface p-3">
                        <div className="text-[13px] font-medium text-text-primary">{qa.question}</div>
                        <div className="mt-1 text-[13px] text-text-secondary">↳ {qa.answer || <span className="italic text-text-muted">(skipped)</span>}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* pending question (multiple choice) */}
                {active.guard_question && !active.guard_mapping && (
                  <div className="rounded-xl border border-accent-yellow/40 bg-accent-soft p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-primary"><MessageSquareQuote className="h-4 w-4 text-accent-yellow" /> {active.guard_question.text}</div>
                    <div className="mb-3 font-mono text-[10px] text-text-muted">{active.guard_question.why}{(active.guard_question.options?.length || 0) > 0 ? ' · select all that apply' : ''}</div>
                    {(active.guard_question.options?.length || 0) > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {active.guard_question.options!.map((o) => {
                            const on = guardSelected.includes(o);
                            return (
                              <button key={o} onClick={() => setGuardSelected(on ? guardSelected.filter((x) => x !== o) : [...guardSelected, o])}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all ${on ? 'border-accent-yellow bg-accent-yellow/20 text-text-primary' : 'border-bg-border bg-bg-surface text-text-secondary hover:border-accent-yellow/50'}`}>
                                {on ? <Check className="h-3.5 w-3.5 text-accent-yellow" /> : <span className="h-3.5 w-3.5 rounded-sm border border-bg-border" />} {o}
                              </button>
                            );
                          })}
                        </div>
                        <input value={guardInput} onChange={(e) => setGuardInput(e.target.value)} placeholder="Other (optional)…" className="mt-2 w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm focus:border-accent-yellow focus:outline-none" />
                      </>
                    ) : (
                      <textarea rows={2} value={guardInput} onChange={(e) => setGuardInput(e.target.value)} placeholder="Your answer…" className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm focus:border-accent-yellow focus:outline-none" />
                    )}
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={submitGuardAnswer} disabled={guardLoading} className="btn btn-primary btn-sm flex-1">{guardLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</> : <>Submit answer <ArrowRight className="h-4 w-4" /></>}</button>
                      <button onClick={() => { setGuardSelected([]); setGuardInput(''); runGuardStep([...active.guard_answers, { question: active.guard_question!.text, answer: '' }]); }} disabled={guardLoading} className="btn btn-outline btn-sm">Skip</button>
                    </div>
                  </div>
                )}

                {/* final mapping — shape + category grid + adaptive controls */}
                {active.guard_mapping && (() => {
                  const gm = active.guard_mapping!;
                  const hit = (code: string) => gm.categories.find((c) => c.code === code);
                  return (
                    <div className="space-y-5 rounded-xl border border-bg-border bg-bg-surface p-5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-text-secondary">Mapping result</span>
                        {gm.accepted && <span className="inline-flex items-center gap-1 rounded-md bg-status-green/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-status-green"><Check className="h-3 w-3" /> Accepted</span>}
                      </div>

                      {/* GUARD category grid (all 13; touched highlighted) */}
                      <div>
                        <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-text-secondary">GUARD categories touched</div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {GUARD_CATS.map(([code, name]) => {
                            const c = hit(code);
                            return (
                              <div key={code} className={`rounded-lg border p-2.5 ${c?.primary ? 'border-accent-yellow bg-accent-soft' : c ? 'border-accent-yellow/40' : 'border-bg-border bg-bg-elevated'}`}>
                                <div className={`font-mono text-[9.5px] ${c ? 'text-accent-yellow' : 'text-text-muted'}`}>{code}{c?.primary ? '·P' : ''}</div>
                                <div className="mt-0.5 text-[11.5px] font-semibold text-text-primary">{name}</div>
                                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-bg-border">
                                  <div className="h-full rounded-full bg-accent-yellow transition-all duration-700" style={{ width: c ? `${c.strength}%` : '0%' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* subcategories */}
                      {gm.subcategories.length > 0 && (
                        <div>
                          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-text-secondary">Subcategories</div>
                          <div className="flex flex-wrap gap-2">
                            {gm.subcategories.map((s2) => (
                              <span key={s2.code + s2.category} className="inline-flex items-center gap-1.5 rounded-md border border-bg-border bg-bg-elevated px-2.5 py-1 text-[12px] text-text-secondary">
                                <span className="font-mono text-[10px] text-accent-yellow">{s2.code}</span> {s2.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* adaptive controls — verify or remove */}
                      <div>
                        <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-text-secondary">Mapped adaptive controls — verify or remove</div>
                        <div className="space-y-2">
                          {gm.adaptive_controls.map((ac, i) => (
                            <div key={ac.code + i} className="flex items-center gap-2.5 rounded-lg border border-bg-border bg-bg-elevated px-3 py-2.5">
                              <span className="rounded border border-accent-yellow/40 bg-accent-soft px-1.5 py-0.5 font-mono text-[9.5px] text-[#7A5B00]">{ac.verb}</span>
                              <span className="font-mono text-[11.5px] text-text-primary">{ac.code}</span>
                              <span className="flex-1 text-[12px] text-text-secondary">{ac.label}</span>
                              <button onClick={() => removeControl(i)} className="text-text-muted hover:text-status-red"><X className="h-3.5 w-3.5" /></button>
                            </div>
                          ))}
                          {gm.adaptive_controls.length === 0 && <p className="text-xs text-text-muted">No adaptive controls — re-evaluate to regenerate.</p>}
                        </div>
                      </div>

                      <p className="text-[13px] leading-relaxed text-text-secondary">{gm.explanation}</p>

                      <div className="flex flex-wrap gap-2 border-t border-bg-border pt-4">
                        <button onClick={acceptMapping} disabled={gm.accepted} className="btn btn-primary btn-sm disabled:opacity-50"><Check className="h-4 w-4" /> Accept mapping</button>
                        <button onClick={reEvaluate} className="btn btn-outline btn-sm"><RefreshCw className="h-4 w-4" /> Re-evaluate</button>
                        <select onChange={(e) => e.target.value && manualOverride(e.target.value)} value="" className="rounded-lg border border-bg-border bg-bg-surface px-2.5 py-2 text-sm text-text-secondary focus:border-accent-yellow focus:outline-none">
                          <option value="">Override primary (admin)…</option>
                          {GUARD_CATS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            <p className="font-mono text-[10px] text-text-muted">Guard Mapping is optional to proceed, but recommended — vendors never pick categories manually.</p>
          </div>
        )}

        {/* Media */}
        {step === MEDIA && (
          <div className="space-y-5">
            <StepHeader step={MEDIA} />
            <ProductTabs />
            <div className="space-y-4 rounded-xl border border-bg-border bg-bg-elevated p-4">
              {/* Logo — URL (validated) or PNG/JPG upload, with live preview */}
              <div>
                <label className="mb-1.5 block font-mono text-[12.5px] font-semibold uppercase tracking-wide text-text-secondary">Logo <span className="text-status-red">*</span></label>
                <div className="flex gap-2">
                  <input
                    value={active.logo_url}
                    onChange={(e) => { patchActive({ logo_url: e.target.value }); setLogoLoadError(false); }}
                    placeholder="https://…/logo.png"
                    className={`flex-1 rounded-lg border bg-bg-surface px-3.5 py-2.5 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-yellow/20 ${
                      active.logo_url.trim() && !isUrl(active.logo_url) ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'
                    }`}
                  />
                  <button onClick={() => { setUploadingLogo(true); logoFileInput.current?.click(); }} disabled={uploadingLogo} className="btn btn-outline btn-sm shrink-0">
                    {uploadingLogo ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload PNG/JPG</>}
                  </button>
                </div>
                {active.logo_url.trim() && !isUrl(active.logo_url) ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-status-red"><AlertTriangle className="h-3.5 w-3.5" /> Enter a valid URL (https://…) or upload a PNG/JPG image.</p>
                ) : (
                  <p className="mt-1.5 font-mono text-[10px] text-text-muted">Paste an image URL or upload a PNG/JPG. Proof appears in the preview below.</p>
                )}
                {/* preview */}
                {active.logo_url.trim() && isUrl(active.logo_url) && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-bg-border bg-bg-surface p-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg-border bg-white">
                      {logoLoadError ? (
                        <AlertTriangle className="h-5 w-5 text-status-amber" />
                      ) : (
                        <img src={active.logo_url} alt="Logo preview" className="h-full w-full object-contain p-1" onLoad={() => setLogoLoadError(false)} onError={() => setLogoLoadError(true)} />
                      )}
                    </div>
                    <div className="text-xs">
                      <div className="font-semibold text-text-primary">Logo preview</div>
                      <div className="text-text-muted">{active.logo_url.startsWith('/uploads/') ? 'Uploaded file' : 'From URL'}{logoLoadError ? ' · image not reachable' : ''}</div>
                    </div>
                  </div>
                )}
              </div>
              <AddMoreList label="Product images" items={active.product_images} onChange={(v) => patchActive({ product_images: v })} placeholder="https://…/shot.png" />
              <AddMoreList label="Product videos" items={active.product_videos} onChange={(v) => patchActive({ product_videos: v })} placeholder="https://youtube.com/watch?v=…" />
              {active.product_videos.filter(Boolean).length > 0 && (
                <div>
                  <label className="mb-2 block font-mono text-[12.5px] font-semibold uppercase tracking-wide text-text-secondary">Video preview</label>
                  <p className="mb-3 text-[12px] text-text-muted">Hover a video to play a preview.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {active.product_videos.filter(Boolean).map((v, i) => <VideoThumb key={i} url={v} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evidence */}
        {step === EVID && (
          <div className="space-y-5">
            <StepHeader step={EVID} />

            {/* Defence Rating disclaimer + evidence tier rubric */}
            <div className="rounded-xl border border-accent-yellow/40 bg-accent-soft/60 p-4 sm:p-5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-yellow" />
                <div>
                  <h3 className="text-[15px] font-semibold text-text-primary">Why this matters</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
                    Everything you add here is used to work out your <b>Defence Rating</b> on the next step.
                    We sort each item into a level from E1 (the strongest) down to E5 (the weakest), then turn
                    those levels into your score out of 100. Proof from an outside source counts for the most.
                    Adding more is <b>your choice, but it helps</b>: the more good proof you give us, the higher
                    and more trusted your rating.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t border-accent-yellow/20 pt-3.5">
                {EVIDENCE_TIERS.map((t) => (
                  <div key={t.tier} className="flex items-start gap-2.5 text-[13px]">
                    <span className={`mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${t.tone}`}>{t.tier}</span>
                    <div className="flex-1">
                      <span className="text-text-primary">{t.label}.</span>{' '}
                      <span className="text-text-muted">For example: {t.example}.</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3.5 text-[12px] leading-relaxed text-text-muted">
                You don’t choose the level yourself. You just add the proof and our system sorts it for you.
                The higher levels need proof from an outside source or a named customer. Your score stays hidden
                (marked “Provisional”) until our team has checked at least one item stronger than E5.
              </p>
            </div>

            <ProductTabs />
            <EvidenceBlock title="Articles & web links" icon={Link2} hint="Public web pages about your product, such as a news article, a blog post, a research report, or a customer success story. Copy the web address (it starts with https://) from your browser and paste it below. You can usually find these on your own website’s blog or press page, or by searching your product’s name online. Pick the type, add a short title, and paste the link." items={active.evidence.filter((e) => e.group === 'link')} onAdd={() => addEvidence('link')}>
              {active.evidence.filter((e) => e.group === 'link').map((ev) => (
                <div key={ev.id} className="space-y-2 rounded-lg border border-bg-border bg-bg-surface p-3">
                  <div className="flex gap-2">
                    <select value={ev.type} onChange={(e) => updateEvidence(ev.id, { type: e.target.value })} className="rounded-lg border border-bg-border bg-bg-surface px-2 py-1.5 text-sm focus:border-accent-yellow focus:outline-none">{LINK_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <input value={ev.title} onChange={(e) => updateEvidence(ev.id, { title: e.target.value })} placeholder="Short title, e.g. “TechCrunch review”" className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                    <button onClick={() => removeEvidence(ev.id)} className="text-text-muted hover:text-status-red"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <input value={ev.url} onChange={(e) => updateEvidence(ev.id, { url: e.target.value })} placeholder="Paste the web address, e.g. https://yoursite.com/blog/post" className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                  {evidenceFile(ev)}
                  <IssuedDate value={ev.issued_date} onChange={(v) => updateEvidence(ev.id, { issued_date: v })} />
                </div>
              ))}
            </EvidenceBlock>
            <EvidenceBlock title="Customer proof" icon={MessageSquareQuote} hint="Proof that real customers use and like your product. For example, a review on a site like G2 or Gartner Peer Insights, a short written testimonial from a customer, or the name of a customer who is happy to be a reference. Type the customer’s name and their quote, and paste a link if you have one." items={active.evidence.filter((e) => e.group === 'customer')} onAdd={() => addEvidence('customer')}>
              {active.evidence.filter((e) => e.group === 'customer').map((ev) => (
                <div key={ev.id} className="space-y-2 rounded-lg border border-bg-border bg-bg-surface p-3">
                  <div className="flex gap-2">
                    <select value={ev.type} onChange={(e) => updateEvidence(ev.id, { type: e.target.value })} className="rounded-lg border border-bg-border bg-bg-surface px-2 py-1.5 text-sm focus:border-accent-yellow focus:outline-none">{CUSTOMER_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <input value={ev.title} onChange={(e) => updateEvidence(ev.id, { title: e.target.value })} placeholder="Customer name, e.g. Acme Corp" className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                    <button onClick={() => removeEvidence(ev.id)} className="text-text-muted hover:text-status-red"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <textarea rows={2} value={ev.description} onChange={(e) => updateEvidence(ev.id, { description: e.target.value })} placeholder="What did they say about your product?" className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                  <input value={ev.url} onChange={(e) => updateEvidence(ev.id, { url: e.target.value })} placeholder="Link to the review or story (optional)" className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                  {evidenceFile(ev)}
                  <IssuedDate value={ev.issued_date} onChange={(v) => updateEvidence(ev.id, { issued_date: v })} />
                </div>
              ))}
            </EvidenceBlock>
            <EvidenceBlock title="Documents & files (audit reports, certificates, data sheets…)" addLabel="a document" icon={FileText} hint="Upload files that back up your claims (for example: audit reports, certificates, penetration-test reports, data sheets, white papers, or slide decks). Accepted formats are PDF, Word, Excel, and PowerPoint. Give each file a short title so reviewers know what it is." items={active.evidence.filter((e) => e.group === 'document')} onAdd={() => addEvidence('document')}>
              {active.evidence.filter((e) => e.group === 'document').map((ev) => (
                <div key={ev.id} className="space-y-2 rounded-lg border border-bg-border bg-bg-surface p-3">
                  <div className="flex gap-2"><input value={ev.title} onChange={(e) => updateEvidence(ev.id, { title: e.target.value })} placeholder="What is this file? e.g. “SOC 2 report”" className="flex-1 rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                    <button onClick={() => removeEvidence(ev.id)} className="text-text-muted hover:text-status-red"><Trash2 className="h-4 w-4" /></button></div>
                  <input value={ev.url} onChange={(e) => updateEvidence(ev.id, { url: e.target.value })} placeholder="Link to the document (optional, if it's online)" className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-1.5 text-sm focus:border-accent-yellow focus:outline-none" />
                  {evidenceFile(ev)}
                  <IssuedDate value={ev.issued_date} onChange={(v) => updateEvidence(ev.id, { issued_date: v })} />
                </div>
              ))}
            </EvidenceBlock>
            {/* Certifications — moved here from Company; they are supporting evidence */}
            {certList()}
          </div>
        )}

        {/* Defence Rating */}
        {step === DEFENSE && (
          <div className="space-y-5">
            <StepHeader step={DEFENSE} />
            <DefineCard items={[
              { term: 'What is a Defence Rating?', def: 'It is a single trust score from 0 to 100 that shows buyers how well proven your product is. A higher score means stronger, more independent evidence behind your claims.' },
              { term: 'How is it worked out?', def: 'It is built only from the evidence you added and the risk areas you cover. It looks at how strong your proof is, whether outside sources back it up, and how recent it is. Paying for a plan never changes it.' },
              { term: 'Why might it be hidden?', def: 'If none of your evidence has been checked by our team yet, the number stays hidden and shows as “Provisional” until at least one strong item is verified.' },
            ]} />
            <ProductTabs />
            {(() => {
              const p = active;
              const prev = defensePreviews[p.id];
              const loading = defenseLoading[p.id];
              const err = defenseError[p.id];
              const tierTone = (t: string) =>
                t === 'E1' || t === 'E2' ? 'text-status-green border-status-green/30 bg-status-green/10'
                : t === 'E3' ? 'text-status-blue border-status-blue/30 bg-status-blue/10'
                : t === 'E4' ? 'text-status-amber border-status-amber/30 bg-status-amber/10'
                : 'text-text-muted border-bg-border bg-bg-elevated';
              if (loading) return (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-bg-border bg-bg-elevated py-16 text-sm text-text-secondary">
                  <Loader2 className="h-5 w-5 animate-spin text-accent-yellow" /> Grading evidence &amp; computing rating…
                </div>
              );
              if (err) return (
                <div className="rounded-xl border border-status-red/30 bg-status-red/5 p-5 text-sm text-status-red">
                  {err}
                  <button onClick={() => runDefensePreview(p)} className="ml-3 btn btn-outline btn-sm"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
                </div>
              );
              if (!prev) return (
                <button onClick={() => runDefensePreview(p)} className="btn btn-primary"><Sparkles className="h-4 w-4" /> Compute Defence Rating</button>
              );
              const withheld = prev.score_withheld;
              return (
                <div className="space-y-5">
                  {/* score header */}
                  <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-bg-border bg-bg-elevated p-6 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-4">
                      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent-yellow/40 bg-accent-soft">
                        <ShieldCheck className="h-8 w-8 text-accent-yellow" />
                      </span>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-bold leading-none text-text-primary">{withheld ? '—' : prev.overall}</span>
                          {!withheld && <span className="text-lg text-text-muted">/100</span>}
                          <span className="ml-1 rounded-md border border-accent-yellow/40 bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-[#7A5B00]">{prev.band}</span>
                        </div>
                        <div className="mt-2">
                          {prev.status === 'verified' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-status-green/30 bg-status-green/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-status-green"><Check className="h-3.5 w-3.5" /> Verified</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-status-amber/30 bg-status-amber/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-wide text-status-amber"><AlertTriangle className="h-3.5 w-3.5" /> Provisional</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => runDefensePreview(p)} className="btn btn-outline btn-sm"><RefreshCw className="h-3.5 w-3.5" /> Recompute</button>
                  </div>

                  {withheld && (
                    <p className="flex items-start gap-2.5 rounded-xl border border-status-amber/30 bg-status-amber/5 p-4 text-[14.5px] leading-relaxed text-text-secondary">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-amber" />
                      We’re holding the number back for now. It will appear once our team has checked at least one piece of your proof. You can still see the full breakdown below.
                    </p>
                  )}

                  {/* dimensions */}
                  <div className="rounded-xl border border-bg-border bg-bg-surface p-6">
                    <h3 className="mb-5 text-[17px] font-semibold text-text-primary">How your score is made up</h3>
                    <div className="space-y-4">
                      {api.DEFENSE_DIMENSIONS.map((dim) => {
                        const v = Math.round(prev.per_dimension[dim.key] ?? 0);
                        const w = Math.round((prev.weights[dim.key] ?? 0) * 100);
                        return (
                          <div key={dim.key}>
                            <div className="mb-1.5 flex items-center justify-between">
                              <span className="text-[15px] text-text-primary">{dim.label} <span className="text-[13px] text-text-muted">({w}% of the score)</span></span>
                              <span className="text-[15px] tabular-nums text-text-secondary">{v}/100</span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded-full bg-bg-elevated">
                              <div className="h-full rounded-full bg-accent-yellow transition-all" style={{ width: `${v}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* graded evidence */}
                  <div className="rounded-xl border border-bg-border bg-bg-surface p-6">
                    <h3 className="mb-4 text-[17px] font-semibold text-text-primary">Your evidence, sorted by strength ({prev.graded_evidence.length})</h3>
                    {prev.graded_evidence.length === 0 ? (
                      <p className="text-[14.5px] leading-relaxed text-text-muted">You haven’t added any proof yet. Go back to the Evidence step to add some, and your rating will go up.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {prev.graded_evidence.map((g) => (
                          <div key={g.evidence_id} className="flex items-center gap-3 text-[15px]">
                            <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[12.5px] font-semibold ${tierTone(g.tier)}`}>{g.tier}</span>
                            <span className="flex-1 truncate text-text-primary">{g.title || g.type}</span>
                            {g.independent && <span className="shrink-0 text-[12px] font-medium uppercase tracking-wide text-status-blue">independent</span>}
                            {g.verified
                              ? <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-status-green"><Check className="h-4 w-4" /> verified</span>
                              : <span className="shrink-0 text-[12.5px] text-text-muted">not checked yet</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {prev.notes.length > 0 && (
                    <ul className="space-y-2">
                      {prev.notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-text-secondary"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-yellow" /> {n}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[13px] leading-relaxed text-text-muted">Your score comes only from your evidence. Paying for a plan never changes it.</p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Review */}
        {step === REVIEW && (
          <div className="space-y-5">
            <StepHeader step={REVIEW} />
            <ReviewCard title="Company Information" icon={Building2} onEdit={() => setStep(CO)}>
              <Row k="Company" v={`${s.company_name} (vendor #${s.vendor_id})`} />
              <Row k="Work email" v={s.work_email} />
              <Row k="Website" v={s.website} />
              <Row k="Headquarters" v={s.hq} />
              <Row k="Founded" v={s.founded} />
              <Row k="Size · Stage" v={s.company_size} />
              <Row k="Certifications" v={s.certifications.filter((c) => c.name.trim()).map((c) => `${c.name} (${c.file_url ? 'file ✓' : c.url ? 'link ✓' : 'no proof'})`).join('  ·  ')} />
            </ReviewCard>

            {s.products.map((p, i) => {
              const primary = p.guard_mapping?.categories.find((c) => c.primary) || p.guard_mapping?.categories[0];
              return (
                <ReviewCard key={p.id} title={p.product_name || `Product ${i + 1}`} icon={Box} onEdit={() => { set({ activeIdx: i }); setStep(PROD); }}>
                  {/* quick jumps */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[['Details', PROD], ['Media', MEDIA], ['Evidence', EVID], ['Mapping', GUARD], ['Rating', DEFENSE]].map(([lbl, st]) => (
                      <button key={lbl as string} onClick={() => { set({ activeIdx: i }); setStep(st as number); }}
                        className="rounded border border-bg-border px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:border-accent-yellow hover:text-accent-yellow">{lbl}</button>
                    ))}
                  </div>
                  <Row k="Category" v={p.category} />
                  <Row k="Description" v={p.product_description} />
                  <Row k="Pricing · Market" v={[p.pricing_model, p.target_market].filter(Boolean).join(' · ')} />
                  <Row k="Product URL" v={p.product_url} />
                  <Row k="Version · SKU" v={[p.version, p.sku].filter(Boolean).join(' · ')} />
                  <Row k="Tags" v={p.tags.filter(Boolean).join(', ')} />
                  <Row k="Key features" v={p.key_features.filter(Boolean).join(', ')} />
                  <Row k="Use cases" v={p.use_cases.filter(Boolean).join(', ')} />
                  <Row k="Benefits" v={p.benefits.filter(Boolean).join(', ')} />
                  {/* Logo — rendered thumbnail so the uploaded/linked image is visible before submit */}
                  <div className="flex gap-3 text-[13px]">
                    <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">Logo</span>
                    <div className="flex-1">
                      {p.logo_url.trim() ? (
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg-border bg-white">
                            <img src={p.logo_url} alt="Logo preview" className="h-full w-full object-contain p-1" />
                          </div>
                          <span className="break-all text-text-primary">{p.logo_url}{p.logo_url.startsWith('/uploads/') ? ' (uploaded)' : ''}</span>
                        </div>
                      ) : <span className="text-status-amber">No logo</span>}
                    </div>
                  </div>
                  {/* Images — rendered thumbnails */}
                  <div className="flex gap-3 text-[13px]">
                    <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">Images</span>
                    <div className="flex flex-1 flex-wrap gap-2">
                      {p.product_images.filter(Boolean).length > 0 ? p.product_images.filter(Boolean).map((src) => (
                        <div key={src} className="h-14 w-20 overflow-hidden rounded-lg border border-bg-border bg-white">
                          <img src={src} alt="Product" className="h-full w-full object-contain p-0.5" />
                        </div>
                      )) : <span className="text-text-muted">—</span>}
                    </div>
                  </div>
                  {/* Videos — rendered hover-play thumbnails */}
                  <div className="flex gap-3">
                    <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wide text-text-muted">Videos</span>
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      {p.product_videos.filter(Boolean).length > 0 ? p.product_videos.filter(Boolean).map((v, i) => <VideoThumb key={i} url={v} />) : <span className="text-text-muted">—</span>}
                    </div>
                  </div>
                  {/* evidence list */}
                  {p.evidence.filter((e) => e.title.trim() || e.url.trim() || e.file_url).length > 0 && (
                    <div className="flex gap-3">
                      <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wide text-text-muted">Evidence</span>
                      <div className="flex-1 space-y-1.5">
                        {p.evidence.filter((e) => e.title.trim() || e.url.trim() || e.file_url).map((e) => (
                          <div key={e.id} className="flex items-start gap-2 text-[14.5px] text-text-primary">
                            <span className="mt-0.5 shrink-0 rounded border border-accent-yellow/30 bg-accent-soft px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-[#7A5B00]">{e.type.replace(/_/g, ' ')}</span>
                            <span>{e.title || e.filename || e.url}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* guard mapping detail */}
                  <div className="flex gap-3">
                    <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wide text-text-muted">GUARD mapping</span>
                    <div className="flex-1">
                      {p.guard_mapping ? (
                        <div className="space-y-1.5">
                          <div className="text-[15px] text-text-primary"><b>{primary?.label}</b> <span className="font-mono text-[12px] text-text-muted">({primary?.code})</span>{p.guard_mapping.accepted ? <span className="ml-2 text-[13px] font-medium text-status-green">✓ accepted</span> : <span className="ml-2 text-[13px] font-medium text-status-amber">not accepted</span>}</div>
                          {p.guard_mapping.subcategories.length > 0 && <div className="font-mono text-[12.5px] text-text-secondary">subcats: {p.guard_mapping.subcategories.map((x) => x.code).join(', ')}</div>}
                          {p.guard_mapping.adaptive_controls.map((a, k) => (
                            <div key={k} className="flex items-start gap-2 text-[14px] text-text-secondary">
                              <span className="mt-0.5 shrink-0 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-[#7A5B00]">{a.verb}</span>
                              <span><span className="font-mono text-[12.5px] font-semibold text-text-primary">{a.code}</span> — {a.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : <span className="text-[14px] text-status-amber">Not mapped yet</span>}
                    </div>
                  </div>
                </ReviewCard>
              );
            })}
          </div>
        )}

        {/* Done */}
        {step === DONE && (
          <div className="text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-green"><Check className="h-8 w-8 text-white" strokeWidth={3} /></span>
            <Eyebrow>Submitted for review</Eyebrow><h1 className="text-2xl font-bold tracking-tight text-text-primary">Thanks, {s.company_name} — we've got it.</h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
              Your {createdIds.length} product{createdIds.length === 1 ? '' : 's'} {createdIds.length === 1 ? 'has' : 'have'} been submitted for review. Our team verifies the details and evidence before publishing to the marketplace — we'll email you at <b className="text-text-primary">{s.work_email}</b> as soon as a decision is made.
            </p>
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-bg-border bg-bg-elevated p-4 text-left text-[13px] leading-relaxed text-text-secondary">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-text-secondary"><Check className="h-3.5 w-3.5 text-status-green" /> What happens next</p>
              We review your submission (usually within a few business days), then email you whether it's <b>approved</b>, <b>needs more info</b>, or <b>declined</b>. Once approved, your product goes live on the marketplace automatically.
            </div>
            <div className="mt-6 flex flex-col items-center gap-3">
              <Link to="/marketplace" className="btn btn-primary">Explore the Marketplace</Link>
              <button onClick={() => setStep(CO)} className="text-sm font-medium text-text-secondary hover:text-accent-yellow">Edit my submission</button>
            </div>
          </div>
        )}

        {/* nav */}
        {step > 0 && step < DONE && (
          <>
            {(errors.product || errors.media || errors.evidence || errors.guard || errors.company) && (
              <p className="mt-5 flex items-center gap-1.5 text-sm text-status-red"><AlertTriangle className="h-4 w-4" /> {errors.product || errors.media || errors.evidence || errors.guard || errors.company}</p>
            )}
            {saveError && <p className="mt-5 flex items-center gap-1.5 text-sm text-status-red"><AlertTriangle className="h-4 w-4" /> {saveError}</p>}
            {submitInfo && <p className="mt-5 flex items-center gap-1.5 text-sm text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" /> {submitInfo}</p>}
            <div className="mt-7 flex gap-3">
              <button onClick={back} disabled={saving} className="btn btn-outline"><ArrowLeft className="h-4 w-4" /> Back</button>
              <button onClick={next} disabled={saving} className="btn btn-primary flex-1 group">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {step === DEFENSE ? 'Submitting…' : 'Saving…'}</> : <>{step === DEFENSE ? 'Submit' : 'Continue'}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}</button>
            </div>
          </>
        )}
          </div>{/* /form card */}
        </div>{/* /right column */}
      </div>{/* /two-column grid */}
    </PageContainer>
  );
}

/* helpers */
function SectionGuide({ step }: { step: number }) {
  const idx = JOURNEY.findIndex((j) => j.step === step);
  const current = idx >= 0 ? idx : 0;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-bg-border bg-bg-surface p-7">
      <div className="mb-7">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-yellow">
          {idx >= 0 ? `Step ${idx + 1} of ${JOURNEY.length}` : 'Vendor onboarding'}
        </p>
        <h2 className="mt-2.5 text-[28px] font-semibold leading-[1.12] tracking-tight text-text-primary">
          List on the<br />Defence Layer
        </h2>
      </div>

      <ol className="flex-1">
        {JOURNEY.map((j, i) => {
          const active = i === current;
          const done = idx >= 0 && i < current;
          return (
            <li key={j.step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors ${
                  active ? 'border-accent-yellow bg-accent-yellow text-[#1C1B19] shadow-[0_0_0_4px_rgba(245,184,0,0.15)]'
                  : done ? 'border-accent-yellow/40 bg-accent-soft text-[#7A5B00]'
                  : 'border-bg-border bg-bg-surface text-text-muted'}`}>
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                {i < JOURNEY.length - 1 && (
                  <span className={`my-1.5 w-[2px] flex-1 rounded-full ${i < current ? 'bg-accent-yellow/40' : 'bg-bg-border'}`} />
                )}
              </div>
              <div className={`pb-6 ${active ? '' : 'pt-1'}`}>
                <div className={`text-[16.5px] font-semibold leading-tight ${active ? 'text-text-primary' : done ? 'text-text-secondary' : 'text-text-muted'}`}>
                  {j.label}
                </div>
                {active && (
                  <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">{j.blurb}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex items-center gap-2 rounded-xl border border-bg-border bg-bg-elevated px-4 py-3 text-[12.5px] text-text-secondary">
        <ShieldCheck className="h-4 w-4 shrink-0 text-accent-yellow" />
        Reviewed by our team before going live.
      </div>
    </div>
  );
}

// Plain-English definition callout used to teach unfamiliar concepts in-flow.
function DefineCard({ items }: { items: { term: string; def: string }[] }) {
  return (
    <div className="rounded-xl border border-accent-yellow/30 bg-accent-soft/50 p-5">
      <dl className="space-y-3.5">
        {items.map((it) => (
          <div key={it.term} className="border-l-2 border-accent-yellow/40 pl-3.5">
            <dt className="text-[15px] font-semibold text-text-primary">{it.term}</dt>
            <dd className="mt-1 text-[14px] leading-relaxed text-text-secondary">{it.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StepHeader({ step }: { step: number }) {
  const h = STEP_HEADER[step];
  const idx = JOURNEY.findIndex((j) => j.step === step);
  if (!h) return null;
  return (
    <div className="mb-7 border-b border-bg-border pb-6">
      <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-yellow">
        {idx >= 0 ? `Step ${idx + 1} of ${JOURNEY.length} · ` : ''}{h.tag}
      </p>
      <h1 className="mt-2.5 text-[30px] font-bold leading-[1.12] tracking-tight text-text-primary">{h.title}</h1>
      <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-text-secondary">{h.desc}</p>
    </div>
  );
}

function VideoThumb({ url }: { url: string }) {
  const id = ytId(url);
  const [hover, setHover] = useState(false);
  if (!id) {
    return (
      <div className="flex aspect-video w-full items-center justify-center break-all rounded-lg border border-bg-border bg-bg-elevated p-2 text-center text-[11px] text-text-muted">
        {url || 'No video'}
      </div>
    );
  }
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-lg border border-bg-border bg-black"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover ? (
        <iframe
          title="video preview"
          src={`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&playsinline=1&rel=0`}
          allow="autoplay; encrypted-media"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <>
          <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="video preview" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-yellow shadow-lg">
              <Play className="h-5 w-5 translate-x-0.5 fill-[#1C1B19] text-[#1C1B19]" />
            </span>
          </span>
        </>
      )}
    </div>
  );
}

function IssuedDate({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const missing = !value;
  return (
    <div>
      <label className="flex items-center gap-2 text-[12px]">
        <span className="font-mono uppercase tracking-wide text-text-secondary">Issued / published date <span className="text-status-red">*</span></span>
        <input type="date" value={value || ''} max="2100-12-31" onChange={(e) => onChange(e.target.value)}
          className={`rounded-lg border bg-bg-surface px-2.5 py-1.5 text-[13px] text-text-secondary focus:outline-none ${missing ? 'border-status-red' : 'border-bg-border focus:border-accent-yellow'}`} />
      </label>
      {missing && <p className="mt-1 text-[11px] text-status-red">A date is required (it tells us how recent this proof is).</p>}
    </div>
  );
}
function EvidenceBlock({ title, icon: Icon, hint, items, onAdd, children, addLabel }: { title: string; icon: any; hint: string; items: any[]; onAdd: () => void; children: React.ReactNode; addLabel?: string }) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-elevated p-5">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-yellow" />
          <div>
            <div className="text-[15px] font-semibold text-text-primary">{title}</div>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-text-secondary">{hint}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-md bg-bg-surface px-2 py-0.5 font-mono text-[11px] text-text-muted">{items.length}</span>
      </div>
      <div className="space-y-2">{children}</div>
      <button onClick={onAdd} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent-yellow/50 py-2.5 text-[13px] font-semibold text-accent-yellow hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /> Add {addLabel ?? title.toLowerCase()}</button>
    </div>
  );
}
function ReviewCard({ title, icon: Icon, onEdit, children }: { title: string; icon: any; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-elevated p-4">
      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Icon className="h-[18px] w-[18px] text-accent-yellow" /><span className="text-[16px] font-semibold text-text-primary">{title}</span></div>
        <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-accent-yellow"><Pencil className="h-3 w-3" /> Edit</button></div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return <div className="flex gap-3"><span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wide text-text-muted">{k}</span><span className="flex-1 text-[14.5px] leading-relaxed text-text-primary">{v}</span></div>;
}
