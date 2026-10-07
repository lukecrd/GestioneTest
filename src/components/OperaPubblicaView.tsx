import { exportProgramExcel } from '../utils/programExcel';
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  MapPin,
  Calendar,
  Users,
  Clock,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  Copy,
  CheckCircle,
  AlertCircle,
  UserPlus,
  Search,
  Check,
  Edit2,
  Share2,
  ChevronLeft,
  ChevronRight,
  Info,
  FileSpreadsheet,
  BarChart2,
  TrendingUp,
  Award,
  ArrowUpDown,
  Download,
  Filter,
  CheckCircle2,
  UserCheck,
  UserX,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Send,
  Megaphone,
  RotateCw,
  ClipboardCheck,
  Lock as LockIcon,
} from 'lucide-react';
import {
  StateData,
  OperaPubblicaData,
  OperaPubblicaParticipant,
  OperaPubblicaShiftAssignment,
  OperaPubblicaSurvey,
  OperaPubblicaSurveyResponse,
  Person,
} from '../types';

interface OperaPubblicaViewProps {
  state: StateData;
  onSaveState: (newState: StateData) => void;
  isAdmin: boolean;
  onShowToast: (msg: string) => void;
  checkAdminPermission: () => boolean;
}

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

function getTuesdaysAndWednesdays(year: number, month: number) {
  const dates: { dateStr: string; dayOfWeek: 'martedi' | 'mercoledi'; location: 'Mercato di Ribolla' | 'Mercato di Roccastrada'; date: Date }[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayNum = date.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed...
    const yyyy = year;
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (dayNum === 2) { // Tuesday -> Ribolla
      dates.push({
        dateStr,
        dayOfWeek: 'martedi',
        location: 'Mercato di Ribolla',
        date,
      });
    } else if (dayNum === 3) { // Wednesday -> Roccastrada
      dates.push({
        dateStr,
        dayOfWeek: 'mercoledi',
        location: 'Mercato di Roccastrada',
        date,
      });
    }
  }

  return dates;
}

