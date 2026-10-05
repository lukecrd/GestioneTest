/** Handles JSON API errors and plain-text errors returned by the hosting platform. */
export async function fetchWolJson(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await response.text();
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      `Il servizio WOL ha restituito una risposta non valida (HTTP ${response.status}). ` +
      'Riprova tra poco. Se il problema persiste, verifica i log e la configurazione del server.'
    );
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Il servizio WOL ha restituito dati non validi. Riprova tra poco.');
  }
  if (!response.ok || !data.success) {
    throw new Error(typeof data.error === 'string' ? data.error : `Errore del servizio WOL (HTTP ${response.status}).`);
  }
  return data;
}
