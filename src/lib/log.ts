import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { descriviModifiche } from '../utils/logDiff';

// Registro delle attività (collezione "log"): lo scrive chi è approvato, lo legge solo l'amministratore.
// Le regole impongono uid, email e ora del server, e vietano modifiche e cancellazioni.
export type AzioneLog = 'accesso' | 'modifica' | 'utenti';

export interface VoceLog {
  id: string;
  uid: string;
  email: string;
  quando: Date | null; // null finché il server non ha assegnato l'ora
  azione: AzioneLog;
  sezioni: string[];
  dettaglio: string;
  modifiche: string[]; // "Territori — assegnazioni: aggiunto 12 · Rossi"
}

// Nomi leggibili delle parti dei dati (chiavi di state) e dei due programmi in activePrograms.
export const SEZIONI_LOG: Record<string, string> = {
  people: 'Persone',
  unavail: 'Assenze',
  special: 'Calendario',
  groups: 'Gruppi',
  programResponsibles: 'Responsabili dei programmi',
  mensile: 'Programma mensile',
  mensileArchives: 'Programma mensile (archivio)',
  domenica: 'Adunanza domenica',
  vitaEMinistero: 'Vita e ministero',
  discorsiEsterni: 'Discorsi esterni',
  servizioCampo: 'Servizio di campo',
  operaPubblica: 'Opera pubblica',
  territori: 'Territori',
  tabellaAllegati: 'Tabella informazioni',
};

const LOG = collection(db, 'log');

// Il registro non deve mai bloccare il lavoro: un errore si segnala solo in console.
export function registraEvento(azione: AzioneLog, sezioni: string[] = [], dettaglio = '', modifiche: string[] = []) {
  const u = auth.currentUser;
  if (!u) return;
  addDoc(LOG, {
    uid: u.uid, email: u.email || '', quando: serverTimestamp(), azione, sezioni: sezioni.slice(0, 30), dettaglio: dettaglio.slice(0, 300),
    ...(modifiche.length ? { modifiche: modifiche.slice(0, 100) } : {}),
  })
    .catch(err => console.warn('Registro attività non scritto:', err));
}

// Le modifiche arrivano a raffiche (ogni campo salva): si tiene la versione di prima del primo salvataggio
// e quella dell'ultimo, e si scrive una voce sola con le differenze nette.
// shortcut: una voce ogni 60 s di pausa o quando si lascia la pagina; se il browser si chiude di colpo l'ultima raffica può perdersi.
const inAttesa = new Map<string, { prima: unknown; dopo: unknown }>();
let nomiPersone = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const scarica = () => {
  clearTimeout(timer);
  if (!inAttesa.size) return;
  const sezioni: string[] = [];
  const modifiche: string[] = [];
  for (const [sezione, { prima, dopo }] of inAttesa) {
    const righe = descriviModifiche(prima, dopo, nomiPersone);
    if (!righe.length) continue; // tornata com'era
    sezioni.push(sezione);
    modifiche.push(...righe.map(r => `${SEZIONI_LOG[sezione] ?? sezione} — ${r}`));
  }
  inAttesa.clear();
  if (sezioni.length) registraEvento('modifica', sezioni, '', modifiche);
};
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', scarica);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && scarica());
}

// nomi: id persona -> nome, per scrivere "Mario Rossi" al posto dell'id (senza, restano quelli dell'ultima volta).
export function registraModifica(cambi: { sezione: string; prima: unknown; dopo: unknown }[], nomi?: Map<string, string>) {
  if (nomi) nomiPersone = nomi;
  if (!cambi.length) return;
  // copie: la versione di prima resta quella anche se qualcuno modifica l'oggetto in seguito
  for (const { sezione, prima, dopo } of cambi) {
    const gia = inAttesa.get(sezione);
    inAttesa.set(sezione, { prima: gia ? gia.prima : structuredClone(prima), dopo: structuredClone(dopo) });
  }
  clearTimeout(timer);
  timer = setTimeout(scarica, 60_000);
}

export function ascoltaLog(onDati: (voci: VoceLog[]) => void, onErrore: (e: unknown) => void, max = 500) {
  return onSnapshot(
    query(LOG, orderBy('quando', 'desc'), limit(max)),
    snap => onDati(snap.docs.map(d => {
      const v = d.data();
      return {
        id: d.id,
        uid: String(v.uid ?? ''),
        email: String(v.email ?? ''),
        quando: v.quando instanceof Timestamp ? v.quando.toDate() : null,
        azione: v.azione,
        sezioni: Array.isArray(v.sezioni) ? v.sezioni.map(String) : [],
        dettaglio: String(v.dettaglio ?? ''),
        modifiche: Array.isArray(v.modifiche) ? v.modifiche.map(String) : [],
      };
    })),
    onErrore,
  );
}
