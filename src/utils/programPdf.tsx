import React from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';

// PDF di un programma generato nel browser: il foglio viene disegnato fuori schermo con le regole @media print
// dell'app (stesso aspetto di "Stampa"), fotografato e impaginato in A4.

// Area stampabile come @page in print.css: A4 con margini 3mm sopra, 6mm ai lati e sotto.
const PAGINA = { larghezza: 210, altezza: 297, sopra: 3, lato: 6, sotto: 6 };
const AREA_MM = { larghezza: PAGINA.larghezza - 2 * PAGINA.lato, altezza: PAGINA.altezza - PAGINA.sopra - PAGINA.sotto };
const SCALA = 2;

// Elementi tra i quali si può andare a pagina nuova senza tagliarli.
const BLOCCHI = 'tr, .weekend-program__week, .vm-page, .printable-area > *, .field-service-print > *, .prog-banner, header';

// Testo delle regole @media print di tutti i fogli di stile, da applicare alla copia fotografata.
function regoleDiStampa(): string {
  const testi: string[] = [];
  const visita = (regole: CSSRuleList) => {
    for (const regola of Array.from(regole)) {
      if (regola instanceof CSSMediaRule && /\bprint\b/.test(regola.media.mediaText)) {
        for (const interna of Array.from(regola.cssRules)) testi.push(interna.cssText);
      } else if ('cssRules' in regola) {
        visita((regola as CSSGroupingRule).cssRules); // @layer, @supports…
      }
    }
  };
  for (const foglio of Array.from(document.styleSheets)) {
    try { visita(foglio.cssRules); } catch { /* foglio di un altro dominio (es. Google Fonts): non leggibile */ }
  }
  return testi.join('\n');
}

const attendiImmagini = (radice: HTMLElement) => Promise.all(Array.from(radice.querySelectorAll('img')).map(img =>
  img.complete ? Promise.resolve() : new Promise<void>(fatto => { img.onload = img.onerror = () => fatto(); })));

// Tagli di pagina in pixel del canvas: alla fine dell'ultimo blocco che entra nella pagina, altrimenti a pagina piena.
export function calcolaTagli(fineBlocchi: number[], altezzaTotale: number, altezzaPagina: number): number[] {
  const tagli: number[] = [];
  let inizio = 0;
  while (altezzaTotale - inizio > altezzaPagina) {
    const limite = inizio + altezzaPagina;
    const candidati = fineBlocchi.filter(y => y > inizio + altezzaPagina * 0.3 && y <= limite);
    const taglio = candidati.length ? Math.max(...candidati) : limite;
    tagli.push(taglio);
    inizio = taglio;
  }
  return tagli;
}

