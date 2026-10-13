// Discorsi esterni: oratori della congregazione che vanno a tenere il discorso pubblico altrove.
// Date in formato "YYYY-MM-DD".

export function normalizeDiscorsiEsterni(raw) {
  const oratori = Array.isArray(raw?.oratori)
    ? raw.oratori
      .filter(o => typeof o?.nome === 'string' && o.nome.trim())
      .map(o => ({ ...o, schemi: Array.isArray(o.schemi) ? [...new Set(o.schemi.filter(s => typeof s === 'string'))] : [] }))
    : [];
  const uscite = Array.isArray(raw?.uscite)
    ? raw.uscite.filter(u => u?.id && u.data && u.oratore && u.titolo && u.congregazione)
    : [];
  return { oratori, uscite };
}

// Prima le uscite da fare (la più vicina in cima), poi lo storico (la più recente in cima).
export function ordinaUscite(uscite, oggi) {
  const prossime = uscite.filter(u => u.data >= oggi).sort((a, b) => a.data.localeCompare(b.data));
  const passate = uscite.filter(u => u.data < oggi).sort((a, b) => b.data.localeCompare(a.data));
  return { prossime, passate };
}

// Un oratore non può essere in due congregazioni nello stesso giorno.
export function conflittoUscita(uscite, { id, oratore, data }) {
  return uscite.find(u => u.id !== id && u.oratore === oratore && u.data === data) || null;
}

// L'ultima volta che l'oratore ha già portato quello schema in quella congregazione.
export function giaPresentato(uscite, { id, oratore, titolo, congregazione }) {
  const chiave = s => s.trim().toLowerCase();
  return uscite
    .filter(u => u.id !== id && u.oratore === oratore && u.titolo === titolo && chiave(u.congregazione) === chiave(congregazione))
    .sort((a, b) => b.data.localeCompare(a.data))[0] || null;
}

const pad = n => String(n).padStart(2, '0');
const giornoIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Settimane (da lunedì a domenica) che coprono il mese; mese 0-11.
// Ogni giorno: { data: "YYYY-MM-DD", giorno, nelMese }.
export function settimaneDelMese(anno, mese) {
  const primo = new Date(anno, mese, 1);
  const inizio = new Date(anno, mese, 1 - ((primo.getDay() + 6) % 7));
  const settimane = [];
  for (const d = new Date(inizio); settimane.length === 0 || d.getMonth() === mese; ) {
    const settimana = [];
    for (let i = 0; i < 7; i++) {
      settimana.push({ data: giornoIso(d), giorno: d.getDate(), nelMese: d.getMonth() === mese });
      d.setDate(d.getDate() + 1);
    }
    settimane.push(settimana);
  }
  return settimane;
}

// { "YYYY-MM-DD": [uscite di quel giorno, in ordine di orario] }
export function uscitePerGiorno(uscite) {
  const perGiorno = {};
  for (const u of uscite) (perGiorno[u.data] ||= []).push(u);
  for (const lista of Object.values(perGiorno)) lista.sort((a, b) => (a.orario || '99').localeCompare(b.orario || '99'));
  return perGiorno;
}

export function congregazioniUsate(uscite) {
  const viste = new Map();
  for (const u of uscite) {
    const nome = u.congregazione.trim();
    if (nome && !viste.has(nome.toLowerCase())) viste.set(nome.toLowerCase(), nome);
  }
  return [...viste.values()].sort((a, b) => a.localeCompare(b, 'it'));
}
