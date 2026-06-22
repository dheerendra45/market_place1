// Attacked.ai recognition badges — earned (not bought). Vendors can license the
// right to embed/display a badge they've earned (see the licensing flow).

// ── Shared premium medal frame ────────────────────────────────────────
// Notched gold seal + ribbon streamers + black face; centre glyph varies.
function Medal({ children }: { children: React.ReactNode }) {
  const C = 60;
  const CY = 54;
  return (
    <svg viewBox="0 0 120 138" className="h-24 w-auto" aria-hidden="true">
      {/* ribbon streamers */}
      <path d="M44 92 L33 134 L46 125 L54 136 L60 100 Z" fill="#B07E00" />
      <path d="M76 92 L87 134 L74 125 L66 136 L60 100 Z" fill="#D99B00" />
      {/* scalloped seal edge */}
      {Array.from({ length: 30 }).map((_, i) => {
        const a = (i / 30) * 2 * Math.PI;
        return <circle key={i} cx={C + 50 * Math.cos(a)} cy={CY + 50 * Math.sin(a)} r="2.6" fill="#F5B800" />;
      })}
      {/* gold ring + black face + inner hairline */}
      <circle cx={C} cy={CY} r="49" fill="#F5B800" />
      <circle cx={C} cy={CY} r="42" fill="#0A0A0A" />
      <circle cx={C} cy={CY} r="42" fill="none" stroke="#F5B800" strokeWidth="1.2" strokeOpacity="0.35" />
      <circle cx={C} cy={CY} r="37" fill="none" stroke="#F5B800" strokeWidth="0.8" strokeOpacity="0.18" />
      {children}
    </svg>
  );
}

export function BadgeDefenceRating() {
  return (
    <Medal>
      <path
        d="M60 33 L63.8 42.7 L74.3 43.4 L66.2 50 L68.8 60.1 L60 54.5 L51.2 60.1 L53.8 50 L45.7 43.4 L56.2 42.7 Z"
        fill="#F5B800"
      />
      <text x="60" y="74" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="8" letterSpacing="1.6" fontWeight="700" fill="#fff">RATING</text>
    </Medal>
  );
}

export function BadgeGuardMapped() {
  return (
    <Medal>
      <text x="60" y="50" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="13.5" fontWeight="800" fill="#F5B800">GUARD</text>
      <path d="M50 60l7 7 14-15" fill="none" stroke="#F5B800" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </Medal>
  );
}

export function BadgeVerified() {
  return (
    <Medal>
      <path d="M44 54l11 12 22-25" fill="none" stroke="#F5B800" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
    </Medal>
  );
}

export function BadgeEvidence() {
  return (
    <Medal>
      <text x="60" y="52" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="16" fontWeight="800" fill="#F5B800">E1–E5</text>
      <text x="60" y="70" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="7.5" letterSpacing="1.6" fontWeight="700" fill="#fff">EVIDENCE</text>
    </Medal>
  );
}

export function BadgeIncidentReady() {
  return (
    <Medal>
      <path d="M65 32 L46 57 L57 57 L54 76 L74 49 L62 49 Z" fill="#F5B800" />
    </Medal>
  );
}

export const RECOGNITION_BADGES: {
  Badge: () => React.ReactElement;
  name: string;
  desc: string;
  signal: string;
  earn: string;
}[] = [
  {
    Badge: BadgeDefenceRating,
    name: 'Defence Rating',
    desc: 'A score from 0 to 100 that shows how strong a product’s defence is, based on its verified evidence. Shown as Eligible, Proven, or Authoritative.',
    signal: 'Lets buyers compare products fairly, on real strength.',
    earn: 'Reach a verified rating of 60 or more',
  },
  {
    Badge: BadgeGuardMapped,
    name: 'GUARD-Mapped',
    desc: 'The product is mapped to the 13 GUARD risk categories and the exact controls it covers.',
    signal: 'Shows buyers precisely which risks the product defends.',
    earn: 'Complete your GUARD mapping',
  },
  {
    Badge: BadgeVerified,
    name: 'Verified',
    desc: 'The product’s evidence has been checked and confirmed by our review team.',
    signal: 'Tells buyers the claims are real, not just marketing.',
    earn: 'Pass evidence verification',
  },
  {
    Badge: BadgeEvidence,
    name: 'Evidence-Backed',
    desc: 'The product’s claims are supported by evidence, from independent audits down to vendor statements.',
    signal: 'Shows buyers how solid the proof behind the product is.',
    earn: 'Add strong (E1 or E2) evidence',
  },
  {
    Badge: BadgeIncidentReady,
    name: 'Incident-Ready',
    desc: 'The product is linked to live controls, so it appears the moment a related incident happens.',
    signal: 'Puts the product in front of buyers right when they need it.',
    earn: 'Map to active controls',
  },
];
