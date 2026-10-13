import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
// Progetto "congregazionedb", database Firestore predefinito.
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = initializeFirestore(
  app,
  { ignoreUndefinedProperties: true },
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || undefined
);

export const auth = getAuth(app);
auth.languageCode = 'it';
