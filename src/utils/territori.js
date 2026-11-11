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

export function scadenzaTerritorio(assegnato, mesi = MESI_SCADENZA) {
  const start = parseDay(assegnato);
  const due = new Date(start.getFullYear(), start.getMonth() + mesi, start.getDate());
  // 31 ottobre + 4 mesi non esiste: si ferma all'ultimo giorno di febbraio.
  if (due.getDate() !== start.getDate()) due.setDate(0);
  return formatDay(due);
}

// Avanzamento verso la scadenza di un'assegnazione ancora aperta.
export function statoScadenza(assegnato, oggi = formatDay(new Date()), mesi = MESI_SCADENZA) {
  const start = parseDay(assegnato).getTime();
  const due = parseDay(scadenzaTerritorio(assegnato, mesi)).getTime();
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
export function alertTerritori(assegnazioni, oggi = formatDay(new Date()), mesi = MESI_SCADENZA) {
  return assegnazioni
    .filter(a => !a.rientro)
    .map(a => ({ ...a, ...statoScadenza(a.assegnato, oggi, mesi) }))
    .filter(a => a.livello !== 'regolare')
    .sort((a, b) => a.giorniRimasti - b.giorniRimasti);
}

// Riepilogo della sezione: conta solo i territori in archivio, così disponibili + assegnati = territori.
// Una cartina tolta mentre era fuori non pesa su assegnati e scadenze; le sue registrazioni restano nello storico.
export function riepilogoTerritori(assegnazioni, numeri, oggi = formatDay(new Date()), mesi = MESI_SCADENZA) {
  const aperte = assegnazioni.filter(a => !a.rientro && numeri.has(a.numero));
  const alert = alertTerritori(aperte, oggi, mesi);
  const scaduti = alert.filter(a => a.livello === 'scaduto').length;
  return { aperte, disponibili: numeri.size - new Set(aperte.map(a => a.numero)).size, alert, scaduti, inScadenza: alert.length - scaduti };
}

// Rientrato davvero lavorato: un rientro "non percorso" non conta come lavorazione.
const lavorata = a => a.rientro && !a.nonLavorato;

// Copertura: territori lavorati (rientro percorso) negli ultimi `mesi` mesi, e quelli rimasti indietro.
export function copertura(territori, assegnazioni, oggi = formatDay(new Date()), mesi = 12) {
  const d = parseDay(oggi);
  d.setMonth(d.getMonth() - mesi);
  const da = formatDay(d);
  const lavorati = new Set(assegnazioni.filter(a => lavorata(a) && a.rientro >= da).map(a => a.numero));
  const nonLavorati = territori.filter(t => !lavorati.has(t.numero));
  return { lavorati: territori.length - nonLavorati.length, nonLavorati, percentuale: territori.length ? Math.round(((territori.length - nonLavorati.length) / territori.length) * 100) : null };
}

// Tempo di lavorazione: solo le assegnazioni concluse (con data di rientro) e percorse.
export function statisticheLavorazione(assegnazioni, mesi = MESI_SCADENZA) {
  const concluse = assegnazioni
    .filter(lavorata)
    .map(a => ({ ...a, giorni: giorniTra(a.assegnato, a.rientro), inTempo: a.rientro <= scadenzaTerritorio(a.assegnato, mesi) }));
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

// --- Modulo S-13 (Registrazione delle assegnazioni del territorio) ---------------------------

// L'anno di servizio va da settembre ad agosto e prende il nome dall'anno in cui finisce.
export function annoDiServizio(data) {
  const [y, m] = String(data).split('-').map(Number);
  return m >= 9 ? y + 1 : y;
}

export function periodoAnnoDiServizio(anno) {
  return { inizio: `${anno - 1}-09-01`, fine: `${anno}-08-31` };
}

export const BLOCCHI_S13 = 4;
export const TERRITORI_PER_PAGINA_S13 = 20;

// Righe del modulo: ogni territorio ha almeno una riga; oltre 4 assegnazioni continua su altre righe.
// Entrano le assegnazioni che toccano l'anno: date nell'anno, oppure iniziate prima e ancora fuori all'inizio.
export function righeS13(territori, assegnazioni, anno) {
  const { inizio, fine } = periodoAnnoDiServizio(anno);
  const righe = [];
  for (const t of territori) {
    const sue = assegnazioni.filter(a => a.numero === t.numero);
    const ultimo = sue.filter(a => lavorata(a) && a.rientro < inizio).map(a => a.rientro).sort().pop() || null;
    const nellAnno = sue
      .filter(a => a.assegnato <= fine && (!a.rientro || a.rientro >= inizio))
      .sort((a, b) => a.assegnato.localeCompare(b.assegnato));
    const blocchi = nellAnno.map(a => ({ nome: a.proclamatore, assegnato: a.assegnato, rientro: a.rientro || null }));
    do {
      righe.push({ numero: t.numero, ultimoRientro: righe.at(-1)?.numero === t.numero ? null : ultimo, blocchi: blocchi.splice(0, BLOCCHI_S13) });
    } while (blocchi.length);
  }
  return righe;
}

export function pagineS13(righe) {
  const pagine = [];
  for (let i = 0; i < righe.length; i += TERRITORI_PER_PAGINA_S13) pagine.push(righe.slice(i, i + TERRITORI_PER_PAGINA_S13));
  return pagine.length ? pagine : [[]];
}

// Anni da proporre: quelli delle assegnazioni più l'anno in corso, dal più recente.
export function anniS13(assegnazioni, oggi) {
  const anni = new Set([annoDiServizio(oggi)]);
  for (const a of assegnazioni) {
    anni.add(annoDiServizio(a.assegnato));
    if (a.rientro) anni.add(annoDiServizio(a.rientro));
  }
  return [...anni].sort((a, b) => b - a);
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

// Link (o id) di una cartella Drive -> id: ".../drive/folders/1AbC...?usp=sharing" -> "1AbC...". '' se non si riconosce.
export function idCartellaDrive(testo) {
  const t = String(testo ?? '').trim();
  const id = t.match(/\/folders\/([\w-]+)/)?.[1] ?? t.match(/[?&]id=([\w-]+)/)?.[1] ?? t;
  return /^[\w-]{10,}$/.test(id) ? id : '';
}

// Cartina caricata dall'app (PDF su Drive): numero, nome e sezione come se venisse dal nome di un file.
export function cartinaAggiunta({ numero, nome, link, file }) {
  const info = parseCartina(`territorio_${numero}_${nome}.pdf`);
  return info && { ...info, file, url: link, aggiunta: true };
}

// Archivio completo: le cartine caricate dall'app prendono il posto di quelle col PDF nel progetto con lo stesso numero.
export function unisciCartine(daFile, aggiunte) {
  const perNumero = new Map(daFile.map(c => [c.numero, c]));
  for (const a of aggiunte) {
    const c = cartinaAggiunta(a);
    if (c) perNumero.set(c.numero, c);
  }
  return [...perNumero.values()].sort((a, b) => confrontaNumeri(a.numero, b.numero));
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
      .map(a => ({ ...a, numero: String(a.numero), proclamatore: String(a.proclamatore ?? '').trim() }))
    : [];
  const etichette = Array.isArray(raw?.etichette)
    ? raw.etichette
      .filter(e => e?.id && typeof e.nome === 'string' && e.nome.trim())
      .map(e => ({
        id: e.id,
        nome: e.nome.trim(),
        colore: /^#[0-9a-f]{6}$/i.test(e.colore) ? e.colore : '#5a6b7a',
        territori: Array.isArray(e.territori) ? [...new Set(e.territori.map(String))] : [],
      }))
    : [];
  /** @type {Record<string, string>} */
  const note = {};
  for (const [numero, testo] of Object.entries(raw?.note && typeof raw.note === 'object' ? raw.note : {})) {
    if (typeof testo === 'string' && testo.trim()) note[numero] = testo;
  }
  const valido = n => n?.id && n.numero !== undefined && typeof n.indirizzo === 'string' && n.indirizzo.trim();
  const indirizzi = [
    ...(Array.isArray(raw?.indirizzi) ? raw.indirizzi.filter(valido) : []),
    // vecchio formato: lista "da non visitare" senza tipo né stato
    ...(Array.isArray(raw?.nonVisitare) ? raw.nonVisitare.filter(valido).map(n => ({ ...n, stato: 'non-visitare' })) : []),
  ].map(n => ({
    ...n,
    numero: String(n.numero),
    tipo: TIPI_INDIRIZZO[n.tipo] ? n.tipo : 'residenziale',
    porzione: typeof n.porzione === 'string' ? n.porzione.trim() : '',
    stato: STATI_INDIRIZZO[n.stato] ? n.stato : '',
    visite: Array.isArray(n.visite) ? n.visite.filter(v => v?.data && STATI_INDIRIZZO[v.stato]) : [],
  }));
  const imp = raw?.impostazioni ?? {};
  const intero = (v, min, max, def) => (Number.isInteger(v) && v >= min && v <= max ? v : def);
  const impostazioni = {
    mesiScadenza: intero(imp.mesiScadenza, 1, 24, MESI_SCADENZA),
    maxPerProclamatore: intero(imp.maxPerProclamatore, 0, 20, 0), // 0 = nessun limite
    mostraDisponibili: intero(imp.mostraDisponibili, 0, 500, 0),   // 0 = tutti
    etichettaPredefinita: etichette.some(e => e.id === imp.etichettaPredefinita) ? imp.etichettaPredefinita : '',
    azzeraStatiAlRientro: imp.azzeraStatiAlRientro !== false,
    cartellaCartine: idCartellaDrive(imp.cartellaCartine),
  };
  const aggiunte = Array.isArray(raw?.aggiunte)
    ? raw.aggiunte
      .filter(a => a && /^https:\/\//.test(a.link) && cartinaAggiunta({ ...a, numero: String(a.numero ?? ''), nome: String(a.nome ?? '') }))
      .map(a => ({ ...a, numero: String(a.numero), nome: String(a.nome) }))
    : [];
  return { assegnazioni, etichette, note, indirizzi, impostazioni, aggiunte, congregazione: normalizeCongregazione(raw?.congregazione) };
}

export const TIPI_INDIRIZZO = { residenziale: 'Residenziale', commerciale: 'Commerciale', 'lingua-straniera': 'Lingua straniera' };
export const STATI_INDIRIZZO = {
  '': 'Da visitare',
  visitato: 'Visitato',
  assente: 'Assente',
  impegnato: 'Impegnato',
  'non-interessato': 'Non interessato',
  rivisitare: 'Rivisitare',
  'non-visitare': 'Non visitare',
  'non-avvicinarsi': 'Non avvicinarsi',
};
// Restano anche quando il territorio rientra.
export const STATI_PERMANENTI = ['non-visitare', 'non-avvicinarsi'];

// Nuovo stato con la visita in cima allo storico; una visita per giorno e proclamatore.
export function registraVisita(indirizzo, stato, data, proclamatore = '') {
  const visita = { data, stato, ...(proclamatore ? { proclamatore } : {}) };
  const altre = indirizzo.visite.filter(v => !(v.data === data && (v.proclamatore ?? '') === proclamatore));
  return { ...indirizzo, stato, visite: stato ? [visita, ...altre] : altre };
}

// Ordine di stampa e di elenco: per porzione (quelli senza porzione in fondo), poi per indirizzo.
export function ordinaIndirizzi(indirizzi) {
  return [...indirizzi].sort((a, b) =>
    (!a.porzione - !b.porzione) || (a.porzione || '').localeCompare(b.porzione || '', 'it', { numeric: true }) || a.indirizzo.localeCompare(b.indirizzo, 'it', { numeric: true }));
}

// Rientro del territorio: gli stati tornano vuoti, lo storico delle visite resta.
export function azzeraStati(indirizzi, numero) {
  return indirizzi.map(n => (n.numero === numero && !STATI_PERMANENTI.includes(n.stato) ? { ...n, stato: '' } : n));
}

export const SENZA_ETICHETTE = '__senza';
export const CON_ETICHETTE = '__con';

// Filtro etichette: nessuna selezione = tutto; `tutte` = ogni condizione deve valere, altrimenti basta una.
export function filtraPerEtichette(idsTerritorio, selezionate, tutte = false) {
  if (!selezionate.length) return true;
  const vale = s => (s === SENZA_ETICHETTE ? !idsTerritorio.length : s === CON_ETICHETTE ? idsTerritorio.length > 0 : idsTerritorio.includes(s));
  return tutte ? selezionate.every(vale) : selezionate.some(vale);
}

// Ultimi `mesi` mesi, dal più recente: territori completati (rientri percorsi) e proclamatori che ne avevano uno.
export function statisticheMensili(assegnazioni, oggi = formatDay(new Date()), mesi = 6) {
  const d = parseDay(oggi);
  const righe = [];
  for (let i = 0; i < mesi; i++) {
    const inizio = formatDay(new Date(d.getFullYear(), d.getMonth() - i, 1));
    const fine = formatDay(new Date(d.getFullYear(), d.getMonth() - i + 1, 0));
    const completati = assegnazioni.filter(a => lavorata(a) && a.rientro >= inizio && a.rientro <= fine).length;
    const partecipanti = new Set(
      assegnazioni.filter(a => a.assegnato <= fine && (!a.rientro || a.rientro >= inizio)).map(a => a.proclamatore.trim().toLowerCase()).filter(Boolean),
    ).size;
    righe.push({ mese: inizio.slice(0, 7), completati, partecipanti });
  }
  return righe;
}

// Rientri degli ultimi `giorni` giorni, dal più recente.
export function rientratiDiRecente(assegnazioni, oggi = formatDay(new Date()), giorni = 30) {
  return assegnazioni
    .filter(a => a.rientro && giorniTra(a.rientro, oggi) <= giorni)
    .sort((a, b) => b.rientro.localeCompare(a.rientro));
}

// "12, 35a 59" -> numeri riconosciuti (normalizzati come le cartine) e quelli che non esistono.
export function parseNumeriTerritori(testo, validi) {
  const numeri = [], sconosciuti = [];
  for (const pezzo of testo.split(/[\s,;]+/).filter(Boolean)) {
    const m = pezzo.match(/^0*(\d+)([a-z]?)$/i);
    const numero = m ? m[1] + m[2].toUpperCase() : pezzo;
    (validi.has(numero) ? numeri : sconosciuti).push(numero);
  }
  return { numeri: [...new Set(numeri)], sconosciuti };
}

// Testo nero o bianco, quello che contrasta di più con lo sfondo dell'etichetta.
export function testoSu(colore) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(colore.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111' : '#fff';
}

// Pannello Statistica: riepilogo, serie dei grafici e righe per territorio, sul periodo scelto (mesi indietro da oggi).
export function statisticaTerritori(territori, assegnazioni, oggi = formatDay(new Date()), periodoMesi = 6) {
  const meno = mesi => { const d = parseDay(oggi); d.setMonth(d.getMonth() - mesi); return formatDay(d); };
  const numeri = new Set(territori.map(t => t.numero));
  const sue = assegnazioni.filter(a => numeri.has(a.numero));
  const lavorate = sue.filter(lavorata);
  const completateDal = da => lavorate.filter(a => a.rientro >= da);
  const aperte = new Map(sue.filter(a => !a.rientro).map(a => [a.numero, a]));
  const nonLavoratiIn = mesi => {
    const fatti = new Set(completateDal(meno(mesi)).map(a => a.numero));
    return territori.filter(t => !aperte.has(t.numero) && !fatti.has(t.numero)).length;
  };
  const da = meno(periodoMesi);
  const nelPeriodo = completateDal(da);
  const settimane = list => (list.length ? Math.round(list.reduce((s, a) => s + giorniTra(a.assegnato, a.rientro), 0) / list.length / 7) : null);
  const righe = territori.map(t => {
    const fatte = lavorate.filter(a => a.numero === t.numero);
    return {
      numero: t.numero,
      aperta: aperte.get(t.numero) || null,
      ultimoRientro: fatte.map(a => a.rientro).sort().pop() || null,
      lavorazioni: fatte.length,
      mediaSettimane: settimane(fatte),
    };
  });
  return {
    totale: territori.length,
    assegnati: aperte.size,
    completati: new Set(nelPeriodo.map(a => a.numero)).size,
    nonLavorati: nonLavoratiIn(periodoMesi),
    mediaSettimane: settimane(nelPeriodo),
    partecipanti: new Set(sue.filter(a => !a.rientro || a.rientro >= da).map(a => a.proclamatore.trim().toLowerCase()).filter(Boolean)).size,
    grafici: {
      completati: [3, 6, 12].map(m => ({ etichetta: `Ultimi ${m} mesi`, valore: completateDal(meno(m)).length })),
      inLavorazione: [
        { etichetta: 'Tutti', valore: aperte.size },
        { etichetta: 'Fuori da oltre 3 mesi', valore: [...aperte.values()].filter(a => a.assegnato < meno(3)).length },
        { etichetta: 'Fuori da oltre 6 mesi', valore: [...aperte.values()].filter(a => a.assegnato < meno(6)).length },
      ],
      nonLavorati: [6, 12, 24].map(m => ({ etichetta: `In ${m} mesi`, valore: nonLavoratiIn(m) })),
    },
    righe,
  };
}

// Una registrazione (nuova o modificata) è coerente con le altre dello stesso territorio? Restituisce il problema, o null.
export function erroreRegistrazione(reg, assegnazioni, oggi = formatDay(new Date())) {
  if (!reg.assegnato) return 'Indica la data di assegnazione.';
  if (reg.assegnato > oggi) return "La data di assegnazione non può essere nel futuro.";
  if (reg.rientro && reg.rientro < reg.assegnato) return "Il rientro non può precedere l'assegnazione.";
  if (reg.rientro && reg.rientro > oggi) return 'La data di rientro non può essere nel futuro.';
  const altre = assegnazioni.filter(a => a.numero === reg.numero && a.id !== reg.id);
  if (!reg.rientro && altre.some(a => !a.rientro)) return `Il territorio ${reg.numero} è già assegnato.`;
  const fine = reg.rientro || '9999-12-31';
  const sovrapposta = altre.find(a => a.assegnato <= fine && (a.rientro || '9999-12-31') >= reg.assegnato && !(a.rientro === reg.assegnato || fine === a.assegnato));
  return sovrapposta ? `Si sovrappone all'assegnazione dal ${sovrapposta.assegnato}${sovrapposta.proclamatore ? ' a ' + sovrapposta.proclamatore : ''}.` : null;
}

// Rientro di più assegnazioni insieme (stessa data). Salta quelle già rientrate o assegnate dopo quella data.
// Se l'impostazione lo prevede, azzera gli stati degli indirizzi dei territori rientrati.
export function applicaRientri(dati, ids, rientro, nonLavorato = false) {
  const scelte = new Set(ids);
  const numeri = new Set();
  const saltate = [];
  const assegnazioni = dati.assegnazioni.map(a => {
    if (!scelte.has(a.id) || a.rientro) return a;
    if (a.assegnato > rientro) { saltate.push(a); return a; }
    numeri.add(a.numero);
    return { ...a, rientro, ...(nonLavorato ? { nonLavorato: true } : {}) };
  });
  let indirizzi = dati.indirizzi;
  if (dati.impostazioni.azzeraStatiAlRientro) for (const n of numeri) indirizzi = azzeraStati(indirizzi, n);
  return { dati: { ...dati, assegnazioni, indirizzi }, rientrati: [...numeri], saltate };
}

// --- Mappa della congregazione (KML da JW Hub) ------------------------------------------------

// Firestore non accetta array annidati e il documento ha un limite di 1 MiB: le coordinate si salvano come testo
// "lng,lat lng,lat ..." arrotondate a 5 decimali (circa 1 m), con un tetto alla dimensione totale.
export const MAX_CARATTERI_MAPPA = 300_000;

const pulisciXml = t => t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();

function coordinateKml(testo) {
  const punti = [];
  for (const tupla of testo.trim().split(/\s+/)) {
    const [lng, lat] = tupla.split(',').map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const p = `${+lng.toFixed(5)},${+lat.toFixed(5)}`;
    if (punti.at(-1) !== p) punti.push(p);
  }
  return punti.join(' ');
}

// shortcut: lettura del KML con espressioni regolari (Placemark con Polygon, LineString, Point, anche dentro MultiGeometry);
// basta per i file di JW Hub, non per KML con stili condivisi, NetworkLink o KMZ. Passare a un parser XML se servono.
export function leggiKml(testo) {
  const forme = [];
  for (const [, pm] of testo.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi)) {
    const nome = pulisciXml(pm.match(/<name>([\s\S]*?)<\/name>/i)?.[1] ?? '');
    for (const [, poligono] of pm.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/gi)) {
      const anelli = [...poligono.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)].map(m => coordinateKml(m[1])).filter(c => c.split(' ').length >= 3);
      if (anelli.length) forme.push({ nome, tipo: 'poligono', anelli });
    }
    for (const [, linea] of pm.matchAll(/<LineString\b[^>]*>([\s\S]*?)<\/LineString>/gi)) {
      const c = coordinateKml(linea.match(/<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1] ?? '');
      if (c.split(' ').length >= 2) forme.push({ nome, tipo: 'linea', anelli: [c] });
    }
    for (const [, punto] of pm.matchAll(/<Point\b[^>]*>([\s\S]*?)<\/Point>/gi)) {
      const c = coordinateKml(punto.match(/<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1] ?? '');
      if (c) forme.push({ nome, tipo: 'punto', anelli: [c.split(' ')[0]] });
    }
  }
  const nome = pulisciXml(testo.match(/<Document\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/i)?.[1] ?? '');
  const caratteri = forme.reduce((n, f) => n + f.anelli.join(' ').length, 0);
  if (!forme.length) throw new Error('Il file non contiene confini, linee o punti leggibili.');
  if (caratteri > MAX_CARATTERI_MAPPA) throw new Error(`La mappa è troppo dettagliata (${Math.round(caratteri / 1000)} mila caratteri, massimo ${MAX_CARATTERI_MAPPA / 1000} mila): semplificala prima di caricarla.`);
  return { nome, forme };
}

// "lng,lat lng,lat" -> [[lat, lng], ...] (ordine di Leaflet)
export const puntiAnello = anello => anello.split(' ').map(p => { const [lng, lat] = p.split(',').map(Number); return [lat, lng]; });

export function normalizeCongregazione(raw) {
  if (!raw || !Array.isArray(raw.forme)) return null;
  const forme = raw.forme
    .filter(f => f && ['poligono', 'linea', 'punto'].includes(f.tipo) && Array.isArray(f.anelli) && f.anelli.every(a => typeof a === 'string' && a))
    .map(f => ({ nome: String(f.nome ?? ''), tipo: f.tipo, anelli: f.anelli }));
  return forme.length ? { nome: String(raw.nome ?? ''), file: String(raw.file ?? ''), caricato: String(raw.caricato ?? ''), forme } : null;
}

// --- Import delle registrazioni da Excel (export di Hourglass o di questa app) -----------------

// Intestazioni riconosciute: quelle dell'export di Hourglass e quelle dell'export di Registrazioni.
const COLONNE_IMPORT = {
  numero: ['territory_number', 'territorio'],
  proclamatore: ['publisher', 'proclamatore'],
  assegnato: ['start', 'assegnato'],
  rientro: ['end', 'rientro'],
  etichetta: ['tags', 'etichetta'],
  nonLavorato: ['non percorso'],
};

// Data di una cella: numero seriale di Excel, oggetto Date o testo "YYYY-MM-DD"; '' se vuota, null se illeggibile.
export function dataExcel(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY);
    return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date && !isNaN(v)) return formatDay(v);
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Righe del foglio (oggetti per intestazione) -> registrazioni pronte, scartate col motivo, doppioni saltati.
// modo 'sostituisci' riparte da zero; 'aggiungi' tiene le esistenti e salta le righe identiche (stesso territorio, proclamatore e date).
export function importaRegistrazioni(righe, numeriValidi, esistenti, modo = 'aggiungi', oggi = formatDay(new Date()), nuovoId = () => crypto.randomUUID()) {
  const campo = (riga, nome) => {
    const chiave = Object.keys(riga).find(k => COLONNE_IMPORT[nome].includes(k.trim().toLowerCase()));
    return chiave === undefined ? '' : riga[chiave];
  };
  const scartate = [];
  const candidate = [];
  righe.forEach((riga, i) => {
    const n = i + 2; // riga del foglio: la 1 è l'intestazione
    const testoNumero = String(campo(riga, 'numero')).trim();
    if (!testoNumero) return;
    const numero = parseNumeriTerritori(testoNumero, numeriValidi).numeri[0];
    if (!numero) return scartate.push({ riga: n, motivo: `territorio ${testoNumero} non presente nell'archivio` });
    const assegnato = dataExcel(campo(riga, 'assegnato'));
    const rientro = dataExcel(campo(riga, 'rientro'));
    if (!assegnato || rientro === null) return scartate.push({ riga: n, motivo: 'data non leggibile' });
    const etichetta = String(campo(riga, 'etichetta')).trim();
    const nonLavorato = /^(s[iì]|true|1|x)$/i.test(String(campo(riga, 'nonLavorato')).trim());
    candidate.push({ n, reg: {
      id: '', numero, proclamatore: String(campo(riga, 'proclamatore')).trim(), assegnato,
      ...(rientro ? { rientro } : {}), ...(rientro && nonLavorato ? { nonLavorato: true } : {}), ...(etichetta ? { etichetta } : {}),
    } });
  });
  let doppioni = 0;
  const finali = modo === 'sostituisci' ? [] : [...esistenti];
  for (const { n, reg } of candidate.sort((a, b) => a.reg.assegnato.localeCompare(b.reg.assegnato))) {
    // doppione solo se identica: lo stesso giorno un territorio può rientrare e ripartire con un altro proclamatore
    if (finali.some(a => a.numero === reg.numero && a.assegnato === reg.assegnato && (a.rientro ?? '') === (reg.rientro ?? '') && a.proclamatore === reg.proclamatore)) { doppioni++; continue; }
    const errore = erroreRegistrazione(reg, finali, oggi);
    if (errore) { scartate.push({ riga: n, motivo: `territorio ${reg.numero}: ${errore}` }); continue; }
    finali.push({ ...reg, id: nuovoId() });
  }
  scartate.sort((a, b) => a.riga - b.riga);
  return { assegnazioni: finali, importate: finali.length - (modo === 'sostituisci' ? 0 : esistenti.length), scartate, doppioni };
}
