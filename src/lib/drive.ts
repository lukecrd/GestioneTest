// Salvataggio su Google Drive con Google Identity Services (token OAuth nel browser, nessun server).
// Configurazione in .env: VITE_GOOGLE_CLIENT_ID (client OAuth "Applicazione web" con le origini dell'app autorizzate)
// e VITE_DRIVE_ACCOUNT (l'unico account Drive su cui si salva).
// drive.file: l'app vede e scrive solo i file creati da lei, non il resto del Drive.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const ACCOUNT_DRIVE = ((import.meta.env.VITE_DRIVE_ACCOUNT as string | undefined) || '').trim().toLowerCase();
// drive.readonly in più: per leggere la cartella delle cartine dei territori, che non è stata creata dall'app.
const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

export const driveConfigurato = () => !!CLIENT_ID && !!ACCOUNT_DRIVE;

declare global {
  interface Window { google?: any }
}

let gis: Promise<void> | null = null;
// Da chiamare in anticipo (all'apertura della pagina): se lo script si carica dentro il clic, il popup di Google viene bloccato.
export function precaricaDrive(): Promise<void> {
  if (!driveConfigurato()) return Promise.resolve();
  gis ??= new Promise((ok, ko) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => ok();
    script.onerror = () => { gis = null; ko(new Error('Impossibile contattare Google. Controlla la connessione.')); };
    document.head.appendChild(script);
  });
  return gis;
}

// Il token vale circa un'ora: finché è valido non si riapre il popup, che fuori da un clic il browser blocca
// (es. dopo la scelta del file o un window.confirm).
let salvato: { token: string; scade: number } | null = null;
export const driveAccesso = () => !!salvato && Date.now() < salvato.scade;

// Chiede il token (popup di Google) e verifica che l'account scelto sia quello configurato.
export async function accediDrive(): Promise<string> {
  if (!driveConfigurato()) throw new Error('Salvataggio su Drive non configurato: mancano VITE_GOOGLE_CLIENT_ID o VITE_DRIVE_ACCOUNT.');
  if (salvato && driveAccesso()) return salvato.token;
  await precaricaDrive();
  let durata = 3600;
  const token = await new Promise<string>((ok, ko) => {
    window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      hint: ACCOUNT_DRIVE,
      callback: (r: { access_token?: string; expires_in?: number | string; error?: string }) => {
        durata = Number(r.expires_in) || durata;
        r.access_token ? ok(r.access_token) : ko(new Error(`Accesso a Google non riuscito (${r.error || 'sconosciuto'}).`));
      },
      error_callback: (e: { type?: string }) =>
        ko(new Error(e?.type === 'popup_closed' ? 'Accesso a Google annullato.' : 'Il browser ha bloccato la finestra di accesso a Google.')),
    }).requestAccessToken();
  });
  const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: `Bearer ${token}` } });
  const email = r.ok ? String((await r.json()).user?.emailAddress || '').toLowerCase() : '';
  if (email !== ACCOUNT_DRIVE) {
    window.google.accounts.oauth2.revoke(token, () => {});
    throw new Error(`Hai scelto ${email || 'un altro account'}: la tabella va salvata su ${ACCOUNT_DRIVE}.`);
  }
  salvato = { token, scade: Date.now() + (durata - 60) * 1000 };
  return token;
}

const testoQuery = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

// Cerca (o crea) le cartelle del percorso, una dentro l'altra, e restituisce l'id dell'ultima.
// Con drive.readonly vede anche le cartelle fatte a mano: una con lo stesso nome può essere usata.
export async function cartellaDrive(token: string, percorso: string[]): Promise<string> {
  let padre = 'root';
  for (const nome of percorso) {
    const q = `name = '${testoQuery(nome)}' and mimeType = 'application/vnd.google-apps.folder' and '${padre}' in parents and trashed = false`;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) salvato = null;
    if (!r.ok) throw new Error(`Drive non ha trovato la cartella "${nome}" (errore ${r.status}).`);
    const trovata = (await r.json()).files?.[0]?.id;
    if (trovata) { padre = trovata; continue; }
    const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }),
    });
    if (!c.ok) throw new Error(`Drive non ha creato la cartella "${nome}" (errore ${c.status}).`);
    padre = (await c.json()).id;
  }
  return padre;
}

