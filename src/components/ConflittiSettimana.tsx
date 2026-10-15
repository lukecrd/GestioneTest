import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { dateKey, weekKey } from '../utils/automaticScheduling';
import { PROGRAMMI } from '../utils/utenti';

export interface ConflittoRuoli {
  week: string; // lunedì YYYY-MM-DD
  name: string;
  roles: { program: string; role: string }[];
}

const settimana = (lunedi: string) =>
  new Date(lunedi + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

// Avviso nella sezione aperta: dalla settimana corrente in poi, solo i conflitti che toccano questo programma.
export const ConflittiSettimana: React.FC<{ conflitti: ConflittoRuoli[]; sezione: string; visibile: (sezione: string) => boolean }> = ({ conflitti, sezione, visibile }) => {
  const oggi = weekKey(dateKey(new Date()));
  // I ruoli nei programmi nascosti all'utente non si mostrano; il conflitto resta se ne vede almeno due.
  const visibili = conflitti
    .map(c => ({ ...c, roles: c.roles.filter(r => visibile(r.program)) }))
    .filter(c => c.week >= oggi && c.roles.length > 1 && c.roles.some(r => r.program === sezione));
  if (!visibili.length) return null;
  return (
    <details className="status-banner no-print mb-4 !block" role="alert" open={visibili.length <= 3}>
      <summary className="cursor-pointer font-semibold text-amber-800 inline-flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {visibili.length === 1 ? 'Una persona ha' : `${visibili.length} casi di persone con`} più ruoli nella stessa settimana
      </summary>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {visibili.map(c => (
          <li key={c.week + c.name}>
            <strong>{c.name}</strong>, settimana del {settimana(c.week)}:{' '}
            {c.roles.map(r => `${r.role} (${PROGRAMMI[r.program as keyof typeof PROGRAMMI] || r.program})`).join(', ')}
          </li>
        ))}
      </ul>
    </details>
  );
};
