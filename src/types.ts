export type UserRole = 'admin' | 'viewer';

export interface AuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  role: UserRole;
  isAnonymousPIN?: boolean;
}

export interface PersonRoles {
  uscieri: boolean;
  console: boolean;
  microfoni: boolean;
  presidente: boolean;
  preghiera: boolean;
  lettore: boolean;
}

export interface Person {
  id: string;
  name: string;
  gender: 'M' | 'F';
  spouseId: string | null;
  roles: PersonRoles;
}

export interface ArchivedMensileRow {
  dateStr: string;
  special?: string;
  ingresso?: [string, string];
  auditorium?: string;
  microfoni?: [string, string];
  audioVideo?: [string, string];
  riassetto?: string;
  pulizie?: string;
  duplicates?: string[];
  warnings?: string[];
}

export interface ArchivedProgram {
  id: string;
  month: number;
  year: number;
  title: string;
  savedAt: string;
  rows: ArchivedMensileRow[];
  warn?: string | null;
}

export interface OperaPubblicaShiftAvailability {
  turno1: boolean; // 8:00 - 10:00
  turno2: boolean; // 10:00 - 12:00
}

export interface OperaPubblicaParticipant {
  id: string;
  name: string;
  personId?: string | null;
  gender?: 'M' | 'F';
  availability: {
    ribollaMartedi: OperaPubblicaShiftAvailability;
    roccastradaMercoledi: OperaPubblicaShiftAvailability;
  };
  notes?: string;
}

export interface OperaPubblicaShiftAssignment {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: 'martedi' | 'mercoledi';
  location: 'Mercato di Ribolla' | 'Mercato di Roccastrada';
  turno1: string[]; // Participant IDs
  turno2: string[]; // Participant IDs
  turno1Active?: boolean; // defaults to true if undefined
  turno2Active?: boolean; // defaults to true if undefined
  notes?: string;
}

export interface OperaPubblicaSurveyResponse {
  id: string;
  participantId?: string | null; // linked existing participant, if matched
  personId?: string | null; // linked anagrafica person, if selected
  name: string; // name as submitted by the respondent
  gender?: 'M' | 'F';
  availability: {
    ribollaMartedi: OperaPubblicaShiftAvailability;
    roccastradaMercoledi: OperaPubblicaShiftAvailability;
  };
  notes?: string;
  submittedAt: string; // ISO timestamp
  applied?: boolean; // true once an admin has synced this into the participants list
}

export interface OperaPubblicaSurvey {
  id: string;
  title: string;
  isOpen: boolean;
  createdAt: string;
  closedAt?: string | null;
  responses: OperaPubblicaSurveyResponse[];
}

export interface OperaPubblicaData {
  participants: OperaPubblicaParticipant[];
  schedule: OperaPubblicaShiftAssignment[];
  defaultShifts?: {
    ribollaMartedi: { turno1: boolean; turno2: boolean };
    roccastradaMercoledi: { turno1: boolean; turno2: boolean };
  };
  survey?: OperaPubblicaSurvey | null;
}

export interface ServizioCampoAvailability {
  martediMattina: boolean;
  giovediMattina: boolean;
  sabatoPomeriggio: boolean;
  domenicaPomeriggio: boolean;
}

export interface ServizioCampoConductor {
  id: string;
  name: string;
  personId?: string | null;
  gender?: 'M' | 'F';
  availability: ServizioCampoAvailability;
  notes?: string;
  isActive?: boolean;
}

export type ServizioCampoDayKey =
  | 'martediMattina'
  | 'giovediMattina'
  | 'sabatoPomeriggio'
  | 'domenicaPomeriggio'
  | 'speciale';

export type ServizioCampoMeetingType =
  | 'standard'
  | 'festivo'
  | 'unificata'
  | 'visita'
  | 'campagna'
  | 'speciale';

