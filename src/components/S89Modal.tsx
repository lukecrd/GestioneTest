import React, { useState } from 'react';
import { S89Item, downloadS89Pdf, getS89FileName } from '../utils/s89Pdf';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  FileText,
  Building,
  User,
  Calendar,
  Share2,
} from 'lucide-react';

interface S89ModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: S89Item | null;
  onUpdateStatus?: (isSent: boolean, room: 'main' | 'aux1' | 'aux2') => void;
  isAdmin?: boolean;
}

export function S89Modal({
  isOpen,
  onClose,
  item,
  onUpdateStatus,
  isAdmin = true,
}: S89ModalProps) {
  if (!isOpen || !item) return null;

  const [currentSent, setCurrentSent] = useState<boolean>(!!item.isSent);
  const [currentRoom, setCurrentRoom] = useState<'main' | 'aux1' | 'aux2'>(item.room || 'main');

  const handleToggleSent = (val: boolean) => {
    setCurrentSent(val);
    if (onUpdateStatus) {
      onUpdateStatus(val, currentRoom);
    }
  };

  const handleSelectRoom = (room: 'main' | 'aux1' | 'aux2') => {
    setCurrentRoom(room);
    if (onUpdateStatus) {
      onUpdateStatus(currentSent, room);
    }
  };

  const handleDownload = () => {
    downloadS89Pdf({
      ...item,
      room: currentRoom,
      isSent: currentSent,
    });
  };

  const fileName = getS89FileName(item.studentName, item.partNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-tight">
                Foglietto S-89 — Modulo Assegnazione
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.studentName} • {item.dateLabel} • Parte {item.partNumber}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: S-89 slip faithful preview */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-100/70 dark:bg-slate-950/60">
          {/* Controls Bar: Flag Inviato & Sala */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            {/* Status Flag */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Stato consegna:</span>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => handleToggleSent(!currentSent)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                  currentSent
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs hover:bg-emerald-600'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                }`}
              >
                {currentSent ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Inviato allo studente</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Non ancora inviato</span>
                  </>
                )}
              </button>
            </div>

            {/* Room Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Sala:</span>
              <select
                disabled={!isAdmin}
                value={currentRoom}
                onChange={e => handleSelectRoom(e.target.value as any)}
                className="inp text-xs py-1 px-2 font-semibold"
              >
                <option value="main">Sala principale</option>
                <option value="aux1">Sala secondaria 1</option>
                <option value="aux2">Sala secondaria 2</option>
              </select>
            </div>
          </div>

          {/* S-89 Visual Slip Preview (Identical to Official Printout) */}
          <div className="max-w-md mx-auto bg-white dark:bg-white text-slate-900 p-7 rounded-xl shadow-md border border-slate-300 font-sans select-none relative">
            <div className="text-center space-y-1 mb-6">
              <h2 className="font-extrabold tracking-tight text-base uppercase text-black">
                Parte per l’adunanza
              </h2>
              <h3 className="font-extrabold tracking-tight text-base uppercase text-black">
                Vita cristiana e ministero
              </h3>
            </div>

            {/* Slip Form Fields */}
            <div className="space-y-4 text-sm font-sans mb-6">
              <div className="flex items-baseline">
                <span className="font-extrabold text-black shrink-0 mr-1.5">Nome e cognome:</span>
                <span className="font-semibold text-black px-1 border-b border-dotted border-slate-700 flex-1 min-h-[1.4rem]">
                  {item.studentName || '—'}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-extrabold text-black shrink-0 mr-1.5">Assistente:</span>
                <span className="font-semibold text-black px-1 border-b border-dotted border-slate-700 flex-1 min-h-[1.4rem]">
                  {item.assistantName || '—'}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-extrabold text-black shrink-0 mr-1.5">Data:</span>
                <span className="font-semibold text-black px-1 border-b border-dotted border-slate-700 flex-1 min-h-[1.4rem]">
                  {item.dateLabel || '—'}
                </span>
              </div>

              <div className="flex items-baseline">
                <span className="font-extrabold text-black shrink-0 mr-1.5">Parte n.:</span>
                <span className="font-semibold text-black px-1 border-b border-dotted border-slate-700 flex-1 min-h-[1.4rem]">
                  {item.partNumber}{item.partTitle ? ` — ${item.partTitle}` : ''}
                </span>
              </div>
            </div>

            {/* Room checkboxes */}
            <div className="space-y-2 mb-6 text-sm">
              <div className="font-extrabold text-black mb-1">Da svolgere nella:</div>
              
              <label
                onClick={() => isAdmin && handleSelectRoom('main')}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-colors ${
                  currentRoom === 'main' ? 'border-black bg-black text-white' : 'border-slate-600 bg-white'
                }`}>
                  {currentRoom === 'main' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-black font-medium">Sala principale</span>
              </label>

              <label
                onClick={() => isAdmin && handleSelectRoom('aux1')}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-colors ${
                  currentRoom === 'aux1' ? 'border-black bg-black text-white' : 'border-slate-600 bg-white'
                }`}>
                  {currentRoom === 'aux1' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-black font-medium">Sala secondaria 1</span>
              </label>

              <label
                onClick={() => isAdmin && handleSelectRoom('aux2')}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <div className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-colors ${
                  currentRoom === 'aux2' ? 'border-black bg-black text-white' : 'border-slate-600 bg-white'
                }`}>
                  {currentRoom === 'aux2' && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className="text-black font-medium">Sala secondaria 2</span>
              </label>
            </div>

            {/* Nota per lo studente */}
            <div className="text-[11.5px] leading-relaxed text-black pt-2 border-t border-slate-200">
              <span className="font-extrabold text-black">Nota per lo studente: </span>
              <span>
                La fonte e la lezione che riguardano la tua parte sono indicate nella <i>Guida per l’adunanza Vita e ministero</i>. Ripassa le <i>Istruzioni per l’adunanza Vita cristiana e ministero</i> (S-38) relative alla tua parte.
              </span>
            </div>

            {/* S-89 code */}
            <div className="mt-5 text-[10px] text-slate-500 font-mono">
              S-89-I   11/23
            </div>
          </div>
        </div>

        {/* Modal Footer: Action Buttons */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
            Nome file: <span className="font-semibold text-slate-700 dark:text-slate-300">{fileName}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              Chiudi
            </button>

            <button
              onClick={handleDownload}
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 border border-indigo-500 border-b-[3px] border-b-indigo-800 shadow-md flex items-center gap-1.5 active:translate-y-[1px] active:border-b-[1px] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica PDF ({fileName})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
