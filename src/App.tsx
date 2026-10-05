import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Calendar,
  CalendarDays,
  Settings,
  RefreshCw,
  Download,
  Upload,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Trash2,
  Edit3,
  Search,
  Check,
  Sparkles,
  UserPlus,
  Clock,
  Archive,
  Save,
  FolderOpen,
  Eye,
  BookmarkCheck,
  BarChart2,
  RotateCcw,
  ShieldCheck,
  LogOut,
  Lock,
  UserCheck,
  Key,
  MapPin,
  Compass,
  Terminal,
  Cpu,
  Activity,
  Radio,
  BookOpen,
  LogIn,
  Mic,
  MonitorPlay,
  Armchair,
} from 'lucide-react';
import { Person, StateData, MensileRow, DomenicaRow, ArchivedProgram, AuthUser, ChecklistProgramKey } from './types';
import { StatsView } from './components/StatsView';
import { LoginScreen } from './components/LoginScreen';
import { OperaPubblicaView } from './components/OperaPubblicaView';
import { ServizioCampoView } from './components/ServizioCampoView';
import { VitaEMinisteroView } from './components/VitaEMinisteroView';
import { ModernSectionHub, SectionKey } from './components/ModernSectionHub';
import { ModernSquareNavbar } from './components/ModernSquareNavbar';
import { ExcelImportModal } from './components/ExcelImportModal';
import { DEFAULT_VITA_MINISTERO_DATA } from './data/defaultVitaEMinistero';
import { TITOLI_DISCORSI_PUBBLICI } from './data/titoliDiscorsiPubblici';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  subscribeToCongregation,
  pushStateToFirestore,
  pushActiveProgramsToFirestore,
  ActiveProgramsData,
} from './lib/firestoreSync';

const STORAGE_KEY = 'dashboard_congregazione_v2';
const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MESI_ABBR = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

const _mem: Record<string, string> = {};
const storage = {
  get(k: string) {
    try { return window.localStorage.getItem(k); } catch (e) { return (k in _mem) ? _mem[k] : null; }
  },
  set(k: string, v: string) {
    try { window.localStorage.setItem(k, v); } catch (e) { _mem[k] = v; }
  },
};

function normalize(s: any): StateData {
  s = s || {};
  const people: Person[] = Array.isArray(s.people) ? s.people : [];
  const unavail: Record<string, string[]> = s.unavail || {};
  const special: Record<string, string> = s.special || {};
  const groups = s.groups || { riassetto: '1', pulizie: 'Massa' };
  const mensileArchives: ArchivedProgram[] = Array.isArray(s.mensileArchives) ? s.mensileArchives : [];

  people.forEach((p: any) => {
    p.roles = p.roles || {};
    ['uscieri','console','microfoni','presidente','preghiera','lettore'].forEach(r => {
      p.roles[r] = !!p.roles[r];
    });
  });

  const adminPin = typeof s.adminPin === 'string' && s.adminPin.trim() ? s.adminPin.trim() : '1122';
  const viewerPin = typeof s.viewerPin === 'string' && s.viewerPin.trim() ? s.viewerPin.trim() : '1234';
  const operaPubblica = s.operaPubblica || { participants: [], schedule: [] };
  const servizioCampo = s.servizioCampo || { conductors: [], schedule: [], locations: [] };
  const vitaEMinistero = s.vitaEMinistero || DEFAULT_VITA_MINISTERO_DATA;
  const programResponsibles = s.programResponsibles && typeof s.programResponsibles === 'object' ? s.programResponsibles : {};

  return { people, unavail, special, groups, mensileArchives, adminPin, viewerPin, operaPubblica, servizioCampo, vitaEMinistero, programResponsibles };
}

