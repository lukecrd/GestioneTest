import React, { useMemo, useState } from 'react';
import { FileText, Trash2, Undo2, Map as MapIcon, AlertTriangle, UserPlus, Printer } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { StateData, AssegnazioneTerritorio, TerritoriData } from '../types';
import {
  MESI_SCADENZA,
  formatDay,
  giorniTra,
  statoScadenza,
  alertTerritori,
  statisticheLavorazione,
  assegnazioneAperta,
  ultimoRientro,
  normalizeTerritori,
  cartineDaFile,
  raggruppaSezioni,
  dettaglioInSezione,
} from '../utils/territori';
import { ModuloS13 } from './ModuloS13';

interface TerritoriViewProps {
  state: StateData;
  onSaveState: (state: StateData) => void;
  isAdmin: boolean;
  onShowToast: (msg: string) => void;
  checkAdminPermission: () => boolean;
}

// Le cartine sono i PDF in src/territori/, inclusi nel build: aggiungerne una richiede un nuovo deploy.
const CARTINE = cartineDaFile(
  import.meta.glob('../territori/*.pdf', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
);

const SEZIONI = raggruppaSezioni(CARTINE);
const PER_NUMERO = new Map(CARTINE.map(c => [c.numero, c]));

// Un colore per sezione, nell'ordine dei numeri: aiuta a riconoscerla, ma il nome resta sempre scritto.
const COLORI_SEZIONE = ['#2f6f8f', '#b5651d', '#6a8d2a', '#7a4fa0', '#b23a48', '#2a8a7a', '#b8860b', '#4b5fae', '#8d5a3b', '#a8467e', '#5a6b7a', '#d0561f', '#3f8a4f'];
const coloreSezione = (nome: string) => {
  const sezione = SEZIONI.find(s => s.nome === nome);
  return sezione ? COLORI_SEZIONE[sezione.indice % COLORI_SEZIONE.length] : '#8f9893';
};
const idSezione = (nome: string) => 'sezione-' + nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Grafici: una sola serie, colore validato (chroma e contrasto) contro la superficie chiara.
const COLORE_BARRE = '#16799e';
const GIORNI_SCADENZA = Math.round(MESI_SCADENZA * 30.44);
const INK = { muted: '#646e6a', secondary: '#4a5451', grid: '#dde1dd', axis: '#c3c9c4' };

const nomeCompleto = (numero: string) => {
  const c = PER_NUMERO.get(numero);
  return c ? `${numero} ${c.nome}` : numero;
};

const Pallino: React.FC<{ colore: string }> = ({ colore }) => (
  <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colore }} />
);

// "35A Roccastrada" col pallino della sezione; se la cartina non c'è più resta solo il codice.
const NomeTerritorio: React.FC<{ numero: string }> = ({ numero }) => {
  const c = PER_NUMERO.get(numero);
  return (
    <span className="inline-flex items-center gap-2">
      <Pallino colore={c ? coloreSezione(c.sezione) : '#8f9893'} />
      <span><span className="font-bold tabular-nums">{numero}</span>{c ? ' ' + c.nome : ''}</span>
    </span>
  );
};

