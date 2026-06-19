const API_BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function sendJSON<T>(method: string, url: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: any) => d.msg).join(', ')
      : detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}
const postJSON = <T,>(url: string, payload: unknown) => sendJSON<T>('POST', url, payload);
const patchJSON = <T,>(url: string, payload: unknown) => sendJSON<T>('PATCH', url, payload);

// ── Stats ─────────────────────────────────────────
export interface PlatformStats {
  vendor_count: number;
  product_count: number;
  total_vendor_rows: number;
  vi_vendor_count: number;
  incident_count: number;
  evidence_count: number;
  guard_categories: number;
}
export const getStats = () => fetchJSON<PlatformStats>('/stats');

// ── Guard Categories ──────────────────────────────
export interface GuardCategory {
  code: string;
  label: string;
}
export const getGuardCategories = () => fetchJSON<GuardCategory[]>('/guard/categories');

// ── Normalised vendor / product shape ─────────────
export interface EvidenceClaim {
  control?: string;
  claim?: string;
  source_span?: string;
  source_url?: string;
  evidence_type?: string;
}

export interface DimensionBreakdown {
  category: string;
  score: number;
  weight: number;
  evidence_ids: string[];
}
export interface EvidenceTrace {
  evidence_id: string;
  tier: string;
  verified: boolean;
  impact: number;
}
export interface DefenseRating {
  rating: number;
  band: string;
  status: 'provisional' | 'verified';
  per_dimension: Record<string, number>;
  breakdown: DimensionBreakdown[];
  evidence_traceability: EvidenceTrace[];
  notes: string[];
  computed_at?: string | null;
}

export interface GradedEvidence {
  evidence_id: string;
  title?: string | null;
  type?: string | null;
  tier: string;
  verified: boolean;
  independent: boolean;
}
// Live preview result (onboarding) — the engine returns `overall`, not `rating`.
export interface DefenseRatingResult {
  overall: number;
  band: string;
  status: 'provisional' | 'verified';
  score_withheld: boolean;
  can_surface: boolean;
  per_dimension: Record<string, number>;
  weights: Record<string, number>;
  breakdown: DimensionBreakdown[];
  evidence_traceability: EvidenceTrace[];
  notes: string[];
  graded_evidence: GradedEvidence[];
}

// Human labels + weights for the five dimensions (display only — no math here).
export const DEFENSE_DIMENSIONS: { key: string; label: string }[] = [
  { key: 'control_coverage', label: 'Control Coverage' },
  { key: 'evidence_strength', label: 'Evidence Strength' },
  { key: 'demonstrated_efficacy', label: 'Demonstrated Efficacy' },
  { key: 'independent_corroboration', label: 'Independent Corroboration' },
  { key: 'recency', label: 'Recency' },
];
export interface ProductEvidence {
  evidence_id: string;
  type: string;
  title: string;
  description?: string | null;
  source_type?: string | null;
  issuer?: string | null;
  issued_date?: string | null;
  trust_tier?: string | null;
  verified: boolean;
  file_url?: string | null;
}

export interface NormalisedVendor {
  _source: 'vi_vendors' | 'vendors';
  _id: string;
  id: number;
  vendor_id?: number;
  vendor_name: string;
  product_name: string;
  product_url: string;
  vendor_url: string;
  vendor_logo?: string | null;
  vendor_domain?: string | null;
  product_logo?: string | null;
  product_images?: string[];
  product_videos?: string[];
  optional_metadata?: Record<string, any>;
  entity_type?: string | null;
  headquarters: string;
  description: string;
  controls: string[];
  guard_categories: { code: string; label: string }[];
  fit_level: string | null;
  confidence: string | null;
  placement: string | null;
  vendor_group: string | null;
  role?: string | null;
  primary_mc?: string | null;
  ai_verdict: number | null;
  score_band?: string | null;
  verified?: boolean;
  defense_rating?: DefenseRating | null;
  product_evidence?: ProductEvidence[];
  score_rationale?: string | null;
  avg_score?: number | null;
  product_count?: number;
  incident_id?: number;
  incident_name?: string | null;
  video_url?: string | null;
  video_id?: string | null;
  video_thumbnail?: string | null;
  video_embed?: string | null;
  capability_claims: EvidenceClaim[];
  framework_alignments: Record<string, any>;
  validation_stats: Record<string, any>;
  compliance_certifications: any[];
  dimension_coverage: Record<string, any>;
  mitigation_mechanism: { how_it_mitigates?: string | null; known_limits?: string | null };
  enabling_features: any[];
  workflow_steps: any[];
  products?: NormalisedVendor[];
}

export interface PaginatedResponse {
  data: NormalisedVendor[];
  page: number;
  page_size: number;
  total?: number;
}

