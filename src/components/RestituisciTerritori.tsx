import React, { useMemo, useState } from 'react';
import { CheckSquare, Copy, Undo2 } from 'lucide-react';
import { AssegnazioneTerritorio, EtichettaTerritorio } from '../types';
import { formatDay, giorniTra, rientratiDiRecente, statoScadenza } from '../utils/territori';

interface RestituisciTerritoriProps {
  assegnazioni: AssegnazioneTerritorio[];
  nomeDi: (numero: string) => string;
  etichettePer: Map<string, EtichettaTerritorio[]>;
  mesi: number;
  isAdmin: boolean;
  onRestituisci: (ids: string[], rientro: string, nonLavorato: boolean) => void;
  onAnnullaRientro: (a: AssegnazioneTerritorio) => void;
  onShowToast: (msg: string) => void;
  nome: (numero: string) => React.ReactNode;
  chips: (numero: string) => React.ReactNode;
}

const GIORNI_RECENTI = [7, 14, 30, 60];
const dataBreve = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT');
const fa = (giorni: number) => (giorni === 0 ? 'oggi' : giorni === 1 ? 'ieri' : `${giorni} giorni fa`);
const mesiFa = (giorni: number) => `${(giorni / 30.44).toLocaleString('it-IT', { maximumFractionDigits: 1 })} mesi fa`;