const dataIt = (day: string) =>
  new Date(day + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

const giorniTesto = (n: number) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;

const testoScadenza = (s: ReturnType<typeof statoScadenza>) =>
  s.livello === 'scaduto'
    ? `Scaduto da ${giorniTesto(-s.giorniRimasti)} (scadenza ${dataIt(s.scadenza)})`
    : s.giorniRimasti === 0
      ? `Scade oggi, ${dataIt(s.scadenza)}`
      : `Scade il ${dataIt(s.scadenza)}, tra ${giorniTesto(s.giorniRimasti)}`;

const BAR_COLOR = { regolare: 'bg-emerald-500', vicino: 'bg-amber-500', scaduto: 'bg-rose-600' } as const;
const TEXT_COLOR = { regolare: 'text-slate-600', vicino: 'text-amber-700', scaduto: 'text-rose-700 font-semibold' } as const;

const BarraScadenza: React.FC<{ assegnato: string; numero: string }> = ({ assegnato, numero }) => {
  const s = statoScadenza(assegnato);
  const percent = Math.round(s.frazione * 100);
  return (
    <div className="min-w-[180px]">
      <div
        className="h-2 w-full rounded-full bg-slate-200 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Territorio ${numero}: tempo trascorso verso la scadenza`}
      >
        <div className={`h-full rounded-full ${BAR_COLOR[s.livello]}`} style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <p className={`mt-1 text-xs ${TEXT_COLOR[s.livello]}`}>
        {s.livello === 'scaduto' && <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" aria-hidden="true" />}
        {testoScadenza(s)}
      </p>
    </div>
  );
};

type RigaGrafico = { numero: string; etichetta: string; giorni: number; nota: string };

const TooltipGiorni: React.FC<{ active?: boolean; payload?: { payload: RigaGrafico }[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{nomeCompleto(r.numero)}</p>
      <p className="text-slate-700 tabular-nums">{giorniTesto(r.giorni)}</p>
      <p className="text-slate-500">{r.nota}</p>
    </div>
  );
};

// Barre orizzontali in giorni, con la linea della scadenza a 4 mesi.
const GraficoGiorni: React.FC<{ dati: RigaGrafico[]; titolo: string }> = ({ dati, titolo }) => {
  const massimo = Math.max(GIORNI_SCADENZA + 15, ...dati.map(d => d.giorni));
  return (
    <figure aria-label={titolo}>
      <ResponsiveContainer width="100%" height={Math.max(140, dati.length * 26 + 48)}>
        <BarChart data={dati} layout="vertical" margin={{ top: 20, right: 24, bottom: 4, left: 4 }} barCategoryGap={4}>
          <CartesianGrid horizontal={false} stroke={INK.grid} />
          <XAxis
            type="number"
            domain={[0, Math.ceil(massimo / 40) * 40]}
            ticks={Array.from({ length: Math.ceil(massimo / 40) + 1 }, (_, i) => i * 40)}
            tick={{ fill: INK.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v} gg`}
          />
          <YAxis
            type="category"
            dataKey="etichetta"
            width={170}
            tick={{ fill: INK.secondary, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: INK.axis }}
            interval={0}
          />
          <Tooltip content={<TooltipGiorni />} cursor={{ fill: 'rgba(26, 36, 33, .05)' }} />
          <ReferenceLine
            x={GIORNI_SCADENZA}
            stroke={INK.secondary}
            strokeWidth={1}
            label={{ value: `${MESI_SCADENZA} mesi`, position: 'top', fill: INK.secondary, fontSize: 12 }}
          />
          <Bar dataKey="giorni" fill={COLORE_BARRE} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
};

export const TerritoriView: React.FC<TerritoriViewProps> = ({ state, onSaveState, isAdmin, onShowToast, checkAdminPermission }) => {
  const data = useMemo(() => normalizeTerritori(state.territori), [state.territori]);
  const { assegnazioni } = data;
  const territori = CARTINE;
  const oggi = formatDay(new Date());

  // Assegnazione in linea: si apre sotto la riga del territorio scelto.
  const [assegnando, setAssegnando] = useState<string | null>(null);
  const [assegnaNome, setAssegnaNome] = useState('');
  const [assegnaData, setAssegnaData] = useState(oggi);
  const [sezioneGrafici, setSezioneGrafici] = useState('');
  const [mostraS13, setMostraS13] = useState(false);

  const save = (next: TerritoriData) => onSaveState({ ...state, territori: next });

  const aperte = assegnazioni.filter(a => !a.rientro);
  const disponibili = territori.length - territori.filter(t => assegnazioneAperta(assegnazioni, t.numero)).length;
  const alert = useMemo(() => alertTerritori(assegnazioni, oggi), [assegnazioni, oggi]);
  const scaduti = alert.filter(a => a.livello === 'scaduto').length;
  const lavorazione = useMemo(() => statisticheLavorazione(assegnazioni), [assegnazioni]);
  const proclamatori = useMemo(
    () => Array.from(new Set<string>(state.people.map(p => p.name))).sort((a, b) => a.localeCompare(b, 'it')),
    [state.people],
  );
  const storico = [...assegnazioni].sort((a, b) => {
    if (!a.rientro !== !b.rientro) return a.rientro ? 1 : -1; // prima quelle in corso
    return a.rientro ? b.rientro!.localeCompare(a.rientro) : a.assegnato.localeCompare(b.assegnato);
  });

  const nellaSezione = (numero: string) => !sezioneGrafici || PER_NUMERO.get(numero)?.sezione === sezioneGrafici;
  const datiMedie: RigaGrafico[] = [...lavorazione.perTerritorio.values()]
    .filter(s => nellaSezione(s.numero))
    .sort((a, b) => b.mediaGiorni - a.mediaGiorni)
    .map(s => ({
      numero: s.numero,
      etichetta: nomeCompleto(s.numero),
      giorni: s.mediaGiorni,
      nota: `Media su ${s.lavorazioni} ${s.lavorazioni === 1 ? 'lavorazione' : 'lavorazioni'}, ${s.inTempo} entro ${MESI_SCADENZA} mesi`,
    }));
  const datiInCorso: RigaGrafico[] = aperte
    .filter(a => nellaSezione(a.numero))
    .map(a => ({ numero: a.numero, etichetta: nomeCompleto(a.numero), giorni: giorniTra(a.assegnato, oggi), nota: `${a.proclamatore}, dal ${dataIt(a.assegnato)}` }))
    .sort((a, b) => b.giorni - a.giorni);

  const apriAssegnazione = (numero: string) => {
    if (!checkAdminPermission()) return;
    setAssegnando(numero);
    setAssegnaNome('');
    setAssegnaData(oggi);
  };

  const assegna = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assegnando || !checkAdminPermission()) return;
    const numero = assegnando;
    const proclamatore = assegnaNome.trim();
    if (!proclamatore || !assegnaData) return onShowToast('Indica proclamatore e data di assegnazione.');
    if (assegnazioneAperta(assegnazioni, numero)) return onShowToast(`Il territorio ${numero} è già assegnato.`);
    const nuova: AssegnazioneTerritorio = { id: crypto.randomUUID(), numero, proclamatore, assegnato: assegnaData };
    save({ ...data, assegnazioni: [...assegnazioni, nuova] });
    setAssegnando(null);
    onShowToast(`Territorio ${numero} assegnato a ${proclamatore}.`);
  };

  const aggiornaAssegnazione = (id: string, patch: Partial<AssegnazioneTerritorio>) => {
    if (!checkAdminPermission()) return;
    save({ ...data, assegnazioni: assegnazioni.map(a => (a.id === id ? { ...a, ...patch } : a)) });
  };

  const segnaRientro = (a: AssegnazioneTerritorio) => {
    aggiornaAssegnazione(a.id, { rientro: oggi });
    onShowToast(`Rientro del territorio ${a.numero} registrato.`);
  };

  const eliminaAssegnazione = (a: AssegnazioneTerritorio) => {
    if (!checkAdminPermission()) return;
    if (!window.confirm(`Eliminare l'assegnazione del territorio ${a.numero} a ${a.proclamatore}?`)) return;
    save({ ...data, assegnazioni: assegnazioni.filter(x => x.id !== a.id) });
  };

  const colonne = isAdmin ? 4 : 3;

  if (mostraS13) return <ModuloS13 territori={territori} assegnazioni={assegnazioni} onChiudi={() => setMostraS13(false)} />;

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Territori</h1>
          <p className="page-description">
            Archivio delle cartine e assegnazioni ai proclamatori. Ogni territorio va riconsegnato entro {MESI_SCADENZA} mesi.
          </p>
        </div>
        <button type="button" className="btn-ghost no-print shrink-0" onClick={() => setMostraS13(true)}>
          <Printer className="w-4 h-4" /> Modulo S-13
        </button>
      </div>

      {alert.length > 0 && (
        <div className={`status-banner ${scaduti ? '!border-rose-200 !bg-rose-50 !text-rose-800' : ''}`} role="alert">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900">
              {scaduti ? `${scaduti} ${scaduti === 1 ? 'territorio scaduto' : 'territori scaduti'}` : ''}
              {scaduti && alert.length > scaduti ? ' e ' : ''}
              {alert.length > scaduti ? `${alert.length - scaduti} in scadenza entro 30 giorni` : ''}
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              {alert.map(a => (
                <li key={a.id}>
                  <a className="underline-offset-2 hover:underline" href={'#territorio-' + a.numero}>
                    <span className="font-semibold">{nomeCompleto(a.numero)}</span>
                  </a>
                  {`, ${a.proclamatore}: `}
                  {a.livello === 'scaduto' ? `scaduto da ${giorniTesto(-a.giorniRimasti)}` : `scade tra ${giorniTesto(a.giorniRimasti)}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Disponibili', value: disponibili },
          { label: 'Assegnati', value: aperte.length },
          { label: 'In scadenza entro 30 giorni', value: alert.length - scaduti },
          { label: 'Scaduti', value: scaduti },
        ].map(m => (
          <div key={m.label} className="metric-card compact">
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
          </div>
        ))}
      </div>

      <datalist id="territori-proclamatori">
        {proclamatori.map(n => <option key={n} value={n} />)}
      </datalist>

      <div className="card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Archivio cartine</h2>
            <p className="section-description">
              {territori.length} {territori.length === 1 ? 'territorio' : 'territori'} in {SEZIONI.length} {SEZIONI.length === 1 ? 'sezione' : 'sezioni'}.
            </p>
          </div>
        </div>

        {territori.length === 0 ? (
          <p className="text-sm text-slate-600 py-6">
            L'archivio è vuoto. Copia le cartine nella cartella <code>src/territori/</code> del progetto, con numero e nome nel nome del file (es. <code>territorio_12_Ribolla.pdf</code>), e pubblica di nuovo l'app.
          </p>
        ) : (
          <>
            <nav aria-label="Sezioni dei territori" className="flex flex-wrap gap-2 mb-4">
              {SEZIONI.map(sezione => (
                <a key={sezione.nome} href={'#' + idSezione(sezione.nome)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-slate-400">
                  <Pallino colore={coloreSezione(sezione.nome)} />
                  {sezione.nome}
                  <span className="text-slate-500 tabular-nums">{sezione.territori.length}</span>
                </a>
              ))}
            </nav>

            <div className="space-y-3">
              {SEZIONI.map(sezione => {
                const colore = coloreSezione(sezione.nome);
                const fuori = sezione.territori.filter(t => assegnazioneAperta(assegnazioni, t.numero)).length;
                return (
                  <details key={sezione.nome} id={idSezione(sezione.nome)} open className="rounded-lg border border-slate-200 overflow-hidden scroll-mt-24">
                    <summary
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
                      style={{ background: `color-mix(in srgb, ${colore} 11%, white)`, borderLeft: `6px solid ${colore}` }}
                    >
                      <h3 className="font-bold text-slate-900">{sezione.nome}</h3>
                      <span className="text-sm text-slate-600">
                        {sezione.territori.length} {sezione.territori.length === 1 ? 'territorio' : 'territori'}{fuori ? `, ${fuori} ${fuori === 1 ? 'assegnato' : 'assegnati'}` : ''}
                      </span>
                    </summary>
                    <div className="table-wrapper overflow-x-auto">
                      {/* Larghezze fisse: le colonne restano allineate da una sezione all'altra. */}
                      <table className="tbl table-fixed min-w-[720px]">
                        <colgroup>
                          <col className="w-[30%]" />
                          <col className="w-[140px]" />
                          <col />
                          {isAdmin && <col className="w-[170px]" />}
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Territorio</th>
                            <th>Cartina</th>
                            <th>Stato</th>
                            {isAdmin && <th><span className="sr-only">Azioni</span></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sezione.territori.map(t => {
                            const aperta = assegnazioneAperta(assegnazioni, t.numero);
                            const rientro = ultimoRientro(assegnazioni, t.numero);
                            const dettaglio = dettaglioInSezione(t);
                            const media = lavorazione.perTerritorio.get(t.numero);
                            return (
                              <React.Fragment key={t.numero}>
                                <tr id={'territorio-' + t.numero} className="scroll-mt-24">
                                  <td className="truncate">
                                    <span className="font-bold tabular-nums text-base">{t.numero}</span>
                                    {dettaglio && <span className="ml-2">{dettaglio}</span>}
                                  </td>
                                  <td>
                                    <a className="btn-ghost" href={t.url} target="_blank" rel="noopener noreferrer" title={t.file}>
                                      <FileText className="w-4 h-4" /> Apri PDF
                                    </a>
                                  </td>
                                  <td>
                                    {aperta ? (
                                      <div className="space-y-1">
                                        <p className="text-sm"><span className="font-semibold">{aperta.proclamatore}</span>, dal {dataIt(aperta.assegnato)}</p>
                                        <BarraScadenza assegnato={aperta.assegnato} numero={t.numero} />
                                      </div>
                                    ) : (
                                      <span className="text-sm text-emerald-700">
                                        Disponibile{rientro ? `, rientrato il ${dataIt(rientro)}` : ''}
                                      </span>
                                    )}
                                    {media && (
                                      <p className="text-xs text-slate-500 mt-1">
                                        Lavorazione media {giorniTesto(media.mediaGiorni)} su {media.lavorazioni} {media.lavorazioni === 1 ? 'volta' : 'volte'}
                                      </p>
                                    )}
                                  </td>
                                  {isAdmin && (
                                    <td className="text-right whitespace-nowrap">
                                      {aperta ? (
                                        <button type="button" className="btn-ghost" onClick={() => segnaRientro(aperta)}>
                                          <Undo2 className="w-4 h-4" /> Segna rientro
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn-ghost"
                                          aria-expanded={assegnando === t.numero}
                                          onClick={() => (assegnando === t.numero ? setAssegnando(null) : apriAssegnazione(t.numero))}
                                        >
                                          <UserPlus className="w-4 h-4" /> Assegna
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                                {isAdmin && assegnando === t.numero && !aperta && (
                                  <tr>
                                    <td colSpan={colonne} className="!bg-slate-50">
                                      <form onSubmit={assegna} className="flex flex-wrap items-end gap-3 py-1">
                                        <div className="min-w-[220px] flex-1">
                                          <label className="lbl" htmlFor={'assegna-nome-' + t.numero}>Proclamatore</label>
                                          <input
                                            id={'assegna-nome-' + t.numero}
                                            className="inp mt-1"
                                            list="territori-proclamatori"
                                            value={assegnaNome}
                                            onChange={e => setAssegnaNome(e.target.value)}
                                            placeholder="Nome e cognome"
                                            autoFocus
                                            required
                                          />
                                        </div>
                                        <div>
                                          <label className="lbl" htmlFor={'assegna-data-' + t.numero}>Data di assegnazione</label>
                                          <input id={'assegna-data-' + t.numero} type="date" className="inp mt-1" value={assegnaData} max={oggi} onChange={e => setAssegnaData(e.target.value)} required />
                                        </div>
                                        <button type="submit" className="btn-primary">Assegna territorio {t.numero}</button>
                                        <button type="button" className="btn-ghost" onClick={() => setAssegnando(null)}>Annulla</button>
                                      </form>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card space-y-5">
        <div className="section-heading-row flex-wrap">
          <div>
            <h2 className="section-title">Tempo di lavorazione</h2>
            <p className="section-description">Giorni tra assegnazione e rientro. La linea segna la scadenza di {MESI_SCADENZA} mesi.</p>
          </div>
          <div>
            <label className="lbl" htmlFor="grafici-sezione">Sezione</label>
            <select id="grafici-sezione" className="inp mt-1 min-w-[200px]" value={sezioneGrafici} onChange={e => setSezioneGrafici(e.target.value)}>
              <option value="">Tutte le sezioni</option>
              {SEZIONI.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Tempo medio di lavorazione', value: lavorazione.mediaGiorni === null ? '—' : giorniTesto(lavorazione.mediaGiorni) },
            { label: `Rientrati entro ${MESI_SCADENZA} mesi`, value: lavorazione.percentualeInTempo === null ? '—' : `${lavorazione.percentualeInTempo}%` },
            { label: 'Lavorazioni concluse', value: String(lavorazione.concluse) },
          ].map(m => (
            <div key={m.label} className="metric-card compact">
              <div className="metric-value">{m.value}</div>
              <div className="metric-label">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-8">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Media per territorio, lavorazioni concluse</h3>
            {datiMedie.length ? (
              <GraficoGiorni dati={datiMedie} titolo="Tempo medio di lavorazione per territorio, in giorni" />
            ) : (
              <p className="text-sm text-slate-600 py-6">I tempi compaiono qui dal primo rientro registrato{sezioneGrafici ? ` in ${sezioneGrafici}` : ''}.</p>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">In lavorazione ora, giorni trascorsi</h3>
            {datiInCorso.length ? (
              <GraficoGiorni dati={datiInCorso} titolo="Giorni trascorsi dall'assegnazione per i territori in lavorazione" />
            ) : (
              <p className="text-sm text-slate-600 py-6">Nessun territorio in lavorazione{sezioneGrafici ? ` in ${sezioneGrafici}` : ''}. Assegnane uno dall'archivio.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Assegnazioni</h2>
            <p className="section-description">Prima quelle in corso, ordinate per scadenza; poi lo storico dei rientri.</p>
          </div>
        </div>
        {storico.length === 0 ? (
          <p className="text-sm text-slate-600 py-6 flex items-center gap-2">
            <MapIcon className="w-4 h-4" /> Nessuna assegnazione registrata. Usa il pulsante Assegna accanto a un territorio dell'archivio.
          </p>
        ) : (
          <div className="table-wrapper overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Proclamatore</th>
                  <th>Territorio</th>
                  <th>Assegnato il</th>
                  <th>Rientro</th>
                  <th>Scadenza</th>
                  {isAdmin && <th><span className="sr-only">Azioni</span></th>}
                </tr>
              </thead>
              <tbody>
                {storico.map(a => (
                  <tr key={a.id}>
                    <td className="font-semibold">{a.proclamatore}</td>
                    <td className="whitespace-nowrap"><NomeTerritorio numero={a.numero} /></td>
                    <td>
                      {isAdmin ? (
                        <input type="date" className="inp !min-h-0 !py-1" value={a.assegnato} max={a.rientro || oggi} aria-label={`Data di assegnazione, territorio ${a.numero}`}
                          onChange={e => e.target.value && aggiornaAssegnazione(a.id, { assegnato: e.target.value })} />
                      ) : dataIt(a.assegnato)}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input type="date" className="inp !min-h-0 !py-1" value={a.rientro || ''} min={a.assegnato} max={oggi} aria-label={`Data di rientro, territorio ${a.numero}`}
                          onChange={e => aggiornaAssegnazione(a.id, { rientro: e.target.value || undefined })} />
                      ) : a.rientro ? dataIt(a.rientro) : <span className="text-slate-500">In corso</span>}
                    </td>
                    <td>
                      {a.rientro ? (
                        <span className="text-xs text-slate-500">Lavorato in {giorniTesto(giorniTra(a.assegnato, a.rientro))}</span>
                      ) : (
                        <BarraScadenza assegnato={a.assegnato} numero={a.numero} />
                      )}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <button type="button" className="icon-btn" onClick={() => eliminaAssegnazione(a)} title="Elimina assegnazione">
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Elimina assegnazione del territorio {a.numero} a {a.proclamatore}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
