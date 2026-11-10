import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
}

const LOG = collection(db, 'log');

// Il registro non deve mai bloccare il lavoro: un errore si segnala solo in console.
export function registraEvento(azione: AzioneLog, sezioni: string[] = [], dettaglio = '') {
  const u = auth.currentUser;
  if (!u) return;
  addDoc(LOG, { uid: u.uid, email: u.email || '', quando: serverTimestamp(), azione, sezioni: sezioni.slice(0, 30), dettaglio: dettaglio.slice(0, 300) })
    .catch(err => console.warn('Registro attività non scritto:', err));
}

// Le modifiche arrivano a raffiche (ogni campo salva): si raccolgono e si scrive una voce sola.
// shortcut: una voce ogni 60 s di pausa o quando si lascia la pagina; se il browser si chiude di colpo l'ultima raffica può perdersi.
const inAttesa = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
const scarica = () => {
  clearTimeout(timer);
  if (!inAttesa.size) return;
  registraEvento('modifica', [...inAttesa]);
  inAttesa.clear();
};
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', scarica);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && scarica());
}

export function registraModifica(sezioni: string[]) {
  if (!sezioni.length) return;
  sezioni.forEach(s => inAttesa.add(s));
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
      };
    })),
    onErrore,
  );
}
