import type { WorkBook } from 'xlsx';
import type { Worksheet, Workbook } from 'exceljs';

const margins = { left: 12 / 25.4, right: 12 / 25.4, top: 12 / 25.4, bottom: 12 / 25.4, header: 0, footer: 0 };

function setup(sheet: Worksheet, columns: number) {
  sheet.views = [{ showGridLines: false }];
  sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins };
  for (let c = 1; c <= columns; c++) sheet.getColumn(c).width = 100 / columns;
}

function printedText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('.no-print, button, img, svg').forEach(node => node.remove());
  copy.querySelectorAll('select').forEach(node => node.replaceWith(node.selectedOptions[0]?.textContent || ''));
  copy.querySelectorAll('input, textarea').forEach(node => node.replaceWith((node as HTMLInputElement).value));
  copy.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
  return (copy.textContent || '').replace(/[ \t]+/g, ' ').trim();
}

function color(value: string, fallback: string): string {
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!rgb || rgb[4] === '0') return fallback;
  return 'FF' + rgb.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Builds editable Excel cells from the same program element used for PDF printing. */
export async function buildProgramSheet(book: Workbook, root: HTMLElement) {
  const table = root.querySelector('table');
  const columns = table ? Math.max(...Array.from(table.rows).map(row => Array.from(row.cells).reduce((n, cell) => n + cell.colSpan, 0))) : 8;
  const sheet = book.addWorksheet('Programma');
  setup(sheet, columns);
  const view = root.ownerDocument.defaultView!;
  if (table?.rows[0]) {
    const total = table.getBoundingClientRect().width;
    let column = 1;
    if (total > 0) for (const cell of Array.from(table.rows[0].cells)) {
      const width = 100 * cell.getBoundingClientRect().width / total / cell.colSpan;
      for (let n = 0; n < cell.colSpan; n++) sheet.getColumn(column++).width = width;
    }
  }
  const border = { style: 'thin' as const, color: { argb: 'FF333333' } };
  let nextRow = 1;

  function cellBlock(element: Element, row: number, first: number, last: number, bordered = false) {
    const text = printedText(element);
    if (last > first) sheet.mergeCells(row, first, row, last);
    const cell = sheet.getCell(row, first);
    const style = view.getComputedStyle(element);
    const fontSize = Math.max(9, Math.min(22, parseFloat(style.fontSize) * 0.75 || 10));
    cell.value = text;
    cell.font = { name: /Georgia|Times/.test(style.fontFamily) ? 'Georgia' : 'Arial', size: fontSize, bold: Number(style.fontWeight) >= 600 || style.fontWeight === 'bold', italic: style.fontStyle === 'italic', color: { argb: color(style.color, 'FF000000') } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: style.textAlign === 'right' ? 'right' : style.textAlign === 'center' ? 'center' : 'left' };
    let background = color(style.backgroundColor, '');
    let parent = element.parentElement;
    while (!background && parent) {
      background = color(view.getComputedStyle(parent).backgroundColor, '');
      parent = parent.parentElement;
    }
    background ||= 'FFFFFFFF';
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: background } };
    if (bordered) cell.border = { top: border, right: border, bottom: border, left: border };
    const charsPerLine = Math.max(8, (100 / columns) * (last - first + 1) * (11 / fontSize));
    const lines = text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    sheet.getRow(row).height = Math.max(sheet.getRow(row).height || 0, lines * fontSize * 1.4 + 8);
    return cell;
  }

  async function image(element: HTMLImageElement, row: number, col = 0, width = 160, height = 90) {
    if (!element.complete) await new Promise<void>((resolve, reject) => { element.onload = () => resolve(); element.onerror = () => reject(new Error('Impossibile caricare un’immagine del programma.')); });
    if (!element.naturalWidth) throw new Error('Immagine del programma non disponibile.');
    const canvas = root.ownerDocument.createElement('canvas');
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    canvas.getContext('2d')!.drawImage(element, 0, 0);
    const imageId = book.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
    const ratio = Math.min(width / element.naturalWidth, height / element.naturalHeight);
    sheet.addImage(imageId, { tl: { col: col + 0.1, row: row - 1 + 0.1 }, ext: { width: element.naturalWidth * ratio, height: element.naturalHeight * ratio }, editAs: 'oneCell' });
    sheet.getRow(row).height = Math.max(sheet.getRow(row).height || 0, height * 0.75 + 10);
  }

  async function visit(element: Element) {
    if (element.matches('.no-print, button, select, input, textarea, svg')) return;
    if (element.tagName === 'IMG') {
      await image(element as HTMLImageElement, nextRow++, 0, 690, element.className.includes('banner') ? 110 : 120);
      return;
    }
    if (element.tagName === 'TABLE') {
      const start = nextRow;
      const occupied = new Set<string>();
      for (const tr of Array.from((element as HTMLTableElement).rows)) {
        let col = 1;
        for (const td of Array.from(tr.cells)) {
          while (occupied.has(`${nextRow}:${col}`)) col++;
          const first = col;
          const last = col + td.colSpan - 1;
          cellBlock(td, nextRow, first, last, true);
          // Preserve spanning cells without assigning duplicate values to merged children.
          if (td.rowSpan > 1) {
            if (last > first) sheet.unMergeCells(nextRow, first, nextRow, last);
            sheet.mergeCells(nextRow, first, nextRow + td.rowSpan - 1, last);
          }
          for (let r = nextRow; r < nextRow + td.rowSpan; r++) for (let c = first; c <= last; c++) occupied.add(`${r}:${c}`);
          for (const img of Array.from(td.querySelectorAll('img'))) {
            const imageRow = nextRow;
            await image(img, imageRow, first - 1, 70, 48);
            // Leave room for the heading above its illustration.
            const lastImage = sheet.getImages().at(-1)!;
            lastImage.range.tl.nativeRowOff += 260000;
            sheet.getRow(imageRow).height = Math.max(sheet.getRow(imageRow).height || 0, 85);
          }
          col = last + 1;
        }
        nextRow++;
      }
      const headRows = (element as HTMLTableElement).tHead?.rows.length || 0;
      if (headRows) sheet.pageSetup.printTitlesRow = `${start}:${start + headRows - 1}`;
      return;
    }
    const children = Array.from(element.children).filter(child => !child.matches('.no-print, button, select, input, textarea, svg'));
    const style = view.getComputedStyle(element);
    if (element.classList.contains('weekend-program__line') || (style.display === 'flex' && children.length === 2 && !element.querySelector('img, table'))) {
      const split = Math.max(1, Math.floor(columns * (element.classList.contains('weekend-program__line') ? 0.34 : 0.62)));
      cellBlock(children[0], nextRow, 1, split);
      cellBlock(children[1], nextRow, split + 1, columns);
      nextRow++;
    } else if (!children.length || /^(H[1-6]|P)$/.test(element.tagName)) {
      if (printedText(element)) cellBlock(element, nextRow++, 1, columns);
    } else {
      for (const child of children) await visit(child);
    }
  }
  await visit(root);
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(columns).letter}${Math.max(1, nextRow - 1)}`;
  return sheet;
}

export async function exportProgramExcel(source: WorkBook, filename: string, selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error('Apri l’anteprima di stampa del programma prima di esportare.');
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;';
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.head.innerHTML = document.head.innerHTML;
    const container = doc.createElement('main');
    container.className = 'app-content';
    container.appendChild(element.cloneNode(true));
    doc.body.appendChild(container);
    const style = doc.createElement('style');
    // Apply the existing PDF print rules to the detached light-mode preview.
    const printRules: string[] = [];
    const collect = (rules: CSSRuleList) => Array.from(rules).forEach(rule => {
      if (rule instanceof CSSMediaRule && rule.conditionText.includes('print')) printRules.push(Array.from(rule.cssRules).map(r => r.cssText).join('\n'));
      else if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules);
      else if (rule instanceof CSSImportRule && rule.styleSheet) collect(rule.styleSheet.cssRules);
    });
    for (const sheet of Array.from(document.styleSheets)) { try { collect(sheet.cssRules); } catch { /* Cross-origin stylesheet has no program-specific rules. */ } }
    style.textContent = printRules.join('\n') + '\nheader {display:block!important} .app-content{width:703px!important} .print-only{display:inline!important} .no-print{display:none!important}';
    doc.head.appendChild(style);
    await Promise.all(Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => link.sheet ? Promise.resolve() : new Promise<void>((resolve, reject) => { link.onload = () => resolve(); link.onerror = () => reject(new Error('Impossibile caricare lo stile del programma.')); })));
    await doc.fonts.ready;
    await buildProgramSheet(book, container.firstElementChild as HTMLElement);
    const XLSX = await import('xlsx');
    source.SheetNames.forEach(name => {
      const original = source.Sheets[name];
      const rows = XLSX.utils.sheet_to_json<any[]>(original, { header: 1, defval: '' });
      const sheet = book.addWorksheet(('Dati ' + name).slice(0, 31));
      sheet.addRows(rows);
      setup(sheet, Math.max(1, ...rows.map(row => row.length)));
      for (const merge of original['!merges'] || []) sheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1);
      sheet.eachRow(row => row.eachCell(cell => { cell.font = { name: 'Arial', size: 10 }; cell.alignment = { wrapText: true, vertical: 'middle' }; }));
    });
    const buffer = await book.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    frame.remove();
  }
}
