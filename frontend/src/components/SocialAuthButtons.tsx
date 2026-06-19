import { useEffect, useState } from 'react';
import * as api from '../api/client';
import type { AuthProviders } from '../api/client';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
  </svg>
);

const MicrosoftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 23 23" width="16" height="16" aria-hidden="true">
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M12 1h10v10H12z" />
    <path fill="#00A4EF" d="M1 12h10v10H1z" />
    <path fill="#FFB900" d="M12 12h10v10H12z" />
  </svg>
);

/**
 * Renders "Continue with Google / Microsoft" buttons + an "or" divider.
 * The buttons are always visible. When the backend reports a provider as
 * configured they become live links; until then they are inert (no broken
 * navigation) — so the logos show now and light up automatically once the
 * OAuth env vars are set.
 */
export default function SocialAuthButtons() {
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  useEffect(() => {
    api.getAuthProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  const cls =
    'flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-bg-border bg-bg-surface text-sm font-semibold text-text-primary transition-colors hover:border-accent-yellow/50 hover:bg-bg-elevated';

  const Btn = ({
    provider,
    label,
    icon,
  }: {
    provider: 'google' | 'microsoft';
    label: string;
    icon: React.ReactNode;
  }) => {
    const enabled = !!providers?.[provider];
    if (enabled) {
      return (
        <a href={api.oauthStartUrl(provider)} className={cls}>
          {icon}
          {label}
        </a>
      );
    }
    // Inert until configured — keeps the logo visible without a broken click.
    return (
      <button type="button" title="Coming soon" className={cls}>
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        <Btn provider="google" label="Continue with Google" icon={<GoogleIcon />} />
        <Btn provider="microsoft" label="Continue with Microsoft" icon={<MicrosoftIcon />} />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-bg-border" />
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">or</span>
        <span className="h-px flex-1 bg-bg-border" />
      </div>
    </div>
  );
}
