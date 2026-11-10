// Descrive in italiano cosa è cambiato tra due versioni di una parte dei dati, per il registro attività.
// Generico per tutte le sezioni: riconosce gli elementi per id (o data), mostra i nomi al posto degli id delle persone.

const MAX_RIGHE = 100;
const MAX_TESTO = 300;
const ISO = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const oggetto = v => v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

const INGLESE = { rows: 'righe', title: 'titolo', warn: 'avvisi', name: 'nome', date: 'data', roles: 'ruoli', gender: 'sesso', spouse: 'coniuge' };
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// "preghieraInizialeId" -> "preghiera iniziale"; "2026-11" -> "novembre 2026"
export function campoLeggibile(k) {
  const mese = k.match(/^(\d{4})-(\d{2})$/);
  if (mese && +mese[2] >= 1 && +mese[2] <= 12) return `${MESI[+mese[2] - 1]} ${mese[1]}`;
  if (/^\d+$/.test(k)) return k;
  const base = k.replace(/Id$/, '');
  return INGLESE[base] ?? base.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function dataIt(v) {
  const d = v instanceof Date ? v : new Date(v.length === 10 ? v + 'T12:00:00' : v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function valore(v, nomi) {
  if (v === undefined || v === null || v === '') return '—';
  if (v instanceof Date || (typeof v === 'string' && ISO.test(v))) return dataIt(v);
  if (typeof v === 'string') return nomi.get(v) ?? v;
  if (typeof v === 'boolean') return v ? 'sì' : 'no';
  if (Array.isArray(v)) return v.length ? v.map(x => valore(x, nomi)).join(', ') : '—';
  if (oggetto(v)) return etichetta(v, nomi) || '{…}';
  return String(v);
}

// Come si chiama un elemento: "12 · Mario Rossi", "Conoscete bene Dio?", "03/11/2026"…
const CAMPI_NOME = ['numero', 'nome', 'name', 'titolo', 'title', 'proclamatore', 'oratore', 'data', 'date', 'dateStr'];
function etichetta(o, nomi) {
  return CAMPI_NOME.filter(k => o[k] !== undefined && o[k] !== '').slice(0, 2).map(k => valore(o[k], nomi)).join(' · ');
}

// Chiave per riconoscere lo stesso elemento in due elenchi: id, altrimenti la data, altrimenti la posizione.
function chiaviElenco(a, b) {
  const tutti = [...a, ...b];
  for (const k of ['id', 'date', 'dateStr', 'data']) {
    if (!tutti.every(x => oggetto(x) && x[k] !== undefined && x[k] !== '')) continue;
    const per = l => l.map(x => JSON.stringify(x[k]));
    if (new Set(per(a)).size === a.length && new Set(per(b)).size === b.length) return x => JSON.stringify(x[k]);
  }
  return null;
}

function confronta(prima, dopo, percorso, righe, nomi) {
  if (righe.length > MAX_RIGHE || uguali(prima, dopo)) return;
  const dove = percorso.length ? percorso.join(' › ') + ': ' : '';

  if (Array.isArray(prima) && Array.isArray(dopo)) {
    const chiave = chiaviElenco(prima, dopo);
    if (chiave) {
      const mPrima = new Map(prima.map(x => [chiave(x), x]));
      const mDopo = new Map(dopo.map(x => [chiave(x), x]));
      for (const [k, x] of mDopo) if (!mPrima.has(k)) righe.push(`${dove}aggiunto ${etichetta(x, nomi) || valore(x, nomi)}`);
      for (const [k, x] of mPrima) if (!mDopo.has(k)) righe.push(`${dove}tolto ${etichetta(x, nomi) || valore(x, nomi)}`);
      for (const [k, x] of mDopo) if (mPrima.has(k)) confronta(mPrima.get(k), x, [...percorso, etichetta(x, nomi) || k], righe, nomi);
      return;
    }
    if (prima.every(x => !oggetto(x)) && dopo.every(x => !oggetto(x))) {
      const tolti = prima.filter(x => !dopo.some(y => uguali(x, y)));
      const aggiunti = dopo.filter(x => !prima.some(y => uguali(x, y)));
      if (!tolti.length && !aggiunti.length) return righe.push(`${dove}${valore(prima, nomi)} → ${valore(dopo, nomi)}`); // solo l'ordine
      if (aggiunti.length) righe.push(`${dove}aggiunto ${valore(aggiunti, nomi)}`);
      if (tolti.length) righe.push(`${dove}tolto ${valore(tolti, nomi)}`);
      return;
    }
    const n = Math.max(prima.length, dopo.length);
    for (let i = 0; i < n; i++) {
      const p = prima[i], d = dopo[i];
      if (p === undefined) righe.push(`${dove}aggiunto ${valore(d, nomi)}`);
      else if (d === undefined) righe.push(`${dove}tolto ${valore(p, nomi)}`);
      else confronta(p, d, [...percorso, (oggetto(d) && etichetta(d, nomi)) || String(i + 1)], righe, nomi);
    }
    return;
  }

  if (oggetto(prima) && oggetto(dopo)) {
    for (const k of new Set([...Object.keys(prima), ...Object.keys(dopo)])) {
      const nome = nomi.get(k) ?? (ISO.test(k) ? dataIt(k) : campoLeggibile(k));
      if (!(k in prima) && oggetto(dopo[k])) righe.push(`${percorso.concat(nome).join(' › ')}: aggiunto ${etichetta(dopo[k], nomi) || ''}`.trim());
      else if (!(k in dopo) && oggetto(prima[k])) righe.push(`${percorso.concat(nome).join(' › ')}: tolto ${etichetta(prima[k], nomi) || ''}`.trim());
      else confronta(prima[k], dopo[k], [...percorso, nome], righe, nomi);
    }
    return;
  }

  righe.push(`${dove}${valore(prima, nomi)} → ${valore(dopo, nomi)}`);
}

// nomi: Map id persona -> nome. Restituisce al massimo MAX_RIGHE righe, ognuna di al massimo MAX_TESTO caratteri.
export function descriviModifiche(prima, dopo, nomi = new Map()) {
  const righe = [];
  confronta(prima, dopo, [], righe, nomi);
  const testo = righe.map(r => (r.length > MAX_TESTO ? r.slice(0, MAX_TESTO - 1) + '…' : r));
  // il confronto si ferma oltre MAX_RIGHE: il resto non si conta
  return testo.length > MAX_RIGHE ? [...testo.slice(0, MAX_RIGHE - 1), '…e altre modifiche'] : testo;
}
