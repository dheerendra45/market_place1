import { Award } from 'lucide-react';

// Industry-recognition medallions (illustrative placeholders, G2/Gartner-style).
const RECOGNITIONS: { award: string; category: string; period: string }[] = [
  { award: 'Leader', category: 'Cyber Security', period: 'Q2 2026' },
  { award: 'High Performer', category: 'Data & Privacy', period: 'Q2 2026' },
  { award: "Customers' Choice", category: 'Third-Party Risk', period: '2026' },
  { award: 'Top Rated', category: 'Defence Layer', period: '2026' },
];

// A single laurel branch (mirror with scale-x-[-1] for the right side).
function Laurel({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 56" width="16" height="40" className={className} aria-hidden="true">
      <path d="M20 4C9 12 9 44 20 52" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <g fill="currentColor">
        <ellipse cx="14" cy="13" rx="4" ry="2" transform="rotate(-42 14 13)" />
        <ellipse cx="11" cy="21" rx="4.2" ry="2.1" transform="rotate(-28 11 21)" />
        <ellipse cx="9.6" cy="29" rx="4.4" ry="2.2" transform="rotate(-12 9.6 29)" />
        <ellipse cx="9.6" cy="37" rx="4.4" ry="2.2" transform="rotate(12 9.6 37)" />
        <ellipse cx="11" cy="45" rx="4.2" ry="2.1" transform="rotate(28 11 45)" />
      </g>
    </svg>
  );
}

function AwardMedallion({
  award,
  category,
  period,
}: {
  award: string;
  category: string;
  period: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center text-accent-yellow">
        <Laurel />
        <div className="px-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">{period}</div>
          <div className="text-[15px] font-extrabold uppercase leading-none text-[#8A6D00]">{award}</div>
          <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Defence Layer
          </div>
        </div>
        <Laurel className="scale-x-[-1]" />
      </div>
      <div className="mt-2 text-xs font-medium text-text-secondary">{category}</div>
    </div>
  );
}

export default function IndustryRecognition({
  title = 'Industry Recognition',
  className = '',
}: {
  title?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-bg-border bg-bg-surface p-6 sm:p-8 ${className}`}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Award className="h-5 w-5 text-accent-yellow" />
          <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
        </div>
        <span className="rounded-md border border-bg-border bg-bg-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Illustrative
        </span>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {RECOGNITIONS.map((r) => (
          <AwardMedallion key={`${r.award}-${r.category}`} {...r} />
        ))}
      </div>
      <p className="mt-6 border-t border-bg-border pt-4 text-xs text-text-muted">
        Recognition badges reflect evidence-tiered performance within the Defence Layer. Placeholders
        shown here are illustrative.
      </p>
    </div>
  );
}
