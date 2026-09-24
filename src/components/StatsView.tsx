import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  BarChart2,
  PieChart as PieChartIcon,
  TrendingUp,
  Users,
  Award,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowUpDown,
  UserCheck,
} from 'lucide-react';
import { Person, MensileRow, DomenicaRow, ArchivedProgram } from '../types';

interface StatsViewProps {
  people: Person[];
  menRows: MensileRow[] | null;
  menTitle: string;
  domRows: DomenicaRow[] | null;
  domTitle: string;
  archives: ArchivedProgram[];
}

export interface PersonStat {
  id: string;
  name: string;
  gender: 'M' | 'F';
  uscieri: number;
  audioVideo: number;
  microfoni: number;
  presidente: number;
  preghiera: number;
  lettore: number;
  total: number;
}

const ROLE_COLORS: Record<string, { label: string; color: string }> = {
  uscieri: { label: 'Usciere', color: '#6366f1' },
  audioVideo: { label: 'Audio / Video', color: '#06b6d4' },
  microfoni: { label: 'Microfonista', color: '#10b981' },
  presidente: { label: 'Presidente', color: '#f59e0b' },
  preghiera: { label: 'Preghiera', color: '#ec4899' },
  lettore: { label: 'Lettore T.d.G.', color: '#8b5cf6' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc: number, entry: any) => acc + Number(entry.value || 0), 0);
    return (
      <div className="bg-slate-900 text-slate-100 p-3 rounded-xl shadow-xl text-xs border border-slate-700/80">
        <p className="font-bold border-b border-slate-800 pb-1.5 mb-1.5 text-sm text-white">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            Number(entry.value) > 0 && (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-semibold text-white">{entry.value}</span>
              </div>
            )
          ))}
          <div className="border-t border-slate-800 pt-1.5 mt-1.5 flex justify-between font-bold text-indigo-300">
            <span>Totale Incarichi:</span>
            <span>{total}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const StatsView: React.FC<StatsViewProps> = ({
  people,
  menRows,
  menTitle,
  domRows,
  domTitle,
  archives,
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('current-all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fairnessFilter, setFairnessFilter] = useState<'all' | 'assigned' | 'unassigned' | 'above' | 'below'>('all');
  const [sortBy, setSortBy] = useState<'total' | 'name'>('total');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Compute stats according to selected source
  const statsData = useMemo(() => {
    const map: Record<string, PersonStat> = {};

    // Initialize all existing people in congregation
    people.forEach(p => {
      map[p.name] = {
        id: p.id,
        name: p.name,
        gender: p.gender,
        uscieri: 0,
        audioVideo: 0,
        microfoni: 0,
        presidente: 0,
        preghiera: 0,
        lettore: 0,
        total: 0,
      };
    });

    const getPersonStat = (name: string): PersonStat => {
      if (!name || name === '—') return null as any;
      if (!map[name]) {
        map[name] = {
          id: name,
          name,
          gender: 'M',
          uscieri: 0,
          audioVideo: 0,
          microfoni: 0,
          presidente: 0,
          preghiera: 0,
          lettore: 0,
          total: 0,
        };
      }
      return map[name];
    };

    const addMensileRow = (r: {
      ingresso?: [string, string];
      auditorium?: string;
      microfoni?: [string, string];
      audioVideo?: [string, string];
    }) => {
      if (r.ingresso?.[0] && r.ingresso[0] !== '—') {
        const ps = getPersonStat(r.ingresso[0]);
        if (ps) { ps.uscieri++; ps.total++; }
      }
      if (r.ingresso?.[1] && r.ingresso[1] !== '—') {
        const ps = getPersonStat(r.ingresso[1]);
        if (ps) { ps.uscieri++; ps.total++; }
      }
      if (r.auditorium && r.auditorium !== '—') {
        const ps = getPersonStat(r.auditorium);
        if (ps) { ps.uscieri++; ps.total++; }
      }
      if (r.microfoni?.[0] && r.microfoni[0] !== '—') {
        const ps = getPersonStat(r.microfoni[0]);
        if (ps) { ps.microfoni++; ps.total++; }
      }
      if (r.microfoni?.[1] && r.microfoni[1] !== '—') {
        const ps = getPersonStat(r.microfoni[1]);
        if (ps) { ps.microfoni++; ps.total++; }
      }
      if (r.audioVideo?.[0] && r.audioVideo[0] !== '—') {
        const ps = getPersonStat(r.audioVideo[0]);
        if (ps) { ps.audioVideo++; ps.total++; }
      }
      if (r.audioVideo?.[1] && r.audioVideo[1] !== '—') {
        const ps = getPersonStat(r.audioVideo[1]);
        if (ps) { ps.audioVideo++; ps.total++; }
      }
    };

    const addDomenicaRow = (r: { presidente?: string; preghiera?: string; lettore?: string }) => {
      if (r.presidente && r.presidente !== '—') {
        const ps = getPersonStat(r.presidente);
        if (ps) { ps.presidente++; ps.total++; }
      }
      if (r.preghiera && r.preghiera !== '—') {
        const ps = getPersonStat(r.preghiera);
        if (ps) { ps.preghiera++; ps.total++; }
      }
      if (r.lettore && r.lettore !== '—') {
        const ps = getPersonStat(r.lettore);
        if (ps) { ps.lettore++; ps.total++; }
      }
    };

    if (selectedSource === 'current-all' || selectedSource === 'current-mensile') {
      if (menRows) menRows.forEach(addMensileRow);
    }
    if (selectedSource === 'current-all' || selectedSource === 'current-domenica') {
      if (domRows) domRows.forEach(addDomenicaRow);
    }

    if (selectedSource === 'all-archives') {
      archives.forEach(arc => {
        arc.rows.forEach(addMensileRow);
      });
    } else if (selectedSource.startsWith('archive-')) {
      const arcId = selectedSource.replace('archive-', '');
      const found = archives.find(a => a.id === arcId);
      if (found) {
        found.rows.forEach(addMensileRow);
      }
    }

    return Object.values(map);
  }, [people, menRows, domRows, archives, selectedSource]);

  // Aggregate metrics
  const totalAssignments = useMemo(() => {
    return statsData.reduce((acc, p) => acc + p.total, 0);
  }, [statsData]);

  const assignedPeopleCount = useMemo(() => {
    return statsData.filter(p => p.total > 0).length;
  }, [statsData]);

  const avgAssignments = useMemo(() => {
    if (assignedPeopleCount === 0) return 0;
    return (totalAssignments / assignedPeopleCount).toFixed(1);
  }, [totalAssignments, assignedPeopleCount]);

  const { minAssignments, maxAssignments } = useMemo(() => {
    const assignedList = statsData.filter(p => p.total > 0);
    if (assignedList.length === 0) return { minAssignments: 0, maxAssignments: 0 };
    const totals = assignedList.map(p => p.total);
    return {
      minAssignments: Math.min(...totals),
      maxAssignments: Math.max(...totals),
    };
  }, [statsData]);

  // Role summary for Pie chart
  const rolePieData = useMemo(() => {
    const totals = {
      uscieri: 0,
      audioVideo: 0,
      microfoni: 0,
      presidente: 0,
      preghiera: 0,
      lettore: 0,
    };
    statsData.forEach(p => {
      totals.uscieri += p.uscieri;
      totals.audioVideo += p.audioVideo;
      totals.microfoni += p.microfoni;
      totals.presidente += p.presidente;
      totals.preghiera += p.preghiera;
      totals.lettore += p.lettore;
    });

    return Object.entries(totals)
      .map(([key, value]) => ({
        name: ROLE_COLORS[key]?.label || key,
        value,
        color: ROLE_COLORS[key]?.color || '#94a3b8',
      }))
      .filter(item => item.value > 0);
  }, [statsData]);

  // Sorted and filtered list for table & bar chart
  const filteredPeople = useMemo(() => {
    const avgNum = Number(avgAssignments);
    return statsData
      .filter(p => {
        if (searchQuery.trim() && !p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
          return false;
        }
        if (fairnessFilter === 'assigned') return p.total > 0;
        if (fairnessFilter === 'unassigned') return p.total === 0;
        if (fairnessFilter === 'above') return p.total > avgNum;
        if (fairnessFilter === 'below') return p.total > 0 && p.total < avgNum;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'total') {
          return sortOrder === 'desc' ? b.total - a.total : a.total - b.total;
        } else {
          return sortOrder === 'desc'
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name);
        }
      });
  }, [statsData, searchQuery, fairnessFilter, sortBy, sortOrder, avgAssignments]);

  // Data for BarChart (top active people or filtered list)
  const chartBarData = useMemo(() => {
    // Only include people with total > 0 or top 20 for chart clarity
    return statsData
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)
      .map(p => ({
        name: p.name,
        Usciere: p.uscieri,
        'Audio / Video': p.audioVideo,
        Microfonista: p.microfoni,
        Presidente: p.presidente,
        Preghiera: p.preghiera,
        'Lettore T.d.G.': p.lettore,
        Totale: p.total,
      }));
  }, [statsData]);

  return (
    <section className="tab-panel no-print space-y-5">
      {/* HEADER & SOURCE SELECTOR */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="card-title">Statistiche &amp; Monitoraggio Equità</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Analisi del numero di turni e bilanciamento della rotazione tra tutti i fratelli e sorelle.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
              Sorgente Dati:
            </label>
            <select
              value={selectedSource}
              onChange={e => setSelectedSource(e.target.value)}
              className="inp text-xs py-1.5 px-3 min-w-[220px]"
            >
              <option value="current-all">Tutto il Programma Attivo (Mese + Domenica)</option>
              {menRows && <option value="current-mensile">Solo {menTitle || 'Programma Mensile'}</option>}
              {domRows && <option value="current-domenica">Solo {domTitle || 'Adunanza Domenica'}</option>}
              <option value="all-archives">Tutti i Programmi Archiviati ({archives.length})</option>
              {archives.map(arc => (
                <option key={arc.id} value={`archive-${arc.id}`}>
                  Archivio: {arc.title} ({arc.savedAt.split(',')[0]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-lg shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Totale Incarichi
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {totalAssignments}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Persone Attive
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {assignedPeopleCount} <span className="text-xs font-normal text-slate-400">/ {people.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Media per Persona
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {avgAssignments} <span className="text-xs font-normal text-slate-400">turni</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 rounded-lg shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Range (Min - Max)
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {minAssignments} - {maxAssignments} <span className="text-xs font-normal text-slate-400">turni</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* BAR CHART */}
        <div className="card lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Distribuzione Turni per Persona
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {chartBarData.length} persone con incarichi
            </span>
          </div>

          {chartBarData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
              <HelpCircle className="w-8 h-8 mb-2 opacity-50" />
              Nessun dato disponibile per la sorgente selezionata. Genera o seleziona un programma.
            </div>
          ) : (
            <div className="w-full h-[320px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartBarData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: '15px', fontSize: '11px' }}
                  />
                  <Bar dataKey="Usciere" stackId="a" fill={ROLE_COLORS.uscieri.color} />
                  <Bar dataKey="Audio / Video" stackId="a" fill={ROLE_COLORS.audioVideo.color} />
                  <Bar dataKey="Microfonista" stackId="a" fill={ROLE_COLORS.microfoni.color} />
                  <Bar dataKey="Presidente" stackId="a" fill={ROLE_COLORS.presidente.color} />
                  <Bar dataKey="Preghiera" stackId="a" fill={ROLE_COLORS.preghiera.color} />
                  <Bar dataKey="Lettore T.d.G." stackId="a" fill={ROLE_COLORS.lettore.color} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* PIE / DONUT CHART */}
        <div className="card flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <PieChartIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Ripartizione per Ruolo
            </h3>
          </div>

          {rolePieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
              Nessun incarico presente
            </div>
          ) : (
            <div className="w-full h-[280px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rolePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rolePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `${value} turni (${((Number(value) / totalAssignments) * 100).toFixed(0)}%)`,
                      name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} layout="horizontal" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* DETAILED FAIRNESS TABLE */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="card-title">
              Dettaglio Incarichi per Persona
              <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                ({filteredPeople.length})
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="inp pl-9 pr-3 py-1.5 max-w-[200px]"
                placeholder="Cerca persona..."
              />
            </div>

            {/* Filter */}
            <select
              value={fairnessFilter}
              onChange={e => setFairnessFilter(e.target.value as any)}
              className="inp text-xs py-1.5 px-3 min-w-[150px]"
            >
              <option value="all">Tutte le persone</option>
              <option value="assigned">Solo con incarichi</option>
              <option value="unassigned">Senza incarichi (0)</option>
              <option value="above">Sopra la media (&gt; {avgAssignments})</option>
              <option value="below">Sotto la media (&lt; {avgAssignments})</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="tbl">
            <thead>
              <tr>
                <th
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
                  onClick={() => {
                    if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('name'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Nome Persona</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="text-center">Usciere</th>
                <th className="text-center">A/V</th>
                <th className="text-center">Microfoni</th>
                <th className="text-center">Presidente</th>
                <th className="text-center">Preghiera</th>
                <th className="text-center">Lettore</th>
                <th
                  className="text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
                  onClick={() => {
                    if (sortBy === 'total') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('total'); setSortOrder('desc'); }
                  }}
                >
                  <div className="flex items-center justify-center gap-1 font-bold">
                    <span>Totale</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="text-center">Stato Equità</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map(p => {
                const avgNum = Number(avgAssignments);
                let badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
                let statusLabel = 'Inattivo';

                if (p.total === 0) {
                  badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
                  statusLabel = 'Nessun turno';
                } else if (p.total > avgNum + 1) {
                  badgeClass = 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-semibold';
                  statusLabel = 'Sopra la media';
                } else if (p.total < avgNum - 0.5) {
                  badgeClass = 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 font-semibold';
                  statusLabel = 'Sotto la media';
                } else {
                  badgeClass = 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-semibold';
                  statusLabel = 'In media';
                }

                return (
                  <tr key={p.id}>
                    <td className="font-semibold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className={`badge ${p.gender === 'M' ? 'badge-m' : 'badge-f'}`}>
                          {p.gender}
                        </span>
                      </div>
                    </td>
                    <td className="text-center font-mono text-xs">{p.uscieri || '—'}</td>
                    <td className="text-center font-mono text-xs">{p.audioVideo || '—'}</td>
                    <td className="text-center font-mono text-xs">{p.microfoni || '—'}</td>
                    <td className="text-center font-mono text-xs">{p.presidente || '—'}</td>
                    <td className="text-center font-mono text-xs">{p.preghiera || '—'}</td>
                    <td className="text-center font-mono text-xs">{p.lettore || '—'}</td>
                    <td className="text-center font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                      {p.total}
                    </td>
                    <td className="text-center">
                      <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPeople.length === 0 && (
          <p className="text-slate-400 text-center py-6 text-xs">
            Nessuna persona corrisponde ai criteri di ricerca.
          </p>
        )}
      </div>
    </section>
  );
};
