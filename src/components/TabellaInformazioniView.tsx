import React, { useEffect, useState } from 'react';
import { ArrowRight, Video, Link2, FileUp, Trash2, FileText, ExternalLink, CloudUpload } from 'lucide-react';
import type { SectionKey } from './ModernSectionHub';
import type { TabellaAllegato } from '../types';
import { apriAllegato, caricaAllegato } from '../lib/allegati';
import { ACCOUNT_DRIVE, precaricaDrive } from '../lib/drive';

// Riproduce la "Tabella Informazioni" stampata (design/00 - Tabella Informazioni - novembre.pdf):
// ogni riquadro apre il programma corrispondente; quelli senza sezione aprono un link o un PDF scelto dall'amministratore.

interface TabellaInformazioniViewProps {
  onSelectSection: (section: SectionKey) => void;
  visibile: (sezione: string) => boolean;
  allegati: Record<string, TabellaAllegato>;
  isAdmin: boolean;
  onSalvaAllegato: (chiave: string, allegato: TabellaAllegato | null) => void;
  onErrore: (messaggio: string) => void;
  onApriPdf: (sezione: SectionKey, titolo: string) => Promise<void>; // PDF del programma del mese in corso
  onSalvaDrive?: () => Promise<void>; // assente: pulsante nascosto (non amministratori, PDF della tabella)
}

export type Voce = { titolo: string; img: string; sezione?: SectionKey };

const PROGRAMMI_MESE: Voce[] = [
  { titolo: 'Adunanza Infrasettimanale', img: 'infrasettimanale', sezione: 'vitaEMinistero' },
  { titolo: 'Adunanza del fine settimana', img: 'fine-settimana', sezione: 'domenica' },
  { titolo: 'Programma incarichi settimanali', img: 'incarichi-settimanali', sezione: 'mensile' },
  { titolo: 'Adunanze per il servizio di campo', img: 'servizio-campo', sezione: 'servizioCampo' },
  { titolo: 'Programma opera pubblica', img: 'opera-pubblica', sezione: 'operaPubblica' },
];

const GRUPPI_DESTRA: { titolo: string; voci: [Voce, Voce] }[] = [
  {
    titolo: 'Attività da svolgere oltre alle pulizie settimanali e schede pulizie:',
    voci: [
      { titolo: 'Programma pulizie', img: 'programma-pulizie', sezione: 'mensile' },
      { titolo: 'Schede Pulizie', img: 'schede-pulizie' },
    ],
  },
  {
    titolo: 'Lettere e Comunicazioni:',
    voci: [
      { titolo: 'Comunicazioni', img: 'comunicazioni' },
      { titolo: 'Nuove pubblicazioni', img: 'nuove-pubblicazioni' },
    ],
  },
  {
    titolo: '',
    voci: [
      { titolo: 'Prospetto dei conti', img: 'prospetto-conti' },
      { titolo: 'Piano di Emergenza', img: 'piano-emergenza' },
    ],
  },
  {
    titolo: 'Incarichi di congregazione:',
    voci: [
      { titolo: 'Incarichi', img: 'incarichi' },
      { titolo: 'Gruppi di servizio', img: 'gruppi-servizio' },
    ],
  },
];

// Tutti i riquadri: per i link cliccabili del PDF salvato su Drive.
export const VOCI_TABELLA: Voce[] = [...PROGRAMMI_MESE, ...GRUPPI_DESTRA.flatMap(g => g.voci)];

// Dati del modello stampato di novembre.
export const ZOOM = {
  url: 'https://us02web.zoom.us/j/3929101055?pwd=cHRxemhMNlVzODFydTBTOFo5eXpEUT09&omn=84475027017',
  id: '392 910 1055',
  codice: '111222',
};

const titoloGruppo = 'font-bold italic text-[#7b3fb5] dark:text-violet-300 text-lg sm:text-xl text-center';