function loadInitialState(): StateData {
  try {
    const raw = storage.get(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {}
  try {
    const old = storage.get('dashboard_congregazione_v1');
    if (old) return normalize(JSON.parse(old));
  } catch (e) {}
  return normalize({});
}

function uid() {
  return 'p' + Math.random().toString(36).slice(2, 9);
}

function timeNow() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function iso(dt: Date) {
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function fmtShort(dt: Date) {
  return dt.getDate() + '-' + MESI_ABBR[dt.getMonth()];
}

function fmtDate(dt: Date) {
  return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
}

function addDays(dt: Date, n: number) {
  const d = new Date(dt);
  d.setDate(d.getDate() + n);
  return d;
}

function sundayDates(year: number, month: number) {
  const dates: Date[] = [];
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dt = new Date(year, month, d);
    if (dt.getDay() === 0) dates.push(dt);
  }
  return dates;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, header: string[], rows: (string | undefined)[][]) {
  const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [header.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

export default function App() {
  const [state, setState] = useState<StateData>(loadInitialState);
  const [activeTab, setActiveTab] = useState<SectionKey | 'hub'>('hub');
  
  // User Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = storage.get('congregation_auth_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    storage.set('congregation_auth_user', JSON.stringify(user));
    showToast(`Accesso effettuato (${user.role === 'admin' ? 'Amministratore' : 'Solo Lettura'})`);
  };

  const handleLogout = () => {
    signOut(auth).catch(() => {});
    setCurrentUser(null);
    storage.set('congregation_auth_user', '');
    showToast('Disconnessione effettuata');
  };

  const checkAdminPermission = (): boolean => {
    if (currentUser?.role === 'viewer') {
      showToast('Azione non consentita in modalità Solo Lettura (richiesto Admin)');
      return false;
    }
    return true;
  };

  // Sync Status
  const [syncMsg, setSyncMsg] = useState<string>('Connessione…');
  const [syncClass, setSyncClass] = useState<string>('text-gray-400');
  
  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<any>(null);

  // Custom Confirm Modal State
  interface ConfirmModalConfig {
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary';
    onConfirm: () => void;
  }
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalConfig | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  };

  // Auto-save & Remote Firestore sync handler
  const saveState = (newState: StateData) => {
    setState(newState);
    storage.set(STORAGE_KEY, JSON.stringify(newState));
    setSyncMsg('Salvataggio Cloud…');
    setSyncClass('text-blue-500 font-medium');
    pushStateToFirestore(newState)
      .then(() => {
        setSyncMsg('✓ Sincronizzato Cloud ' + timeNow());
        setSyncClass('text-emerald-600 font-medium');
      })
      .catch((err) => {
        console.error('Firestore save error:', err);
        setSyncMsg('Offline — Salvato locale');
        setSyncClass('text-amber-600');
      });
  };

  // Helper to sync active programs to Firestore
  const syncActivePrograms = (overrides: Partial<ActiveProgramsData>) => {
    const data: ActiveProgramsData = {
      menRows,
      menTitle,
      menWarn,
      menMonth,
      menYear,
      domRows,
      domTitle,
      domWarn,
      domMonth,
      domYear,
      ...overrides,
    };
    pushActiveProgramsToFirestore(data).catch((err) => console.error('Active program sync error:', err));
  };

  useEffect(() => {
    setSyncMsg('Connessione Cloud…');
    setSyncClass('text-blue-500 font-medium');

    const unsubscribeData = subscribeToCongregation(
      ({ state: remoteState, activePrograms: remotePrograms }) => {
        if (remoteState && Array.isArray(remoteState.people)) {
          const norm = normalize(remoteState);
          setState(norm);
          storage.set(STORAGE_KEY, JSON.stringify(norm));
        }

        if (remotePrograms) {
          if ('menRows' in remotePrograms) setMenRows(remotePrograms.menRows);
          if (remotePrograms.menTitle !== undefined) setMenTitle(remotePrograms.menTitle);
          if (remotePrograms.menWarn !== undefined) setMenWarn(remotePrograms.menWarn);
          if (remotePrograms.menMonth !== undefined) setMenMonth(remotePrograms.menMonth);
          if (remotePrograms.menYear !== undefined) setMenYear(remotePrograms.menYear);

          if ('domRows' in remotePrograms) setDomRows(remotePrograms.domRows);
          if (remotePrograms.domTitle !== undefined) setDomTitle(remotePrograms.domTitle);
          if (remotePrograms.domWarn !== undefined) setDomWarn(remotePrograms.domWarn);
          if (remotePrograms.domMonth !== undefined) setDomMonth(remotePrograms.domMonth);
          if (remotePrograms.domYear !== undefined) setDomYear(remotePrograms.domYear);
        }

        setSyncMsg('✓ Sincronizzato Cloud ' + timeNow());
        setSyncClass('text-emerald-600 font-medium');
      },
      (error) => {
        console.warn('Firestore subscription error:', error);
        setSyncMsg('Offline — Dati salvati in locale');
        setSyncClass('text-amber-600');
      }
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        if (!currentUser) {
          const u: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || undefined,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Utente Cloud',
            role: 'admin',
          };
          setCurrentUser(u);
          storage.set('congregation_auth_user', JSON.stringify(u));
        }
      }
    });

    return () => {
      unsubscribeData();
      unsubscribeAuth();
    };
  }, []);

  // Helpers for logic
  const personById = (id: string) => state.people.find(p => p.id === id);
  const areSpouses = (a?: Person | null, b?: Person | null) => {
    if (!a || !b) return false;
    return a.spouseId === b.id || b.spouseId === a.id;
  };

  const isUnavailable = (personId: string, sun: Date, wed: Date) => {
    const list = state.unavail[personId] || [];
    return list.includes(iso(sun)) || list.includes(iso(wed));
  };

  const fairPick = (
    candidates: Person[],
    counts: Record<string, number>,
    lastUsed: Record<string, number>,
    meetingIdx: number,
    excludeIds: string[]
  ) => {
    const pool = candidates.filter(p => !excludeIds.includes(p.id));
    if (pool.length === 0) return null;
    pool.sort((a, b) => {
      const ca = counts[a.id] || 0, cb = counts[b.id] || 0;
      if (ca !== cb) return ca - cb;
      const la = lastUsed[a.id] ?? -999, lb = lastUsed[b.id] ?? -999;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name);
    });
    return pool[0];
  };

  const markUsed = (p: Person, counts: Record<string, number>, lastUsed: Record<string, number>, idx: number) => {
    counts[p.id] = (counts[p.id] || 0) + 1;
    lastUsed[p.id] = idx;
  };

  const consolePairValid = (a: Person, b: Person) => {
    return a.gender === b.gender || areSpouses(a, b);
  };

  const renderPersonName = (name: string | undefined, duplicates?: string[]) => {
    if (!name || name === '—') return '—';
    if (duplicates?.includes(name)) {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400" title="⚠ Attenzione: persona assegnata a più ruoli nella stessa settimana">
          <span className="text-amber-600 dark:text-amber-400 font-bold" aria-label="Avviso">⚠</span>
          {name}
        </span>
      );
    }
    return name;
  };

  // Cella dell'incarico nel Programma mensile: menu a tendina per Admin, testo semplice per Viewer
  const renderMensileCell = (
    rowIndex: number,
    field: MensileFieldKey,
    currentValue: string | undefined,
    pool: Person[],
    duplicates?: string[]
  ) => {
    if (currentUser?.role !== 'admin') {
      return renderPersonName(currentValue, duplicates);
    }
    const value = currentValue && currentValue !== '—' ? currentValue : '';
    const isDup = !!value && !!duplicates?.includes(value);
    const names = new Set(pool.map(p => p.name));
    if (value) names.add(value);
    const options = Array.from(names).sort((a, b) => a.localeCompare(b));

    return (
      <select
        value={value}
        onChange={e => updateMensileField(rowIndex, field, e.target.value)}
        className={`mensile-select${isDup ? ' mensile-select-warn' : ''}`}
        title={isDup ? '⚠ Attenzione: persona assegnata a più ruoli nella stessa settimana' : 'Cambia nominativo'}
      >
        <option value="">— (nessuno)</option>
        {options.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    );
  };

  // Opzioni disponibili per Riassetto e Pulizie del fine settimana
  const GROUP_OPTIONS: { value: string; label: string }[] = [
    { value: '1', label: 'Gruppo 1' },
    { value: '2', label: 'Gruppo 2' },
    { value: '3', label: 'Gruppo 3' },
    { value: '4', label: 'Gruppo 4' },
    { value: 'Massa', label: 'Massa Marittima' },
  ];

  // Cambia manualmente il gruppo di Riassetto/Pulizie assegnato a una riga del programma mensile
  const updateMensileGroup = (rowIndex: number, field: 'riassetto' | 'pulizie', value: string) => {
    if (!checkAdminPermission()) return;
    if (!menRows) return;
    const updatedRows = menRows.map((r, i) => {
      if (i !== rowIndex || r.special) return r;
      return { ...r, [field]: value };
    });
    setMenRows(updatedRows);
    syncActivePrograms({ menRows: updatedRows });
    showToast('Gruppo aggiornato');
  };

  // Cella di Riassetto/Pulizie: select con etichetta estesa a schermo per Admin,
  // testo compatto (es. "2", "Massa") per Viewer e in stampa/PDF
  const renderGroupCell = (rowIndex: number, field: 'riassetto' | 'pulizie', currentValue: string | undefined) => {
    const compact = currentValue || '—';
    if (currentUser?.role !== 'admin') {
      return compact;
    }
    return (
      <>
        <select
          value={currentValue || ''}
          onChange={e => updateMensileGroup(rowIndex, field, e.target.value)}
          className="mensile-select no-print"
          title="Cambia gruppo"
        >
          {GROUP_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="print-only">{compact}</span>
      </>
    );
  };

  // --- ANAGRAFICA FORM STATE ---
  const [personId, setPersonId] = useState('');
  const [personName, setPersonName] = useState('');
  const [personGender, setPersonGender] = useState<'M' | 'F'>('M');
  const [personSpouse, setPersonSpouse] = useState('');
  const [roles, setRoles] = useState({
    uscieri: false,
    console: false,
    microfoni: false,
    presidente: false,
    preghiera: false,
    lettore: false,
  });
  const [peopleSearch, setPeopleSearch] = useState('');
  const [anagraficaFilter, setAnagraficaFilter] = useState<'all' | 'M' | 'F' | 'uscieri' | 'console' | 'microfoni' | 'presidente' | 'lettore' | 'preghiera'>('all');
  const [showPersonEditor, setShowPersonEditor] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);

  const resetPersonForm = () => {
    setPersonId('');
    setPersonName('');
    setPersonGender('M');
    setPersonSpouse('');
    setRoles({
      uscieri: false,
      console: false,
      microfoni: false,
      presidente: false,
      preghiera: false,
      lettore: false,
    });
  };

  const handlePersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkAdminPermission()) return;
    const name = personName.trim();
    if (!name) return;
    const id = personId || uid();
    const newPerson: Person = {
      id,
      name,
      gender: personGender,
      spouseId: personSpouse || null,
      roles: { ...roles },
    };

    const newPeople = [...state.people];
    const idx = newPeople.findIndex(p => p.id === id);
    if (idx >= 0) newPeople[idx] = newPerson;
    else newPeople.push(newPerson);

    // Sync spouses
    newPeople.forEach(p => {
      if (p.id !== newPerson.id && p.spouseId === newPerson.id && newPerson.spouseId !== p.id) {
        p.spouseId = null;
      }
    });
    if (newPerson.spouseId) {
      const sp = newPeople.find(p => p.id === newPerson.spouseId);
      if (sp) sp.spouseId = newPerson.id;
    }

    saveState({ ...state, people: newPeople });
    resetPersonForm();
    setShowPersonEditor(false);
    showToast(idx >= 0 ? 'Persona aggiornata' : 'Persona aggiunta');
  };

  const editPerson = (id: string) => {
    const p = personById(id);
    if (!p) return;
    setPersonId(p.id);
    setPersonName(p.name);
    setPersonGender(p.gender);
    setPersonSpouse(p.spouseId || '');
    setRoles({ ...p.roles });
    setShowPersonEditor(true);
  };

  const deletePerson = (id: string) => {
    if (!checkAdminPermission()) return;
    const p = personById(id);
    setConfirmModalState({
      title: 'Elimina Persona',
      message: `Sei sicuro di voler eliminare ${p?.name || 'questa persona'} dall'anagrafica?`,
      confirmText: 'Elimina',
      confirmVariant: 'danger',
      onConfirm: () => {
        const newPeople = state.people.filter(p => p.id !== id);
        newPeople.forEach(p => { if (p.spouseId === id) p.spouseId = null; });
        const newUnavail = { ...state.unavail };
        delete newUnavail[id];
        const newSpecial = { ...state.special };
        delete newSpecial[id];
        saveState({ ...state, people: newPeople, unavail: newUnavail, special: newSpecial });
        showToast('Persona eliminata');
        setConfirmModalState(null);
      }
    });
  };

  // --- IMPORTAZIONE ANAGRAFICA DA EXCEL ---
  const handleImportPeopleFromExcel = (peopleToAdd: Person[], updateExisting: boolean) => {
    if (!checkAdminPermission()) return;
    if (!peopleToAdd.length) return;

    const currentPeople = [...state.people];
    let addedCount = 0;
    let updatedCount = 0;

    peopleToAdd.forEach(importedPerson => {
      const existingIdx = currentPeople.findIndex(
        p => p.name.trim().toLowerCase() === importedPerson.name.trim().toLowerCase()
      );

      if (existingIdx >= 0) {
        if (updateExisting) {
          currentPeople[existingIdx] = {
            ...currentPeople[existingIdx],
            gender: importedPerson.gender,
          };
          updatedCount++;
        }
      } else {
        currentPeople.push(importedPerson);
        addedCount++;
      }
    });

    saveState({ ...state, people: currentPeople });
    const msg = [
      addedCount > 0 ? `${addedCount} nuovi ${addedCount === 1 ? 'proclamatore aggiunto' : 'proclamatori aggiunti'}` : '',
      updatedCount > 0 ? `${updatedCount} aggiornati` : '',
    ].filter(Boolean).join(', ');
    showToast(msg ? `Importazione completata: ${msg}` : 'Nessuna modifica effettuata');
  };

  // --- CHECKLIST MENSILE: RESPONSABILI PROGRAMMI ---
  const updateProgramResponsible = (key: ChecklistProgramKey, responsible: { name: string; email: string } | null) => {
    if (!checkAdminPermission()) return;
    const current = { ...(state.programResponsibles || {}) };
    const name = responsible?.name.trim() || '';
    const email = responsible?.email.trim() || '';
    if (!responsible || (!name && !email)) {
      delete current[key];
    } else {
      current[key] = { name, email };
    }
    saveState({ ...state, programResponsibles: current });
    showToast(name || email ? 'Responsabile aggiornato' : 'Responsabile rimosso');
  };

  // --- PROGRAMMA MENSILE STATE ---
  const now = new Date();
  const [menMonth, setMenMonth] = useState(now.getMonth());
  const [menYear, setMenYear] = useState(now.getFullYear());
  const [menRows, setMenRows] = useState<MensileRow[] | null>(null);
  const [menWarn, setMenWarn] = useState<string | null>(null);
  const [menTitle, setMenTitle] = useState<string>('');

  const generateMensile = (y: number, m: number) => {
    if (!checkAdminPermission()) return;
    const sundays = sundayDates(y, m);
    const uscieriPool = state.people.filter(p => p.roles.uscieri);
    const micPool = state.people.filter(p => p.roles.microfoni);
    const consolePool = state.people.filter(p => p.roles.console);
    const uc: Record<string, number> = {}, ul: Record<string, number> = {};
    const mc: Record<string, number> = {}, ml: Record<string, number> = {};
    const cc: Record<string, number> = {}, cl: Record<string, number> = {};

    const riassGroups = ['1', '2', '3', '4'];
    const pulGroups = ['Massa', '1', '2', '3', '4'];
    let ri = Math.max(0, riassGroups.indexOf(state.groups.riassetto));
    let pi = Math.max(0, pulGroups.indexOf(state.groups.pulizie));

    const warnings: string[] = [];
    if (uscieriPool.length < 3) warnings.push('Servono almeno 3 uscieri.');
    if (micPool.length < 2) warnings.push('Servono almeno 2 microfonisti.');
    if (consolePool.length < 2) warnings.push('Servono almeno 2 persone per Audio/Video (console).');

    const rows: MensileRow[] = [];
    sundays.forEach((sun, idx) => {
      const wed = addDays(sun, 3);
      const key = iso(sun);

      if (state.special[key]) {
        rows.push({ date: sun, special: state.special[key] });
        return;
      }

      const unavailIds = state.people.filter(p => isUnavailable(p.id, sun, wed)).map(p => p.id);

      const chosenUsc: Person[] = [];
      for (let s = 0; s < 3; s++) {
        const p = fairPick(uscieriPool, uc, ul, idx, [...unavailIds, ...chosenUsc.map(c => c.id)]);
        if (p) { chosenUsc.push(p); markUsed(p, uc, ul, idx); }
      }

      // Microfonisti: prefer people not already assigned to Uscieri in the same week
      const usedInWeek = [...unavailIds, ...chosenUsc.map(c => c.id)];
      const chosenMic: Person[] = [];
      for (let s = 0; s < 2; s++) {
        let p = fairPick(micPool, mc, ml, idx, [...usedInWeek, ...chosenMic.map(c => c.id)]);
        if (!p) {
          p = fairPick(micPool, mc, ml, idx, [...unavailIds, ...chosenMic.map(c => c.id)]);
        }
        if (p) { chosenMic.push(p); markUsed(p, mc, ml, idx); }
      }

      // Audio/Video: prefer people not already assigned to Uscieri or Microfonisti
      const assignedInWeekIds = [...usedInWeek, ...chosenMic.map(c => c.id)];
      let c1: Person | null = null, c2: Person | null = null;
      
      const orderedPrimary = consolePool.filter(p => !assignedInWeekIds.includes(p.id)).sort((a, b) => {
        const ca = cc[a.id] || 0, cb = cc[b.id] || 0;
        if (ca !== cb) return ca - cb;
        return (cl[a.id] ?? -999) - (cl[b.id] ?? -999);
      });

      outerPrimary:
      for (let x = 0; x < orderedPrimary.length; x++) {
        for (let y = 0; y < orderedPrimary.length; y++) {
          if (x === y) continue;
          if (consolePairValid(orderedPrimary[x], orderedPrimary[y])) {
            c1 = orderedPrimary[x];
            c2 = orderedPrimary[y];
            break outerPrimary;
          }
        }
      }

      if (!c1) {
        const orderedFallback = consolePool.filter(p => !unavailIds.includes(p.id)).sort((a, b) => {
          const ca = cc[a.id] || 0, cb = cc[b.id] || 0;
          if (ca !== cb) return ca - cb;
          return (cl[a.id] ?? -999) - (cl[b.id] ?? -999);
        });

        outerFallback:
        for (let x = 0; x < orderedFallback.length; x++) {
          for (let y = 0; y < orderedFallback.length; y++) {
            if (x === y) continue;
            if (consolePairValid(orderedFallback[x], orderedFallback[y])) {
              c1 = orderedFallback[x];
              c2 = orderedFallback[y];
              break outerFallback;
            }
          }
        }
      }

      if (c1) markUsed(c1, cc, cl, idx);
      if (c2) markUsed(c2, cc, cl, idx);

      const riassetto = riassGroups[ri % riassGroups.length]; ri++;
      const pulizie = pulGroups[pi % pulGroups.length]; pi++;

      const row: MensileRow = {
        date: sun,
        ingresso: [chosenUsc[0]?.name || '—', chosenUsc[1]?.name || '—'],
        auditorium: chosenUsc[2]?.name || '—',
        microfoni: [chosenMic[0]?.name || '—', chosenMic[1]?.name || '—'],
        audioVideo: [c1?.name || '—', c2?.name || '—'],
        riassetto,
        pulizie,
      };

      // Validation check: duplicate roles in the same week
      const roleAssignments: { name: string; role: string }[] = [];
      if (row.ingresso?.[0] && row.ingresso[0] !== '—') roleAssignments.push({ name: row.ingresso[0], role: 'Uscieri ingresso' });
      if (row.ingresso?.[1] && row.ingresso[1] !== '—') roleAssignments.push({ name: row.ingresso[1], role: 'Uscieri ingresso' });
      if (row.auditorium && row.auditorium !== '—') roleAssignments.push({ name: row.auditorium, role: 'Usciere Auditorium' });
      if (row.microfoni?.[0] && row.microfoni[0] !== '—') roleAssignments.push({ name: row.microfoni[0], role: 'Microfonista' });
      if (row.microfoni?.[1] && row.microfoni[1] !== '—') roleAssignments.push({ name: row.microfoni[1], role: 'Microfonista' });
      if (row.audioVideo?.[0] && row.audioVideo[0] !== '—') roleAssignments.push({ name: row.audioVideo[0], role: 'Audio/Video' });
      if (row.audioVideo?.[1] && row.audioVideo[1] !== '—') roleAssignments.push({ name: row.audioVideo[1], role: 'Audio/Video' });

      const nameMap: Record<string, string[]> = {};
      roleAssignments.forEach(({ name, role }) => {
        if (!nameMap[name]) nameMap[name] = [];
        nameMap[name].push(role);
      });

      const duplicates: string[] = [];
      const rowWarns: string[] = [];
      Object.entries(nameMap).forEach(([name, rolesList]) => {
        if (rolesList.length > 1) {
          duplicates.push(name);
          rowWarns.push(`${name} è assegnato/a a più ruoli (${rolesList.join(', ')}) nella settimana del ${fmtShort(sun)}.`);
        }
      });

      if (duplicates.length > 0) {
        row.duplicates = duplicates;
        row.warnings = rowWarns;
        warnings.push(...rowWarns);
      }

      rows.push(row);
    });

    const title = `Mese di ${MESI[m]} ${y}`;
    const warn = warnings.join(' ') || null;
    setMenTitle(title);
    setMenRows(rows);
    setMenWarn(warn);
    setActiveArchiveId(null);
    syncActivePrograms({
      menRows: rows,
      menTitle: title,
      menWarn: warn,
      menMonth: m,
      menYear: y,
    });
  };

  // Ricalcola sovrapposizioni (stessa persona su più incarichi nella stessa settimana)
  const computeRowDuplicates = (row: MensileRow): { duplicates: string[]; warnings: string[] } => {
    if (row.special) return { duplicates: [], warnings: [] };

    const roleAssignments: { name: string; role: string }[] = [];
    if (row.ingresso?.[0] && row.ingresso[0] !== '—') roleAssignments.push({ name: row.ingresso[0], role: 'Uscieri ingresso' });
    if (row.ingresso?.[1] && row.ingresso[1] !== '—') roleAssignments.push({ name: row.ingresso[1], role: 'Uscieri ingresso' });
    if (row.auditorium && row.auditorium !== '—') roleAssignments.push({ name: row.auditorium, role: 'Usciere Auditorium' });
    if (row.microfoni?.[0] && row.microfoni[0] !== '—') roleAssignments.push({ name: row.microfoni[0], role: 'Microfonista' });
    if (row.microfoni?.[1] && row.microfoni[1] !== '—') roleAssignments.push({ name: row.microfoni[1], role: 'Microfonista' });
    if (row.audioVideo?.[0] && row.audioVideo[0] !== '—') roleAssignments.push({ name: row.audioVideo[0], role: 'Audio/Video' });
    if (row.audioVideo?.[1] && row.audioVideo[1] !== '—') roleAssignments.push({ name: row.audioVideo[1], role: 'Audio/Video' });

    const nameMap: Record<string, string[]> = {};
    roleAssignments.forEach(({ name, role }) => {
      if (!nameMap[name]) nameMap[name] = [];
      nameMap[name].push(role);
    });

    const duplicates: string[] = [];
    const warnings: string[] = [];
    Object.entries(nameMap).forEach(([name, rolesList]) => {
      if (rolesList.length > 1) {
        duplicates.push(name);
        warnings.push(`${name} è assegnato/a a più ruoli (${rolesList.join(', ')}) nella settimana del ${fmtShort(row.date)}.`);
      }
    });

    return { duplicates, warnings };
  };

  type MensileFieldKey = 'ingresso0' | 'ingresso1' | 'auditorium' | 'microfoni0' | 'microfoni1' | 'audioVideo0' | 'audioVideo1';

  // Cambia manualmente il nominativo assegnato a un incarico di una riga del programma mensile
  const updateMensileField = (rowIndex: number, field: MensileFieldKey, newName: string) => {
    if (!checkAdminPermission()) return;
    if (!menRows) return;
    const value = newName || '—';

    const updatedRows = menRows.map((r, i) => {
      if (i !== rowIndex || r.special) return r;
      const next: MensileRow = {
        ...r,
        ingresso: r.ingresso ? [...r.ingresso] as [string, string] : undefined,
        microfoni: r.microfoni ? [...r.microfoni] as [string, string] : undefined,
        audioVideo: r.audioVideo ? [...r.audioVideo] as [string, string] : undefined,
      };
      switch (field) {
        case 'ingresso0':
          next.ingresso = [value, next.ingresso?.[1] || '—'];
          break;
        case 'ingresso1':
          next.ingresso = [next.ingresso?.[0] || '—', value];
          break;
        case 'auditorium':
          next.auditorium = value;
          break;
        case 'microfoni0':
          next.microfoni = [value, next.microfoni?.[1] || '—'];
          break;
        case 'microfoni1':
          next.microfoni = [next.microfoni?.[0] || '—', value];
          break;
        case 'audioVideo0':
          next.audioVideo = [value, next.audioVideo?.[1] || '—'];
          break;
        case 'audioVideo1':
          next.audioVideo = [next.audioVideo?.[0] || '—', value];
          break;
      }
      const { duplicates, warnings } = computeRowDuplicates(next);
      next.duplicates = duplicates.length ? duplicates : undefined;
      next.warnings = warnings.length ? warnings : undefined;
      return next;
    });

    const combinedWarn = updatedRows.flatMap(r => r.warnings || []).join(' ') || null;
    setMenRows(updatedRows);
    setMenWarn(combinedWarn);
    syncActivePrograms({ menRows: updatedRows, menWarn: combinedWarn });
    showToast('Incarico aggiornato');
  };

  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);

  const saveMensileToArchive = () => {
    if (!menRows) return;
    const nowStr = new Date().toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const archiveId = `men-${menYear}-${menMonth + 1}-${Date.now()}`;
    const newArchive: ArchivedProgram = {
      id: archiveId,
      month: menMonth,
      year: menYear,
      title: menTitle || `Mese di ${MESI[menMonth]} ${menYear}`,
      savedAt: nowStr,
      rows: menRows.map(r => ({
        dateStr: r.date.toISOString(),
        special: r.special,
        ingresso: r.ingresso,
        auditorium: r.auditorium,
        microfoni: r.microfoni,
        audioVideo: r.audioVideo,
        riassetto: r.riassetto,
        pulizie: r.pulizie,
        duplicates: r.duplicates,
        warnings: r.warnings
      })),
      warn: menWarn,
    };

    const existing = state.mensileArchives || [];
    const filtered = existing.filter(a => !(a.month === menMonth && a.year === menYear));
    const updatedArchives = [newArchive, ...filtered];

    saveState({ ...state, mensileArchives: updatedArchives });
    setActiveArchiveId(archiveId);
    showToast(`Programma di ${MESI[menMonth]} ${menYear} archiviato`);
  };

  const exportMensileToExcel = () => {
    if (!menRows) return;
    const rows: (string | number)[][] = [
      ['Programma Incontro Vita e Ministero / Servizi Infrasettimanali', '', '', '', '', '', ''],
      [`${menTitle}`, '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Settimana del', 'Uscieri Ingresso', 'Usciere Auditorium', 'Microfonisti', 'Audio / Video', 'Riassetto', 'Pulizie del Fine Settimana'],
    ];

    menRows.forEach(r => {
      if (r.special) {
        rows.push([fmtShort(r.date), r.special, '', '', '', '', '']);
      } else {
        const ing = (r.ingresso || []).filter(Boolean).join(' — ');
        const mic = (r.microfoni || []).filter(Boolean).join(' — ');
        const av = (r.audioVideo || []).filter(Boolean).join(' — ');
        rows.push([
          fmtShort(r.date),
          ing || '---',
          r.auditorium || '---',
          mic || '---',
          av || '---',
          r.riassetto || '---',
          r.pulizie || '---',
        ]);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    ];
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 22 },
      { wch: 28 },
      { wch: 28 },
      { wch: 22 },
      { wch: 25 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Programma Infrasettimanale');
    XLSX.writeFile(workbook, `Programma_Infrasettimanale_${menTitle.replace(/\s+/g, '_')}.xlsx`);
    showToast('Programma Infrasettimanale esportato in Excel (.xlsx)!');
  };

  const exportDomenicaToExcel = () => {
    if (!domRows) return;
    const rows: (string | number)[][] = [
      ['Programma Adunanza del Fine Settimana', '', '', '', '', ''],
      [`${domTitle}`, '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Data', 'Oratore', 'Titolo discorso pubblico', 'Presidente', 'Preghiera finale', 'Lettore Torre di Guardia'],
    ];

    domRows.forEach(r => {
      if (r.special) {
        rows.push([`${GIORNI[r.date.getDay()]} ${fmtDate(r.date)}`, r.special, '', '', '', '']);
      } else {
        rows.push([
          `${GIORNI[r.date.getDay()]} ${fmtDate(r.date)}`,
          r.oratore || '---',
          r.titoloDiscorso || '---',
          r.presidente || '---',
          r.preghiera || '---',
          r.lettore || '---',
        ]);
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ];
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 24 },
      { wch: 55 },
      { wch: 25 },
      { wch: 25 },
      { wch: 28 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Adunanza Domenica');
    XLSX.writeFile(workbook, `Programma_Domenica_${domTitle.replace(/\s+/g, '_')}.xlsx`);
    showToast('Programma Domenica esportato in Excel (.xlsx)!');
  };

  const loadMensileArchive = (archive: ArchivedProgram) => {
    const rows: MensileRow[] = archive.rows.map(r => ({
      date: new Date(r.dateStr),
      special: r.special,
      ingresso: r.ingresso,
      auditorium: r.auditorium,
      microfoni: r.microfoni,
      audioVideo: r.audioVideo,
      riassetto: r.riassetto,
      pulizie: r.pulizie,
      duplicates: r.duplicates,
      warnings: r.warnings
    }));
    setMenRows(rows);
    setMenTitle(archive.title);
    setMenWarn(archive.warn || null);
    setMenMonth(archive.month);
    setMenYear(archive.year);
    setActiveArchiveId(archive.id);
    showToast(`Caricato dall'archivio: ${archive.title}`);
    syncActivePrograms({
      menRows: rows,
      menTitle: archive.title,
      menWarn: archive.warn || null,
      menMonth: archive.month,
      menYear: archive.year,
    });
  };

  const deleteMensileArchive = (archiveId: string, title: string) => {
    setConfirmModalState({
      title: 'Elimina dall\'Archivio',
      message: `Sei sicuro di voler eliminare dall'archivio il programma "${title}"?`,
      confirmText: 'Elimina',
      confirmVariant: 'danger',
      onConfirm: () => {
        const updated = (state.mensileArchives || []).filter(a => a.id !== archiveId);
        saveState({ ...state, mensileArchives: updated });
        if (activeArchiveId === archiveId) {
          setActiveArchiveId(null);
        }
        showToast('Programma rimosso dall\'archivio');
        setConfirmModalState(null);
      }
    });
  };

  const clearAllArchives = () => {
    if (!state.mensileArchives || state.mensileArchives.length === 0) return;
    setConfirmModalState({
      title: 'Svuota Archivio Programmi',
      message: 'Sei sicuro di voler cancellare TUTTI i programmi mensili salvati nell\'archivio?',
      confirmText: 'Svuota Archivio',
      confirmVariant: 'danger',
      onConfirm: () => {
        saveState({ ...state, mensileArchives: [] });
        setActiveArchiveId(null);
        showToast('Archivio programmi svuotato');
        setConfirmModalState(null);
      }
    });
  };

  const clearActiveArchive = () => {
    setActiveArchiveId(null);
  };

  const resetMensileProgram = () => {
    if (!menRows) {
      showToast('Nessun programma mensile da azzerare');
      return;
    }
    setConfirmModalState({
      title: 'Azzera Programma Mensile',
      message: 'Sei sicuro di voler azzerare il programma mensile attualmente visualizzato?',
      confirmText: 'Azzera Programma',
      confirmVariant: 'danger',
      onConfirm: () => {
        setMenRows(null);
        setMenWarn(null);
        setActiveArchiveId(null);
        showToast('Programma mensile azzerato');
        setConfirmModalState(null);
        syncActivePrograms({ menRows: null, menWarn: null });
      }
    });
  };

  const resetDomenicaProgram = () => {
    if (!domRows) {
      showToast('Nessun turno adunanza domenica da azzerare');
      return;
    }
    setConfirmModalState({
      title: 'Azzera Turni Domenica',
      message: 'Sei sicuro di voler azzerare i turni dell\'Adunanza Domenica?',
      confirmText: 'Azzera Turni',
      confirmVariant: 'danger',
      onConfirm: () => {
        setDomRows(null);
        setDomWarn(null);
        showToast('Turni adunanza domenica azzerati');
        setConfirmModalState(null);
        syncActivePrograms({ domRows: null, domWarn: null });
      }
    });
  };

  const resetAllPrograms = () => {
    if (!menRows && !domRows) {
      showToast('Nessun programma attivo da azzerare');
      return;
    }
    setConfirmModalState({
      title: 'Azzera Tutti i Programmi',
      message: 'Vuoi azzerare sia il Programma Mensile che l\'Adunanza Domenica attualmente visualizzati?',
      confirmText: 'Azzera Tutti i Programmi',
      confirmVariant: 'danger',
      onConfirm: () => {
        setMenRows(null);
        setMenWarn(null);
        setActiveArchiveId(null);
        setDomRows(null);
        setDomWarn(null);
        showToast('Tutti i programmi attivi sono stati azzerati');
        setConfirmModalState(null);
        syncActivePrograms({ menRows: null, menWarn: null, domRows: null, domWarn: null });
      }
    });
  };

  const resetToInitialDefaults = () => {
    setConfirmModalState({
      title: 'Ripristina Dati Iniziali',
      message: 'Vuoi ripristinare tutti i dati della congregazione allo stato iniziale? Verranno ripristinate le persone ed eliminati tutti i programmi salvati.',
      confirmText: 'Ripristina Tutto',
      confirmVariant: 'danger',
      onConfirm: () => {
        localStorage.removeItem(STORAGE_KEY);
        const initial = loadInitialState();
        saveState(initial);
        setMenRows(null);
        setMenWarn(null);
        setActiveArchiveId(null);
        setDomRows(null);
        setDomWarn(null);
        showToast('Dati ripristinati allo stato iniziale');
        setConfirmModalState(null);
        syncActivePrograms({ menRows: null, menWarn: null, domRows: null, domWarn: null });
      }
    });
  };

  // --- ADUNANZA DOMENICA STATE ---
  const [domMonth, setDomMonth] = useState(now.getMonth());
  const [domYear, setDomYear] = useState(now.getFullYear());
  const [domRows, setDomRows] = useState<DomenicaRow[] | null>(null);
  const [domWarn, setDomWarn] = useState<string | null>(null);
  const [domTitle, setDomTitle] = useState<string>('');

  const generateDomenica = (y: number, m: number) => {
    if (!checkAdminPermission()) return;
    const sundays = sundayDates(y, m);
    const presPool = state.people.filter(p => p.roles.presidente);
    const pregPool = state.people.filter(p => p.roles.preghiera);
    const lettPool = state.people.filter(p => p.roles.lettore);
    const pc: Record<string, number> = {}, pl: Record<string, number> = {};
    const rc: Record<string, number> = {}, rl: Record<string, number> = {};
    const lc: Record<string, number> = {}, ll: Record<string, number> = {};

    const rows: DomenicaRow[] = [];
    const warnings: string[] = [];
    if (presPool.length < 1) warnings.push('Nessun Presidente abilitato.');
    if (pregPool.length < 1) warnings.push('Nessuno abilitato per la Preghiera finale.');
    if (lettPool.length < 1) warnings.push('Nessun Lettore Torre di Guardia abilitato.');

    sundays.forEach((sun, idx) => {
      const key = iso(sun);
      if (state.special[key]) {
        rows.push({ date: sun, special: state.special[key] });
        return;
      }
      const wed = addDays(sun, 3);
      const unavailIds = state.people.filter(p => isUnavailable(p.id, sun, wed)).map(p => p.id);
      const used = [...unavailIds];

      const pres = fairPick(presPool, pc, pl, idx, used);
      if (pres) { markUsed(pres, pc, pl, idx); used.push(pres.id); }

      const preg = fairPick(pregPool, rc, rl, idx, used);
      if (preg) { markUsed(preg, rc, rl, idx); used.push(preg.id); }

      const lett = fairPick(lettPool, lc, ll, idx, used);
      if (lett) { markUsed(lett, lc, ll, idx); used.push(lett.id); }

      const row: DomenicaRow = {
        date: sun,
        oratore: '',
        titoloDiscorso: '',
        presidente: pres?.name || '—',
        preghiera: preg?.name || '—',
        lettore: lett?.name || '—',
      };

      // Validation check for duplicates
      const roleAssignments: { name: string; role: string }[] = [];
      if (row.presidente && row.presidente !== '—') roleAssignments.push({ name: row.presidente, role: 'Presidente' });
      if (row.preghiera && row.preghiera !== '—') roleAssignments.push({ name: row.preghiera, role: 'Preghiera' });
      if (row.lettore && row.lettore !== '—') roleAssignments.push({ name: row.lettore, role: 'Lettore' });

      const nameMap: Record<string, string[]> = {};
      roleAssignments.forEach(({ name, role }) => {
        if (!nameMap[name]) nameMap[name] = [];
        nameMap[name].push(role);
      });

      const duplicates: string[] = [];
      const rowWarns: string[] = [];
      Object.entries(nameMap).forEach(([name, rolesList]) => {
        if (rolesList.length > 1) {
          duplicates.push(name);
          rowWarns.push(`${name} è assegnato/a a più ruoli (${rolesList.join(', ')}) nell'adunanza del ${fmtDate(sun)}.`);
        }
      });

      if (duplicates.length > 0) {
        row.duplicates = duplicates;
        row.warnings = rowWarns;
        warnings.push(...rowWarns);
      }

      rows.push(row);
    });

    const title = `${MESI[m]} ${y}`;
    const warn = warnings.join(' ') || null;
    setDomTitle(title);
    setDomRows(rows);
    setDomWarn(warn);
    syncActivePrograms({
      domRows: rows,
      domTitle: title,
      domWarn: warn,
      domMonth: m,
      domYear: y,
    });
  };

  const updateDomenicaField = (rowIndex: number, field: 'oratore' | 'titoloDiscorso' | 'presidente' | 'preghiera', value: string) => {
    if (!checkAdminPermission() || !domRows) return;
    const updatedRows = domRows.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row);
    setDomRows(updatedRows);
    syncActivePrograms({ domRows: updatedRows });
  };

  // --- INDISPONIBILITÀ & DATE SPECIALI ---
  const [unPerson, setUnPerson] = useState('');
  const [unMode, setUnMode] = useState<'single' | 'range'>('single');
  const [unDate, setUnDate] = useState('');
  const [unStartDate, setUnStartDate] = useState('');
  const [unEndDate, setUnEndDate] = useState('');
  const [spDate, setSpDate] = useState('');
  const [spLabel, setSpLabel] = useState('');

  const handleAddUnavail = () => {
    if (!checkAdminPermission()) return;
    if (!unPerson) {
      showToast('Seleziona una persona');
      return;
    }

    if (unMode === 'single') {
      if (!unDate) {
        showToast('Seleziona la data');
        return;
      }
      const list = state.unavail[unPerson] || [];
      if (!list.includes(unDate)) {
        const newUnavail = { ...state.unavail, [unPerson]: [...list, unDate] };
        saveState({ ...state, unavail: newUnavail });
        showToast('Indisponibilità aggiunta');
      } else {
        showToast('Data già presente tra le indisponibilità');
      }
    } else {
      if (!unStartDate || !unEndDate) {
        showToast('Seleziona sia la data di inizio che la data di fine');
        return;
      }
      if (unStartDate > unEndDate) {
        showToast('La data di inizio deve essere precedente o uguale alla data di fine');
        return;
      }

      const datesToAdd: string[] = [];
      const cur = new Date(unStartDate + 'T00:00:00');
      const end = new Date(unEndDate + 'T00:00:00');

      while (cur <= end) {
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        datesToAdd.push(`${yyyy}-${mm}-${dd}`);
        cur.setDate(cur.getDate() + 1);
      }

      const list = state.unavail[unPerson] || [];
      const newList = Array.from(new Set([...list, ...datesToAdd]));
      const addedCount = newList.length - list.length;

      if (addedCount > 0) {
        const newUnavail = { ...state.unavail, [unPerson]: newList };
        saveState({ ...state, unavail: newUnavail });
        showToast(`Aggiunte ${addedCount} giornate di indisponibilità!`);
      } else {
        showToast('Tutte le date nell\'intervallo erano già state aggiunte');
      }
    }
  };

  const handleRemoveUnavail = (pid: string, d: string) => {
    if (!checkAdminPermission()) return;
    const list = (state.unavail[pid] || []).filter(x => x !== d);
    const newUnavail = { ...state.unavail };
    if (list.length === 0) delete newUnavail[pid];
    else newUnavail[pid] = list;
    saveState({ ...state, unavail: newUnavail });
    showToast('Rimossa');
  };

  const handleAddSpecial = () => {
    if (!checkAdminPermission()) return;
    if (!spDate || !spLabel.trim()) {
      showToast('Inserisci data ed etichetta');
      return;
    }
    const newSpecial = { ...state.special, [spDate]: spLabel.trim() };
    saveState({ ...state, special: newSpecial });
    setSpLabel('');
    showToast('Data speciale aggiunta');
  };

  const handleRemoveSpecial = (d: string) => {
    if (!checkAdminPermission()) return;
    const newSpecial = { ...state.special };
    delete newSpecial[d];
    saveState({ ...state, special: newSpecial });
    showToast('Rimossa');
  };

  // Import / Export JSON
  const handleExportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    triggerDownload(blob, 'dati_congregazione.json');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkAdminPermission()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showToast('Impossibile leggere il file');
    reader.onload = () => {
      let text = String(reader.result || '');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      text = text.trim();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (err) {
        showToast('File non è un JSON valido');
        return;
      }
      if (!data || !Array.isArray(data.people)) {
        showToast('File non valido: manca l\'anagrafica');
        return;
      }
      try {
        const norm = normalize(data);
        saveState(norm);
        showToast('Dati importati: ' + norm.people.length + ' persone');
      } catch (err: any) {
        showToast('Errore nell\'applicare i dati: ' + (err?.message || err));
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const filteredPeople = state.people
    .filter(p => {
      const matchSearch = !peopleSearch.trim() || p.name.toLowerCase().includes(peopleSearch.trim().toLowerCase());
      if (!matchSearch) return false;
      if (anagraficaFilter === 'all') return true;
      if (anagraficaFilter === 'M') return p.gender === 'M';
      if (anagraficaFilter === 'F') return p.gender === 'F';
      if (anagraficaFilter === 'uscieri') return p.roles.uscieri;
      if (anagraficaFilter === 'console') return p.roles.console;
      if (anagraficaFilter === 'microfoni') return p.roles.microfoni;
      if (anagraficaFilter === 'presidente') return p.roles.presidente;
      if (anagraficaFilter === 'lettore') return p.roles.lettore;
      if (anagraficaFilter === 'preghiera') return p.roles.preghiera;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const countMen = state.people.filter(p => p.gender === 'M').length;
  const countWomen = state.people.filter(p => p.gender === 'F').length;
  const countUscieri = state.people.filter(p => p.roles.uscieri).length;
  const countConsole = state.people.filter(p => p.roles.console).length;
  const countMic = state.people.filter(p => p.roles.microfoni).length;
  const countPres = state.people.filter(p => p.roles.presidente).length;
  const countLett = state.people.filter(p => p.roles.lettore).length;
  const countPreg = state.people.filter(p => p.roles.preghiera).length;

  const unavailEntries: { pid: string; d: string }[] = [];
  Object.entries(state.unavail).forEach(([pid, dates]) => {
    (dates as string[]).forEach(d => unavailEntries.push({ pid, d }));
  });
  unavailEntries.sort((a, b) => a.d.localeCompare(b.d));

  const specialEntries = Object.entries(state.special).sort((a, b) => a[0].localeCompare(b[0]));

  const activeSectionTitle: Record<SectionKey | 'hub', string> = {
    hub: 'Dashboard',
    anagrafica: 'Persone',
    mensile: 'Programma mensile',
    domenica: 'Adunanza domenica',
    vitaEMinistero: 'Vita e ministero',
    servizioCampo: 'Servizio di campo',
    operaPubblica: 'Opera pubblica',
    impostazioni: 'Assenze e calendario',
    statistiche: 'Statistiche',
  };

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        adminPin={state.adminPin || '1122'}
        viewerPin={state.viewerPin || '1234'}
      />
    );
  }

  return (
    <div id="app" className="min-h-screen bg-slate-50 font-sans">
      <div className="app-shell">
        <ModernSquareNavbar
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          peopleCount={state.people.length}
        />

        <div className="app-main">
          <header className="app-topbar no-print">
            <div className="min-w-0">
              <div className="text-sm text-slate-500">Gestione Congregazione</div>
              <div className="text-lg font-semibold text-slate-950 truncate">{activeSectionTitle[activeTab]}</div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => showToast(syncMsg)}
                className="sync-chip hidden sm:inline-flex"
                title="Stato sincronizzazione"
              >
                <span className={`sync-dot ${syncMsg.toLowerCase().includes('offline') ? 'is-warning' : ''}`} />
                <span className="max-w-[190px] truncate">{syncMsg}</span>
              </button>

              <button onClick={handleExportData} className="icon-button hidden md:inline-flex" title="Esporta dati">
                <Download className="w-4 h-4" />
              </button>
              <label className="icon-button hidden md:inline-flex cursor-pointer" title="Importa dati">
                <Upload className="w-4 h-4" />
                <input type="file" accept="application/json" onChange={handleImportData} className="hidden" />
              </label>

              <div className="user-chip">
                {currentUser.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{currentUser.displayName || (currentUser.role === 'admin' ? 'Admin' : 'Consultazione')}</span>
              </div>
              <button onClick={handleLogout} className="icon-button" title="Esci">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </header>

          {currentUser.role === 'viewer' && (
            <div className="viewer-banner no-print">
              <Eye className="w-4 h-4 shrink-0" />
              <span>Modalità sola lettura. Le modifiche richiedono accesso amministratore.</span>
              <button onClick={handleLogout}>Cambia accesso</button>
            </div>
          )}

          <main className="app-content">
      {/* ============ HUB PRINCIPALE A QUADRATI MODERNI ============ */}
      {activeTab === 'hub' && (
        <ModernSectionHub
          state={state}
          menRows={menRows}
          menMonth={menMonth}
          menYear={menYear}
          domRows={domRows}
          domMonth={domMonth}
          domYear={domYear}
          onSelectSection={(sec) => setActiveTab(sec)}
          currentUserRole={currentUser?.role}
          onUpdateResponsible={updateProgramResponsible}
        />
      )}

      {/* ============ ANAGRAFICA ============ */}
      {activeTab === 'anagrafica' && (
        <section className="tab-panel no-print space-y-5">
          <div className="page-heading">
            <div>
              <p className="page-eyebrow">Anagrafica</p>
              <h1 className="page-title">Persone</h1>
              <p className="page-description">Consulta le persone e gestisci le abilitazioni agli incarichi.</p>
            </div>
            {currentUser.role === 'admin' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
                  onClick={() => setShowExcelImportModal(true)}
                  title="Importa anagrafica proclamatori da file Excel (.xlsx, .xls, .csv)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Importa da Excel</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => { resetPersonForm(); setShowPersonEditor(true); }}
                >
                  <UserPlus className="w-4 h-4" /> Aggiungi persona
                </button>
              </div>
            )}
          </div>

          {/* Quick statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <div className="metric-card compact">
              <div className="metric-value">{state.people.length}</div>
              <div className="metric-label">Totale</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countMen}</div>
              <div className="metric-label">Uomini</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countWomen}</div>
              <div className="metric-label">Donne</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countUscieri}</div>
              <div className="metric-label">Uscieri</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countConsole}</div>
              <div className="metric-label">Audio/Video</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countMic}</div>
              <div className="metric-label">Microfoni</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countPres}</div>
              <div className="metric-label">Presidenti</div>
            </div>
            <div className="metric-card compact">
              <div className="metric-value">{countLett}</div>
              <div className="metric-label">Lettori</div>
            </div>
          </div>

          {/* Person editor drawer */}
          {showPersonEditor && (
            <div className="person-editor-layer">
              <button
                type="button"
                className="person-editor-backdrop"
                aria-label="Chiudi modifica persona"
                onClick={() => { resetPersonForm(); setShowPersonEditor(false); }}
              />
              <div className="person-editor-panel">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="card-title text-sky-950 dark:text-sky-100">
                    {personId ? 'Modifica persona' : 'Aggiungi persona'}
                  </h2>
                  <p className="text-xs text-sky-700/80 dark:text-sky-400/80">
                    Gestione anagrafica proclamatori e abilitazione incarichi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {personId && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                    Modifica
                  </span>
                )}
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => { resetPersonForm(); setShowPersonEditor(false); }}
                  aria-label="Chiudi"
                >
                  ×
                </button>
              </div>
            </div>
            <form onSubmit={handlePersonSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <input type="hidden" value={personId} />
              <div className="flex flex-col gap-1">
                <label className="lbl text-sky-900 dark:text-sky-200">Nome e cognome</label>
                <input
                  value={personName}
                  onChange={e => setPersonName(e.target.value)}
                  className="inp focus:border-sky-500 focus:ring-sky-500/20"
                  placeholder="Es. Mario Rossi"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="lbl text-sky-900 dark:text-sky-200">Sesso</label>
                <select
                  value={personGender}
                  onChange={e => setPersonGender(e.target.value as 'M' | 'F')}
                  className="inp focus:border-sky-500"
                >
                  <option value="M">Uomo</option>
                  <option value="F">Donna</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="lbl text-sky-900 dark:text-sky-200">Coniuge (per regola console)</label>
                <select
                  value={personSpouse}
                  onChange={e => setPersonSpouse(e.target.value)}
                  className="inp focus:border-sky-500"
                >
                  <option value="">— Nessuno —</option>
                  {state.people
                    .filter(p => p.id !== personId)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="sm:col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mt-1">
                <span className="lbl text-sky-900 dark:text-sky-200 block mb-2 font-bold">Ruoli abilitati:</span>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={roles.uscieri}
                      onChange={e => setRoles({ ...roles, uscieri: e.target.checked })}
                      className="accent-sky-600"
                    /> Usciere
                  </label>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={roles.console}
                      onChange={e => setRoles({ ...roles, console: e.target.checked })}
                      className="accent-sky-600"
                    /> Audio/Video (console)
                  </label>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={roles.microfoni}
                      onChange={e => setRoles({ ...roles, microfoni: e.target.checked })}
                      className="accent-sky-600"
                    /> Microfonista
                  </label>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={roles.presidente}
                      onChange={e => setRoles({ ...roles, presidente: e.target.checked })}
                      className="accent-sky-600"
                    /> Presidente
                  </label>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={roles.preghiera}
                      onChange={e => setRoles({ ...roles, preghiera: e.target.checked })}
                      className="accent-sky-600"
                    /> Preghiera finale
                  </label>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={roles.lettore}
                      onChange={e => setRoles({ ...roles, lettore: e.target.checked })}
                      className="accent-sky-600"
                    /> Lettore Torre di Guardia
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2 flex gap-2.5 mt-1">
                <button type="submit" className="btn-sky">
                  <Check className="w-4 h-4" />
                  <span>{personId ? 'Aggiorna persona' : 'Salva persona'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { resetPersonForm(); setShowPersonEditor(false); }}
                  className="btn-ghost"
                >
                  Annulla
                </button>
              </div>
            </form>
              </div>
            </div>
          )}

          {/* Directory List Card */}
          <div className="card border-sky-200 dark:border-sky-900/60 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-sky-100 dark:border-sky-900/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="card-title text-sky-950 dark:text-sky-100">
                    Elenco Anagrafica <span className="text-sky-600 dark:text-sky-400 font-normal ml-1">({filteredPeople.length}{filteredPeople.length !== state.people.length ? ` di ${state.people.length}` : ''})</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Consulta, cerca e filtra i fratelli e le sorelle della congregazione
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={peopleSearch}
                    onChange={e => setPeopleSearch(e.target.value)}
                    className="inp pl-9 pr-3 py-2 sm:w-[260px]"
                    placeholder="Cerca per nome..."
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <div className="flex items-center gap-1.5 sm:hidden">
                    <button
                      type="button"
                      className="icon-button border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400"
                      onClick={() => setShowExcelImportModal(true)}
                      aria-label="Importa da Excel"
                      title="Importa da Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { resetPersonForm(); setShowPersonEditor(true); }}
                      aria-label="Aggiungi persona"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">Filtra per:</span>
              <button
                onClick={() => setAnagraficaFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'all'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-sky-100 hover:text-sky-800'
                }`}
              >
                Tutti ({state.people.length})
              </button>
              <button
                onClick={() => setAnagraficaFilter('M')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'M'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 hover:bg-blue-100'
                }`}
              >
                Uomini ({countMen})
              </button>
              <button
                onClick={() => setAnagraficaFilter('F')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'F'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100'
                }`}
              >
                Donne ({countWomen})
              </button>
              <button
                onClick={() => setAnagraficaFilter('uscieri')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'uscieri'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                Uscieri ({countUscieri})
              </button>
              <button
                onClick={() => setAnagraficaFilter('console')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'console'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 hover:bg-indigo-100'
                }`}
              >
                Audio/Video ({countConsole})
              </button>
              <button
                onClick={() => setAnagraficaFilter('microfoni')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'microfoni'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 hover:bg-teal-100'
                }`}
              >
                Microfoni ({countMic})
              </button>
              <button
                onClick={() => setAnagraficaFilter('presidente')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'presidente'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 hover:bg-purple-100'
                }`}
              >
                Presidenti ({countPres})
              </button>
              <button
                onClick={() => setAnagraficaFilter('lettore')}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  anagraficaFilter === 'lettore'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                Lettori ({countLett})
              </button>
            </div>

            <div className="table-wrapper border border-sky-200 dark:border-sky-900/60 rounded-xl">
              <table className="tbl">
                <thead>
                  <tr className="bg-sky-100/70 dark:bg-sky-950/60 text-sky-950 dark:text-sky-200">
                    <th className="font-bold">Nome</th>
                    <th className="font-bold">Sesso</th>
                    <th className="font-bold">Coniuge</th>
                    <th className="text-center font-bold">Usc.</th>
                    <th className="text-center font-bold">A/V</th>
                    <th className="text-center font-bold">Micr.</th>
                    <th className="text-center font-bold">Pres.</th>
                    <th className="text-center font-bold">Pregh.</th>
                    <th className="text-center font-bold">Lett.</th>
                    <th className="text-right font-bold">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPeople.map(p => {
                    const spouse = p.spouseId ? (personById(p.spouseId)?.name || '—') : '—';
                    const chk = (v: boolean) => (
                      v ? <Check className="w-4 h-4 text-sky-600 dark:text-sky-400 mx-auto stroke-[2.5]" /> : <span className="text-slate-300 dark:text-slate-700">—</span>
                    );
                    return (
                      <tr key={p.id} className="hover:bg-sky-50/40 dark:hover:bg-sky-950/30 transition-colors">
                        <td className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</td>
                        <td>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            p.gender === 'M'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                          }`}>
                            {p.gender === 'M' ? 'Uomo' : 'Donna'}
                          </span>
                        </td>
                        <td className="text-slate-500 dark:text-slate-400">{spouse}</td>
                        <td className="text-center">{chk(p.roles.uscieri)}</td>
                        <td className="text-center">{chk(p.roles.console)}</td>
                        <td className="text-center">{chk(p.roles.microfoni)}</td>
                        <td className="text-center">{chk(p.roles.presidente)}</td>
                        <td className="text-center">{chk(p.roles.preghiera)}</td>
                        <td className="text-center">{chk(p.roles.lettore)}</td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            onClick={() => editPerson(p.id)}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 dark:text-sky-300 dark:border-sky-800/60 rounded-lg px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1 transition-colors mr-1"
                            title="Modifica"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modifica</span>
                          </button>
                          <button
                            onClick={() => deletePerson(p.id)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800/60 rounded-lg px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Elimina</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredPeople.length === 0 && (
              <div className="text-center py-10 space-y-3">
                <p className="text-slate-400">
                  {peopleSearch || anagraficaFilter !== 'all'
                    ? 'Nessuna persona corrisponde ai criteri di ricerca/filtro.'
                    : 'Nessuna persona in anagrafica.'}
                </p>
                {currentUser.role === 'admin' && !peopleSearch && anagraficaFilter === 'all' && (
                  <div className="flex items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      className="btn-ghost text-xs border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5"
                      onClick={() => setShowExcelImportModal(true)}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Importa da file Excel
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs inline-flex items-center gap-1.5"
                      onClick={() => { resetPersonForm(); setShowPersonEditor(true); }}
                    >
                      <UserPlus className="w-4 h-4" /> Aggiungi persona
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============ PROGRAMMA MENSILE ============ */}
      {activeTab === 'mensile' && (
        <section className="tab-panel space-y-5">
          <div className="page-heading no-print">
            <div>
              <p className="page-eyebrow">Programmi</p>
              <h1 className="page-title">Programma mensile</h1>
              <p className="page-description">Genera e gestisci i turni di sala per il mese selezionato.</p>
            </div>
          </div>
          <div className="card no-print">
            <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="card-title">Genera Programma Mensile</h2>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Un unico programma per settimana: Uscieri (2 ingresso + 1 auditorium), Microfonisti (2), Audio/Video console (2, mai uomo+donna salvo coniugi), Riassetto (gruppi 1‑4) e Pulizie (gruppi 1‑4 + Massa).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
              <div className="flex flex-col gap-1">
                <label className="lbl">Mese</label>
                <select
                  value={menMonth}
                  onChange={e => setMenMonth(parseInt(e.target.value, 10))}
                  className="inp"
                >
                  {MESI.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="lbl">Anno</label>
                <input
                  type="number"
                  value={menYear}
                  onChange={e => setMenYear(parseInt(e.target.value, 10))}
                  className="inp"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => generateMensile(menYear, menMonth)}
                  className="btn-primary w-full"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Genera programma</span>
                </button>
              </div>
            </div>
            {menRows && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                <button
                  onClick={saveMensileToArchive}
                  className="btn-primary"
                  title="Salva o aggiorna questo programma nell'archivio permanente"
                >
                  <Save className="w-4 h-4" />
                  <span>{activeArchiveId ? 'Aggiorna in Archivio' : 'Salva in Archivio'}</span>
                </button>
                <button onClick={() => window.print()} className="btn-ghost" title="Stampa o salva in PDF">
                  <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Stampa / PDF</span>
                </button>
                <button
                  onClick={exportMensileToExcel}
                  className="btn-ghost text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100"
                  title="Esporta in formato Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Esporta Excel (.xlsx)</span>
                </button>
                <button
                  onClick={() => {
                    if (!menRows) return;
                    const header = ['Settimana del', 'Uscieri ingresso 1', 'Uscieri ingresso 2', 'Usciere Auditorium', 'Microfonista 1', 'Microfonista 2', 'Audio/Video 1', 'Audio/Video 2', 'Riassetto', 'Pulizie'];
                    const data = menRows.map(r => r.special
                      ? [fmtShort(r.date), r.special, '', '', '', '', '', '', '', '']
                      : [fmtShort(r.date), r.ingresso?.[0], r.ingresso?.[1], r.auditorium, r.microfoni?.[0], r.microfoni?.[1], r.audioVideo?.[0], r.audioVideo?.[1], r.riassetto, r.pulizie]);
                    downloadCsv('programma_mensile_' + menTitle.replace(/\s+/g, '_') + '.csv', header, data);
                  }}
                  className="btn-ghost text-slate-500 text-xs"
                  title="Esporta CSV grezzo"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={resetMensileProgram}
                  className="btn-ghost text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Azzera e svuota il programma mensile attualmente visualizzato"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Azzera Programma</span>
                </button>
              </div>
            )}
          </div>

          {/* ARCHIVIO PROGRAMMI MENSILE */}
          <div className="card mb-5 no-print">
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="card-title">Archivio Programmi Mensili</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {(state.mensileArchives || []).length} { (state.mensileArchives || []).length === 1 ? 'salvato' : 'salvati' }
                </span>
                {(state.mensileArchives || []).length > 0 && (
                  <button
                    onClick={clearAllArchives}
                    className="btn-ghost text-xs text-rose-600 dark:text-rose-400 py-1 px-2 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Svuota l'intero archivio dei programmi salvati"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Svuota Archivio</span>
                  </button>
                )}
              </div>
            </div>

            {(!state.mensileArchives || state.mensileArchives.length === 0) ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-3 text-center">
                Nessun programma archiviato. Genera un programma mensile e clicca su "Salva in Archivio" per consultarlo in seguito.
              </p>
            ) : (
              <div className="table-wrapper border border-slate-200 dark:border-slate-800 rounded-xl mt-3">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Periodo</th>
                      <th>Data salvataggio</th>
                      <th className="text-center">Settimane</th>
                      <th className="text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.mensileArchives.map(a => {
                      const isViewing = activeArchiveId === a.id;
                      return (
                        <tr key={a.id} className={isViewing ? "bg-indigo-50/70 dark:bg-indigo-950/30 font-medium" : undefined}>
                          <td className="font-semibold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <span>{a.title}</span>
                              {isViewing && (
                                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                                  In visione
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-xs text-slate-500 dark:text-slate-400">{a.savedAt}</td>
                          <td className="text-center text-xs text-slate-600 dark:text-slate-400">{a.rows.length}</td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              onClick={() => loadMensileArchive(a)}
                              className={`icon-btn mr-1.5 ${isViewing ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'edit'}`}
                              title="Consulta programma"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isViewing ? 'In visione' : 'Consulta'}</span>
                            </button>
                            <button
                              onClick={() => deleteMensileArchive(a.id, a.title)}
                              className="icon-btn"
                              title="Elimina dall'archivio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Elimina</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {activeArchiveId && (
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-xl p-3.5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print shadow-sm">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium text-xs sm:text-sm">
                <Archive className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  Stai consultando la versione archiviata di: <strong>{menTitle}</strong> (salvata il {state.mensileArchives?.find(a => a.id === activeArchiveId)?.savedAt}).
                </span>
              </div>
              <button
                onClick={clearActiveArchive}
                className="btn-ghost text-xs whitespace-nowrap bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
              >
                Torna a generazione libera
              </button>
            </div>
          )}

          {menRows && (() => {
            const uscieriOptions = state.people.filter(p => p.roles.uscieri).sort((a, b) => a.name.localeCompare(b.name));
            const microfoniOptions = state.people.filter(p => p.roles.microfoni).sort((a, b) => a.name.localeCompare(b.name));
            const audioVideoOptions = state.people.filter(p => p.roles.console).sort((a, b) => a.name.localeCompare(b.name));
            return (
            <div className="print-sheet">
              {currentUser?.role === 'admin' && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 no-print">
                  Clicca su un nominativo per assegnare un'altra persona all'incarico.
                </p>
              )}
              <div className="prog-banner">
                <div className="prog-title">Programma</div>
                <div className="prog-sub">Uscieri - Microfonisti - Audio / Video - Riassetto e Pulizie</div>
                <div className="prog-month">{menTitle}</div>
              </div>
              <div className="table-wrapper">
                <table className="prog-table">
                  <thead>
                    <tr>
                      <th className="w-week" rowSpan={2}>Settimana<br />del:</th>
                      <th><LogIn className="prog-th-icon" /><div>Uscieri ingresso</div></th>
                      <th><Users className="prog-th-icon" /><div>Usciere<br />Auditorium</div></th>
                      <th><Mic className="prog-th-icon" /><div>Microfonisti</div></th>
                      <th><MonitorPlay className="prog-th-icon" /><div>Audio / Video</div></th>
                      <th><Armchair className="prog-th-icon" /><div>Riassetto</div></th>
                      <th><Sparkles className="prog-th-icon" /><div>Pulizie del<br />fine settimana</div></th>
                    </tr>
                    <tr className="prog-subheader">
                      <th>Nominativo</th>
                      <th>Nominativo</th>
                      <th>Nominativo</th>
                      <th>Nominativo</th>
                      <th>Gruppo</th>
                      <th>Gruppo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menRows.map((r, i) => {
                      if (r.special) {
                        return (
                          <React.Fragment key={i}>
                            <tr className="special-row">
                              <td className="week-cell">{fmtShort(r.date)}</td>
                              <td colSpan={6}>{r.special}</td>
                            </tr>
                            {i < menRows.length - 1 && (
                              <tr className="week-spacer"><td colSpan={7} /></tr>
                            )}
                          </React.Fragment>
                        );
                      }
                      const hasDup = r.duplicates && r.duplicates.length > 0;
                      const rowClass = hasDup ? 'week-row-warn' : undefined;
                      return (
                        <React.Fragment key={i}>
                          <tr className={rowClass}>
                            <td className="week-cell" rowSpan={2}>
                              <div className="flex items-center justify-center gap-1">
                                {hasDup && (
                                  <span className="text-amber-600 font-bold text-sm" title={r.warnings?.join('\n')}>⚠</span>
                                )}
                                <span>{fmtShort(r.date)}</span>
                              </div>
                            </td>
                            <td>{renderMensileCell(i, 'ingresso0', r.ingresso?.[0], uscieriOptions, r.duplicates)}</td>
                            <td rowSpan={2}>{renderMensileCell(i, 'auditorium', r.auditorium, uscieriOptions, r.duplicates)}</td>
                            <td>{renderMensileCell(i, 'microfoni0', r.microfoni?.[0], microfoniOptions, r.duplicates)}</td>
                            <td>{renderMensileCell(i, 'audioVideo0', r.audioVideo?.[0], audioVideoOptions, r.duplicates)}</td>
                            <td className="group-cell" rowSpan={2}>{renderGroupCell(i, 'riassetto', r.riassetto)}</td>
                            <td className="group-cell" rowSpan={2}>{renderGroupCell(i, 'pulizie', r.pulizie)}</td>
                          </tr>
                          <tr className={rowClass}>
                            <td>{renderMensileCell(i, 'ingresso1', r.ingresso?.[1], uscieriOptions, r.duplicates)}</td>
                            <td>{renderMensileCell(i, 'microfoni1', r.microfoni?.[1], microfoniOptions, r.duplicates)}</td>
                            <td>{renderMensileCell(i, 'audioVideo1', r.audioVideo?.[1], audioVideoOptions, r.duplicates)}</td>
                          </tr>
                          {i < menRows.length - 1 && (
                            <tr className="week-spacer"><td colSpan={7} /></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {menWarn && <div className="warn">⚠ {menWarn}</div>}
            </div>
            );
          })()}
        </section>
      )}

      {/* ============ ADUNANZA DOMENICA ============ */}
      {activeTab === 'domenica' && (
        <section className="tab-panel space-y-5">
          <div className="page-heading no-print">
            <div>
              <p className="page-eyebrow">Programmi</p>
              <h1 className="page-title">Adunanza domenica</h1>
              <p className="page-description">Pianifica oratore, titolo del discorso pubblico, presidente, preghiera finale e lettore per le domeniche del mese.</p>
            </div>
          </div>
          <div className="card no-print">
            <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800">
              <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="card-title">Genera programma Adunanza Domenica</h2>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Per ogni domenica: oratore e discorso pubblico, Presidente, Preghiera finale e Lettore Torre di Guardia. Rotazione equa; una persona non ricopre due ruoli nella stessa adunanza. Rispetta indisponibilità e date speciali.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
              <div className="flex flex-col gap-1">
                <label className="lbl">Mese</label>
                <select
                  value={domMonth}
                  onChange={e => setDomMonth(parseInt(e.target.value, 10))}
                  className="inp"
                >
                  {MESI.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="lbl">Anno</label>
                <input
                  type="number"
                  value={domYear}
                  onChange={e => setDomYear(parseInt(e.target.value, 10))}
                  className="inp"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => generateDomenica(domYear, domMonth)}
                  className="btn-primary w-full"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Genera turni</span>
                </button>
              </div>
            </div>
          </div>

          {domRows && (
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 no-print">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="card-title">Adunanza Domenica — <span className="text-indigo-600 dark:text-indigo-400 font-bold">{domTitle}</span></h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.print()} className="btn-ghost" title="Stampa o salva in PDF">
                    <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Stampa / PDF</span>
                  </button>
                  <button
                    onClick={exportDomenicaToExcel}
                    className="btn-ghost text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100"
                    title="Esporta in formato Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Esporta Excel (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!domRows) return;
                      const header = ['Data', 'Giorno', 'Oratore', 'Titolo discorso pubblico', 'Presidente', 'Preghiera finale', 'Lettore Torre di Guardia'];
                      const data = domRows.map(r => r.special
                        ? [fmtDate(r.date), GIORNI[r.date.getDay()], r.special, '', '', '', '']
                        : [fmtDate(r.date), GIORNI[r.date.getDay()], r.oratore || '', r.titoloDiscorso || '', r.presidente, r.preghiera, r.lettore]);
                      downloadCsv('adunanza_domenica_' + domTitle.replace(/\s+/g, '_') + '.csv', header, data);
                    }}
                    className="btn-ghost text-slate-500 text-xs"
                    title="Esporta CSV grezzo"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={resetDomenicaProgram}
                    className="btn-ghost text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Azzera e svuota i turni dell'adunanza domenica"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Azzera Turni</span>
                  </button>
                </div>
              </div>
              <div className="table-wrapper border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Giorno</th>
                      <th>Oratore</th>
                      <th>Discorso pubblico</th>
                      <th>Presidente</th>
                      <th>Preghiera finale</th>
                      <th>Lettore Torre di Guardia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domRows.map((r, i) => {
                      const hasDup = r.duplicates && r.duplicates.length > 0;
                      return (
                        <tr key={i} className={hasDup ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}>
                          <td>
                            <div className="flex items-center gap-1.5 font-medium">
                              {hasDup && (
                                <span className="text-amber-600 font-bold text-sm" title={r.warnings?.join('\n')}>⚠</span>
                              )}
                              <span>{fmtDate(r.date)}</span>
                            </div>
                          </td>
                          <td className="text-slate-500 dark:text-slate-400">{GIORNI[r.date.getDay()]}</td>
                          {r.special ? (
                            <td colSpan={5} className="italic text-amber-700 dark:text-amber-400 font-medium">{r.special}</td>
                          ) : (
                            <>
                              <td>
                                {currentUser?.role === 'admin' ? <>
                                  <input className="mensile-select no-print text-left" value={r.oratore || ''} placeholder="Nome oratore" onChange={e => updateDomenicaField(i, 'oratore', e.target.value)} />
                                  <span className="print-only">{r.oratore || '—'}</span>
                                </> : (r.oratore || '—')}
                              </td>
                              <td>
                                {currentUser?.role === 'admin' ? <>
                                  <select className="mensile-select no-print" value={r.titoloDiscorso || ''} onChange={e => updateDomenicaField(i, 'titoloDiscorso', e.target.value)}>
                                    <option value="">Seleziona il tema…</option>
                                    {TITOLI_DISCORSI_PUBBLICI.map((title, index) => <option key={index} value={title}>{title}</option>)}
                                  </select>
                                  <span className="print-only">{r.titoloDiscorso || '—'}</span>
                                </> : (r.titoloDiscorso || '—')}
                              </td>
                              {(['presidente', 'preghiera'] as const).map(field => {
                                const eligible = state.people.filter(person => field === 'presidente' ? person.roles.presidente : person.roles.preghiera);
                                const current = r[field] || '';
                                return <td key={field}>
                                  {currentUser?.role === 'admin' ? <>
                                    <select className="mensile-select no-print" value={current} onChange={e => updateDomenicaField(i, field, e.target.value)}>
                                      <option value="">—</option>
                                      {current && !eligible.some(person => person.name === current) && <option value={current}>{current} (non abilitato)</option>}
                                      {eligible.map(person => <option key={person.id} value={person.name}>{person.name}</option>)}
                                    </select>
                                    <span className="print-only">{current || '—'}</span>
                                  </> : renderPersonName(current, r.duplicates)}
                                </td>;
                              })}
                              <td>{renderPersonName(r.lettore, r.duplicates)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {domWarn && <div className="warn"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" /> <span>{domWarn}</span></div>}
            </div>
          )}
        </section>
      )}

      {/* ============ INDISPONIBILITÀ & DATE SPECIALI ============ */}
      {activeTab === 'impostazioni' && (
        <section className="tab-panel no-print space-y-5">
          <div className="page-heading">
            <div>
              <p className="page-eyebrow">Gestione</p>
              <h1 className="page-title">Assenze e calendario</h1>
              <p className="page-description">Registra indisponibilità e date speciali che influenzano la generazione dei programmi.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="card">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2 className="card-title">Indisponibilità</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Segna le date o un intervallo di più settimane in cui una persona non è disponibile.
              </p>

              {/* Mode Switcher */}
              <div className="flex items-center gap-3 mt-3 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setUnMode('single')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                    unMode === 'single'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  📅 Data Singola
                </button>
                <button
                  type="button"
                  onClick={() => setUnMode('range')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition-all ${
                    unMode === 'range'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  🗓️ Intervallo (Più settimane)
                </button>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="lbl">Persona</label>
                  <select
                    value={unPerson}
                    onChange={e => setUnPerson(e.target.value)}
                    className="inp text-xs"
                  >
                    <option value="">— Seleziona persona —</option>
                    {state.people
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                </div>

                {unMode === 'single' ? (
                  <div className="flex flex-col gap-1">
                    <label className="lbl">Data</label>
                    <input
                      type="date"
                      value={unDate}
                      onChange={e => setUnDate(e.target.value)}
                      className="inp text-xs"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="lbl">Data Inizio Range</label>
                      <input
                        type="date"
                        value={unStartDate}
                        onChange={e => setUnStartDate(e.target.value)}
                        className="inp text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="lbl">Data Fine Range</label>
                      <input
                        type="date"
                        value={unEndDate}
                        onChange={e => setUnEndDate(e.target.value)}
                        className="inp text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleAddUnavail} className="btn-primary mt-4 w-full justify-center">
                <Clock className="w-4 h-4" />
                <span>
                  {unMode === 'single' ? 'Aggiungi Indisponibilità Singola' : 'Aggiungi Intervallo Indisponibilità'}
                </span>
              </button>
              <div className="table-wrapper border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Data</th>
                      <th className="text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unavailEntries.map(({ pid, d }) => {
                      const name = personById(pid)?.name || '(eliminato)';
                      const [y, mo, da] = d.split('-');
                      return (
                        <tr key={`${pid}-${d}`}>
                          <td className="font-medium text-slate-900 dark:text-slate-100">{name}</td>
                          <td className="text-slate-600 dark:text-slate-300">{`${da}/${mo}/${y}`}</td>
                          <td className="text-right">
                            <button
                              onClick={() => handleRemoveUnavail(pid, d)}
                              className="icon-btn"
                              title="Rimuovi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Rimuovi</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {unavailEntries.length === 0 && (
                <p className="text-slate-400 text-center py-6 text-xs">Nessuna indisponibilità registrata.</p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="card-title">Date speciali</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Settimane senza adunanza normale (assemblea, commemorazione, ecc.). La riga mostrerà l'etichetta al posto degli incarichi.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="lbl">Data (domenica della settimana)</label>
                  <input
                    type="date"
                    value={spDate}
                    onChange={e => setSpDate(e.target.value)}
                    className="inp"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="lbl">Etichetta</label>
                  <input
                    value={spLabel}
                    onChange={e => setSpLabel(e.target.value)}
                    className="inp"
                    placeholder="Es. Assemblea di circoscrizione"
                  />
                </div>
              </div>
              <button onClick={handleAddSpecial} className="btn-primary mt-4">
                <Calendar className="w-4 h-4" />
                <span>Aggiungi data speciale</span>
              </button>
              <div className="table-wrapper border border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Etichetta</th>
                      <th className="text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialEntries.map(([d, label]) => {
                      const [y, mo, da] = d.split('-');
                      return (
                        <tr key={d}>
                          <td className="font-medium text-slate-900 dark:text-slate-100">{`${da}/${mo}/${y}`}</td>
                          <td className="text-slate-600 dark:text-slate-300">{label}</td>
                          <td className="text-right">
                            <button
                              onClick={() => handleRemoveSpecial(d)}
                              className="icon-btn"
                              title="Rimuovi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Rimuovi</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {specialEntries.length === 0 && (
                <p className="text-slate-400 text-center py-6 text-xs">Nessuna data speciale registrata.</p>
              )}
            </div>

            <div className="card md:col-span-2">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="card-title">Sicurezza & Codici PIN Accesso</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Personalizza i codici PIN di accesso per la tua congregazione. I PIN aggiornati vengono salvati nel Cloud in tempo reale.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="lbl">PIN Amministratore (Lettura & Scrittura)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={10}
                    value={state.adminPin || '1122'}
                    disabled={currentUser?.role !== 'admin'}
                    onChange={e => {
                      if (!checkAdminPermission()) return;
                      saveState({ ...state, adminPin: e.target.value.trim() });
                    }}
                    className="inp font-mono text-center tracking-widest font-bold"
                    placeholder="1122"
                  />
                  <span className="text-[11px] text-slate-400">Permette la gestione completa di anagrafica e programmi.</span>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="lbl">PIN Consultazione (Solo Lettura)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={10}
                    value={state.viewerPin || '1234'}
                    disabled={currentUser?.role !== 'admin'}
                    onChange={e => {
                      if (!checkAdminPermission()) return;
                      saveState({ ...state, viewerPin: e.target.value.trim() });
                    }}
                    className="inp font-mono text-center tracking-widest font-bold"
                    placeholder="1234"
                  />
                  <span className="text-[11px] text-slate-400">Permette la sola visualizzazione e la stampa dei programmi.</span>
                </div>
              </div>
            </div>

            <div className="card md:col-span-2">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="card-title">Rotazione gruppi</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Imposta da quale gruppo partire ogni mese; la rotazione avanza di una posizione ad ogni settimana.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col gap-1">
                  <label className="lbl">Riassetto — gruppo di partenza</label>
                  <select
                    value={state.groups.riassetto}
                    onChange={e => saveState({ ...state, groups: { ...state.groups, riassetto: e.target.value } })}
                    className="inp"
                  >
                    <option value="1">Gruppo 1</option>
                    <option value="2">Gruppo 2</option>
                    <option value="3">Gruppo 3</option>
                    <option value="4">Gruppo 4</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="lbl">Pulizie — gruppo di partenza</label>
                  <select
                    value={state.groups.pulizie}
                    onChange={e => saveState({ ...state, groups: { ...state.groups, pulizie: e.target.value } })}
                    className="inp"
                  >
                    <option value="Massa">Massa</option>
                    <option value="1">Gruppo 1</option>
                    <option value="2">Gruppo 2</option>
                    <option value="3">Gruppo 3</option>
                    <option value="4">Gruppo 4</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card md:col-span-2">
              <div className="flex items-center gap-2 mb-1 pb-2 border-b border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                <RotateCcw className="w-5 h-5" />
                <h2 className="card-title text-slate-900 dark:text-slate-100">Gestione & Azzeramento Dati</h2>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Azzera o ripristina i programmi generati, l'archivio salvato o l'intera anagrafica della congregazione.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
                <button
                  onClick={resetAllPrograms}
                  className="btn-ghost justify-start text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 p-3 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Azzera Programmi Attivi</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Svuota la tabella mensile e domenica in visione</div>
                  </div>
                </button>

                <button
                  onClick={clearAllArchives}
                  className="btn-ghost justify-start text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 p-3 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Svuota Archivio Programmi</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Cancella tutti i programmi mensili salvati</div>
                  </div>
                </button>

                <button
                  onClick={resetToInitialDefaults}
                  className="btn-ghost justify-start text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 p-3 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold text-xs">Ripristina Dati Iniziali</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Ripristina la congregazione di esempio predefinita</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ VITA E MINISTERO ============ */}
      {activeTab === 'vitaEMinistero' && (
        <VitaEMinisteroView
          state={state}
          onSaveState={saveState}
          isAdmin={currentUser?.role === 'admin'}
          onShowToast={showToast}
          checkAdminPermission={checkAdminPermission}
        />
      )}

      {/* ============ SERVIZIO DI CAMPO ============ */}
      {activeTab === 'servizioCampo' && (
        <ServizioCampoView
          state={state}
          onSaveState={saveState}
          isAdmin={currentUser?.role === 'admin'}
          onShowToast={showToast}
          checkAdminPermission={checkAdminPermission}
        />
      )}

      {/* ============ OPERA PUBBLICA ============ */}
      {activeTab === 'operaPubblica' && (
        <OperaPubblicaView
          state={state}
          onSaveState={saveState}
          isAdmin={currentUser?.role === 'admin'}
          onShowToast={showToast}
          checkAdminPermission={checkAdminPermission}
        />
      )}

      {/* ============ STATISTICHE ============ */}
      {activeTab === 'statistiche' && (
        <StatsView
          people={state.people}
          menRows={menRows}
          menTitle={menTitle}
          domRows={domRows}
          domTitle={domTitle}
          archives={state.mensileArchives || []}
        />
      )}

          </main>
        </div>
      </div>

      {/* Excel Import Modal */}
      {showExcelImportModal && (
        <ExcelImportModal
          isOpen={showExcelImportModal}
          onClose={() => setShowExcelImportModal(false)}
          existingPeople={state.people}
          onImportPeople={handleImportPeopleFromExcel}
          onShowToast={showToast}
        />
      )}

      {/* Custom Confirm Modal */}
      {confirmModalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {confirmModalState.title}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModalState.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setConfirmModalState(null)}
                className="btn-ghost text-xs px-3.5 py-2"
              >
                Annulla
              </button>
              <button
                onClick={confirmModalState.onConfirm}
                className={`${confirmModalState.confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'} text-xs px-4 py-2`}
              >
                {confirmModalState.confirmText || 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="toast">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