// stampa: true usa le regole @media print (fogli dei programmi); false lo stile a schermo senza .no-print.
// larghezzaPx + finestraPx: impaginazione a schermo fissa (es. due colonne), indipendente dal dispositivo.
// unaPagina: rimpicciolisce tutto in un solo foglio A4 (Tabella informazioni, come il manifesto stampato).
// link: { chiave: url } per gli elementi con data-pdf-link="chiave", che nel PDF diventano cliccabili.
// shortcut: i link valgono solo con unaPagina; estenderli ai PDF su più pagine se servirà.
export async function creaPdf(
  foglio: React.ReactElement,
  titolo: string,
  { stampa = true, larghezzaPx, finestraPx, unaPagina = false, link = {} }: { stampa?: boolean; larghezzaPx?: number; finestraPx?: number; unaPagina?: boolean; link?: Record<string, string> } = {},
): Promise<Blob> {
  const host = document.createElement('div');
  host.id = `pdf-programma-${Date.now()}`;
  // .app-content: molte regole di stampa sono scritte per i fogli dentro l'area contenuti dell'app.
  if (stampa) host.className = 'app-content';
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', background: '#fff' });
  // !important: print.css forza .app-content a width 100%.
  host.style.setProperty('width', larghezzaPx ? `${larghezzaPx}px` : `${AREA_MM.larghezza}mm`, 'important');
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    root.render(foglio);
    await new Promise(r => setTimeout(r, 50)); // lascia a React il tempo di disegnare
    await attendiImmagini(host);
    await document.fonts?.ready;

    // Le animazioni ripartono nella copia (es. animate-fadeIn): senza questo la foto uscirebbe trasparente.
    const css = '*, *::before, *::after { animation: none !important; transition: none !important; }\n'
      + (stampa ? regoleDiStampa() : '.no-print { display: none !important; }');
    let fineBlocchi: number[] = [];
    let aree: { url: string; x: number; y: number; w: number; h: number }[] = []; // px CSS dal bordo del foglio
    const canvas = await html2canvas(host, {
      scale: SCALA,
      backgroundColor: '#ffffff',
      useCORS: true,
      ...(finestraPx ? { windowWidth: finestraPx } : {}),
      onclone: (copia) => {
        const stile = copia.createElement('style');
        stile.textContent = css;
        copia.head.appendChild(stile);
        const clone = copia.getElementById(host.id)!;
        clone.style.left = '0';
        const alto = clone.getBoundingClientRect().top;
        fineBlocchi = Array.from(clone.querySelectorAll(BLOCCHI)).map(el => (el.getBoundingClientRect().bottom - alto) * SCALA);
        const sinistra = clone.getBoundingClientRect().left;
        aree = Array.from(clone.querySelectorAll<HTMLElement>('[data-pdf-link]')).flatMap(el => {
          const url = link[el.dataset.pdfLink!];
          const r = el.getBoundingClientRect();
          return url && r.width && r.height ? [{ url, x: r.left - sinistra, y: r.top - alto, w: r.width, h: r.height }] : [];
        });
      },
    });

    const pxPerMm = canvas.width / AREA_MM.larghezza;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    doc.setProperties({ title: titolo });
    if (unaPagina) {
      const mm = Math.min(AREA_MM.larghezza / canvas.width, AREA_MM.altezza / canvas.height);
      const w = canvas.width * mm;
      const x0 = (PAGINA.larghezza - w) / 2;
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x0, PAGINA.sopra, w, canvas.height * mm);
      const k = mm * SCALA; // da px CSS a mm
      for (const a of aree) doc.link(x0 + a.x * k, PAGINA.sopra + a.y * k, a.w * k, a.h * k, { url: a.url });
      return doc.output('blob');
    }
    const altezzaPagina = Math.floor(AREA_MM.altezza * pxPerMm);
    const tagli = calcolaTagli(fineBlocchi, canvas.height, altezzaPagina);
    [0, ...tagli].forEach((inizio, i, inizi) => {
      const fine = i + 1 < inizi.length ? inizi[i + 1] : canvas.height;
      const pagina = document.createElement('canvas');
      pagina.width = canvas.width;
      pagina.height = Math.max(1, Math.round(fine - inizio));
      pagina.getContext('2d')!.drawImage(canvas, 0, -inizio);
      if (i > 0) doc.addPage();
      doc.addImage(pagina.toDataURL('image/jpeg', 0.92), 'JPEG', PAGINA.lato, PAGINA.sopra, AREA_MM.larghezza, pagina.height / pxPerMm);
    });
    return doc.output('blob');
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function apriPdfProgramma(foglio: React.ReactElement, titolo: string): Promise<void> {
  // La finestra si apre subito, nel clic, altrimenti il browser la blocca come popup.
  const finestra = window.open('', '_blank');
  finestra?.document.write(`<title>${titolo}</title><p style="font-family:sans-serif;padding:2rem">Preparazione del PDF…</p>`);
  try {
    const url = URL.createObjectURL(await creaPdf(foglio, titolo));
    if (finestra) finestra.location.href = url; else window.open(url, '_blank');
  } catch (err) {
    finestra?.close();
    throw err;
  }
}