export interface ServizioCampoMeetingAssignment {
  id?: string;
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: 'lunedi' | 'martedi' | 'mercoledi' | 'giovedi' | 'venerdi' | 'sabato' | 'domenica';
  timeSlot: 'mattina' | 'pomeriggio' | 'sera';
  slotKey: ServizioCampoDayKey;
  meetingType?: ServizioCampoMeetingType; // 'standard' | 'festivo' | 'unificata' | 'visita' | 'campagna' | 'speciale'
  time: string; // e.g. "09:30" or "15:00"
  location: string; // e.g. "Sala del Regno"
  conductorId: string | null; // Conductor ID
  isActive: boolean; // default true, false if suspended (e.g. Assemblea)
  specialNote?: string; // e.g. "1° Maggio - Festa del Lavoro", "Adunanza Unificata", "Visita Sorvegliante"
  isCustom?: boolean; // true if added manually as extra special date
  notes?: string;
}

export interface ServizioCampoDefaultSlotConfig {
  time: string;
  defaultLocation: string;
  active: boolean;
}

export interface ServizioCampoData {
  conductors: ServizioCampoConductor[];
  schedule: ServizioCampoMeetingAssignment[];
  locations: string[];
  defaultSettings?: {
    martediMattina: ServizioCampoDefaultSlotConfig;
    giovediMattina: ServizioCampoDefaultSlotConfig;
    sabatoPomeriggio: ServizioCampoDefaultSlotConfig;
    domenicaPomeriggio: ServizioCampoDefaultSlotConfig;
  };
}

export interface VitaEMinisteroParticipantRoles {
  presidente: boolean;
  preghiera: boolean;
  tesoriDiscorso: boolean;
  tesoriGemme: boolean;
  tesoriLettura: boolean;
  ministeroStudente: boolean;
  // Sottoinsieme dei tipi di parte "Efficaci nel ministero" per cui questo
  // proclamatore è abilitato (vedi MinisteroPartTypeDef.id in ministeroPartTypes.ts).
  // undefined o [] = nessuna restrizione, abilitato a tutti i tipi (retrocompatibile).
  ministeroTipiAbilitati?: string[];
  ministeroAssistente: boolean;
  vitaCristianaParti: boolean;
  studioBiblicoConduttore: boolean;
  studioBiblicoLettore: boolean;
}

// Un "tipo di parte" per la sezione Efficaci nel ministero (criterio di
// assegnazione, es. durata breve, dimostrazione, solo lettura...).
// La lista di base (isDefault: true) è fissa; l'amministratore può
// aggiungerne altri (isDefault: false) da StateData/VitaEMinisteroData.ministeroPartTypes.
export interface MinisteroPartTypeDef {
  id: string;
  label: string;
  isDefault?: boolean;
}

export interface VitaEMinisteroParticipant {
  id: string;
  name: string;
  gender: 'M' | 'F';
  personId?: string | null;
  roles: VitaEMinisteroParticipantRoles;
  notes?: string;
}

export interface MinisteroPart {
  id: string;
  number: number; // e.g. 4, 5, 6, 7
  title: string;  // e.g. "Iniziare una conversazione"
  minutes: number; // e.g. 2, 3, 4, 5, 6
  studentId: string; // Participant ID
  assistantId?: string; // Participant ID (optional)
  hasAssistant: boolean; // default true for student presentations
  // Foglietto S-89
  isSent?: boolean; // Flag "inviato o non inviato"
  room?: 'main' | 'aux1' | 'aux2'; // Sala principale, Sala secondaria 1, Sala secondaria 2
  // Tipi di parte assegnati (vedi MinisteroPartTypeDef), usati per filtrare
  // i proclamatori idonei in base ai criteri configurati (durata, formato, ecc.).
  // Impostati automaticamente da durata/hasAssistant e modificabili a mano.
  partTypeIds?: string[];
}

export interface VitaCristianaPart {
  id: string;
  number: number; // e.g. 7 or 8
  title: string;  // e.g. "Geova è il difensore delle vedove" or "Bisogni locali"
  minutes: number; // e.g. 15
  speakerId: string; // Participant ID
}