// ── Vendors ───────────────────────────────────────
export const getVendors = (params?: { search?: string; page?: number; page_size?: number; source?: string }) => {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.page_size) qs.set('page_size', String(params.page_size));
  if (params?.source) qs.set('source', params.source);
  return fetchJSON<PaginatedResponse>(`/vendors?${qs}`);
};

export const getVendor = (id: number) => fetchJSON<NormalisedVendor>(`/vendors/${id}`);
export const getVendorByName = (name: string) =>
  fetchJSON<{ data: NormalisedVendor[]; source: string }>(`/vendors/by-name/${encodeURIComponent(name)}`);

// ── Products ──────────────────────────────────────
export const getProducts = (params?: {
  search?: string; page?: number; page_size?: number;
  fit_level?: string; vendor_group?: string;
}) => {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.page_size) qs.set('page_size', String(params.page_size));
  if (params?.fit_level) qs.set('fit_level', params.fit_level);
  if (params?.vendor_group) qs.set('vendor_group', params.vendor_group);
  return fetchJSON<PaginatedResponse>(`/products?${qs}`);
};

export const getProduct = (id: number) => fetchJSON<NormalisedVendor>(`/products/${id}`);

// ── Search ────────────────────────────────────────
export interface SearchResult {
  rich: NormalisedVendor[];
  production: NormalisedVendor[];
  total: number;
}
export const searchAll = (q: string) => fetchJSON<SearchResult>(`/search?q=${encodeURIComponent(q)}`);

// ── Vendor Onboarding ─────────────────────────────
export interface OnboardingState {
  id?: number;
  work_email: string;
  company_name?: string | null;
  website?: string | null;
  hq?: string | null;
  founded?: string | null;
  company_size?: string | null;
  certifications?: string | null;
  product_name?: string | null;
  product_description?: string | null;
  product_shape?: string | null;
  video_state?: string | null;
  video_url?: string | null;
  evidence?: any[];
  extra_products?: any[];
  extra?: Record<string, any>;
  current_step?: number;
  status?: string;
}

export const saveOnboarding = (payload: OnboardingState) =>
  postJSON<OnboardingState>('/onboarding', payload);

export const resumeOnboarding = (email: string) =>
  fetchJSON<OnboardingState>(`/onboarding/${encodeURIComponent(email)}`);

// ── User accounts (email+password auth: vendors & buyers) ─────────────
export type UserRole = 'buyer' | 'vendor';
export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
  role: UserRole;
  company_name?: string | null;
  vendor_id?: number | null;
  created_at?: string;
  last_login_at?: string | null;
}
export interface AuthResponse {
  token: string;
  user: AuthUser;
}

const USER_TOKEN_KEY = 'attacked_user_token';
export const getUserToken = () => localStorage.getItem(USER_TOKEN_KEY) || '';
export const setUserToken = (t: string) => localStorage.setItem(USER_TOKEN_KEY, t);
export const clearUserToken = () => localStorage.removeItem(USER_TOKEN_KEY);

// Single sign-up — role is classified internally by the backend (omit `role`).
export const registerUser = (body: {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
  company_name?: string;
}) => postJSON<AuthResponse>('/auth/register', body);

export const loginUser = (body: { email: string; password: string }) =>
  postJSON<AuthResponse>('/auth/login', body);

// Social login (OIDC). Returns which providers are configured on the backend.
export interface AuthProviders {
  google: boolean;
  microsoft: boolean;
}
export const getAuthProviders = () => fetchJSON<AuthProviders>('/auth/providers');
// Full-page navigation target that kicks off the provider redirect flow.
export const oauthStartUrl = (provider: 'google' | 'microsoft') =>
  `${API_BASE}/auth/oauth/${provider}/start`;

export async function getMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${getUserToken()}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

