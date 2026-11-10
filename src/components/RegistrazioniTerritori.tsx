import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileUp, Plus, Trash2 } from 'lucide-react';
import { AssegnazioneTerritorio, EtichettaTerritorio } from '../types';
import { erroreRegistrazione, filtraPerEtichette, formatDay, importaRegistrazioni } from '../utils/territori';

interface RegistrazioniTerritoriProps {
  territori: { numero: string; nome: string }[];
  assegnazioni: AssegnazioneTerritorio[];
  etichette: EtichettaTerritorio[];
  etichettePer: Map<string, EtichettaTerritorio[]>;
  isAdmin: boolean;
  onSalva: (assegnazioni: AssegnazioneTerritorio[]) => void;
  onShowToast: (msg: string) => void;
  checkAdminPermission: () => boolean;
  nome: (numero: string) => React.ReactNode;
}

type Bozza = { id: string; numero: string; proclamatore: string; assegnato: string; rientro: string; etichetta: string; nonLavorato: boolean; nuova: boolean };

const dataBreve = (d?: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('it-IT') : '---');

// Storico delle assegnazioni come in un registro: una riga di schede per territorio (o per proclamatore), dalla più vecchia.
export const RegistrazioniTerritori: React.FC<RegistrazioniTerritoriProps> = props => {
  const { territori, assegnazioni, etichette, etichettePer, isAdmin, onSalva, onShowToast, checkAdminPermission, nome } = props;
  const oggi = formatDay(new Date());
  const [vista, setVista] = useState<'territori' | 'proclamatori'>('territori');
  const [cerca, setCerca] = useState('');
  const [etichettaTerritorio, setEtichettaTerritorio] = useState('');
  const [etichettaRegistrazione, setEtichettaRegistrazione] = useState('');
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [importo, setImporto] = useState<{ file: string; righe: Record<string, unknown>[] } | null>(null);
  const [modoImport, setModoImport] = useState<'aggiungi' | 'sostituisci'>('aggiungi');
  const anteprima = useMemo(
    () => importo && importaRegistrazioni(importo.righe, new Set(territori.map(t => t.numero)), assegnazioni, modoImport, oggi),
    [importo, territori, assegnazioni, modoImport, oggi],
  );

  const leggiExcel = async (file: File | undefined) => {
    if (!file || !checkAdminPermission()) return;
    try {
      const libro = XLSX.read(await file.arrayBuffer());
      const righe = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[libro.SheetNames[0]], { defval: '' });
      if (!righe.length) return onShowToast('Il foglio è vuoto.');
      setModoImport(assegnazioni.length ? 'aggiungi' : 'sostituisci');
      setImporto({ file: file.name, righe });
      setBozza(null);
    } catch {
      onShowToast('Il file non è un foglio Excel leggibile.');
    }
  };

  const confermaImport = () => {
    if (!anteprima || !checkAdminPermission()) return;
    if (modoImport === 'sostituisci' && assegnazioni.length
      && !window.confirm(`Le ${assegnazioni.length} registrazioni attuali saranno sostituite da ${anteprima.importate} registrazioni del file. Continuare?`)) return;
    onSalva(anteprima.assegnazioni);
    onShowToast(`${anteprima.importate} registrazioni importate${anteprima.scartate.length ? `, ${anteprima.scartate.length} scartate` : ''}.`);
    setImporto(null);
  };

  const etichetteRegistrazioni = useMemo(
    () => Array.from(new Set<string>(assegnazioni.map(a => a.etichetta ?? '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'it')),
    [assegnazioni],
  );
  const nomeDi = useMemo(() => new Map(territori.map(t => [t.numero, t.nome])), [territori]);
  const q = cerca.trim().toLowerCase();

  const registrazioni = useMemo(
    () => assegnazioni
      .filter(a => !etichettaRegistrazione || a.etichetta === etichettaRegistrazione)
      .filter(a => filtraPerEtichette((etichettePer.get(a.numero) ?? []).map(e => e.id), etichettaTerritorio ? [etichettaTerritorio] : []))
      .sort((a, b) => a.assegnato.localeCompare(b.assegnato)),
    [assegnazioni, etichettaRegistrazione, etichettaTerritorio, etichettePer],
  );

  const righeTerritori = territori
    .filter(t => filtraPerEtichette((etichettePer.get(t.numero) ?? []).map(e => e.id), etichettaTerritorio ? [etichettaTerritorio] : []))
    .map(t => ({ chiave: t.numero, titolo: nome(t.numero), schede: registrazioni.filter(a => a.numero === t.numero), testo: `${t.numero} ${t.nome}` }))
    .filter(r => !etichettaRegistrazione || r.schede.length)
    .filter(r => !q || r.testo.toLowerCase().includes(q) || r.schede.some(a => a.proclamatore.toLowerCase().includes(q)));

  const righeProclamatori = Array.from(new Set<string>(registrazioni.map(a => a.proclamatore).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'it'))
    .map(p => ({ chiave: p, titolo: <span className="font-semibold">{p}</span>, schede: registrazioni.filter(a => a.proclamatore === p), testo: p }))
    .filter(r => !q || r.testo.toLowerCase().includes(q) || r.schede.some(a => `${a.numero} ${nomeDi.get(a.numero) ?? ''}`.toLowerCase().includes(q)));

  const righe = vista === 'territori' ? righeTerritori : righeProclamatori;

  const apri = (a: AssegnazioneTerritorio) => {
    if (!isAdmin || !checkAdminPermission()) return;
    setBozza({ id: a.id, numero: a.numero, proclamatore: a.proclamatore, assegnato: a.assegnato, rientro: a.rientro ?? '', etichetta: a.etichetta ?? '', nonLavorato: !!a.nonLavorato, nuova: false });
  };
  const nuova = (numero: string) => {
    if (!checkAdminPermission()) return;
    setBozza({ id: crypto.randomUUID(), numero, proclamatore: '', assegnato: oggi, rientro: '', etichetta: '', nonLavorato: false, nuova: true });
  };

  const salva = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bozza || !checkAdminPermission()) return;
    const reg: AssegnazioneTerritorio = {
      id: bozza.id,
      numero: bozza.numero,
      proclamatore: bozza.proclamatore.trim(),
      assegnato: bozza.assegnato,
      ...(bozza.rientro ? { rientro: bozza.rientro } : {}),
      ...(bozza.rientro && bozza.nonLavorato ? { nonLavorato: true } : {}),
      ...(bozza.etichetta.trim() ? { etichetta: bozza.etichetta.trim() } : {}),
    };
    const errore = erroreRegistrazione(reg, assegnazioni, oggi);
    if (errore) return onShowToast(errore);
    // la registrazione si riscrive intera: i campi svuotati spariscono davvero
    onSalva(bozza.nuova ? [...assegnazioni, reg] : assegnazioni.map(a => (a.id === reg.id ? reg : a)));
    setBozza(null);
  };

  const elimina = () => {
    if (!bozza || !checkAdminPermission()) return;
    if (!window.confirm(`Eliminare questa registrazione del territorio ${bozza.numero}?`)) return;
    onSalva(assegnazioni.filter(a => a.id !== bozza.id));
    setBozza(null);
  };

  const scarica = () => {
    const righeFoglio = registrazioni.map(a => ({
      Territorio: a.numero,
      Nome: nomeDi.get(a.numero) ?? '',
      Proclamatore: a.proclamatore,
      Assegnato: a.assegnato,
      Rientro: a.rientro ?? '',
      'Non percorso': a.nonLavorato ? 'sì' : '',
      Etichetta: a.etichetta ?? '',
    }));
    const foglio = XLSX.utils.json_to_sheet(righeFoglio);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, foglio, 'Registrazioni');
    XLSX.writeFile(libro, `registrazioni-territori-${oggi}.xlsx`);
  };

  const scheda = (a: AssegnazioneTerritorio) => {
    const aperta = !a.rientro;
    const contenuto = (
      <>
        <span className="block truncate font-semibold">{vista === 'territori' ? (a.proclamatore || '---') : `${a.numero} ${nomeDi.get(a.numero) ?? ''}`}</span>
        <span className="block tabular-nums">{dataBreve(a.assegnato)}</span>
        <span className={`block tabular-nums ${aperta ? 'text-slate-500' : ''}`}>{dataBreve(a.rientro)}</span>
        {a.nonLavorato && <span className="block text-xs text-slate-600">non percorso</span>}
        {a.etichetta && <span className="mt-1 inline-block rounded bg-rose-700 px-1.5 py-0.5 text-xs font-semibold text-white">{a.etichetta}</span>}
      </>
    );
    const classi = `w-36 shrink-0 rounded-md border px-2 py-1.5 text-center text-sm ${aperta ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'} ${bozza?.id === a.id ? 'ring-2 ring-slate-800' : ''}`;
    return isAdmin ? (
      <button key={a.id} type="button" className={`${classi} hover:border-slate-500`} onClick={() => apri(a)}
        aria-label={`Modifica: territorio ${a.numero}, ${a.proclamatore || 'senza proclamatore'}, dal ${dataBreve(a.assegnato)}${a.rientro ? ' al ' + dataBreve(a.rientro) : ', in corso'}`}>
        {contenuto}
      </button>
    ) : (
      <div key={a.id} className={classi}>{contenuto}</div>
    );
  };

  return (
    <div className="card space-y-4">
      <div className="section-heading-row flex-wrap">
        <div>
          <h2 className="section-title">Registrazioni</h2>
          <p className="section-description">
            Tutte le assegnazioni, dalla più vecchia. In giallo quelle in corso.{isAdmin ? ' Clicca una scheda per modificarla, + per aggiungerne una.' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden" role="group" aria-label="Raggruppa per">
            {(['territori', 'proclamatori'] as const).map(v => (
              <button key={v} type="button" aria-pressed={vista === v} onClick={() => { setVista(v); setBozza(null); }}
                className={`px-3 py-1.5 text-sm ${vista === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                {v === 'territori' ? 'Territori' : 'Proclamatori'}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={scarica} disabled={!registrazioni.length}>
            <Download className="w-4 h-4" /> Excel
          </button>
          {isAdmin && (
            <label className="btn-ghost cursor-pointer">
              <FileUp className="w-4 h-4" /> Importa Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; leggiExcel(f); }} />
            </label>
          )}
        </div>
      </div>

      {importo && anteprima && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 space-y-3" role="region" aria-label="Anteprima dell'importazione">
          <p className="font-semibold text-slate-900">
            {importo.file}: {importo.righe.length} righe lette
          </p>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Cosa fare con le registrazioni attuali</legend>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="modo-import" checked={modoImport === 'aggiungi'} onChange={() => setModoImport('aggiungi')} />
              Aggiungi alle {assegnazioni.length} registrazioni attuali (salta le righe già presenti)
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="modo-import" checked={modoImport === 'sostituisci'} onChange={() => setModoImport('sostituisci')} />
              Sostituisci tutte le registrazioni
            </label>
          </fieldset>
          <ul className="text-sm text-slate-800 space-y-0.5">
            <li><strong className="tabular-nums">{anteprima.importate}</strong> da importare, di cui {anteprima.assegnazioni.filter(a => !a.rientro).length - (modoImport === 'aggiungi' ? assegnazioni.filter(a => !a.rientro).length : 0)} ancora fuori</li>
            {anteprima.doppioni > 0 && <li><strong className="tabular-nums">{anteprima.doppioni}</strong> già presenti, saltate</li>}
            {anteprima.scartate.length > 0 && (
              <li>
                <strong className="tabular-nums">{anteprima.scartate.length}</strong> scartate (correggile nel file o aggiungile a mano):
                <ul className="mt-1 ml-5 list-disc max-h-40 overflow-y-auto">
                  {anteprima.scartate.map(x => <li key={x.riga}>riga {x.riga}: {x.motivo}</li>)}
                </ul>
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={!anteprima.importate && modoImport === 'aggiungi'} onClick={confermaImport}>
              Importa {anteprima.importate} registrazioni
            </button>
            <button type="button" className="btn-ghost" onClick={() => setImporto(null)}>Annulla</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input type="search" className="inp flex-1 min-w-[200px]" placeholder="Cerca territorio o proclamatore" aria-label="Cerca nelle registrazioni"
          value={cerca} onChange={e => setCerca(e.target.value)} />
        {etichette.length > 0 && (
          <select className="inp w-auto" aria-label="Etichetta del territorio" value={etichettaTerritorio} onChange={e => setEtichettaTerritorio(e.target.value)}>
            <option value="">Tutti i territori</option>
            {etichette.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        )}
        {etichetteRegistrazioni.length > 0 && (
          <select className="inp w-auto" aria-label="Etichetta della registrazione" value={etichettaRegistrazione} onChange={e => setEtichettaRegistrazione(e.target.value)}>
            <option value="">Tutte le registrazioni</option>
            {etichetteRegistrazioni.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      <datalist id="registrazioni-etichette">
        {etichetteRegistrazioni.map(e => <option key={e} value={e} />)}
      </datalist>

      {righe.length === 0 ? (
        <p className="text-sm text-slate-600 py-4">Nessuna registrazione corrisponde ai filtri.</p>
      ) : (
        <ul className="divide-y divide-slate-200 max-h-[640px] overflow-y-auto">
          {righe.map(r => (
            <li key={r.chiave} className="py-2">
              <div className="flex items-stretch gap-2">
                <div className="w-40 shrink-0 py-1.5 text-sm">{r.titolo}</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {r.schede.map(scheda)}
                  {isAdmin && vista === 'territori' && (
                    <button type="button" className="w-12 shrink-0 rounded-md border border-dashed border-slate-300 text-slate-600 hover:border-slate-500"
                      onClick={() => nuova(r.chiave)} aria-label={`Aggiungi una registrazione al territorio ${r.chiave}`}>
                      <Plus className="w-5 h-5 mx-auto" />
                    </button>
                  )}
                </div>
              </div>
              {bozza && (vista === 'territori' ? bozza.numero === r.chiave : r.schede.some(a => a.id === bozza.id)) && (
                <form onSubmit={salva} className="mt-2 flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
                  <p className="w-full text-sm font-semibold text-slate-900">
                    {bozza.nuova ? 'Nuova registrazione' : 'Modifica registrazione'}, territorio {bozza.numero}
                  </p>
                  <div className="min-w-[200px] flex-1">
                    <label className="lbl" htmlFor="reg-proclamatore">Proclamatore</label>
                    <input id="reg-proclamatore" className="inp mt-1" list="territori-proclamatori" placeholder="Vuoto = nessuno (---)"
                      value={bozza.proclamatore} onChange={e => setBozza({ ...bozza, proclamatore: e.target.value })} autoFocus />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="reg-assegnato">Assegnato il</label>
                    <input id="reg-assegnato" type="date" className="inp mt-1" max={oggi} required
                      value={bozza.assegnato} onChange={e => setBozza({ ...bozza, assegnato: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="reg-rientro">Rientrato il</label>
                    <input id="reg-rientro" type="date" className="inp mt-1" min={bozza.assegnato} max={oggi}
                      value={bozza.rientro} onChange={e => setBozza({ ...bozza, rientro: e.target.value })} />
                  </div>
                  <div className="min-w-[160px]">
                    <label className="lbl" htmlFor="reg-etichetta">Etichetta</label>
                    <input id="reg-etichetta" className="inp mt-1" list="registrazioni-etichette" placeholder="es. Congresso campagna"
                      value={bozza.etichetta} onChange={e => setBozza({ ...bozza, etichetta: e.target.value })} />
                  </div>
                  {bozza.rientro && (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 pb-2">
                      <input type="checkbox" checked={bozza.nonLavorato} onChange={e => setBozza({ ...bozza, nonLavorato: e.target.checked })} />
                      Non percorso
                    </label>
                  )}
                  <button type="submit" className="btn-primary">Salva</button>
                  <button type="button" className="btn-ghost" onClick={() => setBozza(null)}>Annulla</button>
                  {!bozza.nuova && (
                    <button type="button" className="btn-ghost text-rose-700" onClick={elimina}>
                      <Trash2 className="w-4 h-4" /> Elimina
                    </button>
                  )}
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