export const OperaPubblicaView: React.FC<OperaPubblicaViewProps> = ({
  state,
  onSaveState,
  isAdmin,
  onShowToast,
  checkAdminPermission,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'partecipanti' | 'programma' | 'sondaggio' | 'statistiche' | 'stampa'>('programma');

  // Month & Year state for schedule
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Form states for adding participant
  const [newParticipantName, setNewParticipantName] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [newParticipantGender, setNewParticipantGender] = useState<'M' | 'F'>('M');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick summary in schedule panel toggle
  const [showQuickScheduleStats, setShowQuickScheduleStats] = useState<boolean>(true);

  // --- SONDAGGIO DISPONIBILITÀ: form state (compilabile da qualunque utente collegato) ---
  const [surveyRespondentPersonId, setSurveyRespondentPersonId] = useState<string>('');
  const [surveyRespondentName, setSurveyRespondentName] = useState<string>('');
  const [surveyAvailability, setSurveyAvailability] = useState({
    ribollaMartedi: { turno1: false, turno2: false },
    roccastradaMercoledi: { turno1: false, turno2: false },
  });
  const [surveyNotes, setSurveyNotes] = useState('');
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [surveyTitleDraft, setSurveyTitleDraft] = useState('');

  // Statistics sub-tab filters & sort state
  const [usageSearchQuery, setUsageSearchQuery] = useState<string>('');
  const [usageGenderFilter, setUsageGenderFilter] = useState<'all' | 'M' | 'F'>('all');
  const [usageCountFilter, setUsageCountFilter] = useState<'all' | 'zero' | 'active' | 'frequent'>('all');
  const [usageSortBy, setUsageSortBy] = useState<'shifts-desc' | 'shifts-asc' | 'name-asc' | 'history-desc'>('shifts-desc');

  // Extract OperaPubblicaData from state or initialize empty
  const operaData: OperaPubblicaData = useMemo(() => {
    return (
      state.operaPubblica || {
        participants: [],
        schedule: [],
      }
    );
  }, [state.operaPubblica]);

  const participants = operaData.participants || [];
  const schedule = operaData.schedule || [];
  const survey: OperaPubblicaSurvey | null = operaData.survey || null;
  const surveyResponses = survey?.responses || [];
  const surveyPendingCount = surveyResponses.filter(r => !r.applied).length;

  // Helper to get participant gender safely (checks Anagrafica first so Sisters are never mistakenly marked as Brothers)
  const getParticipantGender = (p: OperaPubblicaParticipant, peopleList: Person[]): 'M' | 'F' => {
    if (p.personId) {
      const person = peopleList.find(item => item.id === p.personId);
      if (person) return person.gender;
    }
    const personByName = peopleList.find(item => item.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    if (personByName) return personByName.gender;
    if (p.gender) return p.gender;
    return 'M';
  };

  // Helper to badge gender status of an assigned shift
  const getShiftGenderBadge = (assignedIds: string[], participantsList: OperaPubblicaParticipant[], peopleList: Person[]) => {
    if (assignedIds.length < 2) return null;
    const genders = assignedIds.map(id => {
      const p = participantsList.find(part => part.id === id);
      return p ? getParticipantGender(p, peopleList) : 'M';
    });
    const mCount = genders.filter(g => g === 'M').length;
    const fCount = genders.filter(g => g === 'F').length;

    if (mCount === 2 && fCount === 0) {
      return { label: '2 Fratelli', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300' };
    } else if (fCount === 2 && mCount === 0) {
      return { label: '2 Sorelle', color: 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300' };
    } else if (mCount > 0 && fCount > 0) {
      return { label: 'Misto (Uomo + Donna)', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300' };
    } else if (mCount > 2) {
      return { label: `${mCount} Fratelli`, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300' };
    } else if (fCount > 2) {
      return { label: `${fCount} Sorelle`, color: 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300' };
    } else {
      return { label: 'Misto', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300' };
    }
  };

  // Helper to save updated OperaPubblicaData
  const updateOperaData = (newData: OperaPubblicaData) => {
    onSaveState({
      ...state,
      operaPubblica: newData,
    });
  };

  // --- PARTECPANTI MANAGEMENT ---
  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkAdminPermission()) return;

    let nameToAdd = newParticipantName.trim();
    let personRef: string | null = null;
    let genderToAdd: 'M' | 'F' = newParticipantGender;

    if (selectedPersonId) {
      const p = state.people.find(person => person.id === selectedPersonId);
      if (p) {
        nameToAdd = p.name;
        personRef = p.id;
        genderToAdd = p.gender;
      }
    }

    if (!nameToAdd) {
      onShowToast('Inserisci un nome e cognome o seleziona un proclamatore.');
      return;
    }

    // Check duplicate
    if (participants.some(pt => pt.name.toLowerCase() === nameToAdd.toLowerCase())) {
      onShowToast('Questo partecipante è già presente nella lista.');
      return;
    }

    const newParticipant: OperaPubblicaParticipant = {
      id: 'op_' + Math.random().toString(36).substring(2, 9),
      name: nameToAdd,
      personId: personRef,
      gender: genderToAdd,
      availability: {
        ribollaMartedi: { turno1: true, turno2: true },
        roccastradaMercoledi: { turno1: true, turno2: true },
      },
    };

    updateOperaData({
      ...operaData,
      participants: [...participants, newParticipant],
    });

    setNewParticipantName('');
    setSelectedPersonId('');
    onShowToast(`Aggiunto partecipante: ${nameToAdd}`);
  };

  const handleImportAllPeople = () => {
    if (!checkAdminPermission()) return;

    const existingNames = new Set(participants.map(p => p.name.toLowerCase()));
    const toImport = state.people.filter(p => !existingNames.has(p.name.toLowerCase()));

    if (toImport.length === 0) {
      onShowToast('Tutti i proclamatori dell\'anagrafica sono già stati importati.');
      return;
    }

    const imported: OperaPubblicaParticipant[] = toImport.map(p => ({
      id: 'op_' + Math.random().toString(36).substring(2, 9),
      name: p.name,
      personId: p.id,
      gender: p.gender,
      availability: {
        ribollaMartedi: { turno1: true, turno2: true },
        roccastradaMercoledi: { turno1: true, turno2: true },
      },
    }));

    updateOperaData({
      ...operaData,
      participants: [...participants, ...imported],
    });

    onShowToast(`Importati ${imported.length} proclamatori dall'anagrafica!`);
  };

  const handleToggleParticipantGender = (participantId: string) => {
    if (!checkAdminPermission()) return;
    const updated = participants.map(p => {
      if (p.id !== participantId) return p;
      const currentG = getParticipantGender(p, state.people);
      return {
        ...p,
        gender: (currentG === 'M' ? 'F' : 'M') as 'M' | 'F',
      };
    });

    updateOperaData({
      ...operaData,
      participants: updated,
    });
  };

  const handleDeleteParticipant = (id: string, name: string) => {
    if (!checkAdminPermission()) return;

    const updated = participants.filter(p => p.id !== id);
    updateOperaData({
      ...operaData,
      participants: updated,
    });
    onShowToast(`Rimosso partecipante: ${name}`);
  };

  const handleToggleAvailability = (
    participantId: string,
    locationDay: 'ribollaMartedi' | 'roccastradaMercoledi',
    shift: 'turno1' | 'turno2'
  ) => {
    if (!checkAdminPermission()) return;

    const updated = participants.map(p => {
      if (p.id !== participantId) return p;
      return {
        ...p,
        availability: {
          ...p.availability,
          [locationDay]: {
            ...p.availability[locationDay],
            [shift]: !p.availability[locationDay][shift],
          },
        },
      };
    });

    updateOperaData({
      ...operaData,
      participants: updated,
    });
  };

  // --- SONDAGGIO DISPONIBILITÀ ---

  // Admin: pubblica un nuovo sondaggio (azzera eventuali risposte precedenti)
  const handlePublishSurvey = () => {
    if (!checkAdminPermission()) return;

    const newSurvey: OperaPubblicaSurvey = {
      id: 'survey_' + Math.random().toString(36).substring(2, 9),
      title: surveyTitleDraft.trim() || 'Sondaggio Disponibilità — Opera Pubblica',
      isOpen: true,
      createdAt: new Date().toISOString(),
      closedAt: null,
      responses: [],
    };

    updateOperaData({
      ...operaData,
      survey: newSurvey,
    });
    setSurveyTitleDraft('');
    onShowToast('Sondaggio pubblicato! I partecipanti possono ora indicare la loro disponibilità.');
  };

  // Admin: chiude il sondaggio (non accetta più nuove risposte, ma le risposte restano visibili)
  const handleCloseSurvey = () => {
    if (!checkAdminPermission()) return;
    if (!survey) return;
    updateOperaData({
      ...operaData,
      survey: { ...survey, isOpen: false, closedAt: new Date().toISOString() },
    });
    onShowToast('Sondaggio chiuso.');
  };

  // Admin: riapre un sondaggio precedentemente chiuso
  const handleReopenSurvey = () => {
    if (!checkAdminPermission()) return;
    if (!survey) return;
    updateOperaData({
      ...operaData,
      survey: { ...survey, isOpen: true, closedAt: null },
    });
    onShowToast('Sondaggio riaperto.');
  };

  // Admin: elimina una singola risposta
  const handleDeleteSurveyResponse = (responseId: string) => {
    if (!checkAdminPermission()) return;
    if (!survey) return;
    updateOperaData({
      ...operaData,
      survey: { ...survey, responses: survey.responses.filter(r => r.id !== responseId) },
    });
  };

  // Admin: copia un messaggio pronto da inoltrare (WhatsApp, ecc.) per annunciare il sondaggio
  const handleCopySurveyAnnouncement = async () => {
    if (!survey) return;
    const msg =
      `📋 *${survey.title}*\n\n` +
      `Accedi all'app Gestione Congregazione, apri "Opera Pubblica" > "Sondaggio" e indica i giorni/orari in cui sei disponibile per l'Opera con espositori mobili (Ribolla il martedì, Roccastrada il mercoledì).\n\n` +
      `Grazie della tua disponibilità!`;
    try {
      await navigator.clipboard.writeText(msg);
      onShowToast('Messaggio di annuncio copiato negli appunti!');
    } catch {
      onShowToast('Impossibile copiare automaticamente: seleziona e copia il testo manualmente.');
    }
  };

  // Chiunque sia collegato (admin o consultazione) può inviare/aggiornare la propria disponibilità
  const handleSubmitSurveyResponse = () => {
    if (!survey || !survey.isOpen) {
      onShowToast('Il sondaggio non è al momento attivo.');
      return;
    }

    let nameToUse = surveyRespondentName.trim();
    let personRef: string | null = null;
    let genderToUse: 'M' | 'F' | undefined;
    let matchedParticipantId: string | null = null;

    if (surveyRespondentPersonId) {
      const p = state.people.find(person => person.id === surveyRespondentPersonId);
      if (p) {
        nameToUse = p.name;
        personRef = p.id;
        genderToUse = p.gender;
      }
    }

    if (!nameToUse) {
      onShowToast('Seleziona il tuo nominativo o inserisci nome e cognome.');
      return;
    }

    const hasAnyAvailability =
      surveyAvailability.ribollaMartedi.turno1 ||
      surveyAvailability.ribollaMartedi.turno2 ||
      surveyAvailability.roccastradaMercoledi.turno1 ||
      surveyAvailability.roccastradaMercoledi.turno2;

    if (!hasAnyAvailability) {
      onShowToast('Seleziona almeno un turno in cui sei disponibile (o indicalo nelle note se non sei mai disponibile).');
      return;
    }

    // Trova un partecipante già esistente con lo stesso nome/personId, per collegare la risposta
    const existingParticipant = participants.find(p =>
      (personRef && p.personId === personRef) ||
      p.name.trim().toLowerCase() === nameToUse.trim().toLowerCase()
    );
    if (existingParticipant) {
      matchedParticipantId = existingParticipant.id;
      if (!genderToUse) genderToUse = getParticipantGender(existingParticipant, state.people);
    }

    // Se l'utente ha già risposto in precedenza, aggiorna la sua risposta invece di duplicarla
    const existingResponse = survey.responses.find(r =>
      (matchedParticipantId && r.participantId === matchedParticipantId) ||
      r.name.trim().toLowerCase() === nameToUse.trim().toLowerCase()
    );

    const newResponse: OperaPubblicaSurveyResponse = {
      id: existingResponse?.id || 'resp_' + Math.random().toString(36).substring(2, 9),
      participantId: matchedParticipantId,
      personId: personRef,
      name: nameToUse,
      gender: genderToUse,
      availability: surveyAvailability,
      notes: surveyNotes.trim() || undefined,
      submittedAt: new Date().toISOString(),
      applied: false, // ogni nuovo invio torna "da applicare", anche se era già stato applicato prima
    };

    const updatedResponses = existingResponse
      ? survey.responses.map(r => (r.id === existingResponse.id ? newResponse : r))
      : [...survey.responses, newResponse];

    updateOperaData({
      ...operaData,
      survey: { ...survey, responses: updatedResponses },
    });

    setSurveySubmitted(true);
    onShowToast(existingResponse ? 'Disponibilità aggiornata, grazie!' : 'Disponibilità inviata, grazie!');
  };

  // Admin: applica la disponibilità di UNA risposta ai Partecipanti (crea o aggiorna)
  const applySurveyResponseToParticipants = (
    response: OperaPubblicaSurveyResponse,
    currentParticipants: OperaPubblicaParticipant[]
  ): OperaPubblicaParticipant[] => {
    const matchIndex = currentParticipants.findIndex(p =>
      (response.participantId && p.id === response.participantId) ||
      (response.personId && p.personId === response.personId) ||
      p.name.trim().toLowerCase() === response.name.trim().toLowerCase()
    );

    if (matchIndex >= 0) {
      const updated = [...currentParticipants];
      updated[matchIndex] = {
        ...updated[matchIndex],
        availability: response.availability,
        notes: response.notes || updated[matchIndex].notes,
      };
      return updated;
    }

    // Nessun partecipante corrispondente: ne crea uno nuovo dalla risposta al sondaggio
    const newParticipant: OperaPubblicaParticipant = {
      id: 'op_' + Math.random().toString(36).substring(2, 9),
      name: response.name,
      personId: response.personId || null,
      gender: response.gender || 'M',
      availability: response.availability,
      notes: response.notes,
    };
    return [...currentParticipants, newParticipant];
  };

  const handleApplySurveyResponse = (responseId: string) => {
    if (!checkAdminPermission()) return;
    if (!survey) return;
    const response = survey.responses.find(r => r.id === responseId);
    if (!response) return;

    const updatedParticipants = applySurveyResponseToParticipants(response, participants);
    const updatedResponses = survey.responses.map(r =>
      r.id === responseId ? { ...r, applied: true } : r
    );

    updateOperaData({
      ...operaData,
      participants: updatedParticipants,
      survey: { ...survey, responses: updatedResponses },
    });

    onShowToast(`Disponibilità di ${response.name} applicata alla lista partecipanti.`);
  };

  // Admin: applica in blocco tutte le risposte non ancora applicate
  const handleApplyAllSurveyResponses = () => {
    if (!checkAdminPermission()) return;
    if (!survey) return;

    const pending = survey.responses.filter(r => !r.applied);
    if (pending.length === 0) {
      onShowToast('Nessuna nuova risposta da applicare.');
      return;
    }

    let updatedParticipants = participants;
    pending.forEach(response => {
      updatedParticipants = applySurveyResponseToParticipants(response, updatedParticipants);
    });

    const updatedResponses = survey.responses.map(r => ({ ...r, applied: true }));

    updateOperaData({
      ...operaData,
      participants: updatedParticipants,
      survey: { ...survey, responses: updatedResponses },
    });

    onShowToast(`${pending.length} disponibilità applicate. Ora puoi generare il programma da "Programmazione Turni".`);
  };

  // Admin: applica tutte le risposte pendenti E genera subito il programma del mese selezionato
  const handleApplyAllAndGenerateSchedule = () => {
    if (!checkAdminPermission()) return;
    if (!survey) return;

    const pending = survey.responses.filter(r => !r.applied);
    let updatedParticipants = participants;
    pending.forEach(response => {
      updatedParticipants = applySurveyResponseToParticipants(response, updatedParticipants);
    });
    const updatedResponses = survey.responses.map(r => ({ ...r, applied: true }));

    updateOperaData({
      ...operaData,
      participants: updatedParticipants,
      survey: { ...survey, responses: updatedResponses },
    });

    setActiveSubTab('programma');
    onShowToast('Disponibilità applicate! Ora premi "Genera Automaticamente" nella scheda Programmazione.');
  };

  // --- PROGRAMMAZIONE TURNI ---
  const daysInMonthList = useMemo(() => {
    return getTuesdaysAndWednesdays(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Generate automated monthly schedule
  const handleSetDateShiftMode = (dateStr: string, mode: 'both' | 't1_only' | 't2_only' | 'none') => {
    if (!checkAdminPermission()) return;

    let existingAssignment = schedule.find(s => s.dateStr === dateStr);
    if (!existingAssignment) {
      const item = daysInMonthList.find(d => d.dateStr === dateStr);
      if (!item) return;
      existingAssignment = {
        dateStr,
        dayOfWeek: item.dayOfWeek,
        location: item.location,
        turno1: [],
        turno2: [],
        turno1Active: true,
        turno2Active: true,
      };
    }

    const t1Active = mode === 'both' || mode === 't1_only';
    const t2Active = mode === 'both' || mode === 't2_only';

    const updatedAssignment: OperaPubblicaShiftAssignment = {
      ...existingAssignment,
      turno1Active: t1Active,
      turno2Active: t2Active,
      turno1: t1Active ? existingAssignment.turno1 : [],
      turno2: t2Active ? existingAssignment.turno2 : [],
    };

    const updatedSchedule = schedule.filter(s => s.dateStr !== dateStr);
    updatedSchedule.push(updatedAssignment);

    updateOperaData({
      ...operaData,
      schedule: updatedSchedule,
    });
  };

  const handleAutoGenerateSchedule = () => {
    if (!checkAdminPermission()) return;

    if (participants.length === 0) {
      onShowToast('Aggiungi prima alcuni partecipanti con le relative disponibilità.');
      return;
    }

    // Keep track of total assignments per participant in this generation pass for fairness
    const assignmentCounts: Record<string, number> = {};
    participants.forEach(p => {
      assignmentCounts[p.id] = 0;
    });

    const newAssignments: OperaPubblicaShiftAssignment[] = [];

    daysInMonthList.forEach(({ dateStr, dayOfWeek, location }) => {
      const isMartedi = dayOfWeek === 'martedi';
      const locKey = isMartedi ? 'ribollaMartedi' : 'roccastradaMercoledi';

      const existingAssignment = schedule.find(s => s.dateStr === dateStr);
      const t1Active = existingAssignment ? (existingAssignment.turno1Active !== false) : true;
      const t2Active = existingAssignment ? (existingAssignment.turno2Active !== false) : true;

      // Helper function to pick a same-gender pair (2 women or 2 men) for a shift
      const generateSameGenderShift = (
        shiftKey: 'turno1' | 'turno2',
        alreadyChosenInOtherShift: string[] = []
      ): string[] => {
        // Filter available participants for this location & shift who are not marked unavailable
        const avail = participants.filter(p => {
          if (!p.availability[locKey]?.[shiftKey]) return false;
          if (p.personId && state.unavail[p.personId]?.includes(dateStr)) return false;
          return true;
        });

        const availMen = avail.filter(p => getParticipantGender(p, state.people) === 'M');
        const availWomen = avail.filter(p => getParticipantGender(p, state.people) === 'F');

        const getScore = (p: OperaPubblicaParticipant) => {
          const penalty = alreadyChosenInOtherShift.includes(p.id) ? 10 : 0;
          return (assignmentCounts[p.id] || 0) + penalty;
        };

        availMen.sort((a, b) => getScore(a) - getScore(b));
        availWomen.sort((a, b) => getScore(a) - getScore(b));

        const hasMalePair = availMen.length >= 2;
        const hasFemalePair = availWomen.length >= 2;

        if (hasMalePair && hasFemalePair) {
          // Compare fairness score of best male pair vs best female pair
          const maleScore = getScore(availMen[0]) + getScore(availMen[1]);
          const femaleScore = getScore(availWomen[0]) + getScore(availWomen[1]);

          if (maleScore < femaleScore) {
            return [availMen[0].id, availMen[1].id];
          } else if (femaleScore < maleScore) {
            return [availWomen[0].id, availWomen[1].id];
          } else {
            // If scores are equal, balance overall shifts assigned to men vs women
            const totalMenShifts = availMen.reduce((sum, p) => sum + (assignmentCounts[p.id] || 0), 0);
            const totalWomenShifts = availWomen.reduce((sum, p) => sum + (assignmentCounts[p.id] || 0), 0);
            if (totalMenShifts <= totalWomenShifts) {
              return [availMen[0].id, availMen[0 + 1].id];
            } else {
              return [availWomen[0].id, availWomen[0 + 1].id];
            }
          }
        } else if (hasMalePair) {
          return [availMen[0].id, availMen[1].id];
        } else if (hasFemalePair) {
          return [availWomen[0].id, availWomen[1].id];
        } else {
          // If a same-gender pair of 2 is not possible (less than 2 men and less than 2 women):
          // Pick 1 person with lowest assignment count to avoid mixing genders
          if (availMen.length > 0 && availWomen.length === 0) {
            return [availMen[0].id];
          } else if (availWomen.length > 0 && availMen.length === 0) {
            return [availWomen[0].id];
          } else if (availMen.length > 0 && availWomen.length > 0) {
            const mScore = getScore(availMen[0]);
            const wScore = getScore(availWomen[0]);
            return mScore <= wScore ? [availMen[0].id] : [availWomen[0].id];
          }
          return [];
        }
      };

      let chosenT1: string[] = [];
      if (t1Active) {
        chosenT1 = generateSameGenderShift('turno1', []);
        chosenT1.forEach(id => {
          assignmentCounts[id] = (assignmentCounts[id] || 0) + 1;
        });
      }

      let chosenT2: string[] = [];
      if (t2Active) {
        chosenT2 = generateSameGenderShift('turno2', chosenT1);
        chosenT2.forEach(id => {
          assignmentCounts[id] = (assignmentCounts[id] || 0) + 1;
        });
      }

      newAssignments.push({
        dateStr,
        dayOfWeek,
        location,
        turno1: chosenT1,
        turno2: chosenT2,
        turno1Active: t1Active,
        turno2Active: t2Active,
      });
    });

    // Merge new assignments into schedule (replace existing for those dates)
    const filteredSchedule = schedule.filter(s => {
      const d = new Date(s.dateStr);
      return d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear;
    });

    updateOperaData({
      ...operaData,
      schedule: [...filteredSchedule, ...newAssignments],
    });

    onShowToast(`Programma "Opera Pubblica" per ${MESI[selectedMonth]} ${selectedYear} generato con coppie dello stesso genere!`);
  };

  // Toggle/Assign participant manually to a specific shift on a specific date
  const handleToggleParticipantInShift = (
    dateStr: string,
    shift: 'turno1' | 'turno2',
    participantId: string
  ) => {
    if (!checkAdminPermission()) return;

    let existingAssignment = schedule.find(s => s.dateStr === dateStr);

    if (!existingAssignment) {
      const item = daysInMonthList.find(d => d.dateStr === dateStr);
      if (!item) return;
      existingAssignment = {
        dateStr,
        dayOfWeek: item.dayOfWeek,
        location: item.location,
        turno1: [],
        turno2: [],
      };
    }

    const currentList = existingAssignment[shift] || [];
    const isAssigned = currentList.includes(participantId);

    const newList = isAssigned
      ? currentList.filter(id => id !== participantId)
      : [...currentList, participantId];

    const updatedAssignment = {
      ...existingAssignment,
      [shift]: newList,
    };

    const updatedSchedule = schedule.filter(s => s.dateStr !== dateStr);
    updatedSchedule.push(updatedAssignment);

    updateOperaData({
      ...operaData,
      schedule: updatedSchedule,
    });
  };

  const handleClearMonthSchedule = () => {
    if (!checkAdminPermission()) return;

    const updatedSchedule = schedule.filter(s => {
      const d = new Date(s.dateStr);
      return d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear;
    });

    updateOperaData({
      ...operaData,
      schedule: updatedSchedule,
    });

    onShowToast(`Programma ${MESI[selectedMonth]} ${selectedYear} azzerato.`);
  };

  // Filtered participants list for search
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const q = searchQuery.toLowerCase();
    return participants.filter(p => p.name.toLowerCase().includes(q));
  }, [participants, searchQuery]);

  // Helper to format date string nicely
  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    const dayName = dateObj.getDay() === 2 ? 'Martedì' : 'Mercoledì';
    return `${dayName} ${d} ${MESI[m]}`;
  };

  // Short date helper for exact PDF style (e.g. 7-lug)
  const formatShortDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const shortMonths = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    return `${day}-${shortMonths[monthIdx]}`;
  };

  // Get week label for grouping (e.g. Settimana del 6 luglio)
  const getWeekLabel = (dateStr: string) => {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    const monDate = new Date(d);
    monDate.setDate(d.getDate() - diffToMon);
    return `Settimana del ${monDate.getDate()} ${MESI[monDate.getMonth()].toLowerCase()}`;
  };

  // Group days by week
  const groupedWeeks = useMemo(() => {
    const groups: { label: string; items: typeof daysInMonthList }[] = [];
    daysInMonthList.forEach(item => {
      const label = getWeekLabel(item.dateStr);
      let group = groups.find(g => g.label === label);
      if (!group) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    return groups;
  }, [daysInMonthList, selectedMonth, selectedYear]);

  // WhatsApp text generator
  const generateWhatsAppText = () => {
    const monthAssignments = daysInMonthList.map(item => {
      const assignment = schedule.find(s => s.dateStr === item.dateStr);
      const t1Active = assignment ? (assignment.turno1Active !== false) : true;
      const t2Active = assignment ? (assignment.turno2Active !== false) : true;

      const t1Names = (assignment?.turno1 || [])
        .map(id => participants.find(p => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');
      const t2Names = (assignment?.turno2 || [])
        .map(id => participants.find(p => p.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      const t1Text = t1Active ? (t1Names || '---') : '(Turno non previsto)';
      const t2Text = t2Active ? (t2Names || '---') : '(Turno non previsto)';

      return `📍 *${item.location}* (${formatDateLabel(item.dateStr)})\n  ⏰ 8:00 - 10:00: ${t1Text}\n  ⏰ 10:00 - 12:00: ${t2Text}\n`;
    });

    return `🛒 *PROGRAMMA OPERA CON ESPOSITORI MOBILI*\n📅 *Mese di ${MESI[selectedMonth]} ${selectedYear}*\n\n${monthAssignments.join('\n')}`;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppText();
    navigator.clipboard.writeText(text);
    onShowToast('Programma copiato negli appunti! Pronto per inviare su WhatsApp.');
  };

  const handleExportExcel = async () => {
try {
    const rows: (string | number)[][] = [
      ['PROGRAMMA OPERA CON ESPOSITORI MOBILI', '', '', ''],
      [`MESE DI ${MESI[selectedMonth].toUpperCase()}`, '', '', ''],
      ['', '', '', ''],
      ['Data', 'Luogo', 'Orario', 'Nominativi'],
    ];

    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Title merged
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Subtitle merged
    ];

    let currentRow = 4;

    groupedWeeks.forEach(week => {
      // Week section header row (e.g. Settimana del 3 agosto)
      rows.push([week.label, '', '', '']);
      merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: 3 } });
      currentRow++;

      week.items.forEach(item => {
        const assignment = schedule.find(s => s.dateStr === item.dateStr);
        const t1Active = assignment ? (assignment.turno1Active !== false) : true;
        const t2Active = assignment ? (assignment.turno2Active !== false) : true;

        const t1Names = (assignment?.turno1 || [])
          .map(id => participants.find(p => p.id === id)?.name)
          .filter(Boolean)
          .join(' - ');
        const t2Names = (assignment?.turno2 || [])
          .map(id => participants.find(p => p.id === id)?.name)
          .filter(Boolean)
          .join(' - ');

        const dateShort = formatShortDate(item.dateStr);

        // Row 1 (Turno 1: 08,00 - 10,00)
        rows.push([
          dateShort,
          item.location,
          '08,00 - 10,00',
          t1Active ? (t1Names || '') : '',
        ]);

        // Row 2 (Turno 2: 10,00 - 12,00)
        rows.push([
          dateShort,
          item.location,
          '10,00 - 12,00',
          t2Active ? (t2Names || '') : '',
        ]);

        // Merge Data column (A) for the two rows
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + 1, c: 0 } });
        // Merge Luogo column (B) for the two rows
        merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow + 1, c: 1 } });

        currentRow += 2;
      });
    });

    // Extra template rows matching the PDF exactly:
    // 1) Ribolla placeholder
    rows.push(['', 'Mercato di Ribolla', '08,00 - 10,00', '']);
    rows.push(['', 'Mercato di Ribolla', '10,00 - 12,00', '']);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + 1, c: 0 } });
    merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow + 1, c: 1 } });
    currentRow += 2;

    // 2) Roccastrada placeholder
    rows.push(['', 'Mercato di Roccastrada', '08,00 - 10,00', '']);
    rows.push(['', 'Mercato di Roccastrada', '10,00 - 12,00', '']);
    merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow + 1, c: 0 } });
    merges.push({ s: { r: currentRow, c: 1 }, e: { r: currentRow + 1, c: 1 } });
    currentRow += 2;

    // 3) Two blank rows
    rows.push(['', '', '', '']);
    currentRow++;
    rows.push(['', '', '', '']);
    currentRow++;

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 28 },
      { wch: 18 },
      { wch: 45 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Opera Espositori');
    await exportProgramExcel(workbook, `Programma_Opera_Espositori_${MESI[selectedMonth]}_${selectedYear}.xlsx`, '.printable-area');
    onShowToast(`Programma esportato in formato Excel (.xlsx)!`);

} catch (error) { onShowToast(error instanceof Error ? error.message : 'Errore durante l’esportazione Excel.'); }
};

  // --- STATISTICHE E RIEPILOGO UTILIZZO PER PERSONA ---
  const participantUsageStats = useMemo(() => {
    return participants.map(p => {
      const gender = getParticipantGender(p, state.people);
      const rib = p.availability?.ribollaMartedi || { turno1: false, turno2: false };
      const roc = p.availability?.roccastradaMercoledi || { turno1: false, turno2: false };
      const totalAvailSlots = (rib.turno1 ? 1 : 0) + (rib.turno2 ? 1 : 0) + (roc.turno1 ? 1 : 0) + (roc.turno2 ? 1 : 0);

      let monthRibollaT1 = 0;
      let monthRibollaT2 = 0;
      let monthRoccastradaT1 = 0;
      let monthRoccastradaT2 = 0;
      const monthAssignments: { dateStr: string; dayLabel: string; location: string; shiftTime: string }[] = [];

      let allTimeTotal = 0;
      let allTimeRibolla = 0;
      let allTimeRoccastrada = 0;
      let lastDate: string | null = null;

      // Scan entire schedule
      schedule.forEach(s => {
        const parts = s.dateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const isSelectedMonth = y === selectedYear && m === selectedMonth;

        const isRibolla = s.location?.includes('Ribolla') || s.dayOfWeek === 'martedi';
        const t1Active = s.turno1Active !== false;
        const t2Active = s.turno2Active !== false;

        let wasAssigned = false;

        if (t1Active && s.turno1?.includes(p.id)) {
          allTimeTotal++;
          if (isRibolla) allTimeRibolla++; else allTimeRoccastrada++;
          wasAssigned = true;

          if (isSelectedMonth) {
            if (isRibolla) monthRibollaT1++; else monthRoccastradaT1++;
            monthAssignments.push({
              dateStr: s.dateStr,
              dayLabel: formatShortDate(s.dateStr),
              location: isRibolla ? 'Ribolla' : 'Roccastrada',
              shiftTime: '08:00 - 10:00',
            });
          }
        }

        if (t2Active && s.turno2?.includes(p.id)) {
          allTimeTotal++;
          if (isRibolla) allTimeRibolla++; else allTimeRoccastrada++;
          wasAssigned = true;

          if (isSelectedMonth) {
            if (isRibolla) monthRibollaT2++; else monthRoccastradaT2++;
            monthAssignments.push({
              dateStr: s.dateStr,
              dayLabel: formatShortDate(s.dateStr),
              location: isRibolla ? 'Ribolla' : 'Roccastrada',
              shiftTime: '10:00 - 12:00',
            });
          }
        }

        if (wasAssigned) {
          if (!lastDate || s.dateStr > lastDate) {
            lastDate = s.dateStr;
          }
        }
      });

      const monthRibollaTotal = monthRibollaT1 + monthRibollaT2;
      const monthRoccastradaTotal = monthRoccastradaT1 + monthRoccastradaT2;
      const monthTotal = monthRibollaTotal + monthRoccastradaTotal;

      return {
        id: p.id,
        name: p.name,
        gender,
        personId: p.personId,
        monthTotal,
        monthRibollaT1,
        monthRibollaT2,
        monthRibollaTotal,
        monthRoccastradaT1,
        monthRoccastradaT2,
        monthRoccastradaTotal,
        monthAssignments,
        allTimeTotal,
        allTimeRibolla,
        allTimeRoccastrada,
        lastShiftDate: lastDate,
        hasRibollaAvail: rib.turno1 || rib.turno2,
        hasRoccastradaAvail: roc.turno1 || roc.turno2,
        totalAvailSlots,
        availability: {
          ribollaT1: rib.turno1,
          ribollaT2: rib.turno2,
          roccastradaT1: roc.turno1,
          roccastradaT2: roc.turno2,
        },
      };
    });
  }, [participants, schedule, selectedYear, selectedMonth, state.people]);

  // Aggregate stats calculations
  const totalParticipants = participants.length;
  const activeParticipantsInMonth = useMemo(() => {
    return participantUsageStats.filter(p => p.monthTotal > 0).length;
  }, [participantUsageStats]);

  const unusedParticipantsInMonth = useMemo(() => {
    return participantUsageStats.filter(p => p.monthTotal === 0).length;
  }, [participantUsageStats]);

  const totalShiftsInMonth = useMemo(() => {
    return participantUsageStats.reduce((sum, p) => sum + p.monthTotal, 0);
  }, [participantUsageStats]);

  const menStats = useMemo(() => {
    return participantUsageStats.filter(p => p.gender === 'M');
  }, [participantUsageStats]);

  const womenStats = useMemo(() => {
    return participantUsageStats.filter(p => p.gender === 'F');
  }, [participantUsageStats]);

  const menTotalShifts = useMemo(() => {
    return menStats.reduce((sum, p) => sum + p.monthTotal, 0);
  }, [menStats]);

  const womenTotalShifts = useMemo(() => {
    return womenStats.reduce((sum, p) => sum + p.monthTotal, 0);
  }, [womenStats]);

  const ribollaTotalShifts = useMemo(() => {
    return participantUsageStats.reduce((sum, p) => sum + p.monthRibollaTotal, 0);
  }, [participantUsageStats]);

  const roccastradaTotalShifts = useMemo(() => {
    return participantUsageStats.reduce((sum, p) => sum + p.monthRoccastradaTotal, 0);
  }, [participantUsageStats]);

  const averageShifts = activeParticipantsInMonth > 0
    ? (totalShiftsInMonth / activeParticipantsInMonth).toFixed(1)
    : '0';

  // Filtered and sorted usage list
  const filteredUsageStats = useMemo(() => {
    return participantUsageStats
      .filter(p => {
        // Search query
        if (usageSearchQuery.trim() && !p.name.toLowerCase().includes(usageSearchQuery.trim().toLowerCase())) {
          return false;
        }
        // Gender filter
        if (usageGenderFilter === 'M' && p.gender !== 'M') return false;
        if (usageGenderFilter === 'F' && p.gender !== 'F') return false;
        // Count filter
        if (usageCountFilter === 'zero' && p.monthTotal !== 0) return false;
        if (usageCountFilter === 'active' && p.monthTotal === 0) return false;
        if (usageCountFilter === 'frequent' && p.monthTotal < 3) return false;
        return true;
      })
      .sort((a, b) => {
        if (usageSortBy === 'shifts-desc') {
          if (b.monthTotal !== a.monthTotal) return b.monthTotal - a.monthTotal;
          return a.name.localeCompare(b.name);
        }
        if (usageSortBy === 'shifts-asc') {
          if (a.monthTotal !== b.monthTotal) return a.monthTotal - b.monthTotal;
          return a.name.localeCompare(b.name);
        }
        if (usageSortBy === 'name-asc') {
          return a.name.localeCompare(b.name);
        }
        if (usageSortBy === 'history-desc') {
          if (b.allTimeTotal !== a.allTimeTotal) return b.allTimeTotal - a.allTimeTotal;
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [participantUsageStats, usageSearchQuery, usageGenderFilter, usageCountFilter, usageSortBy]);

  // Export summary to Excel
  const handleExportUsageExcel = () => {
    const headers = [
      'Nome e Cognome',
      'Genere',
      `Turni ${MESI[selectedMonth]} ${selectedYear}`,
      'Ribolla 08-10',
      'Ribolla 10-12',
      'Tot. Ribolla',
      'Roccastrada 08-10',
      'Roccastrada 10-12',
      'Tot. Roccastrada',
      'Date Assegnate nel Mese',
      'Totale Storico Complessivo',
      'Ultimo Turno Svolto',
      'Disponibilità Dichiarata',
    ];

    const rows = participantUsageStats.map(p => {
      const datesStr = p.monthAssignments.map(a => `${a.dayLabel} (${a.location} ${a.shiftTime})`).join(', ') || 'Nessuna data';
      const availStr = [
        p.availability.ribollaT1 ? 'Ribolla 8-10' : '',
        p.availability.ribollaT2 ? 'Ribolla 10-12' : '',
        p.availability.roccastradaT1 ? 'Roccastrada 8-10' : '',
        p.availability.roccastradaT2 ? 'Roccastrada 10-12' : '',
      ].filter(Boolean).join('; ') || 'Nessuna';

      return [
        p.name,
        p.gender === 'M' ? 'Fratello' : 'Sorella',
        p.monthTotal,
        p.monthRibollaT1,
        p.monthRibollaT2,
        p.monthRibollaTotal,
        p.monthRoccastradaT1,
        p.monthRoccastradaT2,
        p.monthRoccastradaTotal,
        datesStr,
        p.allTimeTotal,
        p.lastShiftDate || '—',
        availStr,
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 45 },
      { wch: 22 },
      { wch: 18 },
      { wch: 35 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Riepilogo Utilizzo');
    XLSX.writeFile(workbook, `Riepilogo_Utilizzo_Opera_Pubblica_${MESI[selectedMonth]}_${selectedYear}.xlsx`);
    onShowToast(`Riepilogo utilizzo esportato in formato Excel (.xlsx)!`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <MapPin className="w-48 h-48 text-indigo-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                <span>Opera Pubblica</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Opera Pubblica</h1>
              <p className="text-slate-300 text-xs mt-1 max-w-xl leading-relaxed">
                Gestione dei turni con i carrelli a <strong>Ribolla</strong> (Martedì) e <strong>Roccastrada</strong> (Mercoledì). Turni formati sempre da 2 sorelle o 2 fratelli.
              </p>
            </div>
            <img
              src="/opera_pubblica_cart.svg"
              alt="Opera Pubblica"
              referrerPolicy="no-referrer"
              className="w-24 h-20 object-contain rounded-lg border border-indigo-500/30 bg-amber-50/10 p-1 shrink-0 hidden sm:block"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-slate-800/80 border border-slate-700/80 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-xs text-slate-400 font-medium">Partecipanti</span>
              <span className="text-lg font-bold text-indigo-300">{participants.length}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-xs text-slate-400 font-medium">Uscite Mese</span>
              <span className="text-lg font-bold text-emerald-300">{daysInMonthList.length}</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/80 px-3.5 py-2 rounded-xl text-center">
              <span className="block text-xs text-slate-400 font-medium">Impiegati</span>
              <span className="text-lg font-bold text-purple-300">{activeParticipantsInMonth}/{participants.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto no-print">
        <button
          type="button"
          onClick={() => setActiveSubTab('programma')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
            activeSubTab === 'programma'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Programmazione Turni Mese</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('partecipanti')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
            activeSubTab === 'partecipanti'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Partecipanti & Disponibilità</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300">
            {participants.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sondaggio')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
            activeSubTab === 'sondaggio'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Sondaggio</span>
          {survey?.isOpen && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              Aperto{surveyPendingCount > 0 ? ` · ${surveyPendingCount}` : ''}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('statistiche')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
            activeSubTab === 'statistiche'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Riepilogo Utilizzo</span>
          <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/60 text-[10px] font-bold text-purple-700 dark:text-purple-300">
            {activeParticipantsInMonth}/{totalParticipants}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('stampa')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-t-xl border-b-2 transition-all ${
            activeSubTab === 'stampa'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Stampa & Condivisione</span>
        </button>
      </div>

      {/* --- SUBTAB 1: PROGRAMMAZIONE TURNI --- */}
      {activeSubTab === 'programma' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11);
                      setSelectedYear(selectedYear - 1);
                    } else {
                      setSelectedMonth(selectedMonth - 1);
                    }
                  }}
                  className="btn-ghost p-2"
                  title="Mese precedente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100 min-w-[140px] text-center">
                  {MESI[selectedMonth]} {selectedYear}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0);
                      setSelectedYear(selectedYear + 1);
                    } else {
                      setSelectedMonth(selectedMonth + 1);
                    }
                  }}
                  className="btn-ghost p-2"
                  title="Mese successivo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="inp py-1.5 text-xs font-semibold"
              >
                {MESI.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="inp py-1.5 text-xs font-semibold"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAutoGenerateSchedule}
                className="btn-primary flex items-center gap-1.5"
                title="Assegna automaticamente i turni in base alle disponibilità indicate"
              >
                <Sparkles className="w-4 h-4" />
                <span>Genera Programma Mese</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="btn-ghost text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copia per WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleClearMonthSchedule}
                className="btn-ghost text-xs text-rose-500 hover:text-rose-700"
                title="Azzera il programma di questo mese"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Azzera Mese</span>
              </button>
            </div>
          </div>

          {/* Quick Summary Chips Banner for the Active Month */}
          <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-slate-900/40 border border-purple-200/80 dark:border-purple-900/50 rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Riepilogo Carichi Mese ({MESI[selectedMonth]} {selectedYear})
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  • <strong>{activeParticipantsInMonth}/{totalParticipants}</strong> proclamatori impiegati ({totalShiftsInMonth} turni totali, media {averageShifts}/persona)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('statistiche')}
                  className="text-xs text-purple-700 dark:text-purple-300 font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Vedi analisi completa</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickScheduleStats(!showQuickScheduleStats)}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  title={showQuickScheduleStats ? 'Nascondi lista rapida' : 'Mostra lista rapida'}
                >
                  {showQuickScheduleStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showQuickScheduleStats && (
              <div className="mt-3 pt-3 border-t border-purple-200/60 dark:border-purple-900/40">
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {participantUsageStats
                    .slice()
                    .sort((a, b) => b.monthTotal - a.monthTotal || a.name.localeCompare(b.name))
                    .map(p => {
                      const count = p.monthTotal;
                      let badgeStyle = 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
                      if (count === 1) {
                        badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 font-medium';
                      } else if (count === 2) {
                        badgeStyle = 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800 font-semibold';
                      } else if (count >= 3) {
                        badgeStyle = 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800 font-bold';
                      }

                      return (
                        <div
                          key={p.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all ${badgeStyle}`}
                        >
                          <span className="text-[11px]">{p.name}</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            count === 0
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          }`}>
                            {count} {count === 1 ? 'turno' : 'turni'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Location Summary Cards Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl flex items-start gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 shadow-md">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                  Martedì - Mercato di Ribolla
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Turno 1: <strong>8:00 - 10:00</strong> | Turno 2: <strong>10:00 - 12:00</strong>
                </p>
                <div className="mt-2 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                  {participants.filter(p => p.availability.ribollaMartedi.turno1 || p.availability.ribollaMartedi.turno2).length} proclamatori disponibili
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-start gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 shadow-md">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                  Mercoledì - Mercato di Roccastrada
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Turno 1: <strong>8:00 - 10:00</strong> | Turno 2: <strong>10:00 - 12:00</strong>
                </p>
                <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  {participants.filter(p => p.availability.roccastradaMercoledi.turno1 || p.availability.roccastradaMercoledi.turno2).length} proclamatori disponibili
                </div>
              </div>
            </div>
          </div>

          {/* Calendar List of Tuesdays & Wednesdays */}
          <div className="space-y-4">
            {daysInMonthList.length === 0 ? (
              <div className="card text-center py-8 text-slate-400 text-xs">
                Nessuna data di mercato trovata per questo mese.
              </div>
            ) : (
              daysInMonthList.map(item => {
                const assignment = schedule.find(s => s.dateStr === item.dateStr);
                const t1Assigned = assignment?.turno1 || [];
                const t2Assigned = assignment?.turno2 || [];
                const t1Active = assignment ? (assignment.turno1Active !== false) : true;
                const t2Active = assignment ? (assignment.turno2Active !== false) : true;

                const isMartedi = item.dayOfWeek === 'martedi';
                const locKey = isMartedi ? 'ribollaMartedi' : 'roccastradaMercoledi';

                // Available candidates for dropdowns
                const availT1Participants = participants.filter(p => p.availability[locKey]?.turno1);
                const availT2Participants = participants.filter(p => p.availability[locKey]?.turno2);

                return (
                  <div
                    key={item.dateStr}
                    className="card border-l-4 transition-all hover:shadow-md"
                    style={{
                      borderLeftColor: isMartedi ? '#6366f1' : '#10b981',
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm ${
                            isMartedi ? 'bg-indigo-600' : 'bg-emerald-600'
                          }`}
                        >
                          {formatDateLabel(item.dateStr)}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.location}</span>
                        </div>
                      </div>

                      {/* Controls to set active shifts for this specific date */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-[11px] self-start md:self-auto">
                          <span className="text-[10px] text-slate-500 font-semibold px-1.5 hidden sm:inline">Turni:</span>
                          <button
                            type="button"
                            onClick={() => handleSetDateShiftMode(item.dateStr, 'both')}
                            title="Attiva tutti e due i turni"
                            className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                              t1Active && t2Active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Entrambi (8-12)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetDateShiftMode(item.dateStr, 't1_only')}
                            title="Attiva solo il Turno 1 (8:00 - 10:00)"
                            className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                              t1Active && !t2Active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Solo 8-10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetDateShiftMode(item.dateStr, 't2_only')}
                            title="Attiva solo il Turno 2 (10:00 - 12:00)"
                            className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                              !t1Active && t2Active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Solo 10-12
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetDateShiftMode(item.dateStr, 'none')}
                            title="Disattiva tutti i turni per questa data"
                            className={`px-2 py-0.5 rounded-lg font-medium transition-all ${
                              !t1Active && !t2Active
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                            }`}
                          >
                            Sospeso
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Turno 1: 8:00 - 10:00 */}
                      <div
                        className={`p-3.5 rounded-xl border transition-all ${
                          t1Active
                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
                            : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/50 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <Clock className={`w-3.5 h-3.5 ${t1Active ? 'text-indigo-500' : 'text-slate-400'}`} />
                            <span>Turno 1: 8:00 - 10:00</span>
                          </div>
                          {t1Active ? (
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const b = getShiftGenderBadge(t1Assigned, participants, state.people);
                                if (!b) return null;
                                return (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.color}`}>
                                    {b.label}
                                  </span>
                                );
                              })()}
                              <span className="text-[10px] text-slate-400 font-medium">
                                {t1Assigned.length}/2 Assegnati
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded">
                              Non previsto
                            </span>
                          )}
                        </div>

                        {t1Active ? (
                          <>
                            {/* Assigned Pills */}
                            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px] items-center">
                              {t1Assigned.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Nessun proclamatore assegnato</span>
                              ) : (
                                t1Assigned.map(id => {
                                  const p = participants.find(part => part.id === id);
                                  return (
                                    <span
                                      key={id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-xs font-medium border border-indigo-200 dark:border-indigo-800 shadow-sm"
                                    >
                                      <span>{p?.name || 'Sconosciuto'}</span>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleParticipantInShift(item.dateStr, 'turno1', id)}
                                          className="hover:text-rose-600 ml-0.5"
                                          title="Rimuovi"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  );
                                })
                              )}
                            </div>

                            {/* Quick Add Dropdown Checkboxes */}
                            {isAdmin && (
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                  Proclamatori disponibili (8-10):
                                </label>
                                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                                  {availT1Participants.map(p => {
                                    const isSelected = t1Assigned.includes(p.id);
                                    const g = getParticipantGender(p, state.people);
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleToggleParticipantInShift(item.dateStr, 'turno1', p.id)}
                                        className={`px-2 py-0.5 rounded text-[11px] transition-all font-medium border ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                                        }`}
                                      >
                                        {isSelected ? '✓ ' : '+ '}
                                        {p.name}
                                        <span className={`ml-1 text-[9px] font-bold ${
                                          isSelected
                                            ? 'text-indigo-200'
                                            : g === 'M'
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-pink-600 dark:text-pink-400'
                                        }`}>
                                          ({g === 'M' ? 'Fratello' : 'Sorella'})
                                        </span>
                                      </button>
                                    );
                                  })}
                                  {availT1Participants.length === 0 && (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                      Nessun proclamatore con disponibilità dichiarata 8-10.
                                    </span>
                                  )}
                                </div>

                                {/* Select to add any other participant manually */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <span className="text-[10px] text-slate-500 font-medium shrink-0">Altro proclamatore:</span>
                                  <select
                                    value=""
                                    onChange={e => {
                                      if (e.target.value) {
                                        handleToggleParticipantInShift(item.dateStr, 'turno1', e.target.value);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="inp text-[11px] py-1 px-2 flex-1"
                                  >
                                    <option value="">-- Seleziona qualsiasi fratello o sorella --</option>
                                    {participants
                                      .filter(p => !t1Assigned.includes(p.id))
                                      .map(p => {
                                        const g = getParticipantGender(p, state.people);
                                        return (
                                          <option key={p.id} value={p.id}>
                                            {p.name} ({g === 'M' ? 'Fratello' : 'Sorella'})
                                          </option>
                                        );
                                      })}
                                  </select>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-400 italic">
                            Turno disattivato per questa data.
                          </div>
                        )}
                      </div>

                      {/* Turno 2: 10:00 - 12:00 */}
                      <div
                        className={`p-3.5 rounded-xl border transition-all ${
                          t2Active
                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
                            : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/50 opacity-70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <Clock className={`w-3.5 h-3.5 ${t2Active ? 'text-emerald-500' : 'text-slate-400'}`} />
                            <span>Turno 2: 10:00 - 12:00</span>
                          </div>
                          {t2Active ? (
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const b = getShiftGenderBadge(t2Assigned, participants, state.people);
                                if (!b) return null;
                                return (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.color}`}>
                                    {b.label}
                                  </span>
                                );
                              })()}
                              <span className="text-[10px] text-slate-400 font-medium">
                                {t2Assigned.length}/2 Assegnati
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded">
                              Non previsto
                            </span>
                          )}
                        </div>

                        {t2Active ? (
                          <>
                            {/* Assigned Pills */}
                            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px] items-center">
                              {t2Assigned.length === 0 ? (
                                <span className="text-xs text-slate-400 italic">Nessun proclamatore assegnato</span>
                              ) : (
                                t2Assigned.map(id => {
                                  const p = participants.find(part => part.id === id);
                                  return (
                                    <span
                                      key={id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-medium border border-emerald-200 dark:border-emerald-800 shadow-sm"
                                    >
                                      <span>{p?.name || 'Sconosciuto'}</span>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleParticipantInShift(item.dateStr, 'turno2', id)}
                                          className="hover:text-rose-600 ml-0.5"
                                          title="Rimuovi"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </span>
                                  );
                                })
                              )}
                            </div>

                            {/* Quick Add Dropdown Checkboxes */}
                            {isAdmin && (
                              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                                <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                  Proclamatori disponibili (10-12):
                                </label>
                                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                                  {availT2Participants.map(p => {
                                    const isSelected = t2Assigned.includes(p.id);
                                    const g = getParticipantGender(p, state.people);
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleToggleParticipantInShift(item.dateStr, 'turno2', p.id)}
                                        className={`px-2 py-0.5 rounded text-[11px] transition-all font-medium border ${
                                          isSelected
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-400'
                                        }`}
                                      >
                                        {isSelected ? '✓ ' : '+ '}
                                        {p.name}
                                        <span className={`ml-1 text-[9px] font-bold ${
                                          isSelected
                                            ? 'text-emerald-200'
                                            : g === 'M'
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-pink-600 dark:text-pink-400'
                                        }`}>
                                          ({g === 'M' ? 'Fratello' : 'Sorella'})
                                        </span>
                                      </button>
                                    );
                                  })}
                                  {availT2Participants.length === 0 && (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                      Nessun proclamatore con disponibilità dichiarata 10-12.
                                    </span>
                                  )}
                                </div>

                                {/* Select to add any other participant manually */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <span className="text-[10px] text-slate-500 font-medium shrink-0">Altro proclamatore:</span>
                                  <select
                                    value=""
                                    onChange={e => {
                                      if (e.target.value) {
                                        handleToggleParticipantInShift(item.dateStr, 'turno2', e.target.value);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="inp text-[11px] py-1 px-2 flex-1"
                                  >
                                    <option value="">-- Seleziona qualsiasi fratello o sorella --</option>
                                    {participants
                                      .filter(p => !t2Assigned.includes(p.id))
                                      .map(p => {
                                        const g = getParticipantGender(p, state.people);
                                        return (
                                          <option key={p.id} value={p.id}>
                                            {p.name} ({g === 'M' ? 'Fratello' : 'Sorella'})
                                          </option>
                                        );
                                      })}
                                  </select>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-400 italic">
                            Turno disattivato per questa data.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB: SONDAGGIO DISPONIBILITÀ --- */}
      {activeSubTab === 'sondaggio' && (
        <div className="space-y-6">
          {/* --- Admin: gestione sondaggio --- */}
          {isAdmin && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="card-title">Sondaggio Disponibilità</h2>
                </div>

                {survey && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      survey.isOpen
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {survey.isOpen ? 'Sondaggio Aperto' : 'Sondaggio Chiuso'}
                  </span>
                )}
              </div>

              {!survey || !survey.isOpen ? (
                <div className="space-y-3">
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    Pubblica un sondaggio per raccogliere dai proclamatori i giorni e gli orari in cui sono
                    disponibili (Ribolla il martedì, Roccastrada il mercoledì). Una volta ricevute le risposte,
                    potrai applicarle direttamente ai Partecipanti e generare il programma del mese.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={surveyTitleDraft}
                      onChange={e => setSurveyTitleDraft(e.target.value)}
                      placeholder="Titolo sondaggio (opzionale)"
                      className="inp flex-1"
                    />
                    <button type="button" onClick={handlePublishSurvey} className="btn-primary text-xs shrink-0">
                      <Send className="w-4 h-4" />
                      <span>{survey ? 'Pubblica Nuovo Sondaggio' : 'Pubblica Sondaggio'}</span>
                    </button>
                  </div>
                  {survey && !survey.isOpen && (
                    <button type="button" onClick={handleReopenSurvey} className="btn-ghost text-xs">
                      <RotateCw className="w-4 h-4" />
                      <span>Riapri l'ultimo sondaggio (mantiene le risposte già ricevute)</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 rounded-xl p-3">
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{survey.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {surveyResponses.length} risposte ricevute
                        {surveyPendingCount > 0 ? ` · ${surveyPendingCount} da applicare` : ' · tutte applicate'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={handleCopySurveyAnnouncement} className="btn-ghost text-xs">
                        <Megaphone className="w-4 h-4" />
                        <span>Copia messaggio annuncio</span>
                      </button>
                      <button type="button" onClick={handleCloseSurvey} className="btn-ghost text-xs text-rose-600 dark:text-rose-400">
                        <LockIcon className="w-4 h-4" />
                        <span>Chiudi sondaggio</span>
                      </button>
                    </div>
                  </div>

                  {surveyResponses.length > 0 && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleApplyAllAndGenerateSchedule}
                        disabled={surveyPendingCount === 0}
                        className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Applica tutte le disponibilità e passa alla programmazione del mese"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        <span>Applica tutte & vai a Programmazione</span>
                      </button>
                    </div>
                  )}

                  {/* Responses table */}
                  {surveyResponses.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                      Nessuna risposta ricevuta finora.
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="p-2 font-semibold">Nominativo</th>
                            <th className="p-2 font-semibold text-center">Ribolla Mar. 8-10</th>
                            <th className="p-2 font-semibold text-center">Ribolla Mar. 10-12</th>
                            <th className="p-2 font-semibold text-center">Roccastrada Mer. 8-10</th>
                            <th className="p-2 font-semibold text-center">Roccastrada Mer. 10-12</th>
                            <th className="p-2 font-semibold">Note</th>
                            <th className="p-2 font-semibold text-center">Stato</th>
                            <th className="p-2 font-semibold text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {surveyResponses
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(r => (
                              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/70">
                                <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{r.name}</td>
                                <td className="p-2 text-center">{r.availability.ribollaMartedi.turno1 ? '✓' : '—'}</td>
                                <td className="p-2 text-center">{r.availability.ribollaMartedi.turno2 ? '✓' : '—'}</td>
                                <td className="p-2 text-center">{r.availability.roccastradaMercoledi.turno1 ? '✓' : '—'}</td>
                                <td className="p-2 text-center">{r.availability.roccastradaMercoledi.turno2 ? '✓' : '—'}</td>
                                <td className="p-2 text-slate-500 dark:text-slate-400 max-w-[160px] truncate" title={r.notes}>
                                  {r.notes || '—'}
                                </td>
                                <td className="p-2 text-center">
                                  {r.applied ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      Applicata
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                      Da applicare
                                    </span>
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {!r.applied && (
                                      <button
                                        type="button"
                                        onClick={() => handleApplySurveyResponse(r.id)}
                                        className="btn-ghost text-[11px] px-2 py-1 text-emerald-700 dark:text-emerald-300"
                                        title="Applica ai Partecipanti"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSurveyResponse(r.id)}
                                      className="btn-ghost text-[11px] px-2 py-1 text-rose-600 dark:text-rose-400"
                                      title="Elimina risposta"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* --- Modulo di compilazione (visibile a chiunque sia collegato) --- */}
          <div className="card max-w-2xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="card-title">Comunica la tua disponibilità</h2>
            </div>

            {!survey || !survey.isOpen ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                Il sondaggio non è al momento attivo.{isAdmin ? ' Pubblicane uno dal pannello qui sopra.' : ' Riprova più tardi.'}
              </div>
            ) : surveySubmitted ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Grazie! Disponibilità inviata.</p>
                <button
                  type="button"
                  onClick={() => setSurveySubmitted(false)}
                  className="btn-ghost text-xs mx-auto"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Modifica la mia risposta</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="lbl">Il tuo nominativo</label>
                  <select
                    value={surveyRespondentPersonId}
                    onChange={e => {
                      setSurveyRespondentPersonId(e.target.value);
                      if (e.target.value) setSurveyRespondentName('');
                    }}
                    className="inp"
                  >
                    <option value="">— Seleziona dall'anagrafica —</option>
                    {state.people
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Non ti trovi in elenco? Scrivi il tuo nome e cognome qui sotto:
                  </p>
                  <input
                    type="text"
                    value={surveyRespondentName}
                    onChange={e => {
                      setSurveyRespondentName(e.target.value);
                      if (e.target.value) setSurveyRespondentPersonId('');
                    }}
                    placeholder="Nome e Cognome"
                    className="inp mt-1.5"
                    disabled={!!surveyRespondentPersonId}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" /> Mercato di Ribolla — Martedì
                    </p>
                    <label className="flex items-center gap-2 text-xs mb-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={surveyAvailability.ribollaMartedi.turno1}
                        onChange={() =>
                          setSurveyAvailability(prev => ({
                            ...prev,
                            ribollaMartedi: { ...prev.ribollaMartedi, turno1: !prev.ribollaMartedi.turno1 },
                          }))
                        }
                      />
                      <span>8:00 - 10:00</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={surveyAvailability.ribollaMartedi.turno2}
                        onChange={() =>
                          setSurveyAvailability(prev => ({
                            ...prev,
                            ribollaMartedi: { ...prev.ribollaMartedi, turno2: !prev.ribollaMartedi.turno2 },
                          }))
                        }
                      />
                      <span>10:00 - 12:00</span>
                    </label>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Mercato di Roccastrada — Mercoledì
                    </p>
                    <label className="flex items-center gap-2 text-xs mb-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={surveyAvailability.roccastradaMercoledi.turno1}
                        onChange={() =>
                          setSurveyAvailability(prev => ({
                            ...prev,
                            roccastradaMercoledi: { ...prev.roccastradaMercoledi, turno1: !prev.roccastradaMercoledi.turno1 },
                          }))
                        }
                      />
                      <span>8:00 - 10:00</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={surveyAvailability.roccastradaMercoledi.turno2}
                        onChange={() =>
                          setSurveyAvailability(prev => ({
                            ...prev,
                            roccastradaMercoledi: { ...prev.roccastradaMercoledi, turno2: !prev.roccastradaMercoledi.turno2 },
                          }))
                        }
                      />
                      <span>10:00 - 12:00</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="lbl">Note (opzionale)</label>
                  <textarea
                    value={surveyNotes}
                    onChange={e => setSurveyNotes(e.target.value)}
                    className="inp"
                    rows={2}
                    placeholder="Es. disponibile solo ogni due settimane, preferenze particolari…"
                  />
                </div>

                <button type="button" onClick={handleSubmitSurveyResponse} className="btn-primary w-full text-xs py-2.5">
                  <Send className="w-4 h-4" />
                  <span>Invia la mia disponibilità</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: PARTECPANTI & DISPONIBILITÀ --- */}
      {activeSubTab === 'partecipanti' && (
        <div className="space-y-6">
          {/* Add / Import Participant Form Card */}
          <div className="card">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="card-title">Aggiungi o Importa Partecipanti Opera Pubblica</h2>
              </div>

              {isAdmin && state.people.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportAllPeople}
                  className="btn-ghost text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Importa Tutti da Anagrafica</span>
                </button>
              )}
            </div>

            <form onSubmit={handleAddParticipant} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="lbl">Seleziona da Anagrafica Congregazione</label>
                <select
                  value={selectedPersonId}
                  onChange={e => {
                    setSelectedPersonId(e.target.value);
                    if (e.target.value) {
                      const p = state.people.find(person => person.id === e.target.value);
                      if (p) {
                        setNewParticipantName(p.name);
                        setNewParticipantGender(p.gender);
                      }
                    }
                  }}
                  className="inp text-xs"
                >
                  <option value="">-- Seleziona un proclamatore dall'elenco --</option>
                  {state.people.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.gender === 'M' ? 'Fratello' : 'Sorella'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="lbl">Oppure Inserisci Nome Manualmente</label>
                <input
                  type="text"
                  placeholder="Es. Mario Rossi"
                  value={newParticipantName}
                  onChange={e => {
                    setNewParticipantName(e.target.value);
                    if (selectedPersonId) setSelectedPersonId('');
                  }}
                  className="inp text-xs"
                />
              </div>

              <div>
                <label className="lbl">Genere (Sesso)</label>
                <select
                  value={newParticipantGender}
                  onChange={e => setNewParticipantGender(e.target.value as 'M' | 'F')}
                  className="inp text-xs"
                >
                  <option value="M">Fratello (M)</option>
                  <option value="F">Sorella (F)</option>
                </select>
              </div>

              <div>
                <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>Aggiungi</span>
                </button>
              </div>
            </form>
          </div>

          {/* Participant Search and List */}
          <div className="card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="card-title">Disponibilità Turni Mercato ({filteredParticipants.length})</h2>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Cerca partecipante..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="inp pl-8 text-xs py-1.5"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Helper Info */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 border border-slate-200/80 dark:border-slate-700">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>
                Seleziona i tetti orari in cui ciascun proclamatore è disponibile per i carrelli del <strong>Martedì (Ribolla)</strong> e del <strong>Mercoledì (Roccastrada)</strong>.
              </span>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Nessun partecipante trovato. Aggiungi il primo usando il modulo qui sopra!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 rounded-tl-xl">Nome e Cognome</th>
                      <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700/80 bg-indigo-50/50 dark:bg-indigo-950/20">
                        🛒 Martedì - Ribolla
                      </th>
                      <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700/80 bg-emerald-50/50 dark:bg-emerald-950/20">
                        🛒 Mercoledì - Roccastrada
                      </th>
                      <th className="p-3 text-right rounded-tr-xl">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredParticipants.map(p => {
                      const rib = p.availability.ribollaMartedi || { turno1: false, turno2: false };
                      const roc = p.availability.roccastradaMercoledi || { turno1: false, turno2: false };

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <span>{p.name}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleParticipantGender(p.id)}
                                disabled={!isAdmin}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                                  getParticipantGender(p, state.people) === 'M'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 hover:bg-blue-200'
                                    : 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 hover:bg-pink-200'
                                }`}
                                title="Clicca per cambiare genere (Fratello/Sorella)"
                              >
                                {getParticipantGender(p, state.people) === 'M' ? 'Fratello' : 'Sorella'}
                              </button>
                            </div>
                          </td>

                          {/* Ribolla (Martedi) */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-center bg-indigo-50/20 dark:bg-indigo-950/10">
                            <div className="flex items-center justify-center gap-3">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={rib.turno1}
                                  disabled={!isAdmin}
                                  onChange={() => handleToggleAvailability(p.id, 'ribollaMartedi', 'turno1')}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span className={`text-[11px] font-medium ${rib.turno1 ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-400'}`}>
                                  8:00 - 10:00
                                </span>
                              </label>

                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={rib.turno2}
                                  disabled={!isAdmin}
                                  onChange={() => handleToggleAvailability(p.id, 'ribollaMartedi', 'turno2')}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <span className={`text-[11px] font-medium ${rib.turno2 ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-slate-400'}`}>
                                  10:00 - 12:00
                                </span>
                              </label>
                            </div>
                          </td>

                          {/* Roccastrada (Mercoledi) */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-center bg-emerald-50/20 dark:bg-emerald-950/10">
                            <div className="flex items-center justify-center gap-3">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={roc.turno1}
                                  disabled={!isAdmin}
                                  onChange={() => handleToggleAvailability(p.id, 'roccastradaMercoledi', 'turno1')}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                />
                                <span className={`text-[11px] font-medium ${roc.turno1 ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-400'}`}>
                                  8:00 - 10:00
                                </span>
                              </label>

                              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={roc.turno2}
                                  disabled={!isAdmin}
                                  onChange={() => handleToggleAvailability(p.id, 'roccastradaMercoledi', 'turno2')}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                                />
                                <span className={`text-[11px] font-medium ${roc.turno2 ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-400'}`}>
                                  10:00 - 12:00
                                </span>
                              </label>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteParticipant(p.id, p.name)}
                                className="icon-btn text-slate-400 hover:text-rose-600"
                                title="Rimuovi partecipante"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB: STATISTICHE E RIEPILOGO UTILIZZO PER PERSONA --- */}
      {activeSubTab === 'statistiche' && (
        <div className="space-y-6">
          {/* Top Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Proclamatori Impiegati */}
            <div className="card p-4 flex flex-col justify-between border-l-4 border-l-purple-500">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Proclamatori Impiegati
                  </span>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                    {activeParticipantsInMonth} <span className="text-xs font-medium text-slate-500">/ {totalParticipants}</span>
                  </div>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Copertura proclamatori</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">
                    {totalParticipants > 0 ? Math.round((activeParticipantsInMonth / totalParticipants) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${totalParticipants > 0 ? (activeParticipantsInMonth / totalParticipants) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Turni Totali Assegnati */}
            <div className="card p-4 flex flex-col justify-between border-l-4 border-l-indigo-500">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Turni Assegnati
                  </span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {totalShiftsInMonth}
                  </div>
                </div>
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Media carichi:{' '}
                <strong className="text-slate-800 dark:text-slate-200">{averageShifts} turni</strong> per proclamatore attivo
              </div>
            </div>

            {/* Card 3: Ripartizione per Genere */}
            <div className="card p-4 flex flex-col justify-between border-l-4 border-l-pink-500">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Turni Fratelli / Sorelle
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">{menTotalShifts} fratelli</span>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-lg font-black text-pink-600 dark:text-pink-400">{womenTotalShifts} sorelle</span>
                  </div>
                </div>
                <div className="p-2 bg-pink-100 dark:bg-pink-950/70 text-pink-600 dark:text-pink-300 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Rapporto assegnazioni</span>
                  <span>{menStats.length} fratelli / {womenStats.length} sorelle</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${totalShiftsInMonth > 0 ? (menTotalShifts / totalShiftsInMonth) * 100 : 50}%`,
                    }}
                  />
                  <div
                    className="h-full bg-pink-500 transition-all duration-500"
                    style={{
                      width: `${totalShiftsInMonth > 0 ? (womenTotalShifts / totalShiftsInMonth) * 100 : 50}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Card 4: Ripartizione per Luogo */}
            <div className="card p-4 flex flex-col justify-between border-l-4 border-l-emerald-500">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Turni per Luogo
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{ribollaTotalShifts} Ribolla</span>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{roccastradaTotalShifts} Roccastrada</span>
                  </div>
                </div>
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Martedì a Ribolla e Mercoledì a Roccastrada
              </div>
            </div>
          </div>

          {/* Controls, Filters & Export */}
          <div className="card space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="card-title flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Riepilogo Dettagliato Utilizzo per Proclamatore</span>
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Visualizza quanti turni ha svolto ogni persona nel mese di <strong>{MESI[selectedMonth]} {selectedYear}</strong> e nello storico complessivo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportUsageExcel}
                  className="btn-ghost text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5"
                  title="Esporta statistiche complete in formato Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Esporta Statistiche Excel</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca per nome..."
                  value={usageSearchQuery}
                  onChange={e => setUsageSearchQuery(e.target.value)}
                  className="inp pl-8 text-xs py-2"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              </div>

              {/* Gender Filter */}
              <div>
                <select
                  value={usageGenderFilter}
                  onChange={e => setUsageGenderFilter(e.target.value as any)}
                  className="inp text-xs py-2"
                >
                  <option value="all">Tutti i generi (Fratelli e Sorelle)</option>
                  <option value="M">Solo Fratelli ({menStats.length})</option>
                  <option value="F">Solo Sorelle ({womenStats.length})</option>
                </select>
              </div>

              {/* Usage Count Filter */}
              <div>
                <select
                  value={usageCountFilter}
                  onChange={e => setUsageCountFilter(e.target.value as any)}
                  className="inp text-xs py-2"
                >
                  <option value="all">Tutti i proclamatori ({totalParticipants})</option>
                  <option value="active">Con almeno 1 turno nel mese ({activeParticipantsInMonth})</option>
                  <option value="zero">Non impiegati questo mese ({unusedParticipantsInMonth})</option>
                  <option value="frequent">Molto impiegati (3+ turni)</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  value={usageSortBy}
                  onChange={e => setUsageSortBy(e.target.value as any)}
                  className="inp text-xs py-2 font-medium"
                >
                  <option value="shifts-desc">Ordina per: Più impiegati nel mese ↓</option>
                  <option value="shifts-asc">Ordina per: Meno impiegati nel mese ↑</option>
                  <option value="name-asc">Ordina per: Nome alfabetico (A-Z)</option>
                  <option value="history-desc">Ordina per: Totale storico complessivo ↓</option>
                </select>
              </div>
            </div>

            {/* Results Table */}
            {filteredUsageStats.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                Nessun proclamatore corrisponde ai filtri selezionati.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3">Proclamatore</th>
                      <th className="p-3 text-center">
                        Turni {MESI[selectedMonth]} {selectedYear}
                      </th>
                      <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700/80 bg-indigo-50/40 dark:bg-indigo-950/20">
                        🛒 Ribolla (Martedì)
                      </th>
                      <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700/80 bg-emerald-50/40 dark:bg-emerald-950/20">
                        🛒 Roccastrada (Mercoledì)
                      </th>
                      <th className="p-3 border-l border-slate-200 dark:border-slate-700/80">Date nel Mese</th>
                      <th className="p-3 text-center border-l border-slate-200 dark:border-slate-700/80">Storico Totale</th>
                      <th className="p-3 border-l border-slate-200 dark:border-slate-700/80">Disponibilità</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsageStats.map(p => {
                      const count = p.monthTotal;
                      const maxShiftsInMonth = Math.max(1, ...participantUsageStats.map(x => x.monthTotal));
                      const relativePercent = Math.round((count / maxShiftsInMonth) * 100);

                      let badgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
                      let badgeBarColor = 'bg-slate-300 dark:bg-slate-700';

                      if (count === 1) {
                        badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-semibold';
                        badgeBarColor = 'bg-emerald-500';
                      } else if (count === 2) {
                        badgeColor = 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800 font-bold';
                        badgeBarColor = 'bg-teal-500';
                      } else if (count >= 3) {
                        badgeColor = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 font-extrabold';
                        badgeBarColor = 'bg-purple-500';
                      }

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Person Name & Gender */}
                          <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-900 dark:text-slate-100">{p.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  p.gender === 'M'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                                    : 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300'
                                }`}
                              >
                                {p.gender === 'M' ? 'Fratello' : 'Sorella'}
                              </span>
                            </div>
                          </td>

                          {/* Month Count with visual progress indicator */}
                          <td className="p-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border shadow-xs ${badgeColor}`}>
                                <strong>{count}</strong>&nbsp;{count === 1 ? 'turno' : 'turni'}
                              </span>
                              {count > 0 && (
                                <div className="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                                  <div
                                    className={`h-full ${badgeBarColor} rounded-full`}
                                    style={{ width: `${relativePercent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Ribolla breakdown */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800 bg-indigo-50/20 dark:bg-indigo-950/10 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[11px] text-slate-600 dark:text-slate-400" title="Turno 8:00 - 10:00">
                                8-10: <strong className="text-indigo-900 dark:text-indigo-200">{p.monthRibollaT1}</strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <span className="text-[11px] text-slate-600 dark:text-slate-400" title="Turno 10:00 - 12:00">
                                10-12: <strong className="text-indigo-900 dark:text-indigo-200">{p.monthRibollaT2}</strong>
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                Tot: {p.monthRibollaTotal}
                              </span>
                            </div>
                          </td>

                          {/* Roccastrada breakdown */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[11px] text-slate-600 dark:text-slate-400" title="Turno 8:00 - 10:00">
                                8-10: <strong className="text-emerald-900 dark:text-emerald-200">{p.monthRoccastradaT1}</strong>
                              </span>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <span className="text-[11px] text-slate-600 dark:text-slate-400" title="Turno 10:00 - 12:00">
                                10-12: <strong className="text-emerald-900 dark:text-emerald-200">{p.monthRoccastradaT2}</strong>
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                Tot: {p.monthRoccastradaTotal}
                              </span>
                            </div>
                          </td>

                          {/* Month Assigned Dates */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800">
                            {p.monthAssignments.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">Nessun turno nel mese</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {p.monthAssignments.map((a, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                      a.location === 'Ribolla'
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    }`}
                                    title={`${a.location} (${a.shiftTime})`}
                                  >
                                    {a.dayLabel} ({a.location.slice(0, 3)} {a.shiftTime.slice(0, 2)}h)
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Historical Total */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {p.allTimeTotal} {p.allTimeTotal === 1 ? 'turno' : 'turni'}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                {p.lastShiftDate ? `Ultimo: ${formatShortDate(p.lastShiftDate)}` : 'Mai impiegato'}
                              </span>
                            </div>
                          </td>

                          {/* Declared Availability */}
                          <td className="p-3 border-l border-slate-200 dark:border-slate-800">
                            <div className="flex flex-wrap gap-1">
                              {p.availability.ribollaT1 && (
                                <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 rounded text-[9px] font-medium">
                                  Rib 8-10
                                </span>
                              )}
                              {p.availability.ribollaT2 && (
                                <span className="px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 rounded text-[9px] font-medium">
                                  Rib 10-12
                                </span>
                              )}
                              {p.availability.roccastradaT1 && (
                                <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded text-[9px] font-medium">
                                  Roc 8-10
                                </span>
                              )}
                              {p.availability.roccastradaT2 && (
                                <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded text-[9px] font-medium">
                                  Roc 10-12
                                </span>
                              )}
                              {p.totalAvailSlots === 0 && (
                                <span className="text-rose-500 dark:text-rose-400 text-[10px] italic">
                                  Nessuna disp.
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Equity & Unused Participants Recommendation Card */}
          {unusedParticipantsInMonth > 0 && (
            <div className="card p-4 border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                  Proclamatori non ancora impiegati a {MESI[selectedMonth]} ({unusedParticipantsInMonth})
                </h3>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                I seguenti proclamatori hanno disponibilità ma non hanno ancora turni assegnati in questo mese. Considera di coinvolgerli per distribuire equamente il lavoro:
              </p>
              <div className="flex flex-wrap gap-2">
                {participantUsageStats
                  .filter(p => p.monthTotal === 0 && p.totalAvailSlots > 0)
                  .map(p => (
                    <div
                      key={p.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl shadow-2xs"
                    >
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{p.name}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        p.gender === 'M' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300'
                      }`}>
                        {p.gender === 'M' ? 'Fratello' : 'Sorella'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {p.hasRibollaAvail ? 'Ribolla' : ''} {p.hasRibollaAvail && p.hasRoccastradaAvail ? '•' : ''} {p.hasRoccastradaAvail ? 'Roccastrada' : ''}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
      {activeSubTab === 'stampa' && (
        <div className="space-y-6">
          <div className="card flex items-center justify-between no-print">
            <div>
              <h2 className="card-title">Anteprima di Stampa & Condivisione</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Programma completo per il mese di {MESI[selectedMonth]} {selectedYear}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn-ghost text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Esporta Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="btn-ghost text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
              >
                <Share2 className="w-4 h-4" />
                <span>Copia per WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-xs"
                title="Stampa o salva il programma in PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa / PDF</span>
              </button>
            </div>
          </div>

          {/* Printable Layout Sheet */}
          <div className="bg-white text-black p-6 sm:p-8 rounded-none border border-slate-300 shadow-lg space-y-4 printable-area max-w-4xl mx-auto">
            {/* Header Box matching attached PDF */}
            <div className="border-2 border-black p-4 bg-[#f4ede2] flex items-center justify-between gap-4 overflow-hidden relative">
              <div className="flex-1 text-center py-1">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-black tracking-wide uppercase font-sans">
                  PROGRAMMA OPERA CON ESPOSITORI MOBILI
                </h1>
                <h2 className="text-base sm:text-lg md:text-xl font-black text-black uppercase mt-3 tracking-wide font-sans">
                  MESE DI {MESI[selectedMonth].toUpperCase()}
                </h2>
              </div>
              <div className="shrink-0 flex items-center justify-end">
                <img
                  src="/opera_pubblica_cart.svg"
                  alt="Opera Pubblica"
                  referrerPolicy="no-referrer"
                  className="w-40 sm:w-48 h-28 sm:h-32 object-contain"
                />
              </div>
            </div>

            {/* Schedule Table matching PDF */}
            <table className="w-full text-left border-collapse text-xs sm:text-sm border-2 border-black font-sans">
              <thead>
                <tr className="bg-white text-black font-bold border-b border-black">
                  <th className="p-2 border border-black text-center w-[12%]">Data</th>
                  <th className="p-2 border border-black text-left w-[28%] pl-3">Luogo</th>
                  <th className="p-2 border border-black text-center w-[18%]">Orario</th>
                  <th className="p-2 border border-black text-left w-[42%] pl-3">Nominativi</th>
                </tr>
              </thead>
              <tbody>
                {groupedWeeks.map(week => (
                  <React.Fragment key={week.label}>
                    {/* Week Section Row */}
                    <tr className="bg-[#fdf4f4] border-b border-black">
                      <td
                        colSpan={4}
                        className="p-1.5 border border-black text-center font-bold text-[#b91c1c] text-xs sm:text-sm tracking-wide"
                      >
                        {week.label}
                      </td>
                    </tr>

                    {week.items.map(item => {
                      const assignment = schedule.find(s => s.dateStr === item.dateStr);
                      const t1Active = assignment ? (assignment.turno1Active !== false) : true;
                      const t2Active = assignment ? (assignment.turno2Active !== false) : true;

                      const t1Names = (assignment?.turno1 || [])
                        .map(id => participants.find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(' - ');
                      const t2Names = (assignment?.turno2 || [])
                        .map(id => participants.find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(' - ');

                      const shortDate = formatShortDate(item.dateStr);

                      return (
                        <React.Fragment key={item.dateStr}>
                          <tr className="border-b border-black">
                            <td rowSpan={2} className="p-2 border border-black text-center font-bold align-middle text-black bg-white">
                              {shortDate}
                            </td>
                            <td rowSpan={2} className="p-2 border border-black font-bold align-middle text-black pl-3 bg-white">
                              {item.location}
                            </td>
                            <td className="p-1.5 border border-black text-center font-normal text-black bg-white">
                              08,00 - 10,00
                            </td>
                            <td className="p-1.5 border border-black text-black pl-3 font-normal bg-white">
                              {t1Active ? (t1Names || '') : ''}
                            </td>
                          </tr>
                          <tr className="border-b border-black">
                            <td className="p-1.5 border border-black text-center font-normal text-black bg-white">
                              10,00 - 12,00
                            </td>
                            <td className="p-1.5 border border-black text-black pl-3 font-normal bg-white">
                              {t2Active ? (t2Names || '') : ''}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* Extra placeholder rows matching reference template */}
                <tr className="border-b border-black">
                  <td rowSpan={2} className="p-2 border border-black text-center align-middle bg-white"></td>
                  <td rowSpan={2} className="p-2 border border-black font-bold align-middle text-black pl-3 bg-white">
                    Mercato di Ribolla
                  </td>
                  <td className="p-1.5 border border-black text-center font-normal text-black bg-white">
                    08,00 - 10,00
                  </td>
                  <td className="p-1.5 border border-black text-black pl-3 bg-white"></td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 border border-black text-center font-normal text-black bg-white">
                    10,00 - 12,00
                  </td>
                  <td className="p-1.5 border border-black text-black pl-3 bg-white"></td>
                </tr>

                <tr className="border-b border-black">
                  <td rowSpan={2} className="p-2 border border-black text-center align-middle bg-white"></td>
                  <td rowSpan={2} className="p-2 border border-black font-bold align-middle text-black pl-3 bg-white">
                    Mercato di Roccastrada
                  </td>
                  <td className="p-1.5 border border-black text-center font-normal text-black bg-white">
                    08,00 - 10,00
                  </td>
                  <td className="p-1.5 border border-black text-black pl-3 bg-white"></td>
                </tr>
                <tr className="border-b border-black">
                  <td className="p-1.5 border border-black text-center font-normal text-black bg-white">
                    10,00 - 12,00
                  </td>
                  <td className="p-1.5 border border-black text-black pl-3 bg-white"></td>
                </tr>

                {/* 2 Blank rows at bottom for notes/manual writing */}
                <tr className="border-b border-black h-7">
                  <td className="p-1.5 border border-black bg-white"></td>
                  <td className="p-1.5 border border-black bg-white"></td>
                  <td className="p-1.5 border border-black bg-white"></td>
                  <td className="p-1.5 border border-black bg-white"></td>
                </tr>
                <tr className="border-b border-black h-7">
                  <td className="p-1.5 border border-black bg-white"></td>
                  <td className="p-1.5 border border-black bg-white"></td>
                  <td className="p-1.5 border border-black bg-white"></td>
                  <td className="p-1.5 border border-black bg-white"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
