// Logica pura dei territori: date in formato locale "YYYY-MM-DD".

export const MESI_SCADENZA = 4;
export const GIORNI_PREAVVISO = 30;

const DAY = 86400000;

export function parseDay(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function scadenzaTerritorio(assegnato) {
  const start = parseDay(assegnato);
  const due = new Date(start.getFullYear(), start.getMonth() + MESI_SCADENZA, start.getDate());
  // 31 ottobre + 4 mesi non esiste: si ferma all'ultimo giorno di febbraio.
  if (due.getDate() !== start.getDate()) due.setDate(0);
  return formatDay(due);
}

// Avanzamento verso la scadenza di un'assegnazione ancora aperta.
export function statoScadenza(assegnato, oggi = formatDay(new Date())) {
  const start = parseDay(assegnato).getTime();
  const due = parseDay(scadenzaTerritorio(assegnato)).getTime();
  const now = parseDay(oggi).getTime();
  const giorniRimasti = Math.round((due - now) / DAY);
  const frazione = Math.min(1, Math.max(0, (now - start) / (due - start)));
  const livello = giorniRimasti < 0 ? 'scaduto' : giorniRimasti <= GIORNI_PREAVVISO ? 'vicino' : 'regolare';
  return { scadenza: formatDay(new Date(due)), giorniRimasti, frazione, livello };
}

export function assegnazioneAperta(assegnazioni, numero) {
  return assegnazioni.find(a => a.numero === numero && !a.rientro) || null;
}

export function ultimoRientro(assegnazioni, numero) {
  return assegnazioni
    .filter(a => a.numero === numero && a.rientro)
    .map(a => a.rientro)
    .sort()
    .pop() || null;
}

export function giorniTra(da, a) {
  return Math.round((parseDay(a).getTime() - parseDay(da).getTime()) / DAY);
}

// Assegnazioni aperte che chiedono attenzione: prima le scadute, poi le più vicine alla scadenza.
export function alertTerritori(assegnazioni, oggi = formatDay(new Date())) {
  return assegnazioni
    .filter(a => !a.rientro)
    .map(a => ({ ...a, ...statoScadenza(a.assegnato, oggi) }))
    .filter(a => a.livello !== 'regolare')
    .sort((a, b) => a.giorniRimasti - b.giorniRimasti);
}

// Tempo di lavorazione: solo le assegnazioni concluse (con data di rientro).
export function statisticheLavorazione(assegnazioni) {
  const concluse = assegnazioni
    .filter(a => a.rientro)
    .map(a => ({ ...a, giorni: giorniTra(a.assegnato, a.rientro), inTempo: a.rientro <= scadenzaTerritorio(a.assegnato) }));
  const perTerritorio = new Map();
  for (const a of concluse) {
    const s = perTerritorio.get(a.numero) || { numero: a.numero, lavorazioni: 0, totaleGiorni: 0, maxGiorni: 0, inTempo: 0 };
    s.lavorazioni += 1;
    s.totaleGiorni += a.giorni;
    s.maxGiorni = Math.max(s.maxGiorni, a.giorni);
    s.inTempo += a.inTempo ? 1 : 0;
    perTerritorio.set(a.numero, s);
  }
  for (const s of perTerritorio.values()) s.mediaGiorni = Math.round(s.totaleGiorni / s.lavorazioni);
  const totale = concluse.reduce((sum, a) => sum + a.giorni, 0);
  return {
    perTerritorio,
    concluse: concluse.length,
    mediaGiorni: concluse.length ? Math.round(totale / concluse.length) : null,
    percentualeInTempo: concluse.length ? Math.round((concluse.filter(a => a.inTempo).length / concluse.length) * 100) : null,
  };
}

// "35A" dopo "35" e prima di "36".
export function confrontaNumeri(a, b) {
  return parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b);
}

// "territorio_59_Commerciale_Ribolla_1.pdf" -> { numero: "59", nome: "Commerciale Ribolla 1", sezione: "Commerciale" }
// "territorio_35A_Roccastrada.pdf"          -> { numero: "35A", nome: "Roccastrada", sezione: "Roccastrada" }
export function parseCartina(file) {
  const base = file.replace(/\.pdf$/i, '');
  const match = base.match(/(\d+)([a-z](?![a-z]))?/i);
  if (!match || Number(match[1]) === 0) return null;
  const numero = String(Number(match[1])) + (match[2] || '').toUpperCase();
  const nome = base.slice(match.index + match[0].length).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sezione = /^commerciale\b/i.test(nome) ? 'Commerciale'
    : /\brurale\b/i.test(nome) ? 'Rurale'
    : nome.replace(/\s+\d+$/, '') || 'Senza nome';
  return { numero, nome: nome || `Territorio ${numero}`, sezione };
}

// Cosa resta da dire del territorio dentro la sua sezione: "Ribolla" in Ribolla non aggiunge nulla.
export function dettaglioInSezione({ nome, sezione }) {
  if (nome === sezione) return '';
  if (sezione === 'Commerciale') return nome.replace(/^commerciale\s*/i, '');
  if (sezione === 'Rurale') return nome.replace(/\s*\brurale\b\s*/i, ' ').trim();
  return nome;
}

// { "../territori/territorio_12_Ribolla.pdf": "/assets/…pdf" } -> [{ numero, nome, sezione, file, url }]
export function cartineDaFile(fileMap) {
  const cartine = new Map();
  for (const [path, url] of Object.entries(fileMap)) {
    const file = path.split('/').pop();
    const info = parseCartina(file);
    if (info && !cartine.has(info.numero)) cartine.set(info.numero, { ...info, file, url });
  }
  return [...cartine.values()].sort((a, b) => confrontaNumeri(a.numero, b.numero));
}

// Sezioni nell'ordine del primo territorio che contengono: un paese nuovo non cambia i colori degli altri.
export function raggruppaSezioni(cartine) {
  const sezioni = new Map();
  for (const c of cartine) {
    if (!sezioni.has(c.sezione)) sezioni.set(c.sezione, { nome: c.sezione, indice: sezioni.size, territori: [] });
    sezioni.get(c.sezione).territori.push(c);
  }
  return [...sezioni.values()];
}

export function normalizeTerritori(raw) {
  const assegnazioni = Array.isArray(raw?.assegnazioni)
    ? raw.assegnazioni
      .filter(a => a?.id && a.numero !== undefined && a.numero !== '' && a.assegnato)
      .map(a => ({ ...a, numero: String(a.numero) }))
    : [];
  return { assegnazioni };
}
