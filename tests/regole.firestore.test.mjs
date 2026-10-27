// Test di firestore.rules nell'emulatore Firebase (serve Java). Non fa parte di test:scheduling.
// Esecuzione, da una cartella con firebase-tools, @firebase/rules-unit-testing e firebase installati:
//   REGOLE=percorso/di/firestore.rules firebase emulators:exec --project demo-regole --only firestore "node --test regole.firestore.test.mjs"
// L'email del primo amministratore viene sostituita con primo@test.it solo per la prova.
import test, { before, after, beforeEach } from 'node:test';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const REGOLE = fs
  .readFileSync(process.env.REGOLE || new URL('../firestore.rules', import.meta.url), 'utf8')
  .replace(/(function amministratoreIniziale\(\) \{\s*return request\.auth\.token\.email == ')[^']*(')/, '$1primo@test.it$2');
if (!REGOLE.includes("== 'primo@test.it'")) throw new Error('amministratoreIniziale() non trovata in firestore.rules');
let env;

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-regole', firestore: { rules: REGOLE, host: '127.0.0.1', port: 8080 } });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'congregationData/main'), { state: { people: [] } });
    await setDoc(doc(db, 'utenti/admin1'), { email: 'admin@test.it', nome: 'Admin', ruolo: 'admin', creato: 'x' });
    await setDoc(doc(db, 'utenti/admin2'), { email: 'admin2@test.it', nome: 'Admin 2', ruolo: 'admin', creato: 'x' });
    await setDoc(doc(db, 'utenti/lettore'), { email: 'lettore@test.it', nome: 'Lettore', ruolo: 'viewer', creato: 'x' });
    await setDoc(doc(db, 'utenti/attesa'), { email: 'attesa@test.it', nome: 'Attesa', ruolo: 'in_attesa', creato: 'x' });
  });
});

const come = (uid, email, verificata = true) => env.authenticatedContext(uid, { email, email_verified: verificata }).firestore();
const dati = db => doc(db, 'congregationData/main');

test('dati: estranei, anonimi ed email non verificate restano fuori', async () => {
  await assertFails(getDoc(dati(env.unauthenticatedContext().firestore())));
  await assertFails(getDoc(dati(env.authenticatedContext('anonimo', {}).firestore())));
  await assertFails(getDoc(dati(come('admin1', 'admin@test.it', false)))); // admin ma email non verificata
  await assertFails(getDoc(dati(come('sconosciuto', 'x@test.it'))));        // verificato ma senza profilo
});

test('dati: in attesa non legge; consultazione legge ma non scrive; admin legge e scrive', async () => {
  await assertFails(getDoc(dati(come('attesa', 'attesa@test.it'))));
  await assertSucceeds(getDoc(dati(come('lettore', 'lettore@test.it'))));
  await assertFails(setDoc(dati(come('lettore', 'lettore@test.it')), { state: {} }, { merge: true }));
  await assertSucceeds(getDoc(dati(come('admin1', 'admin@test.it'))));
  await assertSucceeds(setDoc(dati(come('admin1', 'admin@test.it')), { state: { people: [1] } }, { merge: true }));
});

test('profilo: ognuno crea solo il proprio, in attesa, con la propria email', async () => {
  const db = come('nuovo', 'nuovo@test.it');
  const p = { email: 'nuovo@test.it', nome: 'Nuovo', ruolo: 'in_attesa', creato: 'x' };
  await assertFails(setDoc(doc(db, 'utenti/nuovo'), { ...p, ruolo: 'admin' }));
  await assertFails(setDoc(doc(db, 'utenti/nuovo'), { ...p, ruolo: 'viewer' }));
  await assertFails(setDoc(doc(db, 'utenti/nuovo'), { ...p, email: 'admin@test.it' }));
  await assertFails(setDoc(doc(db, 'utenti/nuovo'), { ...p, extra: true }));
  await assertFails(setDoc(doc(db, 'utenti/altro'), p));
  await assertFails(setDoc(doc(come('nuovo', 'nuovo@test.it', false), 'utenti/nuovo'), p)); // non verificato
  await assertSucceeds(setDoc(doc(db, 'utenti/nuovo'), p));
});

test('profilo: solo l\'email del primo amministratore nasce admin', async () => {
  const p = { email: 'primo@test.it', nome: 'Primo', ruolo: 'admin', creato: 'x' };
  await assertFails(setDoc(doc(come('primo', 'primo@test.it', false), 'utenti/primo'), p));
  await assertSucceeds(setDoc(doc(come('primo', 'primo@test.it'), 'utenti/primo'), p));
});

