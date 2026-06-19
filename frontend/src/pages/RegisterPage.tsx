import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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
      // Role (buyer vs vendor) is classified internally by the backend.
      await register({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
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
            <p className="mt-1.5 text-xs text-text-muted">
              Use your work email — we tailor your experience automatically.
            </p>
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