// I PDF dentro una cartella (non nelle sottocartelle), tutte le pagine.
export async function pdfInCartella(token: string, cartella: string): Promise<{ id: string; name: string; webViewLink: string }[]> {
  const q = `'${cartella}' in parents and mimeType = 'application/pdf' and trashed = false`;
  const tutti: { id: string; name: string; webViewLink: string }[] = [];
  let pagina = '';
  do {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,webViewLink)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${pagina && '&pageToken=' + pagina}`, { headers: { Authorization: `Bearer ${token}` } });
    // 403: token senza la lettura dei file (accesso fatto prima o permesso non concesso): al prossimo clic si richiede
    if (r.status === 401 || r.status === 403) salvato = null;
    if (r.status === 403) throw new Error('Drive non permette di leggere la cartella: riprova e, nella finestra di Google, concedi la lettura dei file di Drive.');
    if (r.status === 404) throw new Error('Cartella non trovata: controlla il link e che sia di un account a cui hai accesso.');
    if (!r.ok) throw new Error(`Drive non ha letto la cartella (errore ${r.status}).`);
    const j = await r.json();
    tutti.push(...(j.files ?? []));
    pagina = j.nextPageToken ?? '';
  } while (pagina);
  return tutti;
}

// pubblico: "chiunque abbia il link può visualizzare" (i PDF dei programmi collegati dalla tabella, scelta dell'utente).
// Se nella cartella c'è già un file con lo stesso nome lo sovrascrive (stesso id e stesso link), senza creare doppioni.
export async function caricaSuDrive(token: string, file: Blob, nome: string, { pubblico = false, cartella }: { pubblico?: boolean; cartella?: string } = {}): Promise<{ id: string; webViewLink: string }> {
  let esistente: string | undefined;
  if (cartella) {
    const q = `name = '${testoQuery(nome)}' and '${cartella}' in parents and mimeType = '${file.type || 'application/pdf'}' and trashed = false`;
    const s = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,capabilities/canEdit)&orderBy=createdTime`, { headers: { Authorization: `Bearer ${token}` } });
    if (s.status === 401) salvato = null;
    if (!s.ok) throw new Error(`Drive non ha cercato "${nome}" (errore ${s.status}).`);
    // solo i file che l'app può modificare (drive.file: creati da lei); quelli messi a mano restano e se ne crea uno nuovo
    esistente = ((await s.json()).files ?? []).find((f: { capabilities?: { canEdit?: boolean } }) => f.capabilities?.canEdit)?.id;
  }
  const corpo = new FormData();
  // in aggiornamento "parents" non è ammesso: il file resta dov'è
  corpo.append('metadata', new Blob([JSON.stringify({ name: nome, mimeType: file.type || 'application/pdf', ...(cartella && !esistente && { parents: [cartella] }) })], { type: 'application/json' }));
  corpo.append('file', file);
  const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files${esistente ? '/' + esistente : ''}?uploadType=multipart&fields=id,webViewLink`, {
    method: esistente ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: corpo,
  });
  if (r.status === 401) salvato = null;
  if (!r.ok) throw new Error(`Drive ha rifiutato il file (errore ${r.status}).`);
  const caricato = await r.json();
  if (pubblico) {
    const p = await fetch(`https://www.googleapis.com/drive/v3/files/${caricato.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
    if (!p.ok) throw new Error(`Drive non ha reso pubblico "${nome}" (errore ${p.status}).`);
  }
  return { id: caricato.id, webViewLink: caricato.webViewLink || `https://drive.google.com/file/d/${caricato.id}/view` };
}
