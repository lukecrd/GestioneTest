import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Trash2, Undo2, AlertTriangle, UserPlus, Printer, Tag, Plus, Upload, ArrowLeft, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { StateData, AssegnazioneTerritorio, TerritoriData, EtichettaTerritorio, IndirizzoTerritorio, TipoIndirizzo, StatoIndirizzo, CartinaAggiunta } from '../types';
import {
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
  parseNumeriTerritori,
  testoSu,
  copertura,
  filtraPerEtichette,
  SENZA_ETICHETTE,
  CON_ETICHETTE,
  statisticheMensili,
  TIPI_INDIRIZZO,
  STATI_INDIRIZZO,
  STATI_PERMANENTI,
  registraVisita,
  unisciCartine,
  cartinaAggiunta,
  parseCartina,
  ordinaIndirizzi,
  applicaRientri,
} from '../utils/territori';
import { accediDrive, caricaSuDrive, cartellaDrive, driveAccesso, driveConfigurato, precaricaDrive } from '../lib/drive';
import { ModuloS13 } from './ModuloS13';
import { SchedaTerritorio } from './SchedaTerritorio';
import { StatisticaTerritori } from './StatisticaTerritori';
import { RegistrazioniTerritori } from './RegistrazioniTerritori';
import { RestituisciTerritori } from './RestituisciTerritori';
import { CongregazioneTerritori } from './CongregazioneTerritori';

interface TerritoriViewProps {
  state: StateData;
  onSaveState: (state: StateData) => void;
  isAdmin: boolean;
  onShowToast: (msg: string) => void;
  checkAdminPermission: () => boolean;
}

// Cartine di base: i PDF in src/territori/, inclusi nel build. Quelle caricate dall'app (su Drive) si aggiungono o le sostituiscono.
const CARTINE_FILE = cartineDaFile(
  import.meta.glob('../territori/*.pdf', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
);

type Cartina = { numero: string; nome: string; sezione: string; file: string; url: string; aggiunta?: boolean };
const creaArchivio = (cartine: Cartina[]) => ({
  cartine,
  sezioni: raggruppaSezioni(cartine) as { nome: string; indice: number; territori: Cartina[] }[],
  perNumero: new Map(cartine.map(c => [c.numero, c])),
});
type Archivio = ReturnType<typeof creaArchivio>;
// I componenti fuori dalla vista (nome del territorio, tooltip) leggono l'archivio corrente da qui.
const ArchivioCtx = createContext<Archivio>(creaArchivio(CARTINE_FILE));

// Un colore per sezione, nell'ordine dei numeri: aiuta a riconoscerla, ma il nome resta sempre scritto.
const COLORI_SEZIONE = ['#2f6f8f', '#b5651d', '#6a8d2a', '#7a4fa0', '#b23a48', '#2a8a7a', '#b8860b', '#4b5fae', '#8d5a3b', '#a8467e', '#5a6b7a', '#d0561f', '#3f8a4f'];
const coloreIn = (archivio: Archivio, nome: string) => {
  const sezione = archivio.sezioni.find(s => s.nome === nome);
  return sezione ? COLORI_SEZIONE[sezione.indice % COLORI_SEZIONE.length] : '#8f9893';
};
const idSezione = (nome: string) => 'sezione-' + nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Grafici: una sola serie, colore validato (chroma e contrasto) contro la superficie chiara.
const COLORE_BARRE = '#16799e';
const INK = { muted: '#646e6a', secondary: '#4a5451', grid: '#dde1dd', axis: '#c3c9c4' };

const nomeCompletoIn = (archivio: Archivio, numero: string) => {
  const c = archivio.perNumero.get(numero);
  return c ? `${numero} ${c.nome}` : numero;
};

const Pallino: React.FC<{ colore: string }> = ({ colore }) => (
  <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colore }} />
);

// "35A Roccastrada" col pallino della sezione; se la cartina non c'è più resta solo il codice.
const NomeTerritorio: React.FC<{ numero: string }> = ({ numero }) => {
  const archivio = useContext(ArchivioCtx);
  const c = archivio.perNumero.get(numero);
  return (
    <span className="inline-flex items-center gap-2">
      <Pallino colore={c ? coloreIn(archivio, c.sezione) : '#8f9893'} />
      <span><span className="font-bold tabular-nums">{numero}</span>{c ? ' ' + c.nome : ''}</span>
    </span>
  );
};

const Chip: React.FC<{ e: EtichettaTerritorio }> = ({ e }) => (
  <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium" style={{ background: e.colore, color: testoSu(e.colore) }}>{e.nome}</span>
);

const Chips: React.FC<{ etichette?: EtichettaTerritorio[] }> = ({ etichette }) =>
  etichette?.length ? <span className="inline-flex flex-wrap gap-1 align-middle">{etichette.map(e => <Chip key={e.id} e={e} />)}</span> : null;

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

const BarraScadenza: React.FC<{ assegnato: string; numero: string; mesi: number }> = ({ assegnato, numero, mesi }) => {
  const s = statoScadenza(assegnato, undefined, mesi);
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
  const archivio = useContext(ArchivioCtx);
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{nomeCompletoIn(archivio, r.numero)}</p>
      <p className="text-slate-700 tabular-nums">{giorniTesto(r.giorni)}</p>
      <p className="text-slate-500">{r.nota}</p>
    </div>
  );
};

// Barre orizzontali in giorni, con la linea della scadenza.
const GraficoGiorni: React.FC<{ dati: RigaGrafico[]; titolo: string; mesi: number }> = ({ dati, titolo, mesi }) => {
  const GIORNI_SCADENZA = Math.round(mesi * 30.44);
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
            label={{ value: `${mesi} mesi`, position: 'top', fill: INK.secondary, fontSize: 12 }}
          />
          <Bar dataKey="giorni" fill={COLORE_BARRE} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
};

