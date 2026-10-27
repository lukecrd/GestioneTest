import { collection, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// PDF della Tabella informazioni, uno per documento nella collezione "allegati".
// shortcut: base64 in Firestore (limite documento 1 MiB → PDF fino a ~700 KB); passare a Firebase Storage se servono file più grandi.
export const MAX_ALLEGATO_BYTES = 700 * 1024;

const leggiComeDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export async function caricaAllegato(file: File): Promise<string> {
  if (file.type !== 'application/pdf') throw new Error('Puoi caricare solo file PDF.');
  if (file.size > MAX_ALLEGATO_BYTES) throw new Error(`Il PDF supera ${Math.round(MAX_ALLEGATO_BYTES / 1024)} KB: comprimilo o usa un link.`);
  const ref = doc(collection(db, 'allegati'));
  await setDoc(ref, { nome: file.name, dati: await leggiComeDataUrl(file), caricato: new Date().toISOString() });
  return ref.id;
}

export async function leggiAllegato(fileId: string): Promise<Blob> {
  const snap = await getDoc(doc(db, 'allegati', fileId));
  if (!snap.exists()) throw new Error('Il PDF non è più disponibile.');
  return (await fetch(snap.data().dati as string)).blob();
}

export async function apriAllegato(fileId: string) {
  // La finestra si apre subito, prima dell'attesa, altrimenti il browser la blocca come popup.
  const finestra = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(await leggiAllegato(fileId));
    if (finestra) finestra.location.href = url; else window.location.href = url;
  } catch (err) {
    finestra?.close();
    throw err;
  }
}

export const eliminaAllegato = (fileId: string) => deleteDoc(doc(db, 'allegati', fileId));
