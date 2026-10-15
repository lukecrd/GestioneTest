// Logica pura degli account: ruoli, ordinamento, messaggi d'errore di Firebase Auth in italiano.
// La protezione vera sta in firestore.rules: qui c'è solo ciò che serve all'interfaccia.

export const RUOLI = {
  in_attesa: 'In attesa di approvazione',
  viewer: 'Consultazione',
  admin: 'Amministratore',
};

const norm = email => String(email || '').trim().toLowerCase();

// Il primo amministratore nasce già approvato; tutti gli altri restano in attesa.
export function ruoloIniziale(email, emailAmministratoreIniziale) {
  return norm(emailAmministratoreIniziale) && norm(email) === norm(emailAmministratoreIniziale) ? 'admin' : 'in_attesa';
}

const ORDINE = { in_attesa: 0, admin: 1, viewer: 2 };

// Prima le richieste da approvare, poi amministratori e consultazione, ciascuno in ordine di nome.
export function ordinaUtenti(utenti) {
  return [...utenti].sort((a, b) =>
    (ORDINE[a.ruolo] ?? 9) - (ORDINE[b.ruolo] ?? 9) ||
    (a.nome || a.email).localeCompare(b.nome || b.email, 'it'));
}

export function contaInAttesa(utenti) {
  return utenti.filter(u => u.ruolo === 'in_attesa').length;
}

const MESSAGGI = {
  'auth/invalid-credential': 'Email o password non corrette.',
  'auth/wrong-password': 'Email o password non corrette.',
  'auth/user-not-found': 'Email o password non corrette.',
  'auth/invalid-email': 'L\'indirizzo email non è valido.',
  'auth/email-already-in-use': 'Questa email è già registrata: accedi o usa "Password dimenticata".',
  'auth/weak-password': 'La password deve avere almeno 8 caratteri.',
  'auth/too-many-requests': 'Troppi tentativi. Aspetta qualche minuto e riprova.',
  'auth/network-request-failed': 'Connessione assente. Controlla internet e riprova.',
  'auth/user-disabled': 'Questo account è stato disattivato.',
  'auth/missing-password': 'Inserisci la password.',
};

export function messaggioErrore(err) {
  return MESSAGGI[err?.code] || 'Operazione non riuscita. Riprova.';
}

// Firebase accetta 6 caratteri; qui chiediamo di più, ma senza regole complicate.
export function passwordValida(password) {
  return typeof password === 'string' && password.length >= 8;
}

// Programmi su cui si possono dare permessi per singolo utente (chiavi = sezioni dell'app).
export const PROGRAMMI = {
  mensile: 'Programma mensile',
  domenica: 'Adunanza domenica',
  vitaEMinistero: 'Vita e ministero',
  discorsiEsterni: 'Discorsi esterni',
  servizioCampo: 'Servizio di campo',
  operaPubblica: 'Opera pubblica',
  territori: 'Territori',
};

// permessi: { [programma]: 'vede' | 'modifica' }; un programma assente è nascosto.
// Senza permessi (profili creati prima) l'utente in consultazione vede tutto e non modifica nulla.
export function puoVedere(utente, sezione) {
  if (utente?.role === 'admin' || !(sezione in PROGRAMMI) || !utente?.permessi) return true;
  return !!utente.permessi[sezione];
}

// Fuori dai programmi (persone, assenze, utenti…) modifica solo l'amministratore.
export function puoModificare(utente, sezione) {
  return utente?.role === 'admin' || (sezione in PROGRAMMI && utente?.permessi?.[sezione] === 'modifica');
}

// Chiavi di "state" in congregationData che l'utente può scrivere: le stesse controllate da firestore.rules.
export function chiaviStatoModificabili(utente) {
  return Object.keys(PROGRAMMI).filter(s => s !== 'domenica' && puoModificare(utente, s))
    .map(s => (s === 'mensile' ? 'mensileArchives' : s));
}
