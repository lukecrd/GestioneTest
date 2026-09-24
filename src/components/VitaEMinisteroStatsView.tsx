import React, { useState, useMemo } from 'react';
import { VitaEMinisteroMeeting, VitaEMinisteroParticipant } from '../types';
import {
  computeVitaStats,
  compareParticipantsByLastAssignmentAsc,
  ParticipantVitaStats,
  VITA_ROLE_LABELS,
  VitaRoleCategory,
} from '../utils/vitaEMinisteroStats';
import {
  BarChart3,
  Search,
  Filter,
  ArrowUpDown,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Award,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  CheckCircle2,
  Sparkles,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface VitaEMinisteroStatsViewProps {
  participants: VitaEMinisteroParticipant[];
  meetings: VitaEMinisteroMeeting[];
  onShowToast: (msg: string) => void;
}

type SortOption =
  | 'rotation_fair' // Default: Never assigned first, recent last (sinks to the bottom)
  | 'recent_first' // Most recent assignment first
  | 'total_asc' // Fewest total parts first
  | 'total_desc' // Most total parts first
  | 'name_asc'; // Alphabetical

export function VitaEMinisteroStatsView({
  participants,
  meetings,
  onShowToast,
}: VitaEMinisteroStatsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'M' | 'F'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEVER' | 'ASSIGNED'>('ALL');
  const [sortOption, setSortOption] = useState<SortOption>('rotation_fair');
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);

  // Compute stats Map
  const statsMap = useMemo(() => {
    return computeVitaStats(participants, meetings);
  }, [participants, meetings]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalParticipants = participants.length;
    const brothers = participants.filter(p => p.gender === 'M').length;
    const sisters = participants.filter(p => p.gender === 'F').length;

    let totalAssignmentsLogged = 0;
    let neverAssignedCount = 0;

    participants.forEach(p => {
      const s = statsMap.get(p.id);
      if (s) {
        totalAssignmentsLogged += s.totalAssignments;
        if (s.totalAssignments === 0) {
          neverAssignedCount += 1;
        }
      }
    });

    return {
      totalParticipants,
      brothers,
      sisters,
      totalAssignmentsLogged,
      neverAssignedCount,
      activeAssignedCount: totalParticipants - neverAssignedCount,
    };
  }, [participants, statsMap]);

  // Filtered & Sorted participants
  const displayedParticipants = useMemo(() => {
    return participants.filter(p => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) return false;
      }

      // Gender
      if (genderFilter !== 'ALL' && p.gender !== genderFilter) {
        return false;
      }

      // Role filter (checks if enabled or performed)
      if (roleFilter !== 'ALL') {
        const roleKey = roleFilter as keyof VitaEMinisteroParticipant['roles'];
        if (roleKey && !p.roles[roleKey]) {
          return false;
        }
      }

      // Status
      const st = statsMap.get(p.id);
      const isAssigned = (st?.totalAssignments || 0) > 0;
      if (statusFilter === 'NEVER' && isAssigned) return false;
      if (statusFilter === 'ASSIGNED' && !isAssigned) return false;

      return true;
    }).sort((a, b) => {
      const statsA = statsMap.get(a.id);
      const statsB = statsMap.get(b.id);

      switch (sortOption) {
        case 'rotation_fair':
          // The user's core rule: most recent assignment sinks to the bottom!
          return compareParticipantsByLastAssignmentAsc(a, b, statsMap);

        case 'recent_first': {
          const dateA = statsA?.lastAssignmentDate || '';
          const dateB = statsB?.lastAssignmentDate || '';
          if (!dateA && dateB) return 1;
          if (dateA && !dateB) return -1;
          if (dateA && dateB && dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return (statsB?.totalAssignments || 0) - (statsA?.totalAssignments || 0);
        }

        case 'total_asc':
          return (statsA?.totalAssignments || 0) - (statsB?.totalAssignments || 0);

        case 'total_desc':
          return (statsB?.totalAssignments || 0) - (statsA?.totalAssignments || 0);

        case 'name_asc':
          return a.name.localeCompare(b.name);

        default:
          return 0;
      }
    });
  }, [participants, statsMap, searchQuery, genderFilter, roleFilter, statusFilter, sortOption]);

  // Export to Excel
  const handleExportExcel = () => {
    const rows: any[] = [];
    rows.push(['STATISTICHE PARTECIPANTI - VITA E MINISTERO']);
    rows.push([`Generato il: ${new Date().toLocaleDateString('it-IT')}`]);
    rows.push([
      'Criterio ordinamento attivo:',
      sortOption === 'rotation_fair'
        ? 'Rotazione equa (Ultimi assegnati in fondo)'
        : sortOption,
    ]);
    rows.push([]);

    const headers = [
      'Posizione',
      'Nominativo',
      'Genere',
      'Totale Parti',
      'Ultima Data Assegnata',
      'Ultima Parte Svolta',
      'Presidente',
      'Preghiere',
      'Tesori: Discorso',
      'Tesori: Gemme',
      'Tesori: Lettura',
      'Ministero: Studente',
      'Ministero: Assistente',
      'Vita Cristiana',
      'Studio Biblico: Conduttore',
      'Studio Biblico: Lettore',
    ];
    rows.push(headers);

    displayedParticipants.forEach((p, idx) => {
      const s = statsMap.get(p.id);
      rows.push([
        idx + 1,
        p.name,
        p.gender === 'M' ? 'Fratello' : 'Sorella',
        s?.totalAssignments || 0,
        s?.lastAssignmentDate ? s.lastAssignmentLabel : 'Mai assegnato',
        s?.lastAssignmentPart || '—',
        s?.roleCounts.presidente || 0,
        s?.roleCounts.preghiera || 0,
        s?.roleCounts.tesoriDiscorso || 0,
        s?.roleCounts.tesoriGemme || 0,
        s?.roleCounts.tesoriLettura || 0,
        s?.roleCounts.ministeroStudente || 0,
        s?.roleCounts.ministeroAssistente || 0,
        s?.roleCounts.vitaCristianaParti || 0,
        s?.roleCounts.studioBiblicoConduttore || 0,
        s?.roleCounts.studioBiblicoLettore || 0,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 26 },
      { wch: 12 },
      { wch: 14 },
      { wch: 22 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Statistiche Vita e Ministero');
    XLSX.writeFile(workbook, `Statistiche_Vita_e_Ministero_${new Date().toISOString().slice(0, 10)}.xlsx`);
    onShowToast('Statistiche esportate in formato Excel (.xlsx)!');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Explanation */}
      <div className="card p-5 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 dark:from-indigo-950/30 dark:via-blue-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              Statistiche &amp; Rotazione Partecipanti
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider">
              Regola Equità Attiva
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
            In base all’ultima data di assegnazione, i componenti utilizzati di recente <strong>scendono in fondo alla lista</strong> e vengono proposti come ultimi nella scelta delle parti, garantendo un’equa distribuzione degli incarichi.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="px-3.5 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          Esporta Report Excel (.xlsx)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="card p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Totale Partecipanti
            </span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {kpis.totalParticipants}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {kpis.brothers} Fratelli • {kpis.sisters} Sorelle
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Parti Assegnate
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {kpis.totalAssignmentsLogged}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Nelle adunanze in programma
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              In Coda (Priorità 1)
            </span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.neverAssignedCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Mai assegnati finora (in cima alla lista)
          </div>
        </div>

        <div className="card p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Già Assegnati
            </span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {kpis.activeAssignedCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Con almeno una parte
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="card p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca proclamatore..."
              className="inp pl-9 pr-3 py-1.5 text-xs w-full"
            />
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Gender Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setGenderFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  genderFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tutti
              </button>
              <button
                onClick={() => setGenderFilter('M')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  genderFilter === 'M'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Fratelli
              </button>
              <button
                onClick={() => setGenderFilter('F')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  genderFilter === 'F'
                    ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sorelle
              </button>
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="inp text-xs py-1.5 px-2.5 max-w-[170px]"
            >
              <option value="ALL">Tutte le parti</option>
              <option value="presidente">Presidente</option>
              <option value="preghiera">Preghiera</option>
              <option value="tesoriDiscorso">Discorso Tesori</option>
              <option value="tesoriGemme">Gemme spirituali</option>
              <option value="tesoriLettura">Lettura biblica</option>
              <option value="ministeroStudente">Studente Ministero</option>
              <option value="ministeroAssistente">Assistente Ministero</option>
              <option value="vitaCristianaParti">Vita Cristiana</option>
              <option value="studioBiblicoConduttore">Studio Biblico Conduttore</option>
              <option value="studioBiblicoLettore">Studio Biblico Lettore</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="inp text-xs py-1.5 px-2.5"
            >
              <option value="ALL">Tutti gli stati</option>
              <option value="NEVER">Mai assegnati</option>
              <option value="ASSIGNED">Già assegnati</option>
            </select>

            {/* Sort Order */}
            <div className="flex items-center gap-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-lg px-2.5 py-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-indigo-900 dark:text-indigo-200 font-semibold hidden sm:inline">
                Ordinamento:
              </span>
              <select
                value={sortOption}
                onChange={e => setSortOption(e.target.value as SortOption)}
                className="bg-transparent font-bold text-indigo-950 dark:text-indigo-100 outline-none cursor-pointer"
              >
                <option value="rotation_fair">
                  Rotazione Equa (Ultimi assegnati in fondo)
                </option>
                <option value="recent_first">Più recenti in alto</option>
                <option value="total_asc">Totale parti (minore prima)</option>
                <option value="total_desc">Totale parti (maggiore prima)</option>
                <option value="name_asc">Nome (A - Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active rule indicator badge */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>
            Mostrando <strong>{displayedParticipants.length}</strong> di <strong>{participants.length}</strong> componenti.{' '}
            {sortOption === 'rotation_fair' && (
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                I componenti non ancora assegnati o con incarico più remoto appaiono in cima; quelli con data più recente scendono verso il fondo.
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Main Table / List */}
      <div className="card overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 p-0 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 w-14 text-center">#</th>
                <th className="py-3 px-3.5">Proclamatore</th>
                <th className="py-3 px-3.5">Ultima Assegnazione</th>
                <th className="py-3 px-3.5 text-center">Totale Parti</th>
                <th className="py-3 px-3.5">Riepilogo Ruoli</th>
                <th className="py-3 px-3.5 text-center w-24">Dettagli</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {displayedParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Nessun proclamatore trovato con i filtri impostati.
                  </td>
                </tr>
              ) : (
                displayedParticipants.map((p, index) => {
                  const stat = statsMap.get(p.id);
                  const total = stat?.totalAssignments || 0;
                  const isNever = total === 0;
                  const isExpanded = expandedParticipantId === p.id;

                  // Priority status badge
                  let priorityBadge = null;
                  if (isNever) {
                    priorityBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        <Sparkles className="w-2.5 h-2.5" />
                        In cima (Mai usato)
                      </span>
                    );
                  } else if (index >= displayedParticipants.length - 4 && displayedParticipants.length > 5) {
                    priorityBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Assegnato di recente
                      </span>
                    );
                  }

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors ${
                          isNever
                            ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                            : ''
                        }`}
                      >
                        {/* Position rank */}
                        <td className="py-3 px-3.5 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>

                        {/* Name & Gender */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                p.gender === 'M'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                                  : 'pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300 bg-pink-100'
                              }`}
                            >
                              {p.gender}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                                {p.name}
                                {priorityBadge}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {p.gender === 'M' ? 'Fratello' : 'Sorella'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Last Assignment */}
                        <td className="py-3 px-3.5">
                          {isNever ? (
                            <span className="text-slate-400 italic">
                              Nessuna parte assegnata finora
                            </span>
                          ) : (
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                {stat?.lastAssignmentLabel}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                  {stat?.lastAssignmentPart}
                                </span>
                                {stat?.daysSinceLastAssignment !== null && (
                                  <span className="text-slate-400">
                                    • {stat?.daysSinceLastAssignment} gg fa
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Total Count */}
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${
                              isNever
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            }`}
                          >
                            {total}
                          </span>
                        </td>

                        {/* Role Counts breakdown */}
                        <td className="py-3 px-3.5">
                          {stat && (
                            <div className="flex flex-wrap gap-1">
                              {stat.roleCounts.presidente > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px]">
                                  Pres: {stat.roleCounts.presidente}
                                </span>
                              )}
                              {stat.roleCounts.preghiera > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px]">
                                  Preg: {stat.roleCounts.preghiera}
                                </span>
                              )}
                              {stat.roleCounts.tesoriDiscorso + stat.roleCounts.tesoriGemme + stat.roleCounts.tesoriLettura > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px]">
                                  Tesori: {stat.roleCounts.tesoriDiscorso + stat.roleCounts.tesoriGemme + stat.roleCounts.tesoriLettura}
                                </span>
                              )}
                              {stat.roleCounts.ministeroStudente + stat.roleCounts.ministeroAssistente > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px]">
                                  Minist: {stat.roleCounts.ministeroStudente + stat.roleCounts.ministeroAssistente}
                                </span>
                              )}
                              {stat.roleCounts.vitaCristianaParti > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px]">
                                  Vita: {stat.roleCounts.vitaCristianaParti}
                                </span>
                              )}
                              {stat.roleCounts.studioBiblicoConduttore + stat.roleCounts.studioBiblicoLettore > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[10px]">
                                  Studio: {stat.roleCounts.studioBiblicoConduttore + stat.roleCounts.studioBiblicoLettore}
                                </span>
                              )}
                              {total === 0 && (
                                <span className="text-[10px] text-slate-400 italic">
                                  Nessuna
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Expand Details */}
                        <td className="py-3 px-3.5 text-center">
                          <button
                            onClick={() =>
                              setExpandedParticipantId(isExpanded ? null : p.id)
                            }
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                            title="Visualizza cronologia assegnazioni"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable History Drawer */}
                      {isExpanded && stat && (
                        <tr className="bg-slate-50/80 dark:bg-slate-900/50">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-800 shadow-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                  Cronologia assegnazioni di {p.name} ({stat.assignments.length})
                                </h4>
                                <span className="text-[10px] text-slate-400">
                                  Ordinata dalla più recente alla più remota
                                </span>
                              </div>

                              {stat.assignments.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
                                  Nessuna assegnazione trovata nel programma corrente.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                  {stat.assignments.map((item, aIdx) => (
                                    <div
                                      key={aIdx}
                                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs flex flex-col justify-between"
                                    >
                                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                                        <span>{item.dateLabel}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                          {item.roleLabel}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                                        {item.partTitle}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
