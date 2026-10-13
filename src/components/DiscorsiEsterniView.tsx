import React, { useMemo, useState } from 'react';
import { Trash2, UserPlus, ListChecks, Plus, Megaphone } from 'lucide-react';
import { StateData, DiscorsiEsterniData, OratoreEsterno, UscitaDiscorso } from '../types';
import { TITOLI_DISCORSI_PUBBLICI, numeroSchema } from '../data/titoliDiscorsiPubblici';
import { normalizeDiscorsiEsterni, ordinaUscite, conflittoUscita, giaPresentato, congregazioniUsate } from '../utils/discorsiEsterni';
import { formatDay } from '../utils/territori';
import { CalendarioUscite } from './CalendarioUscite';

interface DiscorsiEsterniViewProps {
  state: StateData;
  onSaveState: (state: StateData) => void;
  isAdmin: boolean;
  onShowToast: (msg: string) => void;
  checkAdminPermission: () => boolean;
}

const TITOLI: readonly string[] = TITOLI_DISCORSI_PUBBLICI;
// "5. Vero aiuto per la famiglia"; un titolo non più nell'S-99 resta senza numero.
const conNumero = (titolo: string) => (numeroSchema(titolo) ? `${numeroSchema(titolo)}. ${titolo}` : titolo);

const dataIt = (day: string) =>
  new Date(day + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const normalizzaRicerca = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[“”"’']/g, '');

// Elenco degli schemi con ricerca: le spunte sono gli schemi che l'oratore ha preparato.
const EditorSchemi: React.FC<{ oratore: OratoreEsterno; isAdmin: boolean; onChange: (schemi: string[]) => void }> = ({ oratore, isAdmin, onChange }) => {
  const [cerca, setCerca] = useState('');
  const [soloScelti, setSoloScelti] = useState(!isAdmin);
  const scelti = new Set(oratore.schemi);
  const q = normalizzaRicerca(cerca.trim());
  const visibili = TITOLI.filter(t => (!soloScelti || scelti.has(t)) && (!q || (/^\d+$/.test(q) ? String(numeroSchema(t)) === q : normalizzaRicerca(t).includes(q))));

  const toggle = (titolo: string) =>
    onChange(scelti.has(titolo) ? oratore.schemi.filter(s => s !== titolo) : TITOLI.filter(t => t === titolo || scelti.has(t)));

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <input
          className="inp !min-h-0 !py-1.5 flex-1 min-w-[200px]"
          type="search"
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          placeholder="Cerca per titolo o numero"
          aria-label={`Cerca tra gli schemi di ${oratore.nome}`}
        />
        <label className="chk">
          <input type="checkbox" checked={soloScelti} onChange={e => setSoloScelti(e.target.checked)} />
          Solo quelli preparati ({oratore.schemi.length})
        </label>
      </div>
      {visibili.length === 0 ? (
        <p className="text-sm text-slate-600 py-3">
          {soloScelti && !oratore.schemi.length ? 'Nessuno schema preparato.' : 'Nessun titolo corrisponde alla ricerca.'}
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {visibili.map(titolo => (
            <li key={titolo}>
              {isAdmin ? (
                <label className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 accent-sky-700" checked={scelti.has(titolo)} onChange={() => toggle(titolo)} />
                  <span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-slate-500">{numeroSchema(titolo)}</span>
                  <span className="text-sm">{titolo}</span>
                </label>
              ) : (
                <span className="flex gap-3 px-3 py-2 text-sm">
                  <span className="w-9 shrink-0 text-right font-bold tabular-nums text-slate-500">{numeroSchema(titolo)}</span>
                  {titolo}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const DiscorsiEsterniView: React.FC<DiscorsiEsterniViewProps> = ({ state, onSaveState, isAdmin, onShowToast, checkAdminPermission }) => {
  const data = useMemo(() => normalizeDiscorsiEsterni(state.discorsiEsterni), [state.discorsiEsterni]);
  const { oratori, uscite } = data;
  const oggi = formatDay(new Date());
  const { prossime, passate } = ordinaUscite(uscite, oggi);
  const congregazioni = useMemo(() => congregazioniUsate(uscite), [uscite]);

  const [nuovoOratore, setNuovoOratore] = useState('');
  const [aperto, setAperto] = useState<string | null>(null);
  const [form, setForm] = useState({ data: '', orario: '', oratore: '', titolo: '', congregazione: '' });

  const save = (next: DiscorsiEsterniData) => onSaveState({ ...state, discorsiEsterni: next });

  // Solo fratelli dall'anagrafica, non ancora nell'elenco.
  const candidati = state.people
    .filter(p => p.gender === 'M' && !oratori.some(o => o.personId ? o.personId === p.id : o.nome === p.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const schemiOratore = oratori.find(o => o.nome === form.oratore)?.schemi || [];

  const aggiungiOratore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkAdminPermission()) return;
    const persona = state.people.find(p => p.id === nuovoOratore);
    if (!persona) return;
    save({ ...data, oratori: [...oratori, { personId: persona.id, nome: persona.name, schemi: [] }].sort((a, b) => a.nome.localeCompare(b.nome, 'it')) });
    setNuovoOratore('');
    setAperto(persona.name);
    onShowToast(`${persona.name} aggiunto agli oratori. Ora spunta gli schemi che ha preparato.`);
  };

  const aggiornaSchemi = (nome: string, schemi: string[]) => {
    if (!checkAdminPermission()) return;
    save({ ...data, oratori: oratori.map(o => (o.nome === nome ? { ...o, schemi } : o)) });
  };

  const rimuoviOratore = (o: OratoreEsterno) => {
    if (!checkAdminPermission()) return;
    const future = prossime.filter(u => u.oratore === o.nome).length;
    const avviso = future ? ` Ha ancora ${future} ${future === 1 ? 'uscita programmata' : 'uscite programmate'}, che restano nel programma.` : '';
    if (!window.confirm(`Togliere ${o.nome} dagli oratori?${avviso}`)) return;
    save({ ...data, oratori: oratori.filter(x => x.nome !== o.nome) });
  };

  const aggiungiUscita = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkAdminPermission()) return;
    const uscita: UscitaDiscorso = { id: crypto.randomUUID(), ...form, congregazione: form.congregazione.trim() };
    if (!uscita.data || !uscita.orario || !uscita.oratore || !uscita.titolo || !uscita.congregazione) return onShowToast('Compila data, orario, oratore, schema e congregazione.');
    const conflitto = conflittoUscita(uscite, uscita);
    if (conflitto) return onShowToast(`${uscita.oratore} è già a ${conflitto.congregazione} il ${dataIt(conflitto.data)}.`);
    const prima = giaPresentato(uscite, uscita);
    if (prima && !window.confirm(`${uscita.oratore} ha già portato questo schema a ${prima.congregazione} il ${dataIt(prima.data)}. Programmarlo di nuovo?`)) return;
    save({ ...data, uscite: [...uscite, uscita] });
    setForm({ data: '', orario: uscita.orario || '', oratore: uscita.oratore, titolo: '', congregazione: '' });
    onShowToast(`Uscita di ${uscita.oratore} a ${uscita.congregazione} aggiunta.`);
  };

  const aggiornaUscita = (id: string, patch: Partial<UscitaDiscorso>) => {
    if (!checkAdminPermission()) return;
    save({ ...data, uscite: uscite.map(u => (u.id === id ? { ...u, ...patch } : u)) });
  };

  const eliminaUscita = (u: UscitaDiscorso) => {
    if (!checkAdminPermission()) return;
    if (!window.confirm(`Eliminare l'uscita di ${u.oratore} a ${u.congregazione} del ${dataIt(u.data)}?`)) return;
    save({ ...data, uscite: uscite.filter(x => x.id !== u.id) });
  };

  const tabellaUscite = (righe: UscitaDiscorso[]) => (
    <div className="table-wrapper overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Data</th>
            <th>Orario</th>
            <th>Oratore</th>
            <th>Schema</th>
            <th>Congregazione</th>
            {isAdmin && <th><span className="sr-only">Azioni</span></th>}
          </tr>
        </thead>
        <tbody>
          {righe.map(u => (
            <tr key={u.id}>
              <td className="whitespace-nowrap font-semibold">{dataIt(u.data)}</td>
              <td className="whitespace-nowrap">
                {isAdmin ? (
                  <input
                    type="time"
                    className="inp !min-h-0 !py-1 w-[110px]"
                    value={u.orario || ''}
                    aria-label={`Orario dell'uscita del ${dataIt(u.data)}`}
                    onChange={e => aggiornaUscita(u.id, { orario: e.target.value || undefined })}
                  />
                ) : u.orario || <span className="text-slate-500">da definire</span>}
              </td>
              <td className="whitespace-nowrap">{u.oratore}</td>
              <td className="min-w-[240px]">{conNumero(u.titolo)}</td>
              <td className="whitespace-nowrap">{u.congregazione}</td>
              {isAdmin && (
                <td className="text-right">
                  <button type="button" className="icon-btn" onClick={() => eliminaUscita(u)} title="Elimina uscita">
                    <Trash2 className="w-4 h-4" />
                    <span className="sr-only">Elimina l'uscita di {u.oratore} del {dataIt(u.data)}</span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Discorsi esterni</h1>
          <p className="page-description">Gli oratori della congregazione, gli schemi che hanno preparato e le uscite nelle altre congregazioni.</p>
        </div>
      </div>

      <CalendarioUscite uscite={uscite} oggi={oggi} />

      <div className="card">
        <div className="section-heading-row flex-wrap">
          <div>
            <h2 className="section-title">Oratori</h2>
            <p className="section-description">{oratori.length} {oratori.length === 1 ? 'oratore' : 'oratori'}. Apri gli schemi per vedere o spuntare quelli preparati.</p>
          </div>
          {isAdmin && (
            <form onSubmit={aggiungiOratore} className="flex items-end gap-2">
              <div>
                <label className="lbl" htmlFor="nuovo-oratore">Aggiungi da Persone</label>
                <select id="nuovo-oratore" className="inp mt-1 min-w-[220px]" value={nuovoOratore} onChange={e => setNuovoOratore(e.target.value)}>
                  <option value="">{candidati.length ? 'Scegli un fratello…' : 'Nessun altro fratello in Persone'}</option>
                  {candidati.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary" disabled={!nuovoOratore}>
                <UserPlus className="w-4 h-4" /> Aggiungi
              </button>
            </form>
          )}
        </div>

        {oratori.length === 0 ? (
          <p className="text-sm text-slate-600 py-6">
            Nessun oratore. {isAdmin ? 'Scegli dall\'elenco Persone i fratelli che tengono discorsi fuori.' : 'Un amministratore deve aggiungere gli oratori.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {oratori.map(o => {
              const prossima = prossime.find(u => u.oratore === o.nome);
              return (
                <li key={o.nome} className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-semibold text-slate-900">{o.nome}</p>
                      <p className="text-sm text-slate-600">
                        {o.schemi.length} {o.schemi.length === 1 ? 'schema preparato' : 'schemi preparati'}
                        {prossima ? `, prossima uscita ${dataIt(prossima.data)} a ${prossima.congregazione}` : ''}
                      </p>
                    </div>
                    <button type="button" className="btn-ghost" aria-expanded={aperto === o.nome} onClick={() => setAperto(aperto === o.nome ? null : o.nome)}>
                      <ListChecks className="w-4 h-4" /> {aperto === o.nome ? 'Chiudi schemi' : 'Schemi'}
                    </button>
                    {isAdmin && (
                      <button type="button" className="icon-btn" onClick={() => rimuoviOratore(o)} title={`Togli ${o.nome} dagli oratori`}>
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Togli {o.nome} dagli oratori</span>
                      </button>
                    )}
                  </div>
                  {aperto === o.nome && <EditorSchemi oratore={o} isAdmin={isAdmin} onChange={schemi => aggiornaSchemi(o.nome, schemi)} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isAdmin && oratori.length > 0 && (
        <form onSubmit={aggiungiUscita} className="card grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_120px_190px_1fr_200px_auto] xl:items-end">
          <h2 className="card-title md:col-span-2 xl:col-span-6">Programma un'uscita</h2>
          <div>
            <label className="lbl" htmlFor="uscita-data">Data</label>
            <input id="uscita-data" type="date" className="inp mt-1" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required />
          </div>
          <div>
            <label className="lbl" htmlFor="uscita-orario">Orario</label>
            <input id="uscita-orario" type="time" className="inp mt-1" value={form.orario} onChange={e => setForm({ ...form, orario: e.target.value })} required />
          </div>
          <div>
            <label className="lbl" htmlFor="uscita-oratore">Oratore</label>
            <select id="uscita-oratore" className="inp mt-1" value={form.oratore} onChange={e => setForm({ ...form, oratore: e.target.value, titolo: '' })} required>
              <option value="">Scegli…</option>
              {oratori.map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className="lbl" htmlFor="uscita-schema">Schema</label>
            <select id="uscita-schema" className="inp mt-1" value={form.titolo} onChange={e => setForm({ ...form, titolo: e.target.value })} disabled={!schemiOratore.length} required>
              <option value="">
                {!form.oratore ? 'Prima scegli l\'oratore' : schemiOratore.length ? 'Scegli lo schema…' : 'Nessuno schema preparato'}
              </option>
              {schemiOratore.map(t => <option key={t} value={t}>{conNumero(t)}</option>)}
            </select>
            {form.oratore && !schemiOratore.length && (
              <button type="button" className="mt-1 text-xs text-sky-700 underline" onClick={() => setAperto(form.oratore)}>
                Spunta gli schemi di {form.oratore}
              </button>
            )}
          </div>
          <div>
            <label className="lbl" htmlFor="uscita-congregazione">Congregazione</label>
            <input id="uscita-congregazione" className="inp mt-1" list="congregazioni-uscite" value={form.congregazione} onChange={e => setForm({ ...form, congregazione: e.target.value })} placeholder="Es. Grosseto Nord" required />
            <datalist id="congregazioni-uscite">
              {congregazioni.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> Aggiungi uscita</button>
        </form>
      )}

      <div className="card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Prossime uscite</h2>
            <p className="section-description">In ordine di data, a partire da oggi.</p>
          </div>
        </div>
        {prossime.length === 0 ? (
          <p className="text-sm text-slate-600 py-6 flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Nessuna uscita programmata.
          </p>
        ) : tabellaUscite(prossime)}
      </div>

      {passate.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer select-none">
            <span className="section-title">Storico</span>
            <span className="ml-2 text-sm text-slate-600">{passate.length} {passate.length === 1 ? 'uscita passata' : 'uscite passate'}</span>
          </summary>
          <div className="mt-4">{tabellaUscite(passate)}</div>
        </details>
      )}
    </section>
  );
};