export interface VitaEMinisteroMeeting {
  id: string;
  dateStr: string; // YYYY-MM-DD (e.g. 2026-10-05)
  dateLabel: string; // e.g. "5 ottobre 2026"
  bibleReading: string; // e.g. "GEREMIA 40-41"
  isSpecialEvent?: boolean; // true if assembly or visit
  specialEventTitle?: string; // e.g. "Assemblea di circoscrizione"

  // Intestazione
  presidenteId?: string;
  canticoIniziale?: string; // e.g. "Cantico 33: Getta su Geova il tuo peso"
  preghieraInizialeId?: string;

  // Tesori della Parola di Dio
  tesori1Title?: string; // e.g. "Il giusto punto di vista su come Geova ci protegge"
  tesori1Minutes?: number; // 10
  tesori1SpeakerId?: string;

  tesoriGemmeTitle?: string; // "Gemme spirituali"
  tesoriGemmeMinutes?: number; // 10
  tesoriGemmeSpeakerId?: string;

  tesoriLetturaTitle?: string; // "Lettura biblica"
  tesoriLetturaMinutes?: number; // 4
  tesoriLetturaReaderId?: string;
  // Foglietto S-89 per lettura biblica (Parte n. 3)
  tesoriLetturaSent?: boolean; // Flag "inviato o non inviato"
  tesoriLetturaRoom?: 'main' | 'aux1' | 'aux2';

  // Efficaci nel ministero
  ministeroParts: MinisteroPart[];

  // Vita Cristiana
  canticoIntermedio?: string; // e.g. 'Cantico 17: "Lo voglio"'
  vitaCristianaParts: VitaCristianaPart[];

  // Studio Biblico di Congregazione
  studioBiblicoTitle?: string; // "Studio biblico di congregazione"
  studioBiblicoMinutes?: number; // 30
  studioBiblicoConductorId?: string;
  studioBiblicoReaderId?: string;

  // Conclusione
  canticoFinale?: string; // e.g. "Cantico 38: Dio ti renderà forte"
  preghieraFinaleId?: string;
  notes?: string;
}

export interface VitaEMinisteroData {
  congregationName?: string; // e.g. "Roccastrada"
  participants: VitaEMinisteroParticipant[];
  meetings: VitaEMinisteroMeeting[];
  // Tipi di parte "Efficaci nel ministero" aggiunti dall'amministratore,
  // in aggiunta alla lista fissa predefinita (vedi DEFAULT_MINISTERO_PART_TYPES).
  ministeroPartTypes?: MinisteroPartTypeDef[];
}

export interface StateData {
  people: Person[];
  unavail: Record<string, string[]>; // { personId: ["YYYY-MM-DD", ...] }
  special: Record<string, string>;   // { "YYYY-MM-DD": "etichetta" }
  groups: {
    riassetto: string; // '1' | '2' | '3' | '4'
    pulizie: string;   // 'Massa' | '1' | '2' | '3' | '4'
  };
  mensileArchives?: ArchivedProgram[];
  adminPin?: string;
  viewerPin?: string;
  operaPubblica?: OperaPubblicaData;
  servizioCampo?: ServizioCampoData;
  vitaEMinistero?: VitaEMinisteroData;
  programResponsibles?: Partial<Record<ChecklistProgramKey, ProgramResponsible>>;
}

export interface MensileRow {
  date: Date;
  special?: string;
  ingresso?: [string, string];
  auditorium?: string;
  microfoni?: [string, string];
  audioVideo?: [string, string];
  riassetto?: string;
  pulizie?: string;
  duplicates?: string[];
  warnings?: string[];
}

export interface DomenicaRow {
  date: Date;
  special?: string;
  oratore?: string;
  titoloDiscorso?: string;
  presidente?: string;
  preghiera?: string;
  lettore?: string;
  duplicates?: string[];
  warnings?: string[];
}

export type ChecklistProgramKey = 'mensile' | 'domenica' | 'vitaEMinistero' | 'servizioCampo' | 'operaPubblica';

export interface ProgramResponsible {
  name: string;
  email: string;
}