export const TabellaInformazioniView: React.FC<TabellaInformazioniViewProps> = ({ onSelectSection, visibile, allegati, isAdmin, onSalvaAllegato, onErrore, onApriPdf, onSalvaDrive }) => {
  const [inCaricamento, setInCaricamento] = useState<string | null>(null);
  const [salvataggioDrive, setSalvataggioDrive] = useState(false);

  useEffect(() => { if (onSalvaDrive) precaricaDrive().catch(() => {}); }, [!!onSalvaDrive]);

  const salvaDrive = () => {
    if (!onSalvaDrive) return;
    setSalvataggioDrive(true);
    onSalvaDrive().finally(() => setSalvataggioDrive(false));
  };

  const apri = (voce: Voce) => {
    const a = allegati[voce.img];
    if (voce.sezione) {
      setInCaricamento(voce.img);
      onApriPdf(voce.sezione, voce.titolo).finally(() => setInCaricamento(null));
    } else if (a?.fileId) apriAllegato(a.fileId).catch(err => onErrore(err.message || 'Impossibile aprire il PDF.'));
    else if (a?.url) window.open(a.url, '_blank', 'noopener,noreferrer');
  };

  const impostaLink = (voce: Voce) => {
    const url = window.prompt(`Link per "${voce.titolo}":`, allegati[voce.img]?.url || 'https://')?.trim();
    if (!url) return;
    if (!/^https?:\/\/\S+$/i.test(url)) { onErrore('Il link deve iniziare con http:// o https://'); return; }
    onSalvaAllegato(voce.img, { url });
  };

  const caricaPdf = async (voce: Voce, file: File | undefined) => {
    if (!file) return;
    setInCaricamento(voce.img);
    try {
      onSalvaAllegato(voce.img, { fileId: await caricaAllegato(file), nome: file.name });
    } catch (err: any) {
      onErrore(err?.message || 'Caricamento del PDF non riuscito.');
    } finally {
      setInCaricamento(null);
    }
  };

  const Riquadro: React.FC<{ voce: Voce; grande?: boolean }> = ({ voce, grande }) => {
    const allegato = voce.sezione ? undefined : allegati[voce.img];
    const collegato = voce.sezione ? visibile(voce.sezione) : !!(allegato?.url || allegato?.fileId);
    const caricando = inCaricamento === voce.img;
    const etichetta = voce.sezione ? (caricando ? 'Preparazione PDF…' : 'Apri PDF del mese') : allegato?.fileId ? (allegato.nome || 'Apri PDF') : 'Apri link';
    const contenuto = (
      <>
        <span className="block font-bold italic text-slate-900 dark:text-slate-100 text-sm sm:text-base">{voce.titolo}</span>
        <img
          src={`/tabella/${voce.img}.jpg`}
          alt=""
          className={`mx-auto mt-2 rounded-md object-contain bg-[#fdebd0] ${grande ? 'w-full max-w-[260px] aspect-[4/3]' : 'w-full max-w-[200px] aspect-[4/3]'} ${collegato ? 'transition group-hover:scale-[1.03]' : 'opacity-60'}`}
        />
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs no-print max-w-full">
          {collegato ? (
            <span className="text-[#0b5563] dark:text-teal-300 font-semibold inline-flex items-center gap-1 min-w-0">
              {voce.sezione || allegato?.fileId ? <FileText className="w-3 h-3 shrink-0" /> : <ExternalLink className="w-3 h-3 shrink-0" />}
              <span className="truncate">{etichetta}</span>
            </span>
          ) : <span className="text-slate-400 italic">Non ancora collegato</span>}
        </span>
      </>
    );
    return (
      <div data-pdf-link={voce.img}>
        {collegato ? (
          <button
            type="button"
            onClick={() => apri(voce)}
            disabled={caricando}
            aria-busy={caricando}
            className="group block w-full text-center rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7b3fb5]"
            aria-label={voce.sezione ? `Apri il PDF di ${voce.titolo}` : `Apri ${voce.titolo}`}
          >
            {contenuto}
          </button>
        ) : (
          <div className="block w-full text-center p-2" aria-disabled="true">{contenuto}</div>
        )}
        {collegato && voce.sezione && (
          <button type="button" className="mx-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 no-print"
            onClick={() => onSelectSection(voce.sezione!)}>
            Vai alla sezione <ArrowRight className="w-3 h-3" />
          </button>
        )}
        {isAdmin && !voce.sezione && (
          <div className="flex justify-center gap-1 no-print">
            <button type="button" className="icon-button" title="Imposta link" aria-label={`Imposta link per ${voce.titolo}`} onClick={() => impostaLink(voce)}>
              <Link2 className="w-4 h-4" />
            </button>
            <label className={`icon-button cursor-pointer ${caricando ? 'opacity-50 pointer-events-none' : ''}`} title={caricando ? 'Caricamento…' : 'Carica PDF'}>
              <FileUp className="w-4 h-4" />
              <span className="sr-only">Carica PDF per {voce.titolo}</span>
              <input type="file" accept="application/pdf" className="hidden" disabled={caricando}
                onChange={e => { caricaPdf(voce, e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {allegato && (
              <button type="button" className="icon-button" title="Rimuovi collegamento" aria-label={`Rimuovi collegamento di ${voce.titolo}`}
                onClick={() => window.confirm(`Rimuovere il collegamento di "${voce.titolo}"?`) && onSalvaAllegato(voce.img, null)}>
                <Trash2 className="w-4 h-4 text-rose-600" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="card animate-fadeIn !p-4 sm:!p-8">
      {onSalvaDrive && (
        <div className="flex justify-end mb-2 no-print">
          <button type="button" className="btn-ghost" onClick={salvaDrive} disabled={salvataggioDrive} aria-busy={salvataggioDrive}
            title={ACCOUNT_DRIVE ? `Salva il PDF della tabella su Google Drive (${ACCOUNT_DRIVE})` : 'Salva il PDF della tabella su Google Drive'}>
            <CloudUpload className="w-4 h-4" /> {salvataggioDrive ? 'Salvataggio…' : 'Salva su Drive'}
          </button>
        </div>
      )}
      <header className="text-center mb-6">
        <h1 className="font-serif italic font-bold text-[#0b5563] dark:text-teal-300 text-3xl sm:text-5xl leading-tight">
          Tabella Informazioni
          <br />
          Congregazione di Roccastrada
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x divide-slate-800 dark:divide-slate-500">
        {/* Colonna sinistra: programmi del mese */}
        <div className="lg:pr-6">
          <h2 className={titoloGruppo}>Programmi mese in corso:</h2>
          <div className="divide-y divide-slate-800 dark:divide-slate-500">
            {PROGRAMMI_MESE.filter(v => !v.sezione || visibile(v.sezione)).map(v => (
              <div key={v.img} className="py-3"><Riquadro voce={v} grande /></div>
            ))}
          </div>
        </div>

        {/* Colonna destra: attività, comunicazioni, incarichi, Zoom */}
        <div className="lg:pl-6 mt-6 lg:mt-0 border-t border-slate-800 dark:border-slate-500 lg:border-t-0 pt-6 lg:pt-0">
          <div className="divide-y divide-slate-800 dark:divide-slate-500">
            {GRUPPI_DESTRA.map((g, i) => (
              <div key={i} className="py-3">
                {g.titolo && <h2 className={`${titoloGruppo} mb-2`}>{g.titolo}</h2>}
                <div className="grid grid-cols-2 gap-2">
                  {g.voci.map(v => <Riquadro key={v.img} voce={v} />)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-4 border-t-2 border-slate-900 dark:border-slate-400">
            <h2 className="font-bold italic text-[#7b3fb5] dark:text-violet-300">
              Link Zoom per Adunanze di congregazione e Adunanze per il servizio di campo:
            </h2>
            <p className="mt-3 font-bold italic text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Video className="w-4 h-4" /> Join Zoom Meeting
            </p>
            <a data-pdf-link="zoom" href={ZOOM.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 dark:text-sky-400 underline break-all text-sm">
              {ZOOM.url}
            </a>
            <p className="mt-3 text-sm text-slate-800 dark:text-slate-200">ID riunione: <strong>{ZOOM.id}</strong></p>
            <p className="text-sm text-slate-800 dark:text-slate-200">Codice d’accesso: <strong>{ZOOM.codice}</strong></p>
          </div>
        </div>
      </div>
    </section>
  );
};