export const TerritoriView: React.FC<TerritoriViewProps> = ({ state, onSaveState, isAdmin, onShowToast, checkAdminPermission }) => {
  const data = useMemo(() => normalizeTerritori(state.territori), [state.territori]);
  const { assegnazioni, etichette, impostazioni } = data;
  const mesi = impostazioni.mesiScadenza;
  const archivio = useMemo(() => creaArchivio(unisciCartine(CARTINE_FILE, data.aggiunte)), [data.aggiunte]);
  const territori = archivio.cartine;
  const SEZIONI = archivio.sezioni;
  const PER_NUMERO = archivio.perNumero;
  const coloreSezione = (nome: string) => coloreIn(archivio, nome);
  const nomeCompleto = (numero: string) => nomeCompletoIn(archivio, numero);
  // Dopo l'attesa del caricamento su Drive si salva sui dati più recenti, non su quelli del clic.
  const dataRef = useRef(data);
  dataRef.current = data;
  const oggi = formatDay(new Date());

  // Assegnazione in linea: si apre sotto la riga del territorio scelto.
  const [assegnando, setAssegnando] = useState<string | null>(null);
  const [assegnaNome, setAssegnaNome] = useState('');
  const [assegnaData, setAssegnaData] = useState(oggi);
  const [sezioneGrafici, setSezioneGrafici] = useState('');
  const [mostraS13, setMostraS13] = useState(false);
  const [mostraScaduti, setMostraScaduti] = useState(false);

  const save = (next: TerritoriData) => onSaveState({ ...state, territori: next });

  const aperte = assegnazioni.filter(a => !a.rientro);
  const disponibili = territori.length - territori.filter(t => assegnazioneAperta(assegnazioni, t.numero)).length;
  const alert = useMemo(() => alertTerritori(assegnazioni, oggi, mesi), [assegnazioni, oggi, mesi]);
  const scaduti = alert.filter(a => a.livello === 'scaduto').length;
  const lavorazione = useMemo(() => statisticheLavorazione(assegnazioni, mesi), [assegnazioni, mesi]);
  const proclamatori = useMemo(
    () => Array.from(new Set<string>(state.people.map(p => p.name))).sort((a, b) => a.localeCompare(b, 'it')),
    [state.people],
  );

  // Coda di assegnazione: prima i mai lavorati, poi quelli rientrati da più tempo.
  const [cerca, setCerca] = useState('');
  const [filtroEtichette, setFiltroEtichette] = useState<string[]>(() => (impostazioni.etichettaPredefinita ? [impostazioni.etichettaPredefinita] : []));
  const [tutteLeEtichette, setTutteLeEtichette] = useState(false);
  const [mostraTutti, setMostraTutti] = useState(false);
  const alternaFiltro = (id: string) => setFiltroEtichette(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id]));
  const etichettePer = useMemo(() => {
    const m = new Map<string, EtichettaTerritorio[]>();
    for (const e of etichette) for (const n of e.territori) m.set(n, [...(m.get(n) ?? []), e]);
    return m;
  }, [etichette]);
  const codaDisponibili = useMemo(() => {
    const ultimi = new Map<string, AssegnazioneTerritorio>();
    for (const a of assegnazioni) {
      const prec = ultimi.get(a.numero);
      if (a.rientro && !a.nonLavorato && (!prec || a.rientro > prec.rientro!)) ultimi.set(a.numero, a);
    }
    const q = cerca.trim().toLowerCase();
    return territori
      .filter(t => !assegnazioneAperta(assegnazioni, t.numero))
      .map(t => ({ t, ultima: ultimi.get(t.numero) }))
      .filter(({ t }) => filtraPerEtichette((etichettePer.get(t.numero) ?? []).map(e => e.id), filtroEtichette, tutteLeEtichette))
      .filter(({ t, ultima }) => !q || `${t.numero} ${t.nome} ${t.sezione} ${ultima?.proclamatore ?? ''} ${(etichettePer.get(t.numero) ?? []).map(e => e.nome).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => (a.ultima?.rientro ?? '').localeCompare(b.ultima?.rientro ?? ''));
  }, [territori, assegnazioni, cerca, filtroEtichette, tutteLeEtichette, etichettePer]);
  const limite = impostazioni.mostraDisponibili;
  const codaVisibile = limite && !mostraTutti ? codaDisponibili.slice(0, limite) : codaDisponibili;
  const mensili = useMemo(() => statisticheMensili(assegnazioni, oggi), [assegnazioni, oggi]);

  const aggiornaImpostazioni = (patch: Partial<typeof impostazioni>) => {
    if (!checkAdminPermission()) return;
    save({ ...data, impostazioni: { ...impostazioni, ...patch } });
  };

  const [nuovaEtichetta, setNuovaEtichetta] = useState('');
  const [nuovoColore, setNuovoColore] = useState('#2f6f8f');
  const numeriValidi = useMemo(() => new Set(territori.map(t => t.numero)), [territori]);

  const aggiungiEtichetta = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!checkAdminPermission()) return;
    const nome = nuovaEtichetta.trim();
    if (!nome) return;
    if (etichette.some(e => e.nome.toLowerCase() === nome.toLowerCase())) return onShowToast(`L'etichetta "${nome}" esiste già.`);
    save({ ...data, etichette: [...etichette, { id: crypto.randomUUID(), nome, colore: nuovoColore, territori: [] }] });
    setNuovaEtichetta('');
  };

  const aggiornaEtichetta = (id: string, patch: Partial<EtichettaTerritorio>) => {
    if (!checkAdminPermission()) return;
    save({ ...data, etichette: etichette.map(e => (e.id === id ? { ...e, ...patch } : e)) });
  };

  const impostaTerritoriEtichetta = (e: EtichettaTerritorio, testo: string) => {
    const { numeri, sconosciuti } = parseNumeriTerritori(testo, numeriValidi);
    if (sconosciuti.length) onShowToast(`Territori inesistenti ignorati: ${sconosciuti.join(', ')}.`);
    if (numeri.join() !== e.territori.join()) aggiornaEtichetta(e.id, { territori: numeri });
  };

  const eliminaEtichetta = (e: EtichettaTerritorio) => {
    if (!checkAdminPermission()) return;
    if (!window.confirm(`Eliminare l'etichetta "${e.nome}"? I territori non vengono toccati.`)) return;
    setFiltroEtichette(f => f.filter(x => x !== e.id));
    save({
      ...data,
      etichette: etichette.filter(x => x.id !== e.id),
      impostazioni: impostazioni.etichettaPredefinita === e.id ? { ...impostazioni, etichettaPredefinita: '' } : impostazioni,
    });
  };

  const nellaSezione = (numero: string) => !sezioneGrafici || PER_NUMERO.get(numero)?.sezione === sezioneGrafici;
  const datiMedie: RigaGrafico[] = [...lavorazione.perTerritorio.values()]
    .filter(s => nellaSezione(s.numero))
    .sort((a, b) => b.mediaGiorni - a.mediaGiorni)
    .map(s => ({
      numero: s.numero,
      etichetta: nomeCompleto(s.numero),
      giorni: s.mediaGiorni,
      nota: `Media su ${s.lavorazioni} ${s.lavorazioni === 1 ? 'lavorazione' : 'lavorazioni'}, ${s.inTempo} entro ${mesi} mesi`,
    }));
  const datiInCorso: RigaGrafico[] = aperte
    .filter(a => nellaSezione(a.numero))
    .map(a => ({ numero: a.numero, etichetta: nomeCompleto(a.numero), giorni: giorniTra(a.assegnato, oggi), nota: `${a.proclamatore || '---'}, dal ${dataIt(a.assegnato)}` }))
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
    const gia = aperte.filter(a => a.proclamatore.trim().toLowerCase() === proclamatore.toLowerCase()).length;
    const max = impostazioni.maxPerProclamatore;
    if (max && gia >= max && !window.confirm(`${proclamatore} ha già ${gia} territori (massimo ${max}). Assegnare comunque?`)) return;
    const nuova: AssegnazioneTerritorio = { id: crypto.randomUUID(), numero, proclamatore, assegnato: assegnaData };
    save({ ...data, assegnazioni: [...assegnazioni, nuova] });
    setAssegnando(null);
    onShowToast(`Territorio ${numero} assegnato a ${proclamatore}.`);
  };

  // Un solo salvataggio per rientri e azzeramento degli stati degli indirizzi.
  const restituisci = (ids: string[], rientro: string, nonLavorato = false) => {
    if (!checkAdminPermission()) return;
    const r = applicaRientri(data, ids, rientro, nonLavorato);
    if (r.rientrati.length) save(r.dati);
    const fatti = r.rientrati.length === 1 ? `Rientro del territorio ${r.rientrati[0]} registrato` : `${r.rientrati.length} territori rientrati`;
    const saltati = r.saltate.length ? `; saltati ${r.saltate.map(a => a.numero).join(', ')} (assegnati dopo il ${dataIt(rientro)})` : '';
    onShowToast(`${fatti}${nonLavorato ? ' come non percorsi' : ''}${saltati}.`);
  };
  const segnaRientro = (a: AssegnazioneTerritorio, nonLavorato = false) => restituisci([a.id], oggi, nonLavorato);

  const annullaRientro = (a: AssegnazioneTerritorio) => {
    if (!checkAdminPermission()) return;
    if (assegnazioneAperta(assegnazioni, a.numero)) return onShowToast(`Il territorio ${a.numero} è già stato riassegnato: modifica le registrazioni.`);
    if (!window.confirm(`Annullare il rientro del ${dataIt(a.rientro!)}? Il territorio ${a.numero} torna assegnato a ${a.proclamatore || '---'}. Gli stati degli indirizzi già azzerati non tornano.`)) return;
    save({ ...data, assegnazioni: assegnazioni.map(x => (x.id === a.id ? { id: x.id, numero: x.numero, proclamatore: x.proclamatore, assegnato: x.assegnato, ...(x.etichetta ? { etichetta: x.etichetta } : {}) } : x)) });
  };

  // Note e indirizzi: pannello sotto la riga del territorio.
  const [dettagli, setDettagli] = useState<string | null>(null);
  const [nuovoIndirizzo, setNuovoIndirizzo] = useState({ indirizzo: '', tipo: 'residenziale' as TipoIndirizzo, stato: '' as StatoIndirizzo, nota: '', porzione: '' });
  const indirizziPer = (numero: string): IndirizzoTerritorio[] => ordinaIndirizzi(data.indirizzi.filter(n => n.numero === numero));
  const copertura12 = useMemo(() => copertura(territori, assegnazioni, oggi), [territori, assegnazioni, oggi]);

  const salvaNota = (numero: string, testo: string) => {
    if ((data.note[numero] ?? '') === testo.trim() || !checkAdminPermission()) return;
    const note = { ...data.note };
    if (testo.trim()) note[numero] = testo.trim(); else delete note[numero];
    save({ ...data, note });
  };

  const salvaIndirizzi = (indirizzi: IndirizzoTerritorio[]) => save({ ...data, indirizzi });

  const aggiungiIndirizzo = (numero: string) => (e: React.FormEvent) => {
    e.preventDefault();
    const { indirizzo, tipo, stato, nota, porzione } = nuovoIndirizzo;
    if (!checkAdminPermission() || !indirizzo.trim()) return;
    if (data.indirizzi.some(n => n.numero === numero && n.indirizzo.toLowerCase() === indirizzo.trim().toLowerCase())) {
      return onShowToast(`"${indirizzo.trim()}" è già nel territorio ${numero}.`);
    }
    const base: IndirizzoTerritorio = { id: crypto.randomUUID(), numero, indirizzo: indirizzo.trim(), tipo, stato: '', data: oggi, visite: [], porzione: porzione.trim(), ...(nota.trim() ? { nota: nota.trim() } : {}) };
    salvaIndirizzi([...data.indirizzi, stato ? registraVisita(base, stato, oggi, assegnazioneAperta(assegnazioni, numero)?.proclamatore) : base]);
    setNuovoIndirizzo({ indirizzo: '', tipo, stato: '', nota: '', porzione });
  };

  const aggiornaIndirizzo = (id: string, cambia: (n: IndirizzoTerritorio) => IndirizzoTerritorio) => {
    if (!checkAdminPermission()) return;
    salvaIndirizzi(data.indirizzi.map(n => (n.id === id ? cambia(n) : n)));
  };

  const spostaIndirizzo = (n: IndirizzoTerritorio) => {
    if (!checkAdminPermission()) return;
    const testo = window.prompt(`Spostare "${n.indirizzo}" in quale territorio?`, '');
    if (!testo) return;
    const { numeri } = parseNumeriTerritori(testo, numeriValidi);
    if (numeri.length !== 1) return onShowToast(`Territorio "${testo}" non trovato.`);
    if (numeri[0] === n.numero) return;
    salvaIndirizzi(data.indirizzi.map(x => (x.id === n.id ? { ...x, numero: numeri[0] } : x)));
    onShowToast(`"${n.indirizzo}" spostato nel territorio ${numeri[0]}.`);
  };

  const eliminaIndirizzo = (n: IndirizzoTerritorio) => {
    if (!checkAdminPermission()) return;
    if (!window.confirm(`Eliminare "${n.indirizzo}" e il suo storico delle visite?`)) return;
    salvaIndirizzi(data.indirizzi.filter(x => x.id !== n.id));
  };

  const colonne = isAdmin ? 4 : 3;

  // Lo script di Google va caricato prima del clic, altrimenti il popup di accesso viene bloccato.
  useEffect(() => {
    if (isAdmin) precaricaDrive().catch(() => {});
  }, [isAdmin]);
  const [caricando, setCaricando] = useState<string | null>(null);
  const [nuovaCartina, setNuovaCartina] = useState({ numero: '', nome: '' });
  const [schedaStampa, setSchedaStampa] = useState<string | null>(null);
  type Scheda = 'assegna' | 'restituisci' | 'registrazioni' | 'territori' | 'statistica' | 'congregazione' | 'etichette' | 'impostazioni';
  const schede: { id: Scheda; nome: string }[] = [
    { id: 'assegna', nome: 'Assegna' },
    { id: 'restituisci', nome: 'Restituisci' },
    { id: 'registrazioni', nome: 'Registrazioni' },
    { id: 'territori', nome: 'Territori' },
    { id: 'statistica', nome: 'Statistica' },
    { id: 'congregazione', nome: 'Congregazione' },
    ...(isAdmin ? [{ id: 'etichette' as const, nome: 'Etichette' }, { id: 'impostazioni' as const, nome: 'Impostazioni' }] : []),
  ];
  const [schedaScelta, setTab] = useState<Scheda>('assegna');
  const tab: Scheda = schede.some(s => s.id === schedaScelta) ? schedaScelta : 'assegna';
  const [vaiA, setVaiA] = useState<string | null>(null);
  // dopo il cambio di scheda l'elemento esiste: lo si porta in vista una volta sola
  useEffect(() => {
    if (!vaiA) return;
    document.getElementById(vaiA)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setVaiA(null);
  }, [vaiA, tab]);

  // Carica il PDF su Drive (link visibile a chi ha il link): la cartina che aggiunge o sostituisce quella del territorio.
  const inviaCartina = async (token: string, cartella: string, numero: string, nome: string, file: File): Promise<CartinaAggiunta> => {
    const { id, webViewLink } = await caricaSuDrive(token, file, `Territorio_${numero}_${nome}.pdf`, { pubblico: true, cartella });
    return { numero, nome, link: webViewLink, driveId: id, file: file.name, caricato: oggi };
  };
  // Dopo l'attesa su Drive si salva sui dati più recenti, in un'unica scrittura.
  const salvaAggiunte = (nuove: CartinaAggiunta[]) => {
    const numeri = new Set(nuove.map(a => a.numero));
    const attuali = dataRef.current;
    onSaveState({ ...state, territori: { ...attuali, aggiunte: [...attuali.aggiunte.filter(a => !numeri.has(a.numero)), ...nuove] } });
  };

  const caricaCartina = async (numeroScritto: string, nome: string, file: File | undefined) => {
    if (!file || !checkAdminPermission()) return false;
    if (file.type !== 'application/pdf') { onShowToast('Puoi caricare solo file PDF.'); return false; }
    const prova = cartinaAggiunta({ numero: numeroScritto.trim(), nome: nome.trim(), link: '', file: file.name });
    if (!prova || !nome.trim()) { onShowToast('Indica numero (es. 12 o 35A) e nome del territorio.'); return false; }
    const numero = prova.numero;
    setCaricando(numero);
    try {
      const token = await accediDrive();
      const cartella = await cartellaDrive(token, ['Territori']);
      salvaAggiunte([await inviaCartina(token, cartella, numero, nome.trim(), file)]);
      onShowToast(`Cartina del territorio ${numero} caricata su Drive.`);
      return true;
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Caricamento non riuscito.');
      return false;
    } finally {
      setCaricando(null);
    }
  };

  // Più PDF insieme: numero e nome dal nome del file, come per quelli in src/territori/.
  const caricaTutte = async (files: File[]) => {
    if (!files.length || !checkAdminPermission()) return;
    const scelte = new Map<string, { nome: string; file: File }>();
    const scartati: string[] = [];
    for (const file of files) {
      const info = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? parseCartina(file.name) : null;
      if (!info) { scartati.push(file.name); continue; }
      // senza nome nel file ("12.pdf") resta quello del territorio in archivio
      const senzaNome = info.nome === `Territorio ${info.numero}`;
      scelte.set(info.numero, { nome: (senzaNome && PER_NUMERO.get(info.numero)?.nome) || info.nome, file });
    }
    if (!scelte.size) { onShowToast(`Nessun file riconosciuto: il nome deve contenere il numero, es. territorio_12_Ribolla.pdf.`); return; }
    const sostituite = [...scelte.keys()].filter(n => PER_NUMERO.has(n)).length;
    if (!window.confirm(`Caricare ${scelte.size} ${scelte.size === 1 ? 'cartina' : 'cartine'} su Drive?`
      + (sostituite ? ` ${sostituite} ${sostituite === 1 ? 'sostituisce quella' : 'sostituiscono quelle'} già in archivio.` : '')
      + (scartati.length ? `\n\nSaltati (numero non trovato nel nome): ${scartati.join(', ')}` : ''))) return;
    const nuove: CartinaAggiunta[] = [];
    const falliti: string[] = [];
    try {
      const token = await accediDrive();
      const cartella = await cartellaDrive(token, ['Territori']);
      for (const [numero, { nome, file }] of scelte) {
        setCaricando(`${nuove.length + falliti.length + 1}/${scelte.size}`);
        try { nuove.push(await inviaCartina(token, cartella, numero, nome, file)); } catch { falliti.push(numero); }
      }
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      // salva anche un caricamento a metà: i PDF già su Drive non vanno persi
      if (nuove.length) salvaAggiunte(nuove);
      setCaricando(null);
    }
    if (nuove.length) onShowToast(`${nuove.length} ${nuove.length === 1 ? 'cartina caricata' : 'cartine caricate'} su Drive.`
      + (falliti.length ? ` Non riuscite: ${falliti.join(', ')}.` : ''));
  };

  const aggiungiCartina = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem('pdf') as HTMLInputElement).files?.[0];
    const numero = parseNumeriTerritori(nuovaCartina.numero, new Set()).sconosciuti[0] ?? '';
    // l'accesso a Google prima del confirm: dopo, il clic non vale più e il popup viene bloccato
    try { await accediDrive(); } catch (err) { onShowToast(err instanceof Error ? err.message : 'Accesso a Google non riuscito.'); return; }
    if (PER_NUMERO.has(numero) && !window.confirm(`Il territorio ${numero} esiste già: sostituire il suo PDF?`)) return;
    if (await caricaCartina(numero, nuovaCartina.nome, file)) {
      setNuovaCartina({ numero: '', nome: '' });
      form.reset();
    }
  };

  // shortcut: il PDF resta su Drive (cartella "Territori"), si toglie solo dall'archivio; eliminarlo a mano se serve.
  const rimuoviCartina = (numero: string) => {
    if (!checkAdminPermission()) return;
    const torna = CARTINE_FILE.some(c => c.numero === numero);
    if (!window.confirm(torna
      ? `Togliere il PDF caricato per il territorio ${numero}? Torna quello originale del progetto.`
      : `Togliere il territorio ${numero} dall'archivio? Assegnazioni e indirizzi restano nello storico.`)) return;
    save({ ...data, aggiunte: data.aggiunte.filter(a => a.numero !== numero) });
  };

  const daStampare = schedaStampa ? PER_NUMERO.get(schedaStampa) : undefined;
  if (daStampare) {
    return (
      <SchedaTerritorio
        cartina={daStampare}
        nota={data.note[daStampare.numero]}
        indirizzi={indirizziPer(daStampare.numero)}
        aperta={assegnazioneAperta(assegnazioni, daStampare.numero)}
        mesi={mesi}
        onChiudi={() => setSchedaStampa(null)}
      />
    );
  }
  if (mostraScaduti) {
    // alert è già ordinato per giorniRimasti: i più scaduti per primi.
    const elenco = alert.filter(a => a.livello === 'scaduto');
    const esporta = () => {
      const foglio = XLSX.utils.json_to_sheet(elenco.map(a => ({
        Territorio: a.numero,
        Nome: PER_NUMERO.get(a.numero)?.nome ?? '',
        Proclamatore: a.proclamatore,
        Assegnato: a.assegnato,
        Scadenza: a.scadenza,
        'Giorni di ritardo': -a.giorniRimasti,
      })));
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, foglio, 'Territori scaduti');
      XLSX.writeFile(libro, `territori-scaduti-${oggi}.xlsx`);
    };
    return (
      <section className="space-y-5 animate-fadeIn">
        <div className="card no-print flex flex-wrap items-end gap-3">
          <button type="button" className="btn-ghost" onClick={() => setMostraScaduti(false)}>
            <ArrowLeft className="w-4 h-4" /> Torna ai territori
          </button>
          <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!elenco.length}>
            <Printer className="w-4 h-4" /> Stampa
          </button>
          <button type="button" className="btn-ghost" onClick={esporta} disabled={!elenco.length}>
            <Download className="w-4 h-4" /> Esporta Excel (.xlsx)
          </button>
        </div>
        <article className="card space-y-4 print:shadow-none print:border-0">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Territori scaduti ({elenco.length})</h1>
            <p className="text-slate-600">Al {dataIt(oggi)}; scadenza dopo {mesi} mesi dall'assegnazione.</p>
          </header>
          {elenco.length === 0 ? (
            <p className="text-slate-600">Nessun territorio scaduto.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Territorio</th><th>Proclamatore</th><th>Assegnato</th><th>Scadenza</th><th>Ritardo</th></tr>
              </thead>
              <tbody>
                {elenco.map(a => (
                  <tr key={a.id}>
                    <td className="font-semibold">{nomeCompleto(a.numero)}</td>
                    <td>{a.proclamatore || '---'}</td>
                    <td className="tabular-nums">{dataIt(a.assegnato)}</td>
                    <td className="tabular-nums">{dataIt(a.scadenza)}</td>
                    <td className="tabular-nums text-rose-700 font-semibold">{giorniTesto(-a.giorniRimasti)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    );
  }
  if (mostraS13) return <ModuloS13 territori={territori} assegnazioni={assegnazioni} onChiudi={() => setMostraS13(false)} />;

  return (
    <ArchivioCtx.Provider value={archivio}>
    <section className="space-y-6 animate-fadeIn" onClickCapture={e => {
      const link = (e.target as HTMLElement).closest('a[href^="#territorio-"]');
      if (!link) return;
      e.preventDefault();
      setTab('territori');
      setVaiA(link.getAttribute('href')!.slice(1));
    }}>
      <div className="page-heading">
        <div>
          <h1 className="page-title">Territori</h1>
          <p className="page-description">
            Archivio delle cartine e assegnazioni ai proclamatori. Ogni territorio va riconsegnato entro {mesi} mesi.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2 shrink-0">
          <button type="button" className="btn-ghost" onClick={() => setMostraScaduti(true)}>
            <AlertTriangle className="w-4 h-4" /> Territori scaduti
          </button>
          <button type="button" className="btn-ghost" onClick={() => setMostraS13(true)}>
            <Printer className="w-4 h-4" /> Modulo S-13
          </button>
        </div>
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
                  {`, ${a.proclamatore || '---'}: `}
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

      <div className="no-print overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Sezioni dei territori"
        onKeyDown={e => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const i = schede.findIndex(s => s.id === tab);
          const prossima = schede[(i + (e.key === 'ArrowRight' ? 1 : schede.length - 1)) % schede.length];
          setTab(prossima.id);
          document.getElementById('scheda-' + prossima.id)?.focus();
        }}>
        <div className="flex min-w-max gap-1">
          {schede.map(s => (
            <button key={s.id} id={'scheda-' + s.id} type="button" role="tab" aria-selected={tab === s.id} aria-controls={'pannello-' + s.id}
              tabIndex={tab === s.id ? 0 : -1} onClick={() => setTab(s.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap ${tab === s.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'}`}>
              {s.nome}
            </button>
          ))}
        </div>
      </div>

      {tab === 'assegna' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        {territori.length > 0 && (
          <div className="card">
            <div className="section-heading-row flex-wrap">
              <div>
                <h2 className="section-title">Disponibili per l'assegnazione</h2>
                <p className="section-description">Prima i territori mai lavorati, poi quelli rientrati da più tempo.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  className="inp max-w-xs"
                  placeholder="Cerca numero, nome, etichetta o proclamatore"
                  aria-label="Cerca tra i territori disponibili"
                  value={cerca}
                  onChange={e => setCerca(e.target.value)}
                />
              </div>
            </div>
            {etichette.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="Filtra per etichetta">
                {[{ id: CON_ETICHETTE, nome: 'Con etichette', colore: '' }, { id: SENZA_ETICHETTE, nome: 'Senza etichette', colore: '' }, ...etichette].map(e => {
                  const attivo = filtroEtichette.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      aria-pressed={attivo}
                      onClick={() => alternaFiltro(e.id)}
                      className={`rounded-full border px-3 py-1 text-sm ${attivo ? 'font-semibold border-slate-800' : 'border-slate-300 text-slate-700 hover:border-slate-500'}`}
                      style={attivo && e.colore ? { background: e.colore, color: testoSu(e.colore), borderColor: e.colore } : attivo ? { background: '#1e293b', color: '#fff' } : undefined}
                    >
                      {e.nome}
                    </button>
                  );
                })}
                {filtroEtichette.length > 1 && (
                  <label className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" checked={tutteLeEtichette} onChange={e => setTutteLeEtichette(e.target.checked)} />
                    Devono valere tutte
                  </label>
                )}
                {filtroEtichette.length > 0 && (
                  <button type="button" className="text-sm text-slate-600 underline underline-offset-2" onClick={() => setFiltroEtichette([])}>Azzera</button>
                )}
              </div>
            )}
            {codaDisponibili.length === 0 ? (
              <p className="text-sm text-slate-600 py-4">{cerca || filtroEtichette.length ? 'Nessun territorio disponibile corrisponde alla ricerca.' : 'Tutti i territori sono assegnati.'}</p>
            ) : (
              <ul className="divide-y divide-slate-200 max-h-[480px] overflow-y-auto">
                {codaVisibile.map(({ t, ultima }) => (
                  <li key={t.numero} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                    <div className="flex-1 min-w-[200px]">
                      <NomeTerritorio numero={t.numero} /> <Chips etichette={etichettePer.get(t.numero)} />
                      <p className="text-sm text-slate-600 mt-0.5">
                        {ultima ? `Restituito l'ultima volta${ultima.proclamatore ? ' da ' + ultima.proclamatore : ''}` : 'Mai lavorato'}
                      </p>
                    </div>
                    {ultima && (
                      <p className="text-sm text-slate-700 tabular-nums">
                        Rientrato il {dataIt(ultima.rientro!)} ({(giorniTra(ultima.rientro!, oggi) / 30.44).toFixed(1)} mesi fa)
                      </p>
                    )}
                    {isAdmin && (
                      <a
                        className="btn-ghost"
                        href={'#territorio-' + t.numero}
                        onClick={() => apriAssegnazione(t.numero)}
                      >
                        <UserPlus className="w-4 h-4" /> Assegna
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {codaVisibile.length < codaDisponibili.length && (
              <p className="text-sm text-slate-600 mt-2">
                Mostrati {codaVisibile.length} di {codaDisponibili.length}.{' '}
                <button type="button" className="underline underline-offset-2" onClick={() => setMostraTutti(true)}>Mostra tutti</button>
              </p>
            )}
          </div>
        )}
        </div>
      )}

      {tab === 'restituisci' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        <RestituisciTerritori
          assegnazioni={assegnazioni}
          nomeDi={numero => PER_NUMERO.get(numero)?.nome ?? ''}
          etichettePer={etichettePer}
          mesi={mesi}
          isAdmin={isAdmin}
          onRestituisci={restituisci}
          onAnnullaRientro={annullaRientro}
          onShowToast={onShowToast}
          nome={numero => <NomeTerritorio numero={numero} />}
          chips={numero => <Chips etichette={etichettePer.get(numero)} />}
        />
        </div>
      )}

      {tab === 'registrazioni' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        <RegistrazioniTerritori
          territori={territori}
          assegnazioni={assegnazioni}
          etichette={etichette}
          etichettePer={etichettePer}
          isAdmin={isAdmin}
          onSalva={nuove => save({ ...data, assegnazioni: nuove })}
          onShowToast={onShowToast}
          checkAdminPermission={checkAdminPermission}
          nome={numero => <NomeTerritorio numero={numero} />}
        />
        </div>
      )}

      {tab === 'territori' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        <div className="card">
          <div className="section-heading-row">
            <div>
              <h2 className="section-title">Archivio cartine</h2>
              <p className="section-description">
                {territori.length} {territori.length === 1 ? 'territorio' : 'territori'} in {SEZIONI.length} {SEZIONI.length === 1 ? 'sezione' : 'sezioni'}.
              </p>
            </div>
          </div>

          {isAdmin && (
            driveConfigurato() ? (
              <details className="mb-4 rounded-lg border border-slate-200 px-4 py-2.5">
                <summary className="cursor-pointer font-semibold text-slate-900">Aggiungi un territorio o carica una cartina</summary>
                <form onSubmit={aggiungiCartina} className="flex flex-wrap items-end gap-3 mt-3">
                  <div className="w-28">
                    <label className="lbl" htmlFor="cartina-numero">Numero</label>
                    <input id="cartina-numero" className="inp mt-1" placeholder="es. 95 o 35C" required
                      value={nuovaCartina.numero} onChange={e => setNuovaCartina(v => ({ ...v, numero: e.target.value }))} />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="lbl" htmlFor="cartina-nome">Nome</label>
                    <input id="cartina-nome" className="inp mt-1" placeholder="es. Commerciale Ribolla 4" required
                      value={nuovaCartina.nome} onChange={e => setNuovaCartina(v => ({ ...v, nome: e.target.value }))} />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="cartina-pdf">Cartina (PDF)</label>
                    <input id="cartina-pdf" name="pdf" type="file" accept="application/pdf" className="mt-1 block text-sm" required />
                  </div>
                  <button type="submit" className="btn-primary" disabled={!!caricando}>
                    <Upload className="w-4 h-4" /> {caricando ? 'Caricamento…' : 'Carica su Drive e aggiungi'}
                  </button>
                </form>
                <div className="mt-4">
                  <label className={`btn-ghost cursor-pointer ${caricando ? 'opacity-50 pointer-events-none' : ''}`}
                    // come per "Carica PDF": senza accesso il primo clic apre solo il popup di Google
                    onClick={e => {
                      if (driveAccesso()) return;
                      e.preventDefault();
                      accediDrive().then(() => onShowToast('Accesso a Google fatto: ora scegli i PDF.'),
                        err => onShowToast(err instanceof Error ? err.message : 'Accesso a Google non riuscito.'));
                    }}>
                    <Upload className="w-4 h-4" /> {caricando?.includes('/') ? `Caricamento ${caricando}…` : 'Carica più PDF insieme'}
                    <input type="file" accept="application/pdf" multiple className="sr-only"
                      onChange={e => { const f = [...(e.target.files ?? [])]; e.target.value = ''; caricaTutte(f); }} />
                  </label>
                  <p className="text-xs text-slate-500 mt-1">Numero e nome si leggono dal nome di ogni file, es. <code>territorio_12_Ribolla.pdf</code> o <code>12.pdf</code>.</p>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  La sezione si ricava dal nome, come per i file: "Commerciale …" e "… Rurale …" hanno la loro sezione, gli altri quella del paese.
                  Il PDF va nella cartella "Territori" del Drive della congregazione, visibile a chi ha il link.
                </p>
              </details>
            ) : (
              <p className="text-sm text-slate-600 mb-4">Per aggiungere territori dall'app configura Google Drive (VITE_GOOGLE_CLIENT_ID e VITE_DRIVE_ACCOUNT).</p>
            )
          )}

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
                            <col className="w-[160px]" />
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
                              const nota = data.note[t.numero];
                              const ind = indirizziPer(t.numero);
                              const nv = ind.filter(n => STATI_PERMANENTI.includes(n.stato)).length;
                              return (
                                <React.Fragment key={t.numero}>
                                  <tr id={'territorio-' + t.numero} className="scroll-mt-24">
                                    <td className="truncate">
                                      <span className="font-bold tabular-nums text-base">{t.numero}</span>
                                      {dettaglio && <span className="ml-2">{dettaglio}</span>}
                                      <div className="mt-0.5"><Chips etichette={etichettePer.get(t.numero)} /></div>
                                      {(isAdmin || nota || ind.length > 0) && (
                                        <button
                                          type="button"
                                          className="mt-1 text-xs text-slate-600 underline-offset-2 hover:underline"
                                          aria-expanded={dettagli === t.numero}
                                          onClick={() => setDettagli(dettagli === t.numero ? null : t.numero)}
                                        >
                                          {[nota && 'Note', ind.length && `${ind.length} ${ind.length === 1 ? 'indirizzo' : 'indirizzi'}`, nv && `${nv} da non visitare`]
                                            .filter(Boolean).join(' · ') || 'Note e indirizzi'}
                                        </button>
                                      )}
                                    </td>
                                    <td>
                                      <div className="flex flex-col items-start gap-1">
                                        <a className="btn-ghost" href={t.url} target="_blank" rel="noopener noreferrer" title={t.file}>
                                          <FileText className="w-4 h-4" /> Apri PDF
                                        </a>
                                        {isAdmin && driveConfigurato() && (
                                          <label className={`btn-ghost !min-h-0 !py-1 cursor-pointer ${caricando ? 'opacity-50 pointer-events-none' : ''}`}
                                            aria-label={`Carica PDF della cartina del territorio ${t.numero}`}
                                            // senza accesso, il primo clic apre solo il popup di Google: dopo la scelta del file verrebbe bloccato
                                            onClick={e => {
                                              if (driveAccesso()) return;
                                              e.preventDefault();
                                              accediDrive().then(() => onShowToast('Accesso a Google fatto: ora scegli il PDF.'),
                                                err => onShowToast(err instanceof Error ? err.message : 'Accesso a Google non riuscito.'));
                                            }}>
                                            <Upload className="w-4 h-4" /> {caricando === t.numero ? 'Caricamento…' : 'Carica PDF'}
                                            <input type="file" accept="application/pdf" className="sr-only"
                                              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; caricaCartina(t.numero, t.nome, f); }} />
                                          </label>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      {aperta ? (
                                        <div className="space-y-1">
                                          <p className="text-sm"><span className="font-semibold">{aperta.proclamatore || '---'}</span>, dal {dataIt(aperta.assegnato)}</p>
                                          <BarraScadenza assegnato={aperta.assegnato} numero={t.numero} mesi={mesi} />
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
                                          // impilati: affiancati non stanno nella colonna e vengono tagliati
                                          <div className="flex flex-col items-stretch gap-1.5">
                                            <button type="button" className="btn-ghost justify-center" onClick={() => segnaRientro(aperta)}>
                                              <Undo2 className="w-4 h-4" /> Segna rientro
                                            </button>
                                            <button type="button" className="btn-ghost justify-center" title="Restituito senza percorrerlo: non conta come lavorazione"
                                              onClick={() => window.confirm(`Il territorio ${t.numero} rientra senza essere stato percorso?`) && segnaRientro(aperta, true)}>
                                              Non percorso
                                            </button>
                                          </div>
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
                                  {dettagli === t.numero && (
                                    <tr>
                                      <td colSpan={colonne} className="!bg-slate-50">
                                        <div className="space-y-4 py-1 whitespace-normal">
                                          <button type="button" className="btn-ghost !min-h-0 !py-1" onClick={() => setSchedaStampa(t.numero)}>
                                            <Printer className="w-4 h-4" /> Stampa scheda del territorio
                                          </button>
                                          <div>
                                            <label className="lbl" htmlFor={'nota-' + t.numero}>Note e istruzioni per chi riceve il territorio</label>
                                            {isAdmin ? (
                                              <textarea id={'nota-' + t.numero} key={nota ?? ''} className="inp mt-1 min-h-[64px]" defaultValue={nota ?? ''}
                                                placeholder="es. Parcheggiare in piazza; citofoni non funzionanti in via Roma"
                                                onBlur={e => salvaNota(t.numero, e.target.value)} />
                                            ) : (
                                              <p id={'nota-' + t.numero} className="text-sm mt-1 whitespace-pre-line">{nota || 'Nessuna nota.'}</p>
                                            )}
                                          </div>
                                          <div>
                                            {isAdmin && driveConfigurato() && (
                                              <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
                                                <span className="lbl">Cartina PDF</span>
                                                <span className="text-slate-600">{t.aggiunta ? `caricata dall'app (${t.file})` : 'dal progetto'}</span>
                                                {t.aggiunta && (
                                                  <button type="button" className="btn-ghost !min-h-0 !py-1" onClick={() => rimuoviCartina(t.numero)}>
                                                    {CARTINE_FILE.some(c => c.numero === t.numero) ? 'Torna al PDF originale' : 'Togli dall\'archivio'}
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                            <h4 className="lbl">Indirizzi ({ind.length})</h4>
                                            {ind.length > 0 && (
                                              <ul className="mt-1 divide-y divide-slate-200 text-sm">
                                                {ind.map((n, i) => {
                                                  const ultima = n.visite[0];
                                                  const nuovaPorzione = (n.porzione || '') !== (ind[i - 1]?.porzione || '') || (i === 0 && n.porzione);
                                                  return (
                                                    <React.Fragment key={n.id}>
                                                    {nuovaPorzione && <li className="pt-3 pb-1 font-semibold text-slate-800">{n.porzione ? 'Porzione ' + n.porzione : 'Senza porzione'}</li>}
                                                    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                                                      <div className="flex-1 min-w-[200px]">
                                                        <span className="font-semibold">{n.indirizzo}</span>
                                                        <span className="text-slate-500"> · {TIPI_INDIRIZZO[n.tipo]}</span>
                                                        {n.nota && <p className="text-slate-600">{n.nota}</p>}
                                                        {ultima && (
                                                          <p className="text-xs text-slate-500">
                                                            Ultima visita {dataIt(ultima.data)}{ultima.proclamatore ? `, ${ultima.proclamatore}` : ''}: {STATI_INDIRIZZO[ultima.stato]}
                                                          </p>
                                                        )}
                                                        {n.visite.length > 1 && (
                                                          <details className="text-xs text-slate-600">
                                                            <summary className="cursor-pointer">Storico ({n.visite.length} visite)</summary>
                                                            <ul className="mt-1 space-y-0.5">
                                                              {n.visite.map((v, i) => (
                                                                <li key={i} className="tabular-nums">{dataIt(v.data)}{v.proclamatore ? `, ${v.proclamatore}` : ''}: {STATI_INDIRIZZO[v.stato]}</li>
                                                              ))}
                                                            </ul>
                                                          </details>
                                                        )}
                                                      </div>
                                                      {isAdmin ? (
                                                        <>
                                                          <select className="inp !min-h-0 !py-1 w-auto" aria-label={`Stato di ${n.indirizzo}`} value={n.stato}
                                                            onChange={e => aggiornaIndirizzo(n.id, x => registraVisita(x, e.target.value as StatoIndirizzo, oggi, aperta?.proclamatore))}>
                                                            {Object.entries(STATI_INDIRIZZO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                          </select>
                                                          <select className="inp !min-h-0 !py-1 w-auto" aria-label={`Tipo di ${n.indirizzo}`} value={n.tipo}
                                                            onChange={e => aggiornaIndirizzo(n.id, x => ({ ...x, tipo: e.target.value as TipoIndirizzo }))}>
                                                            {Object.entries(TIPI_INDIRIZZO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                          </select>
                                                          <input className="inp !min-h-0 !py-1 w-28" aria-label={`Porzione di ${n.indirizzo}`} placeholder="Porzione" key={n.porzione}
                                                            defaultValue={n.porzione} onBlur={e => e.target.value.trim() !== (n.porzione || '') && aggiornaIndirizzo(n.id, x => ({ ...x, porzione: e.target.value.trim() }))} />
                                                          <button type="button" className="btn-ghost !min-h-0 !py-1" onClick={() => spostaIndirizzo(n)}>Sposta</button>
                                                          <button type="button" className="icon-btn" onClick={() => eliminaIndirizzo(n)} title="Elimina indirizzo">
                                                            <Trash2 className="w-4 h-4" />
                                                            <span className="sr-only">Elimina {n.indirizzo}</span>
                                                          </button>
                                                        </>
                                                      ) : (
                                                        <span className={STATI_PERMANENTI.includes(n.stato) ? 'font-semibold text-rose-700' : 'text-slate-700'}>{STATI_INDIRIZZO[n.stato]}</span>
                                                      )}
                                                    </li>
                                                    </React.Fragment>
                                                  );
                                                })}
                                              </ul>
                                            )}
                                            {isAdmin && (
                                              <form onSubmit={aggiungiIndirizzo(t.numero)} className="flex flex-wrap items-end gap-2 mt-2">
                                                <input className="inp flex-1 min-w-[180px]" aria-label="Nuovo indirizzo" placeholder="Via e numero civico"
                                                  value={nuovoIndirizzo.indirizzo} onChange={e => setNuovoIndirizzo(v => ({ ...v, indirizzo: e.target.value }))} required />
                                                <select className="inp w-auto" aria-label="Tipo del nuovo indirizzo" value={nuovoIndirizzo.tipo}
                                                  onChange={e => setNuovoIndirizzo(v => ({ ...v, tipo: e.target.value as TipoIndirizzo }))}>
                                                  {Object.entries(TIPI_INDIRIZZO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                                <select className="inp w-auto" aria-label="Stato del nuovo indirizzo" value={nuovoIndirizzo.stato}
                                                  onChange={e => setNuovoIndirizzo(v => ({ ...v, stato: e.target.value as StatoIndirizzo }))}>
                                                  {Object.entries(STATI_INDIRIZZO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                                <input className="inp w-28" aria-label="Porzione del nuovo indirizzo" placeholder="Porzione"
                                                  value={nuovoIndirizzo.porzione} onChange={e => setNuovoIndirizzo(v => ({ ...v, porzione: e.target.value }))} />
                                                <input className="inp flex-1 min-w-[120px]" aria-label="Nota sull'indirizzo" placeholder="Nota (facoltativa)"
                                                  value={nuovoIndirizzo.nota} onChange={e => setNuovoIndirizzo(v => ({ ...v, nota: e.target.value }))} />
                                                <button type="submit" className="btn-ghost"><Plus className="w-4 h-4" /> Aggiungi</button>
                                              </form>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
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
                                            {(() => {
                                              const gia = aperte.filter(a => a.proclamatore.trim().toLowerCase() === assegnaNome.trim().toLowerCase());
                                              return assegnaNome.trim() && gia.length > 0 ? (
                                                <p className="text-xs text-amber-800 mt-1" role="status">
                                                  Ha già {gia.length === 1 ? 'il territorio' : `${gia.length} territori:`} {gia.map(a => a.numero).join(', ')}
                                                </p>
                                              ) : null;
                                            })()}
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
        </div>
      )}

      {tab === 'statistica' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        <StatisticaTerritori
          territori={territori}
          assegnazioni={assegnazioni}
          indirizzi={data.indirizzi}
          etichette={etichette}
          etichettePer={etichettePer}
          numeroProclamatori={proclamatori.length}
          nome={numero => <NomeTerritorio numero={numero} />}
        />

        <div className="card space-y-5">
          <div className="section-heading-row flex-wrap">
            <div>
              <h2 className="section-title">Tempo di lavorazione</h2>
              <p className="section-description">Giorni tra assegnazione e rientro. La linea segna la scadenza di {mesi} mesi.</p>
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
              { label: 'Tempo medio di lavorazione', value: lavorazione.mediaGiorni === null ? '—' : `${giorniTesto(lavorazione.mediaGiorni)} (${(lavorazione.mediaGiorni / 7).toLocaleString('it-IT', { maximumFractionDigits: 1 })} sett.)` },
              { label: `Rientrati entro ${mesi} mesi`, value: lavorazione.percentualeInTempo === null ? '—' : `${lavorazione.percentualeInTempo}%` },
              { label: 'Lavorazioni concluse', value: String(lavorazione.concluse) },
            ].map(m => (
              <div key={m.label} className="metric-card compact">
                <div className="metric-value">{m.value}</div>
                <div className="metric-label">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="table-wrapper overflow-x-auto">
            <table className="tbl max-w-xl">
              <caption className="text-left font-semibold text-slate-900 mb-2">Ultimi 6 mesi</caption>
              <thead>
                <tr><th>Mese</th><th className="text-right">Territori completati</th><th className="text-right">Proclamatori con un territorio</th></tr>
              </thead>
              <tbody>
                {mensili.map((m, i) => (
                  <tr key={m.mese}>
                    <td>
                      {new Date(m.mese + '-15T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                      {i === 0 && <span className="text-slate-500"> (in corso)</span>}
                    </td>
                    <td className="text-right tabular-nums">{m.completati}</td>
                    <td className="text-right tabular-nums">{m.partecipanti}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {copertura12.nonLavorati.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold text-slate-900">
                Non lavorati negli ultimi 12 mesi ({copertura12.nonLavorati.length})
              </summary>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {copertura12.nonLavorati.map(t => (
                  <li key={t.numero}><a className="hover:underline underline-offset-2" href={'#territorio-' + t.numero}><NomeTerritorio numero={t.numero} /></a></li>
                ))}
              </ul>
            </details>
          )}

          <div className="grid gap-8">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">Media per territorio, lavorazioni concluse</h3>
              {datiMedie.length ? (
                <GraficoGiorni dati={datiMedie} titolo="Tempo medio di lavorazione per territorio, in giorni" mesi={mesi} />
              ) : (
                <p className="text-sm text-slate-600 py-6">I tempi compaiono qui dal primo rientro registrato{sezioneGrafici ? ` in ${sezioneGrafici}` : ''}.</p>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">In lavorazione ora, giorni trascorsi</h3>
              {datiInCorso.length ? (
                <GraficoGiorni dati={datiInCorso} titolo="Giorni trascorsi dall'assegnazione per i territori in lavorazione" mesi={mesi} />
              ) : (
                <p className="text-sm text-slate-600 py-6">Nessun territorio in lavorazione{sezioneGrafici ? ` in ${sezioneGrafici}` : ''}. Assegnane uno dall'archivio.</p>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {tab === 'congregazione' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
          <CongregazioneTerritori
            mappa={data.congregazione}
            isAdmin={isAdmin}
            onSalva={congregazione => save({ ...data, congregazione })}
            onShowToast={onShowToast}
            checkAdminPermission={checkAdminPermission}
          />
        </div>
      )}

      {tab === 'etichette' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        {isAdmin && territori.length > 0 && (
          <details className="card" open>
            <summary className="cursor-pointer select-none">
              <h2 className="section-title inline-flex items-center gap-2"><Tag className="w-5 h-5" aria-hidden="true" /> Etichette</h2>
              <span className="ml-2 text-sm text-slate-600">{etichette.length} {etichette.length === 1 ? 'etichetta' : 'etichette'}</span>
            </summary>
            <p className="section-description mt-2">Raggruppa i territori (es. Commerciale, Campagna) per filtrarli nella lista dei disponibili. Scrivi i numeri separati da virgola.</p>
            <ul className="divide-y divide-slate-200 mt-3">
              {etichette.map(e => (
                <li key={e.id} className="flex flex-wrap items-end gap-3 py-2.5">
                  <input type="color" className="h-9 w-10 cursor-pointer rounded border border-slate-300" aria-label={`Colore dell'etichetta ${e.nome}`}
                    value={e.colore} onChange={ev => aggiornaEtichetta(e.id, { colore: ev.target.value })} />
                  <div className="w-44">
                    <label className="lbl" htmlFor={'etichetta-nome-' + e.id}>Nome</label>
                    <input id={'etichetta-nome-' + e.id} className="inp mt-1" defaultValue={e.nome}
                      onBlur={ev => { const nome = ev.target.value.trim(); if (nome && nome !== e.nome) aggiornaEtichetta(e.id, { nome }); else ev.target.value = e.nome; }} />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <label className="lbl" htmlFor={'etichetta-territori-' + e.id}>Territori ({e.territori.length})</label>
                    {/* key: dopo il salvataggio l'input riparte dai numeri normalizzati */}
                    <input id={'etichetta-territori-' + e.id} key={e.territori.join()} className="inp mt-1" defaultValue={e.territori.join(', ')} placeholder="es. 59, 60, 61"
                      onBlur={ev => impostaTerritoriEtichetta(e, ev.target.value)} />
                  </div>
                  <Chip e={e} />
                  <button type="button" className="btn-ghost" aria-label={`Elimina l'etichetta ${e.nome}`} onClick={() => eliminaEtichetta(e)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={aggiungiEtichetta} className="flex flex-wrap items-end gap-3 mt-3">
              <input type="color" className="h-9 w-10 cursor-pointer rounded border border-slate-300" aria-label="Colore della nuova etichetta"
                value={nuovoColore} onChange={ev => setNuovoColore(ev.target.value)} />
              <div className="w-56">
                <label className="lbl" htmlFor="nuova-etichetta">Nuova etichetta</label>
                <input id="nuova-etichetta" className="inp mt-1" value={nuovaEtichetta} onChange={ev => setNuovaEtichetta(ev.target.value)} placeholder="es. Campagna" required />
              </div>
              <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> Aggiungi</button>
            </form>
          </details>
        )}
        </div>
      )}

      {tab === 'impostazioni' && (
        <div role="tabpanel" id={"pannello-" + tab} aria-labelledby={"scheda-" + tab} className="space-y-6">
        {isAdmin && (
          <details className="card" open>
            <summary className="cursor-pointer select-none">
              <h2 className="section-title inline">Impostazioni territori</h2>
            </summary>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-3">
              <div>
                <label className="lbl" htmlFor="imp-mesi">Riconsegna entro (mesi)</label>
                <input id="imp-mesi" type="number" min={1} max={24} className="inp mt-1" value={impostazioni.mesiScadenza}
                  onChange={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 1 && v <= 24) aggiornaImpostazioni({ mesiScadenza: v }); }} />
              </div>
              <div>
                <label className="lbl" htmlFor="imp-max">Massimo territori per proclamatore</label>
                <input id="imp-max" type="number" min={0} max={20} className="inp mt-1" value={impostazioni.maxPerProclamatore}
                  onChange={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 0 && v <= 20) aggiornaImpostazioni({ maxPerProclamatore: v }); }} />
                <p className="text-xs text-slate-500 mt-1">0 = nessun limite. Oltre il limite chiede conferma.</p>
              </div>
              <div>
                <label className="lbl" htmlFor="imp-mostra">Disponibili da mostrare</label>
                <input id="imp-mostra" type="number" min={0} max={500} className="inp mt-1" value={impostazioni.mostraDisponibili}
                  onChange={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 0 && v <= 500) aggiornaImpostazioni({ mostraDisponibili: v }); }} />
                <p className="text-xs text-slate-500 mt-1">0 = tutti.</p>
              </div>
              <div>
                <label className="lbl" htmlFor="imp-etichetta">Etichetta predefinita nella lista</label>
                <select id="imp-etichetta" className="inp mt-1" value={impostazioni.etichettaPredefinita}
                  onChange={e => { aggiornaImpostazioni({ etichettaPredefinita: e.target.value }); setFiltroEtichette(e.target.value ? [e.target.value] : []); }}>
                  <option value="">Nessuna</option>
                  {etichette.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <label className="sm:col-span-2 lg:col-span-4 inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={impostazioni.azzeraStatiAlRientro} onChange={e => aggiornaImpostazioni({ azzeraStatiAlRientro: e.target.checked })} />
                Al rientro di un territorio azzera lo stato dei suoi indirizzi (restano "Non visitare" e "Non avvicinarsi"; lo storico delle visite si conserva)
              </label>
            </div>
          </details>
        )}
        </div>
      )}

    </section>
    </ArchivioCtx.Provider>
  );
};
