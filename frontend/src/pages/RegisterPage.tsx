import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, Building2, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../api/client';

const ROLES: { id: UserRole; label: string; blurb: string; icon: typeof Search }[] = [
  {
    id: 'buyer',
    label: 'Buyer',
    blurb: 'Discover and compare verified security products.',
    icon: Search,
  },
  {
    id: 'vendor',
    label: 'Vendor',
    blurb: 'List your product and surface to enterprises.',
    icon: Building2,
  },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        role,
        company_name: role === 'vendor' ? company.trim() || undefined : undefined,
      });
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/attacked-mark.svg" alt="Attacked.ai" className="h-10 w-10" />
          </Link>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-text-primary">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Join the Defence Layer — free during the founding phase.
          </p>
        </div>

        <form onSubmit={onSubmit} className="surface-card space-y-5 p-7">
          {error && (
            <div className="rounded-lg border border-status-red/30 bg-status-red/10 px-3.5 py-2.5 text-sm text-status-red">
              {error}
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-text-secondary">
              I'm a…
            </label>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(({ id, label, blurb, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                    role === id
                      ? 'border-accent-yellow bg-accent-soft shadow-[0_2px_10px_rgba(245,184,0,0.18)]'
                      : 'border-bg-border bg-bg-surface hover:border-accent-yellow/50'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${role === id ? 'text-accent-yellow' : 'text-text-muted'}`} />
                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                  <span className="text-xs leading-snug text-text-muted">{blurb}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Full name
            </label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block h-11 w-full rounded-lg border border-bg-border bg-bg-elevated px-3.5 text-[15px] text-text-primary transition-colors placeholder:text-text-muted focus:border-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/20"
              placeholder="Jane Smith"
            />
          </div>

          {role === 'vendor' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Company name
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="block h-11 w-full rounded-lg border border-bg-border bg-bg-elevated px-3.5 text-[15px] text-text-primary transition-colors placeholder:text-text-muted focus:border-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/20"
                placeholder="Acme Security"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Work email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block h-11 w-full rounded-lg border border-bg-border bg-bg-elevated px-3.5 text-[15px] text-text-primary transition-colors placeholder:text-text-muted focus:border-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/20"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block h-11 w-full rounded-lg border border-bg-border bg-bg-elevated px-3.5 text-[15px] text-text-primary transition-colors placeholder:text-text-muted focus:border-accent-yellow focus:outline-none focus:ring-2 focus:ring-accent-yellow/20"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full justify-center disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" /> Create account
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent-yellow hover:text-accent-yellow-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
