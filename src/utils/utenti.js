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