test('profilo: l\'utente cambia solo il proprio nome, mai il ruolo', async () => {
  const db = come('attesa', 'attesa@test.it');
  await assertSucceeds(getDoc(doc(db, 'utenti/attesa')));
  await assertFails(getDoc(doc(db, 'utenti/lettore')));
  await assertSucceeds(updateDoc(doc(db, 'utenti/attesa'), { nome: 'Nome nuovo' }));
  await assertFails(updateDoc(doc(db, 'utenti/attesa'), { ruolo: 'admin' }));
  await assertFails(updateDoc(doc(come('lettore', 'lettore@test.it'), 'utenti/lettore'), { ruolo: 'admin' }));
});

test('admin: approva e gestisce gli altri, ma non tocca il proprio ruolo né si elimina', async () => {
  const db = come('admin1', 'admin@test.it');
  await assertSucceeds(getDocs(collection(db, 'utenti')));
  await assertSucceeds(updateDoc(doc(db, 'utenti/attesa'), { ruolo: 'viewer' }));
  await assertFails(updateDoc(doc(db, 'utenti/attesa'), { ruolo: 'superadmin' }));
  await assertFails(updateDoc(doc(db, 'utenti/attesa'), { email: 'cambiata@test.it' }));
  await assertFails(updateDoc(doc(db, 'utenti/admin1'), { ruolo: 'viewer' }));
  await assertSucceeds(updateDoc(doc(db, 'utenti/admin2'), { ruolo: 'viewer' }));
  await assertFails(deleteDoc(doc(db, 'utenti/admin1')));
  await assertSucceeds(deleteDoc(doc(db, 'utenti/attesa')));
});

test('consultazione e in attesa non vedono l\'elenco utenti', async () => {
  await assertFails(getDocs(collection(come('lettore', 'lettore@test.it'), 'utenti')));
  await assertFails(getDocs(collection(come('attesa', 'attesa@test.it'), 'utenti')));
  await assertFails(updateDoc(doc(come('lettore', 'lettore@test.it'), 'utenti/attesa'), { ruolo: 'viewer' }));
});

test('permessi per programma: si modifica solo il programma concesso', async () => {
  await env.withSecurityRulesDisabled(ctx =>
    setDoc(doc(ctx.firestore(), 'utenti/vm'), { email: 'vm@test.it', nome: 'VM', ruolo: 'viewer', creato: 'x', permessi: { vitaEMinistero: 'modifica', domenica: 'modifica', mensile: 'vede' } }));
  const db = come('vm', 'vm@test.it');
  await assertSucceeds(setDoc(dati(db), { state: { vitaEMinistero: { meetings: [1] } }, updatedAt: 'x' }, { merge: true }));
  await assertSucceeds(setDoc(dati(db), { activePrograms: { domRows: [], domMonth: 3 } }, { merge: true }));
  await assertFails(setDoc(dati(db), { state: { people: [1] } }, { merge: true }));          // anagrafica: solo admin
  await assertFails(setDoc(dati(db), { state: { territori: { assegnazioni: [] } } }, { merge: true })); // nascosto
  await assertFails(setDoc(dati(db), { activePrograms: { menRows: [] } }, { merge: true })); // mensile: solo consultazione
  await assertFails(setDoc(dati(db), { altro: 1 }, { merge: true }));
  await assertFails(setDoc(dati(db), { activePrograms: { junk: 1 } }, { merge: true }));
  await assertFails(setDoc(dati(come('lettore', 'lettore@test.it')), { state: { vitaEMinistero: {} } }, { merge: true })); // senza permessi
  const admin = come('admin1', 'admin@test.it');
  await assertSucceeds(updateDoc(doc(admin, 'utenti/lettore'), { permessi: { territori: 'modifica' } }));
  await assertFails(updateDoc(doc(admin, 'utenti/lettore'), { permessi: 'tutto' }));
  await assertFails(updateDoc(doc(db, 'utenti/vm'), { permessi: { mensile: 'modifica' } })); // non si dà permessi da solo
});

test('allegati: li legge chi è approvato, li carica e cancella solo l\'admin, solo PDF', async () => {
  const pdf = { nome: 'a.pdf', dati: 'data:application/pdf;base64,JVBERi0=', caricato: 'x' };
  const admin = come('admin1', 'admin@test.it');
  await assertSucceeds(setDoc(doc(admin, 'allegati/a1'), pdf));
  await assertFails(setDoc(doc(admin, 'allegati/a2'), { ...pdf, dati: 'data:text/html;base64,PGI+' }));
  await assertFails(setDoc(doc(admin, 'allegati/a3'), { ...pdf, extra: 1 }));
  await assertSucceeds(getDoc(doc(come('lettore', 'lettore@test.it'), 'allegati/a1')));
  await assertFails(getDoc(doc(come('attesa', 'attesa@test.it'), 'allegati/a1')));
  await assertFails(setDoc(doc(come('lettore', 'lettore@test.it'), 'allegati/a4'), pdf));
  await assertFails(deleteDoc(doc(come('lettore', 'lettore@test.it'), 'allegati/a1')));
  await assertSucceeds(deleteDoc(doc(admin, 'allegati/a1')));
});
