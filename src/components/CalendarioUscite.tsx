import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { UscitaDiscorso } from '../types';
import { numeroSchema } from '../data/titoliDiscorsiPubblici';
import { settimaneDelMese, uscitePerGiorno } from '../utils/discorsiEsterni';

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const GIORNI_ESTESI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const giornoSettimana = (data: string) => GIORNI_ESTESI[(new Date(data + 'T12:00:00').getDay() + 6) % 7];

// Riquadro di un'uscita: orario e schema in alto, poi congregazione e oratore.
const Uscita: React.FC<{ u: UscitaDiscorso }> = ({ u }) => {
  const numero = numeroSchema(u.titolo);
  return (
    <div className="rounded-md border-l-[3px] border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-1.5 text-xs leading-snug" title={`${u.orario || "Senza orario"}, ${u.congregazione}, ${u.oratore}
${numero ? "n. " + numero + " " : ""}${u.titolo}`}>
      <div className="flex justify-between gap-2 font-bold tabular-nums text-slate-900">
        <span className="whitespace-nowrap">{u.orario || <span className="font-normal italic text-slate-500">senza orario</span>}</span>
        {numero && <span className="whitespace-nowrap">n. {numero}</span>}
      </div>
      <div className="font-semibold text-slate-800 truncate">{u.congregazione}</div>
      <div className="text-slate-600 truncate">{u.oratore}</div>
    </div>
  );
};

export const CalendarioUscite: React.FC<{ uscite: UscitaDiscorso[]; oggi: string }> = ({ uscite, oggi }) => {
  const [anno, setAnno] = useState(() => Number(oggi.slice(0, 4)));
  const [mese, setMese] = useState(() => Number(oggi.slice(5, 7)) - 1);

  const sposta = (delta: number) => {
    const d = new Date(anno, mese + delta, 1);
    setAnno(d.getFullYear());
    setMese(d.getMonth());
  };
  const vaiAOggi = () => {
    setAnno(Number(oggi.slice(0, 4)));
    setMese(Number(oggi.slice(5, 7)) - 1);
  };

  const settimane = settimaneDelMese(anno, mese);
  const perGiorno = uscitePerGiorno(uscite);
  const prefisso = `${anno}-${String(mese + 1).padStart(2, '0')}-`;
  const giorniConUscite = Object.keys(perGiorno).filter(d => d.startsWith(prefisso)).sort();
  const totale = giorniConUscite.reduce((n, d) => n + perGiorno[d].length, 0);
  const titoloMese = `${MESI[mese]} ${anno}`;

  return (
    <div className="card">
      <div className="section-heading-row flex-wrap">
        <div>
          <h2 className="section-title">Calendario uscite</h2>
          <p className="section-description" aria-live="polite">
            {titoloMese}: {totale ? `${totale} ${totale === 1 ? 'uscita' : 'uscite'}` : 'nessuna uscita'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="icon-btn" onClick={() => sposta(-1)} title="Mese precedente">
            <ChevronLeft className="w-4 h-4" /><span className="sr-only">Mese precedente</span>
          </button>
          <span className="min-w-[150px] text-center font-serif text-lg font-semibold text-slate-900">{titoloMese}</span>
          <button type="button" className="icon-btn" onClick={() => sposta(1)} title="Mese successivo">
            <ChevronRight className="w-4 h-4" /><span className="sr-only">Mese successivo</span>
          </button>
          <button type="button" className="btn-ghost" onClick={vaiAOggi}>Oggi</button>
        </div>
      </div>

      {/* Schermi larghi: griglia del mese. */}
      <table className="hidden md:table w-full table-fixed border-collapse">
        <caption className="sr-only">Uscite di {titoloMese}</caption>
        <thead>
          <tr>
            {GIORNI.map((g, i) => (
              <th key={g} scope="col" className={`pb-2 text-left text-xs font-semibold ${i === 6 ? 'text-slate-900' : 'text-slate-500'}`}>{g}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {settimane.map(settimana => (
            <tr key={settimana[0].data}>
              {settimana.map(g => {
                const lista = perGiorno[g.data] || [];
                const eOggi = g.data === oggi;
                return (
                  <td key={g.data} className={`h-28 align-top border border-slate-200 p-1.5 ${g.nelMese ? 'bg-white' : 'bg-slate-50'}`}>
                    <div className={`mb-1 text-xs tabular-nums ${eOggi ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 font-bold text-white' : g.nelMese ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                      {g.giorno}
                      {eOggi && <span className="sr-only"> (oggi)</span>}
                    </div>
                    <div className="space-y-1">
                      {lista.map(u => <Uscita key={u.id} u={u} />)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Telefono: elenco dei giorni del mese con uscite. */}
      <div className="md:hidden">
        {giorniConUscite.length === 0 ? (
          <p className="text-sm text-slate-600 py-4">Nessuna uscita in {titoloMese.toLowerCase()}.</p>
        ) : (
          <ol className="space-y-3">
            {giorniConUscite.map(d => (
              <li key={d}>
                <p className={`text-sm font-semibold ${d === oggi ? 'text-[var(--accent-strong)]' : 'text-slate-800'}`}>
                  {giornoSettimana(d)} {Number(d.slice(8))}{d === oggi ? ', oggi' : ''}
                </p>
                <div className="mt-1 space-y-1.5">{perGiorno[d].map(u => <Uscita key={u.id} u={u} />)}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
