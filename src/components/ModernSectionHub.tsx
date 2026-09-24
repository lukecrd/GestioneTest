import React, { useState } from 'react';
import {
  Users,
  Calendar,
  Clock,
  BarChart2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CalendarClock,
  UserPlus,
  Mail,
  Send,
  Pencil,
  X,
} from 'lucide-react';
import {
  SpeakerPodiumIcon,
  WomenTableDiscussionIcon,
  PreacherManWithBagIcon,
  WomenWithLiteratureCartIcon,
} from './SectionIcons';
import { StateData, MensileRow, DomenicaRow, ChecklistProgramKey } from '../types';

export type SectionKey =
  | 'anagrafica'
  | 'mensile'
  | 'domenica'
  | 'vitaEMinistero'
  | 'servizioCampo'
  | 'operaPubblica'
  | 'impostazioni'
  | 'statistiche';

interface ModernSectionHubProps {
  state: StateData;
  menRows: MensileRow[] | null;
  menMonth: number;
  menYear: number;
  domRows: DomenicaRow[] | null;
  domMonth: number;
  domYear: number;
  onSelectSection: (section: SectionKey) => void;
  currentUserRole?: 'admin' | 'viewer';
  onUpdateResponsible: (key: ChecklistProgramKey, responsible: { name: string; email: string } | null) => void;
}

const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// Verifica se una data ISO ("YYYY-MM-DD" o simile) cade nel mese/anno indicati
function fallsInMonth(dateStr: string | undefined, month: number, year: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getMonth() === month && d.getFullYear() === year;
}

