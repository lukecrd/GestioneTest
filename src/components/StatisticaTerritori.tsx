import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { AssegnazioneTerritorio, EtichettaTerritorio, IndirizzoTerritorio } from '../types';
import { statisticaTerritori, copertura, filtraPerEtichette, STATI_PERMANENTI, formatDay } from '../utils/territori';

interface StatisticaTerritoriProps {
  territori: { numero: string }[];
  assegnazioni: AssegnazioneTerritorio[];
  indirizzi: IndirizzoTerritorio[];
  etichette: EtichettaTerritorio[];
  etichettePer: Map<string, EtichettaTerritorio[]>;
  numeroProclamatori: number;
  nome: (numero: string) => React.ReactNode;
}

const PERIODI = [3, 6, 12, 24];
const COLORE = '#16799e';
const INK = { grid: '#dde1dd', axis: '#c3c9c4', muted: '#646e6a' };
type Colonna = 'numero' | 'situazione' | 'assegnato' | 'rientro' | 'lavorazioni' | 'media';

const dataBreve = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT');
const percento = (n: number, su: number) => (su ? `${Math.round((n / su) * 100)}%` : '—');

const Grafico: React.FC<{ titolo: string; dati: { etichetta: string; valore: number }[] }> = ({ titolo, dati }) => (
  <figure className="min-w-0" aria-label={`${titolo}: ${dati.map(d => `${d.etichetta} ${d.valore}`).join(', ')}`}>
    <figcaption className="font-semibold text-slate-900 mb-1">{titolo}</figcaption>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={dati} margin={{ top: 16, right: 8, bottom: 4, left: -16 }}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="etichetta" tick={{ fontSize: 12, fill: INK.muted }} axisLine={{ stroke: INK.axis }} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: INK.muted }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: '#0000000a' }} formatter={(v: number) => [v, 'Territori']} />
        <Bar dataKey="valore" fill={COLORE} radius={[3, 3, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#1e293b' }} />
      </BarChart>
    </ResponsiveContainer>
  </figure>
);

// Pannello Statistica: riepilogo sul periodo, tre grafici e la tabella ordinabile per territorio.
export const StatisticaTerritori: React.FC<StatisticaTerritoriProps> = ({ territori, assegnazioni, indirizzi, etichette, etichettePer, numeroProclamatori, nome }) => {
  const oggi = formatDay(new Date());
  const [periodo, setPeriodo] = useState(6);
  const [etichetta, setEtichetta] = useState('');
  const [ordine, setOrdine] = useState<{ col: Colonna; su: boolean }>({ col: 'numero', su: true });

  const scelti = useMemo(
    () => territori.filter(t => filtraPerEtichette((etichettePer.get(t.numero) ?? []).map(e => e.id), etichetta ? [etichetta] : [])),
    [territori, etichettePer, etichetta],
  );
  const s = useMemo(() => statisticaTerritori(scelti, assegnazioni, oggi, periodo), [scelti, assegnazioni, oggi, periodo]);
  const cop = useMemo(() => copertura(scelti, assegnazioni, oggi), [scelti, assegnazioni, oggi]);
  const numeri = new Set(scelti.map(t => t.numero));
  const ind = indirizzi.filter(n => numeri.has(n.numero));

  const righe = useMemo(() => {
    const chiave = (r: (typeof s.righe)[number]): string | number => {
      switch (ordine.col) {
        case 'situazione': return r.aperta ? 1 : 0;
        case 'assegnato': return r.aperta?.proclamatore.toLowerCase() ?? '￿';
        case 'rientro': return r.ultimoRientro ?? '';
        case 'lavorazioni': return r.lavorazioni;
        case 'media': return r.mediaSettimane ?? -1;
        default: return 0; // ordine dell'archivio
      }
    };
    const ordinate = ordine.col === 'numero' ? [...s.righe] : [...s.righe].sort((a, b) => (chiave(a) < chiave(b) ? -1 : chiave(a) > chiave(b) ? 1 : 0));
    return ordine.su ? ordinate : ordinate.reverse();
  }, [s.righe, ordine]);

  const intestazione = (col: Colonna, testo: string, destra = false) => {
    const attiva = ordine.col === col;
    return (
      <th key={col} aria-sort={attiva ? (ordine.su ? 'ascending' : 'descending') : 'none'} className={destra ? 'text-right' : ''}>
        <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => setOrdine(o => ({ col, su: o.col === col ? !o.su : true }))}>
          {testo}
          {attiva && (ordine.su ? <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  const riepilogo: [string, React.ReactNode][][] = [
    [
      ['Numero totale di territori', s.totale],
      ['Assegnati', s.assegnati],
      ['Non assegnati', s.totale - s.assegnati],
      ['Indirizzi', ind.length],
      ['Non visitare', ind.filter(n => STATI_PERMANENTI.includes(n.stato)).length],
    ],
    [
      [`Completati negli ultimi ${periodo} mesi`, `${s.completati} (${percento(s.completati, s.totale)})`],
      ['In lavorazione', s.assegnati],
      [`Non lavorati negli ultimi ${periodo} mesi`, s.nonLavorati],
    ],
    [
      ['Durata media dell\'assegnazione (settimane)', s.mediaSettimane ?? '—'],
      ['Copertura, ultimi 12 mesi', cop.percentuale === null ? '—' : `${cop.percentuale}%`],
      ['Partecipazione', numeroProclamatori ? `${percento(s.partecipanti, numeroProclamatori)} (${s.partecipanti} su ${numeroProclamatori})` : s.partecipanti],
    ],
  ];

  return (
    <div className="card space-y-5">
      <div className="section-heading-row flex-wrap">
        <div>
          <h2 className="section-title">Statistica</h2>
          <p className="section-description">Completati, in lavorazione e non lavorati nel periodo scelto. Un rientro "non percorso" non conta come lavorazione.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {etichette.length > 0 && (
            <div>
              <label className="lbl" htmlFor="stat-etichetta">Etichetta</label>
              <select id="stat-etichetta" className="inp mt-1 w-auto" value={etichetta} onChange={e => setEtichetta(e.target.value)}>
                <option value="">Tutti i territori</option>
                {etichette.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="lbl" htmlFor="stat-periodo">Periodo</label>
            <select id="stat-periodo" className="inp mt-1 w-auto" value={periodo} onChange={e => setPeriodo(Number(e.target.value))}>
              {PERIODI.map(m => <option key={m} value={m}>Ultimi {m} mesi</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-1 md:grid-cols-3">
        {riepilogo.map((colonna, i) => (
          <dl key={i} className="divide-y divide-slate-100">
            {colonna.map(([etichetta, valore]) => (
              <div key={etichetta} className="flex justify-between gap-4 py-1.5 text-sm">
                <dt className="text-slate-700">{etichetta}</dt>
                <dd className="font-semibold tabular-nums text-slate-900">{valore}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Grafico titolo="Territori completati" dati={s.grafici.completati} />
        <Grafico titolo="Territori in lavorazione" dati={s.grafici.inLavorazione} />
        <Grafico titolo="Territori non lavorati" dati={s.grafici.nonLavorati} />
      </div>

      <div className="table-wrapper overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="tbl">
          <thead className="sticky top-0 bg-white">
            <tr>
              {intestazione('numero', 'Territorio')}
              {intestazione('situazione', 'Situazione')}
              {intestazione('assegnato', 'Assegnato a')}
              {intestazione('rientro', 'Restituito il')}
              {intestazione('lavorazioni', 'Lavorazioni', true)}
              {intestazione('media', 'Durata media (sett.)', true)}
            </tr>
          </thead>
          <tbody>
            {righe.map(r => (
              <tr key={r.numero}>
                <td className="whitespace-nowrap"><a className="hover:underline underline-offset-2" href={'#territorio-' + r.numero}>{nome(r.numero)}</a></td>
                <td>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${r.aperta ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                    {r.aperta ? 'Assegnato' : 'Non assegnato'}
                  </span>
                </td>
                <td>{r.aperta ? <>{r.aperta.proclamatore || '---'} <span className="text-slate-500 tabular-nums">({dataBreve(r.aperta.assegnato)})</span></> : ''}</td>
                <td className="tabular-nums">{r.ultimoRientro ? dataBreve(r.ultimoRientro) : <span className="text-slate-500">Mai</span>}</td>
                <td className="text-right tabular-nums">{r.lavorazioni}</td>
                <td className="text-right tabular-nums">{r.mediaSettimane ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
