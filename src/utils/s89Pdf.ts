import { jsPDF } from 'jspdf';

export interface S89Item {
  id?: string;
  studentName: string;
  assistantName?: string;
  dateLabel: string; // e.g. "5 ottobre 2026"
  partNumber: string | number; // e.g. "3" or "4"
  partTitle?: string; // e.g. "Lettura biblica" or "Iniziare una conversazione"
  room?: 'main' | 'aux1' | 'aux2'; // Sala principale, Sala secondaria 1, Sala secondaria 2
  isSent?: boolean;
}

/**
 * Pulisce il nome per renderlo sicuro in un nome di file e restituisce il nome file formattato
 * con il nome dello studente: es. "Mario Rossi - S-89.pdf"
 */
export function getS89FileName(studentName: string, partNumber?: string | number): string {
  const cleanName = (studentName || 'Studente')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim();
  
  if (partNumber) {
    return `${cleanName} - S-89 (Parte ${partNumber}).pdf`;
  }
  return `${cleanName} - S-89.pdf`;
}

/**
 * Disegna una singola pagina del foglietto S-89 su un documento jsPDF in formato A4
 */
export function renderS89Page(doc: jsPDF, item: S89Item): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 6;
  const rightEdge = pageWidth - margin;

  // Intestazione
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PARTE PER L’ADUNANZA', pageWidth / 2, 16, { align: 'center' });
  doc.text('VITA CRISTIANA E MINISTERO', pageWidth / 2, 23, { align: 'center' });

  let y = 37;
  const lineSpacing = 11;

  const drawField = (label: string, val?: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const fullLabel = label + ': ';
    doc.text(fullLabel, margin, y);
    const labelWidth = doc.getTextWidth(fullLabel);

    if (val && val.trim()) {
      doc.setFont('helvetica', 'normal');
      const cleanVal = val.trim();
      doc.text(cleanVal, margin + labelWidth + 1, y);
      const valWidth = doc.getTextWidth(cleanVal);
      const dashStart = margin + labelWidth + valWidth + 2;
      if (dashStart < rightEdge) {
        doc.setDrawColor(150, 150, 150);
        doc.setLineDashPattern([0.8, 1.2], 0);
        doc.line(dashStart, y + 0.5, rightEdge, y + 0.5);
        doc.setLineDashPattern([], 0);
      }
    } else {
      doc.setDrawColor(150, 150, 150);
      doc.setLineDashPattern([0.8, 1.2], 0);
      doc.line(margin + labelWidth, y + 0.5, rightEdge, y + 0.5);
      doc.setLineDashPattern([], 0);
    }
    y += lineSpacing;
  };

  // 1. Nome e cognome studente
  drawField('Nome e cognome', item.studentName);

  // 2. Assistente (se presente)
  drawField('Assistente', item.assistantName);

  // 3. Data
  drawField('Data', item.dateLabel);

  // 4. Parte n.
  const partDisplay = item.partTitle
    ? `${item.partNumber} - ${item.partTitle}`
    : item.partNumber
    ? String(item.partNumber)
    : '';
  drawField('Parte n.', partDisplay);

  // 5. Da svolgere nella:
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Da svolgere nella:', margin, y);
  y += 6;

  const activeRoom = item.room || 'main';
  const rooms: Array<{ key: 'main' | 'aux1' | 'aux2'; label: string }> = [
    { key: 'main', label: 'Sala principale' },
    { key: 'aux1', label: 'Sala secondaria 1' },
    { key: 'aux2', label: 'Sala secondaria 2' },
  ];

  rooms.forEach(r => {
    const isChecked = activeRoom === r.key;
    // Casella di spunta (checkbox quadrata fedele all'originale)
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.4);
    doc.rect(margin + 1, y - 3.8, 4.4, 4.4);

    if (isChecked) {
      doc.setLineWidth(0.65);
      // Spunta elegante (checkmark)
      doc.line(margin + 1.8, y - 1.4, margin + 2.8, y - 0.4);
      doc.line(margin + 2.8, y - 0.4, margin + 4.6, y - 3.0);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(r.label, margin + 8.5, y);
    y += 6.5;
  });

  // 6. Nota per lo studente
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text('Nota per lo studente: ', margin, y);
  const prefixW = doc.getTextWidth('Nota per lo studente: ');
  doc.setFont('helvetica', 'normal');

  const noteParagraph =
    'La fonte e la lezione che riguardano la tua parte sono indicate nella Guida per l’adunanza Vita e ministero. Ripassa le Istruzioni per l’adunanza Vita cristiana e ministero (S-38) relative alla tua parte.';

  // Gestione testo a capo proporzionato alla larghezza del foglietto
  const splitLines = doc.splitTextToSize('Nota per lo studente: ' + noteParagraph, rightEdge - margin);
  
  // Ridisegniamo le linee con stile pulito
  doc.text(splitLines, margin, y, { lineHeightFactor: 1.35 });

  // 7. Codice modulo S-89-I 11/23 in basso a sinistra
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('S-89-I   11/23', margin, doc.internal.pageSize.getHeight() - margin);
}

/**
 * Genera il file PDF del singolo foglietto S-89 e ne avvia il download.
 * Il nome del file conterrà il nome dello studente (es. "Mario Rossi - S-89.pdf")
 */
export function downloadS89Pdf(item: S89Item): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4', // 210 x 297 mm
  });

  renderS89Page(doc, item);

  const filename = getS89FileName(item.studentName, item.partNumber);
  doc.save(filename);
}

/**
 * Genera un unico file PDF multipagina con tutti i foglietti S-89 indicati
 */
export function downloadCombinedS89Pdf(items: S89Item[], customFileName?: string): void {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  items.forEach((item, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }
    renderS89Page(doc, item);
  });

  const filename = customFileName || `Foglietti_S-89_Vita_e_Ministero.pdf`;
  doc.save(filename);
}
