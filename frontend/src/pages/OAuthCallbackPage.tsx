import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Friendly text for the error codes the backend may return in the URL fragment.
const ERROR_TEXT: Record<string, string> = {
  invalid_state: 'Your sign-in link expired. Please try again.',
  token_exchange_failed: 'We couldn’t complete sign-in with that provider.',
  provider_error: 'The sign-in provider returned an error.',
  provider_not_enabled: 'That sign-in method isn’t enabled.',
  no_email: 'We couldn’t read a verified email from that account.',
  access_denied: 'Sign-in was cancelled.',
};

export default function OAuthCallbackPage() {
  const { hydrateToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard React 18 StrictMode double-invoke
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Clear the token from the URL immediately.
    window.history.replaceState(null, '', window.location.pathname);

    const token = params.get('token');
    const err = params.get('error');

    if (token) {
      hydrateToken(token)
        .then(() => navigate('/account', { replace: true }))
        .catch(() => setError('We couldn’t finish signing you in. Please try again.'));
    } else {
      setError(ERROR_TEXT[err || ''] || 'Sign-in failed. Please try again.');
    }
  }, [hydrateToken, navigate]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <ShieldAlert className="h-8 w-8 text-status-red" />
          <p className="max-w-sm text-sm text-text-secondary">{error}</p>
          <button onClick={() => navigate('/login', { replace: true })} className="btn btn-primary btn-sm">
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-accent-yellow" />
          <p className="text-sm text-text-muted">Completing sign-in…</p>
        </>
      )}
    </div>
  );
}
