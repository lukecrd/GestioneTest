import React, { useState, useEffect } from 'react';
import { VitaEMinisteroMeeting, MinisteroPart, VitaCristianaPart } from '../types';
import {
  Globe,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react';

const MESI_FULL = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

interface VitaEMinisteroWolModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number; // 0-11
  existingMeetings: VitaEMinisteroMeeting[];
  onApplyMeetings: (newMeetings: VitaEMinisteroMeeting[], message: string) => void;
  onShowToast: (msg: string) => void;
}

export function VitaEMinisteroWolModal({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  existingMeetings,
  onApplyMeetings,
  onShowToast,
}: VitaEMinisteroWolModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [syncMode, setSyncMode] = useState<'single_month' | 'all_months'>('all_months');
  const [mergeStrategy, setMergeStrategy] = useState<'preserve' | 'overwrite'>('preserve');

  const [availableYears, setAvailableYears] = useState<{ year: number; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load available years from API on mount
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/wol/years')
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.years) && data.years.length > 0) {
          setAvailableYears(data.years);
        } else {
          // Fallback
          setAvailableYears([2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => ({
            year: y,
            title: `Guida per l’adunanza ${y}`,
          })));
        }
      })
      .catch(() => {
        setAvailableYears([2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map(y => ({
          year: y,
          title: `Guida per l’adunanza ${y}`,
        })));
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      let fetchedMeetings: VitaEMinisteroMeeting[] = [];

      if (syncMode === 'single_month') {
        const monthNum = selectedMonth + 1;
        setLoadingStep(`Scaricamento adunanze di ${MESI_FULL[selectedMonth]} ${selectedYear} da wol.jw.org...`);
        const res = await fetch(`/api/wol/month?year=${selectedYear}&month=${monthNum}`);
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Errore durante il download dal server.');
        }
        fetchedMeetings = data.meetings || [];
      } else {
        setLoadingStep(`Scaricamento di TUTTI i mesi del ${selectedYear} da wol.jw.org (attendere alcuni secondi)...`);
        const res = await fetch(`/api/wol/year?year=${selectedYear}`);
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Errore durante il download dell\'anno dal server.');
        }
        fetchedMeetings = data.meetings || [];
      }

      if (fetchedMeetings.length === 0) {
        throw new Error(`Nessuna adunanza trovata su wol.jw.org per il periodo selezionato (${selectedYear}).`);
      }

      setLoadingStep('Aggiornamento e unione del programma...');

      // Merging logic
      let resultMeetings: VitaEMinisteroMeeting[] = [];

      if (mergeStrategy === 'overwrite') {
        // Remove existing meetings for the touched period
        if (syncMode === 'single_month') {
          const mPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
          const untouched = existingMeetings.filter(m => !m.dateStr || !m.dateStr.startsWith(mPrefix));
          resultMeetings = [...untouched, ...fetchedMeetings];
        } else {
          // Overwrite entire year
          const yPrefix = `${selectedYear}-`;
          const untouched = existingMeetings.filter(m => !m.dateStr || !m.dateStr.startsWith(yPrefix));
          resultMeetings = [...untouched, ...fetchedMeetings];
        }
      } else {
        // 'preserve': Keep all existing assigned participants, update official texts & parts
        const meetingMap = new Map<string, VitaEMinisteroMeeting>();
        existingMeetings.forEach(m => {
          if (m.dateStr) meetingMap.set(m.dateStr, m);
        });

        fetchedMeetings.forEach(wolM => {
          const existing = wolM.dateStr ? meetingMap.get(wolM.dateStr) : undefined;
          if (!existing) {
            // New meeting: add as is
            meetingMap.set(wolM.dateStr, wolM);
          } else {
            // Merge: preserve assigned people
            const mergedMinisteroParts: MinisteroPart[] = wolM.ministeroParts.map((wp, idx) => {
              const ep = existing.ministeroParts.find(p => p.number === wp.number) || existing.ministeroParts[idx];
              return {
                ...wp,
                studentId: ep?.studentId || '',
                assistantId: ep?.assistantId || '',
                isSent: ep?.isSent || false,
                room: ep?.room || 'main',
              };
            });

            const mergedVitaParts: VitaCristianaPart[] = wolM.vitaCristianaParts.map((wvp, idx) => {
              const evp = existing.vitaCristianaParts.find(p => p.number === wvp.number) || existing.vitaCristianaParts[idx];
              return {
                ...wvp,
                speakerId: evp?.speakerId || '',
              };
            });

            const merged: VitaEMinisteroMeeting = {
              ...wolM,
              id: existing.id || wolM.id,
              presidenteId: existing.presidenteId || '',
              preghieraInizialeId: existing.preghieraInizialeId || '',
              tesori1SpeakerId: existing.tesori1SpeakerId || '',
              tesoriGemmeSpeakerId: existing.tesoriGemmeSpeakerId || '',
              tesoriLetturaReaderId: existing.tesoriLetturaReaderId || '',
              tesoriLetturaSent: existing.tesoriLetturaSent || false,
              tesoriLetturaRoom: existing.tesoriLetturaRoom || 'main',
              ministeroParts: mergedMinisteroParts,
              vitaCristianaParts: mergedVitaParts,
              studioBiblicoConductorId: existing.studioBiblicoConductorId || '',
              studioBiblicoReaderId: existing.studioBiblicoReaderId || '',
              preghieraFinaleId: existing.preghieraFinaleId || '',
              isSpecialEvent: existing.isSpecialEvent,
              specialEventTitle: existing.specialEventTitle,
              notes: existing.notes,
            };

            meetingMap.set(wolM.dateStr, merged);
          }
        });

        resultMeetings = Array.from(meetingMap.values());
      }

      // Sort by date ascending
      resultMeetings.sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''));

      const msg = syncMode === 'single_month'
        ? `Importate con successo ${fetchedMeetings.length} adunanze di ${MESI_FULL[selectedMonth]} ${selectedYear} da wol.jw.org!`
        : `Importate con successo ${fetchedMeetings.length} adunanze di tutto il ${selectedYear} da wol.jw.org!`;

      onApplyMeetings(resultMeetings, msg);
      onShowToast(msg);
      onClose();
    } catch (err: any) {
      console.error('WOL sync error:', err);
      setErrorMsg(err.message || 'Errore imprevisto durante il download da wol.jw.org.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Sincronizza da wol.jw.org
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-semibold uppercase tracking-wider">
                  WOL Ufficiale
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guida alle attività per l’adunanza Vita e ministero
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Errore durante il download</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Anno Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Anno di pubblicazione
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                disabled={isLoading}
                onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {availableYears.length > 0 ? (
                  availableYears.map(y => (
                    <option key={y.year} value={y.year}>
                      {y.year} — {y.title}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={2026}>2026 — Guida per l’adunanza 2026</option>
                    <option value={2025}>2025 — Guida per l’adunanza 2025</option>
                    <option value={2024}>2024 — Guida per l’adunanza 2024</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Modalità di Download */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Cosa desideri scaricare?
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: Tutti i mesi */}
              <button
                type="button"
                onClick={() => setSyncMode('all_months')}
                disabled={isLoading}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  syncMode === 'all_months'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Tutti i mesi ({selectedYear})
                  </div>
                  <input
                    type="radio"
                    name="syncMode"
                    checked={syncMode === 'all_months'}
                    onChange={() => setSyncMode('all_months')}
                    className="accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Scarica tutti i 12 mesi disponibili (Gennaio-Dicembre) in un unico passaggio.
                </p>
              </button>

              {/* Card 2: Singolo mese */}
              <button
                type="button"
                onClick={() => setSyncMode('single_month')}
                disabled={isLoading}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  syncMode === 'single_month'
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Mese specifico
                  </div>
                  <input
                    type="radio"
                    name="syncMode"
                    checked={syncMode === 'single_month'}
                    onChange={() => setSyncMode('single_month')}
                    className="accent-indigo-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Scarica o aggiorna unicamente le settimane del mese selezionato.
                </p>
              </button>
            </div>

            {/* Mese picker se syncMode === single_month */}
            {syncMode === 'single_month' && (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in duration-100">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Seleziona il mese:
                </label>
                <select
                  value={selectedMonth}
                  disabled={isLoading}
                  onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold"
                >
                  {MESI_FULL.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name} {selectedYear}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Opzione Assegnatari (Preserve vs Overwrite) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Gestione Assegnatari già inseriti
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="preserve"
                  checked={mergeStrategy === 'preserve'}
                  disabled={isLoading}
                  onChange={() => setMergeStrategy('preserve')}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Conserva gli assegnatari esistenti (Consigliato)
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Aggiorna letture bibliche, titoli ufficiali, cantici, minutaggi ed esercitazioni da wol.jw.org <strong>senza cancellare</strong> i fratelli o le sorelle già assegnati alle parti.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="overwrite"
                  checked={mergeStrategy === 'overwrite'}
                  disabled={isLoading}
                  onChange={() => setMergeStrategy('overwrite')}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Sovrascrivi completamente con il modello WOL
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Sostituisce tutte le parti con quelle pulite scaricate direttamente da wol.jw.org (gli assegnatari andranno reinseriti).
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{loadingStep}</span>
              </>
            ) : (
              <span>Dati estratti direttamente da wol.jw.org</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 shadow-xs transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Scaricamento...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Scarica da wol.jw.org
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