// Riconsegna: a sinistra i territori fuori (anche più insieme), a destra quelli rientrati di recente.
export const RestituisciTerritori: React.FC<RestituisciTerritoriProps> = props => {
  const { assegnazioni, nomeDi, etichettePer, mesi, isAdmin, onRestituisci, onAnnullaRientro, onShowToast, nome, chips } = props;
  const oggi = formatDay(new Date());
  const [cerca, setCerca] = useState('');
  const [cercaRecenti, setCercaRecenti] = useState('');
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [dataRientro, setDataRientro] = useState(oggi);
  const [giorniRecenti, setGiorniRecenti] = useState(7);

  const corrisponde = (a: AssegnazioneTerritorio, testo: string) => {
    const q = testo.trim().toLowerCase();
    return !q || `${a.numero} ${nomeDi(a.numero)} ${a.proclamatore} ${(etichettePer.get(a.numero) ?? []).map(e => e.nome).join(' ')}`.toLowerCase().includes(q);
  };

  const fuori = useMemo(
    () => assegnazioni.filter(a => !a.rientro).sort((a, b) => a.assegnato.localeCompare(b.assegnato)),
    [assegnazioni],
  );
  const visibili = fuori.filter(a => corrisponde(a, cerca));
  const recenti = rientratiDiRecente(assegnazioni, oggi, giorniRecenti).filter(a => corrisponde(a, cercaRecenti));
  const sceltiVisibili = visibili.filter(a => scelti.has(a.id));
  const tuttiScelti = visibili.length > 0 && sceltiVisibili.length === visibili.length;

  const alterna = (id: string) => setScelti(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const restituisci = (nonLavorato: boolean) => {
    if (!sceltiVisibili.length) return;
    const testo = `${sceltiVisibili.length === 1 ? 'il territorio' : sceltiVisibili.length + ' territori'} con rientro il ${dataBreve(dataRientro)}${nonLavorato ? ', come non percorsi' : ''}`;
    if (!window.confirm(`Registrare ${testo}?`)) return;
    onRestituisci(sceltiVisibili.map(a => a.id), dataRientro, nonLavorato);
    setScelti(new Set());
  };

  // Testo pronto da incollare (WhatsApp, email): un promemoria per chi ha territori scaduti o in scadenza.
  const promemoria = async () => {
    const perPersona = new Map<string, string[]>();
    for (const a of fuori) {
      const s = statoScadenza(a.assegnato, oggi, mesi);
      if (s.livello === 'regolare' || !a.proclamatore) continue;
      const riga = `territorio ${a.numero} ${nomeDi(a.numero)}: ${s.livello === 'scaduto' ? `da riconsegnare dal ${dataBreve(s.scadenza)}` : `da riconsegnare entro il ${dataBreve(s.scadenza)}`}`;
      perPersona.set(a.proclamatore, [...(perPersona.get(a.proclamatore) ?? []), riga]);
    }
    if (!perPersona.size) return onShowToast('Nessun territorio scaduto o in scadenza.');
    const testo = [...perPersona].map(([chi, righe]) => `${chi}\n${righe.map(r => '- ' + r).join('\n')}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(`Promemoria territori\n\n${testo}`);
      onShowToast(`Promemoria per ${perPersona.size} ${perPersona.size === 1 ? 'proclamatore' : 'proclamatori'} copiato: incollalo dove vuoi.`);
    } catch {
      onShowToast('Il browser non ha permesso di copiare il testo.');
    }
  };

  return (
    <div className="card space-y-4">
      <div className="section-heading-row flex-wrap">
        <div>
          <h2 className="section-title">Restituisci</h2>
          <p className="section-description">I territori fuori, dal più vecchio. In rosso gli scaduti, in giallo quelli in scadenza.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={promemoria}>
          <Copy className="w-4 h-4" /> Copia promemoria
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="ritiro-titolo" className="min-w-0">
          <h3 id="ritiro-titolo" className="font-semibold text-slate-900">Disponibili per il ritiro ({fuori.length})</h3>
          <input type="search" className="inp mt-2" placeholder="Cerca territorio, proclamatore o etichetta" aria-label="Cerca tra i territori fuori"
            value={cerca} onChange={e => setCerca(e.target.value)} />
          {isAdmin && visibili.length > 0 && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 pb-2">
                <input type="checkbox" checked={tuttiScelti}
                  onChange={() => setScelti(tuttiScelti ? new Set() : new Set(visibili.map(a => a.id)))} />
                Tutti ({visibili.length})
              </label>
              <div>
                <label className="lbl" htmlFor="rientro-data">Data di rientro</label>
                <input id="rientro-data" type="date" className="inp mt-1 !min-h-0 !py-1" max={oggi} value={dataRientro}
                  onChange={e => setDataRientro(e.target.value || oggi)} />
              </div>
              <button type="button" className="btn-primary" disabled={!sceltiVisibili.length} onClick={() => restituisci(false)}>
                <CheckSquare className="w-4 h-4" /> Restituisci ({sceltiVisibili.length})
              </button>
              <button type="button" className="btn-ghost" disabled={!sceltiVisibili.length} onClick={() => restituisci(true)}>
                Non percorsi
              </button>
            </div>
          )}
          {visibili.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">{cerca ? 'Nessun territorio fuori corrisponde alla ricerca.' : 'Nessun territorio è fuori.'}</p>
          ) : (
            <ul className="mt-2 space-y-2 max-h-[560px] overflow-y-auto">
              {visibili.map(a => {
                const s = statoScadenza(a.assegnato, oggi, mesi);
                const sfondo = s.livello === 'scaduto' ? 'bg-rose-50 border-rose-200' : s.livello === 'vicino' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
                const contenuto = (
                  <>
                    <div className="flex-1 min-w-[180px]">
                      <p>{nome(a.numero)} {chips(a.numero)}</p>
                      <p className="text-slate-700">Assegnato a <span className="font-semibold">{a.proclamatore || '---'}</span></p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p>Assegnato il {dataBreve(a.assegnato)} <span className="text-slate-500">({mesiFa(giorniTra(a.assegnato, oggi))})</span></p>
                      <p className={s.livello === 'scaduto' ? 'font-semibold text-rose-800' : ''}>
                        Riconsegnare entro il {dataBreve(s.scadenza)}{' '}
                        <span className={s.livello === 'scaduto' ? '' : 'text-slate-500'}>
                          ({s.giorniRimasti < 0 ? fa(-s.giorniRimasti) : s.giorniRimasti === 0 ? 'oggi' : `tra ${s.giorniRimasti} giorni`})
                        </span>
                      </p>
                    </div>
                  </>
                );
                return (
                  <li key={a.id} className={`rounded-md border px-3 py-2 text-sm ${sfondo}`}>
                    {isAdmin ? (
                      <label className="flex flex-wrap items-start gap-x-3 gap-y-1 cursor-pointer">
                        <input type="checkbox" className="mt-1" checked={scelti.has(a.id)} onChange={() => alterna(a.id)}
                          aria-label={`Seleziona il territorio ${a.numero}`} />
                        {contenuto}
                      </label>
                    ) : (
                      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">{contenuto}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="recenti-titolo" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="recenti-titolo" className="font-semibold text-slate-900">Riconsegnati di recente ({recenti.length})</h3>
            <select className="inp w-auto !min-h-0 !py-1" aria-label="Periodo dei rientri recenti" value={giorniRecenti}
              onChange={e => setGiorniRecenti(Number(e.target.value))}>
              {GIORNI_RECENTI.map(g => <option key={g} value={g}>Ultimi {g} giorni</option>)}
            </select>
          </div>
          <input type="search" className="inp mt-2" placeholder="Cerca territorio, proclamatore o etichetta" aria-label="Cerca tra i rientri recenti"
            value={cercaRecenti} onChange={e => setCercaRecenti(e.target.value)} />
          {recenti.length === 0 ? (
            <p className="text-sm text-slate-600 py-4">Nessun rientro negli ultimi {giorniRecenti} giorni{cercaRecenti ? ' che corrisponda alla ricerca' : ''}.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 max-h-[560px] overflow-y-auto">
              {recenti.map(a => (
                <li key={a.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm">
                  <div className="flex-1 min-w-[180px]">
                    <p>{nome(a.numero)} {chips(a.numero)}</p>
                    <p className="text-slate-700">Restituito da <span className="font-semibold">{a.proclamatore || '---'}</span>{a.nonLavorato ? ', non percorso' : ''}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p>{dataBreve(a.rientro!)}</p>
                    <p className="text-slate-500">{fa(giorniTra(a.rientro!, oggi))}</p>
                  </div>
                  {isAdmin && (
                    <button type="button" className="btn-ghost !min-h-0 !py-1" onClick={() => onAnnullaRientro(a)}
                      title="Il territorio torna fuori, assegnato alla stessa persona">
                      <Undo2 className="w-4 h-4" /> Annulla
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