// Promote the signed-in user to vendor by claiming a vendor profile (called
// after a successful onboarding submission). No-op for signed-out users.
export async function claimVendor(vendorId: number): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getUserToken()}` },
    body: JSON.stringify({ vendor_id: vendorId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

// ── Vendor Portal (strict verification + product + evidence) ──
export const verifyVendor = (body: { vendor_id?: number; company_name?: string }) =>
  postJSON<{ verified: boolean; vendor_id: number; company_name: string; status: string }>(
    '/portal/verify',
    body,
  );

export interface PortalProductPayload {
  vendor_id?: number;
  company_name?: string;
  product_name: string;
  product_description?: string;
  logo_url?: string;
  product_images?: string[];
  product_videos?: string[];
  optional_metadata?: Record<string, any>;
  work_email?: string;
}
export const createPortalProduct = (body: PortalProductPayload) =>
  postJSON<{ id: number; vendor_id: number; name: string }>('/portal/products', body);

export const updatePortalProduct = (id: number, body: Partial<PortalProductPayload>) =>
  patchJSON<{ id: number; vendor_id: number; name: string }>(`/portal/products/${id}`, body);

export const listPortalEvidence = (productId: number) =>
  fetchJSON<any[]>(`/portal/products/${productId}/evidence`);

export interface PortalEvidencePayload {
  type: string;
  title: string;
  description?: string;
  file_url?: string;
  source_type?: string;
  issuer?: string;
  issued_date?: string;
  trust_tier?: string;
}
export const addPortalEvidence = (productId: number, body: PortalEvidencePayload) =>
  postJSON<{ evidence_id: string }>(`/portal/products/${productId}/evidence`, body);

// ── Defence Rating (hybrid: AI grades evidence → deterministic rubric) ──
export const computeDefenseRating = (productId: number) =>
  postJSON<DefenseRating & { product_id: number }>(
    `/portal/products/${productId}/defense-rating/compute`,
    {},
  );

export const getDefenseRating = (productId: number) =>
  fetchJSON<DefenseRating & { product_id: number }>(
    `/portal/products/${productId}/defense-rating`,
  );

export const previewDefenseRating = (body: {
  product: any; vendor: any; evidence: any[]; guard_mapping: any;
}) => postJSON<DefenseRatingResult>('/portal/defense-rating/preview', body);

// ── Admin review console (hidden /admin; bearer-token auth) ──
const ADMIN_TOKEN_KEY = 'attacked_admin_token';
export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || '';
export const setAdminToken = (t: string) => localStorage.setItem(ADMIN_TOKEN_KEY, t);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

export class AdminAuthError extends Error {}

async function adminFetch<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { clearAdminToken(); throw new AdminAuthError('Session expired — please sign in.'); }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface AdminStats {
  pending: number; needs_info: number; approved: number; rejected: number;
  total_submissions: number; total_vendors: number;
}
export type ReviewStatus = 'pending' | 'needs_info' | 'approved' | 'rejected';

export const adminLogin = (password: string) =>
  postJSON<{ token: string }>('/admin/login', { password });
export const adminCheckSession = () => adminFetch<{ ok: boolean }>('GET', '/admin/session');
export const adminStats = () => adminFetch<AdminStats>('GET', '/admin/stats');
export const adminListSubmissions = (status: ReviewStatus) =>
  adminFetch<any[]>('GET', `/admin/submissions?status=${status}`);
export const adminGetSubmission = (id: number) =>
  adminFetch<any>('GET', `/admin/submissions/${id}`);
export interface AdminEmail { to_email?: string; subject?: string; body?: string }
export const adminApprove = (id: number, b: AdminEmail & { note?: string } = {}) =>
  adminFetch<any>('POST', `/admin/submissions/${id}/approve`, b);
export const adminReject = (id: number, b: AdminEmail & { reason: string }) =>
  adminFetch<any>('POST', `/admin/submissions/${id}/reject`, b);
export const adminRequestInfo = (id: number, b: AdminEmail & { message: string }) =>
  adminFetch<any>('POST', `/admin/submissions/${id}/request-info`, b);
export const adminEmailPreview = (id: number, kind: string, note?: string) =>
  adminFetch<{ to_email: string; subject: string; body: string }>(
    'POST', `/admin/submissions/${id}/email-preview`, { kind, note });
export const adminVerifyEvidence = (evidenceId: string) =>
  adminFetch<any>('POST', `/admin/evidence/${evidenceId}/verify`, {});
export const adminActivity = () => adminFetch<any[]>('GET', '/admin/activity');

// ── AI GUARD Mapping ──────────────────────────────
export interface GuardMapResponse {
  confidence: { product_understanding: number; mapping_confidence: number; missing_info: number };
  done: boolean;
  question?: { text: string; why: string; options?: string[]; multi?: boolean } | null;
  mapping?: {
    shape?: string;
    categories: { code: string; label: string; primary?: boolean; strength: number }[];
    subcategories: { category: string; code: string; name: string; confidence: number }[];
    adaptive_controls: { verb: string; code: string; label: string; grounded_in?: string }[];
    explanation: string;
  } | null;
  engine: string;
}
export const guardMappingStep = (body: {
  product: any; vendor: any; answers: { question: string; answer: string }[];
}) => postJSON<GuardMapResponse>('/portal/guard-mapping/step', body);

export interface UploadResult {
  file_url: string;
  filename: string;
  size: number;
  content_type: string;
}
export async function uploadEvidenceFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/portal/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed (HTTP ${res.status})`);
  }
  return res.json();
}