function buildMailto(emails: string[], subject: string, body: string): string {
  return `mailto:${encodeURIComponent(emails.join(','))}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const ModernSectionHub: React.FC<ModernSectionHubProps> = ({
  state,
  menRows,
  menMonth,
  menYear,
  domRows,
  domMonth,
  domYear,
  onSelectSection,
  currentUserRole,
  onUpdateResponsible,
}) => {
  const isAdmin = currentUserRole === 'admin';
  const people = state.people.length;
  const unavailabilityCount = Object.values(state.unavail || {}).reduce<number>((sum, dates) => sum + (dates as string[]).length, 0);
  const specialCount = Object.keys(state.special || {}).length;
  const activePrograms = (menRows?.length || 0) + (domRows?.length || 0);

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const curMonthLabel = `${MESI_IT[curMonth].charAt(0).toUpperCase()}${MESI_IT[curMonth].slice(1)} ${curYear}`;

  const mensilePronto =
    (!!menRows && menRows.length > 0 && menMonth === curMonth && menYear === curYear) ||
    (state.mensileArchives || []).some(a => a.month === curMonth && a.year === curYear);

  const domenicaPronto = !!domRows && domRows.length > 0 && domMonth === curMonth && domYear === curYear;

  const vitaPronto = (state.vitaEMinistero?.meetings || []).some(m => fallsInMonth(m.dateStr, curMonth, curYear));

  const campoPronto = (state.servizioCampo?.schedule || []).some(s => fallsInMonth(s.dateStr, curMonth, curYear));

  const operaPronto = (state.operaPubblica?.schedule || []).some(s => fallsInMonth(s.dateStr, curMonth, curYear));

  const checklist: { key: ChecklistProgramKey; label: string; ready: boolean; section: SectionKey }[] = [
    { key: 'mensile', label: 'Programma mensile', ready: mensilePronto, section: 'mensile' },
    { key: 'domenica', label: 'Adunanza domenica', ready: domenicaPronto, section: 'domenica' },
    { key: 'vitaEMinistero', label: 'Vita e ministero', ready: vitaPronto, section: 'vitaEMinistero' },
    { key: 'servizioCampo', label: 'Servizio di campo', ready: campoPronto, section: 'servizioCampo' },
    { key: 'operaPubblica', label: 'Opera pubblica', ready: operaPronto, section: 'operaPubblica' },
  ];

  const readyCount = checklist.filter(c => c.ready).length;

  const [editingKey, setEditingKey] = useState<ChecklistProgramKey | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');

  const startEdit = (key: ChecklistProgramKey) => {
    const existing = state.programResponsibles?.[key];
    setDraftName(existing?.name || '');
    setDraftEmail(existing?.email || '');
    setEditingKey(key);
  };

  const cancelEdit = () => setEditingKey(null);

  const saveEdit = () => {
    if (!editingKey) return;
    onUpdateResponsible(editingKey, { name: draftName, email: draftEmail });
    setEditingKey(null);
  };

  const reminderMailto = (label: string, email: string) => buildMailto(
    [email],
    `Promemoria: ${label} da preparare`,
    `Ciao,\n\nti scrivo per ricordarti che il programma "${label}" di ${curMonthLabel} non risulta ancora pronto.\n\nGrazie,\nGestione Congregazione`
  );

  const pendingWithEmail = checklist.filter(c => !c.ready && state.programResponsibles?.[c.key]?.email);
  const bulkMailto = buildMailto(
    pendingWithEmail.map(c => state.programResponsibles![c.key]!.email),
    `Promemoria: programmi di ${curMonthLabel} da preparare`,
    `Ciao,\n\nquesti programmi risultano ancora da preparare per ${curMonthLabel}:\n\n${pendingWithEmail.map(c => `- ${c.label}`).join('\n')}\n\nGrazie,\nGestione Congregazione`
  );

  const modules = [
    { id: 'mensile' as const, title: 'Programma mensile', description: 'Turni sala, audio/video, microfoni e pulizie', icon: Calendar },
    { id: 'domenica' as const, title: 'Adunanza domenica', description: 'Presidente, preghiere e lettore', icon: SpeakerPodiumIcon },
    { id: 'vitaEMinistero' as const, title: 'Vita e ministero', description: 'Parti, studenti, assistenti e rotazioni', icon: WomenTableDiscussionIcon },
    { id: 'servizioCampo' as const, title: 'Servizio di campo', description: 'Comitive, conduttori, orari e luoghi', icon: PreacherManWithBagIcon },
    { id: 'operaPubblica' as const, title: 'Opera pubblica', description: 'Turni espositori e disponibilità', icon: WomenWithLiteratureCartIcon },
    { id: 'statistiche' as const, title: 'Statistiche', description: 'Distribuzione incarichi e storico', icon: BarChart2 },
  ];

  return (
    <section className="space-y-6 animate-fadeIn">
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Panoramica</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">Situazione operativa della congregazione e accesso rapido alle attività principali.</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button className="btn-ghost" onClick={() => onSelectSection('impostazioni')}>
            <CalendarClock className="w-4 h-4" /> Assenze e calendario
          </button>
          {currentUserRole === 'admin' && (
            <button className="btn-primary" onClick={() => onSelectSection('anagrafica')}>
              <UserPlus className="w-4 h-4" /> Gestisci persone
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <button className="metric-card text-left" onClick={() => onSelectSection('anagrafica')}>
          <div className="metric-icon"><Users className="w-5 h-5" /></div>
          <div className="metric-value">{people}</div>
          <div className="metric-label">Persone in anagrafica</div>
        </button>
        <button className="metric-card text-left" onClick={() => onSelectSection('mensile')}>
          <div className="metric-icon"><CheckCircle2 className="w-5 h-5" /></div>
          <div className="metric-value">{activePrograms}</div>
          <div className="metric-label">Righe programmi attivi</div>
        </button>
        <button className="metric-card text-left" onClick={() => onSelectSection('impostazioni')}>
          <div className="metric-icon"><Clock className="w-5 h-5" /></div>
          <div className="metric-value">{unavailabilityCount}</div>
          <div className="metric-label">Indisponibilità registrate</div>
        </button>
        <button className="metric-card text-left" onClick={() => onSelectSection('impostazioni')}>
          <div className="metric-icon"><CalendarClock className="w-5 h-5" /></div>
          <div className="metric-value">{specialCount}</div>
          <div className="metric-label">Date speciali</div>
        </button>
      </div>

      {(people === 0 || (!menRows && !domRows)) && (
        <div className="status-banner">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-slate-900">Attività da completare</div>
            <div className="text-sm text-slate-600 mt-0.5">
              {people === 0 ? 'L’anagrafica è vuota. Inserisci le persone prima di generare i programmi.' : 'Non ci sono programmi mensili o domenicali attivi.'}
            </div>
          </div>
          <button
            className="btn-ghost shrink-0"
            onClick={() => onSelectSection(people === 0 ? 'anagrafica' : 'mensile')}
          >
            Apri <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="card-title">Checklist mensile — {curMonthLabel}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {readyCount} di {checklist.length} programmi pronti per questo mese.
            </p>
          </div>
          {pendingWithEmail.length > 0 && (
            <a href={bulkMailto} className="btn-ghost text-xs whitespace-nowrap no-print">
              <Send className="w-3.5 h-3.5" /> Avvisa responsabili non pronti ({pendingWithEmail.length})
            </a>
          )}
        </div>

        <div className="space-y-2">
          {checklist.map(item => {
            const responsible = state.programResponsibles?.[item.key];
            const isEditing = editingKey === item.key;
            return (
              <div
                key={item.key}
                className={`checklist-row ${item.ready ? 'checklist-row-ready' : 'checklist-row-pending'}`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {item.ready ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <CircleDashed className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {item.label}
                      <span className={`checklist-status ${item.ready ? 'checklist-status-ready' : 'checklist-status-pending'}`}>
                        {item.ready ? 'Pronto' : 'Da preparare'}
                      </span>
                    </div>

                    {!isEditing && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {responsible?.name || responsible?.email ? (
                          <span>Responsabile: {responsible.name || '—'}{responsible.email ? ` · ${responsible.email}` : ''}</span>
                        ) : (
                          <span className="italic">Nessun responsabile assegnato</span>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="flex flex-col sm:flex-row gap-2 mt-2 no-print">
                        <input
                          type="text"
                          value={draftName}
                          onChange={e => setDraftName(e.target.value)}
                          placeholder="Nome responsabile"
                          className="inp text-xs"
                          style={{ minHeight: 32, padding: '0.35rem 0.6rem' }}
                        />
                        <input
                          type="email"
                          value={draftEmail}
                          onChange={e => setDraftEmail(e.target.value)}
                          placeholder="email@esempio.it"
                          className="inp text-xs"
                          style={{ minHeight: 32, padding: '0.35rem 0.6rem' }}
                        />
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={saveEdit} className="icon-button" title="Salva">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </button>
                          <button onClick={cancelEdit} className="icon-button" title="Annulla">
                            <X className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 no-print">
                  {!item.ready && responsible?.email && !isEditing && (
                    <a
                      href={reminderMailto(item.label, responsible.email)}
                      className="icon-button"
                      title={`Invia promemoria a ${responsible.email}`}
                    >
                      <Mail className="w-4 h-4 text-sky-600" />
                    </a>
                  )}
                  {isAdmin && !isEditing && (
                    <button onClick={() => startEdit(item.key)} className="icon-button" title="Assegna responsabile">
                      <Pencil className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                  <button onClick={() => onSelectSection(item.section)} className="btn-ghost text-xs whitespace-nowrap">
                    Apri <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Attività</h2>
            <p className="section-description">Apri direttamente il modulo su cui devi lavorare.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <button key={module.id} onClick={() => onSelectSection(module.id)} className="module-card group">
                <div className="module-icon"><Icon className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="font-semibold text-slate-900">{module.title}</div>
                  <div className="text-sm text-slate-500 mt-0.5">{module.description}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-700 group-hover:translate-x-0.5 transition" />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
