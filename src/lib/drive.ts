// Salvataggio su Google Drive con Google Identity Services (token OAuth nel browser, nessun server).
// Configurazione in .env: VITE_GOOGLE_CLIENT_ID (client OAuth "Applicazione web" con le origini dell'app autorizzate)
// e VITE_DRIVE_ACCOUNT (l'unico account Drive su cui si salva).
// drive.file: l'app vede e scrive solo i file creati da lei, non il resto del Drive.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const ACCOUNT_DRIVE = ((import.meta.env.VITE_DRIVE_ACCOUNT as string | undefined) || '').trim().toLowerCase();
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

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

// Cerca (o crea) le cartelle del percorso, una dentro l'altra, e restituisce l'id dell'ultima.
// Con drive.file l'app vede solo le cartelle create da lei: una cartella con lo stesso nome fatta a mano non viene trovata.
export async function cartellaDrive(token: string, percorso: string[]): Promise<string> {
  let padre = 'root';
  for (const nome of percorso) {
    const q = `name = '${nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${padre}' in parents and trashed = false`;
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

// pubblico: "chiunque abbia il link può visualizzare" (i PDF dei programmi collegati dalla tabella, scelta dell'utente).
export async function caricaSuDrive(token: string, file: Blob, nome: string, { pubblico = false, cartella }: { pubblico?: boolean; cartella?: string } = {}): Promise<{ id: string; webViewLink: string }> {
  const corpo = new FormData();
  corpo.append('metadata', new Blob([JSON.stringify({ name: nome, mimeType: file.type || 'application/pdf', ...(cartella && { parents: [cartella] }) })], { type: 'application/json' }));
  corpo.append('file', file);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
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
