import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { ruoloIniziale } from '../utils/utenti';

// ⚠ PRIMO AMMINISTRATORE: deve coincidere con l'email scritta in firestore.rules (funzione amministratoreIniziale).
// Chi si registra con questa email, dopo averla verificata, diventa subito amministratore.
export const EMAIL_AMMINISTRATORE_INIZIALE = 'luca.cardelli@gmail.com';

export type Ruolo = 'in_attesa' | 'viewer' | 'admin';

export interface ProfiloUtente {
  uid: string;
  email: string;
  nome: string;
  ruolo: Ruolo;
  creato?: string;
}

const profiloRef = (uid: string) => doc(db, 'utenti', uid);

export function ascoltaProfilo(uid: string, onDati: (p: ProfiloUtente | null) => void, onErrore: (e: unknown) => void) {
  return onSnapshot(profiloRef(uid), snap => onDati(snap.exists() ? ({ uid, ...snap.data() } as ProfiloUtente) : null), onErrore);
}

// Le regole accettano solo questi campi, e il ruolo "admin" solo per l'email iniziale.
export function creaProfilo(user: User, nome: string) {
  const email = user.email || '';
  return setDoc(profiloRef(user.uid), {
    email,
    nome: nome.trim().slice(0, 80),
    ruolo: ruoloIniziale(email, EMAIL_AMMINISTRATORE_INIZIALE),
    creato: new Date().toISOString(),
  });
}

export function ascoltaUtenti(onDati: (u: ProfiloUtente[]) => void, onErrore: (e: unknown) => void) {
  return onSnapshot(
    collection(db, 'utenti'),
    snap => onDati(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as ProfiloUtente)),
    onErrore,
  );
}

export const cambiaRuolo = (uid: string, ruolo: Ruolo) => updateDoc(profiloRef(uid), { ruolo });
export const eliminaProfilo = (uid: string) => deleteDoc(profiloRef(uid));
