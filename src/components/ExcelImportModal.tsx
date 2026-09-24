import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  X,
  Download,
  Users,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { Person } from '../types';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPeople: Person[];
  onImportPeople: (peopleToAdd: Person[], updateExisting: boolean) => void;
  onShowToast: (msg: string) => void;
}

interface ParsedRow {
  tempId: string;
  originalIndex: number;
  rawName: string;
  rawCognome?: string;
  fullName: string;
  gender: 'M' | 'F';
  isDuplicate: boolean;
  existingPerson?: Person;
  isValid: boolean;
  selected: boolean;
  validationError?: string;
}

type ColumnMode = 'split' | 'single'; // split: Nome + Cognome separati, single: colonna unica

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingPeople,
  onImportPeople,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  
  // Headers and raw data matrix
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);

  // Column mapping states
  const [columnMode, setColumnMode] = useState<ColumnMode>('split');
  const [nameColIndex, setNameColIndex] = useState<number>(-1);
  const [cognomeColIndex, setCognomeColIndex] = useState<number>(-1);
  const [singleColIndex, setSingleColIndex] = useState<number>(-1);
  const [nameOrder, setNameOrder] = useState<'first_last' | 'last_first'>('first_last'); // Nome Cognome vs Cognome Nome
  const [genderColIndex, setGenderColIndex] = useState<number>(-1);
  const [defaultGender, setDefaultGender] = useState<'M' | 'F'>('M');
  const [updateExisting, setUpdateExisting] = useState<boolean>(false);

  // Filter in preview
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'duplicate'>('all');

  // Parsed results list
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // --- DOWNLOAD SAMPLE EXCEL TEMPLATE ---
  const handleDownloadTemplate = () => {
    const wsData = [
      ['Nome', 'Cognome', 'Sesso'],
      ['Mario', 'Rossi', 'M'],
      ['Giuseppe', 'Verdi', 'M'],
      ['Anna', 'Bianchi', 'F'],
      ['Maria', 'Neri', 'F'],
      ['Paolo', 'Bruni', 'M'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anagrafica');
    XLSX.writeFile(wb, 'Modello_Importazione_Anagrafica.xlsx');
    onShowToast('Modello Excel scaricato!');
  };

  // --- PARSE GENDER VALUE ---
  const parseGender = (val: any, fallback: 'M' | 'F'): 'M' | 'F' => {
    if (!val) return fallback;
    const str = String(val).trim().toLowerCase();
    if (['f', 'd', 'donna', 'sorella', 'sr', 'sr.', 'femmina', 'female'].includes(str)) {
      return 'F';
    }
    if (['m', 'u', 'uomo', 'fratello', 'fr', 'fr.', 'maschio', 'male'].includes(str)) {
      return 'M';
    }
    if (str.startsWith('s') || str.startsWith('f') || str.startsWith('d')) return 'F';
    if (str.startsWith('m') || str.startsWith('u')) return 'M';
    return fallback;
  };

  // --- DETECT COLUMN HEADERS INTELLIGENTLY ---
  const analyzeColumnsAndRows = (data: any[][]) => {
    if (!data || data.length === 0) {
      setHeaders([]);
      setRawRows([]);
      setParsedRows([]);
      return;
    }

    // Find candidate header row within first 5 rows
    let headerIdx = 0;
    for (let r = 0; r < Math.min(5, data.length); r++) {
      const row = data[r];
      const joined = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (
        joined.includes('nome') ||
        joined.includes('cognome') ||
        joined.includes('nominativ') ||
        joined.includes('proclamat') ||
        joined.includes('persona')
      ) {
        headerIdx = r;
        break;
      }
    }

    const headerRow = data[headerIdx] || [];
    const maxCols = Math.max(...data.slice(headerIdx).map(r => r.length), 1);
    const colHeaders: string[] = [];

    for (let c = 0; c < maxCols; c++) {
      const val = headerRow[c];
      const title = val !== undefined && val !== null && String(val).trim() !== ''
        ? String(val).trim()
        : `Colonna ${String.fromCharCode(65 + (c % 26))}${c >= 26 ? Math.floor(c / 26) : ''}`;
      colHeaders.push(title);
    }

    setHeaders(colHeaders);
    const contentRows = data.slice(headerIdx + 1).filter(r => r.some(cell => String(cell || '').trim() !== ''));
    setRawRows(contentRows);

    // Intelligent auto-detection of columns
    let foundNome = -1;
    let foundCognome = -1;
    let foundSingle = -1;
    let foundGender = -1;

    colHeaders.forEach((h, idx) => {
      const lower = h.toLowerCase();
      // Single full name col?
      if (
        (lower.includes('nome') && lower.includes('cognome')) ||
        lower.includes('nominativ') ||
        lower.includes('proclamat') ||
        lower.includes('completo') ||
        lower === 'persona'
      ) {
        if (foundSingle === -1) foundSingle = idx;
      }
      // Separate Nome
      if (
        (lower === 'nome' || lower.startsWith('nome ') || lower.includes('first name') || lower.includes('firstname')) &&
        !lower.includes('cognome')
      ) {
        if (foundNome === -1) foundNome = idx;
      }
      // Separate Cognome
      if (
        lower === 'cognome' ||
        lower.startsWith('cognome ') ||
        lower.includes('cognomi') ||
        lower.includes('last name') ||
        lower.includes('surname')
      ) {
        if (foundCognome === -1) foundCognome = idx;
      }
      // Gender col
      if (
        lower.includes('sesso') ||
        lower.includes('genere') ||
        lower.includes('gender') ||
        lower === 'm/f' ||
        lower === 'm_f' ||
        lower === 's'
      ) {
        if (foundGender === -1) foundGender = idx;
      }
    });

    // Determine initial mode
    if (foundNome !== -1 && foundCognome !== -1) {
      setColumnMode('split');
      setNameColIndex(foundNome);
      setCognomeColIndex(foundCognome);
      setSingleColIndex(foundSingle !== -1 ? foundSingle : foundNome);
    } else if (foundSingle !== -1) {
      setColumnMode('single');
      setSingleColIndex(foundSingle);
      setNameColIndex(0);
      setCognomeColIndex(1 < colHeaders.length ? 1 : -1);
    } else {
      // Fallback defaults
      setColumnMode(colHeaders.length >= 2 ? 'split' : 'single');
      setNameColIndex(0);
      setCognomeColIndex(1 < colHeaders.length ? 1 : -1);
      setSingleColIndex(0);
    }

    setGenderColIndex(foundGender);
  };

  // --- PROCESS RAW ROWS INTO PARSED PERSONS ---
  const recomputeParsedRows = (
    mode: ColumnMode,
    nCol: number,
    cCol: number,
    sCol: number,
    order: 'first_last' | 'last_first',
    gCol: number,
    defG: 'M' | 'F',
    rows: any[][]
  ) => {
    if (!rows || rows.length === 0) {
      setParsedRows([]);
      return;
    }

    const existingNamesMap = new Map<string, Person>();
    existingPeople.forEach(p => {
      existingNamesMap.set(p.name.trim().toLowerCase(), p);
    });

    const parsed: ParsedRow[] = [];

    rows.forEach((row, idx) => {
      let first = '';
      let last = '';
      let full = '';

      if (mode === 'split') {
        first = nCol >= 0 && row[nCol] !== undefined ? String(row[nCol]).trim() : '';
        last = cCol >= 0 && row[cCol] !== undefined ? String(row[cCol]).trim() : '';

        if (order === 'first_last') {
          full = [first, last].filter(Boolean).join(' ');
        } else {
          full = [last, first].filter(Boolean).join(' ');
        }
      } else {
        full = sCol >= 0 && row[sCol] !== undefined ? String(row[sCol]).trim() : '';
      }

      // Clean multiple whitespace
      full = full.replace(/\s+/g, ' ').trim();

      const rawGenderVal = gCol >= 0 && row[gCol] !== undefined ? row[gCol] : null;
      const gender = parseGender(rawGenderVal, defG);

      const isValid = full.length > 1;
      const existingPerson = existingNamesMap.get(full.toLowerCase());
      const isDuplicate = !!existingPerson;

      let validationError: string | undefined;
      if (!isValid) {
        validationError = 'Nome vuoto o non valido';
      }

      parsed.push({
        tempId: `tmp_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        originalIndex: idx,
        rawName: first,
        rawCognome: last,
        fullName: full,
        gender,
        isDuplicate,
        existingPerson,
        isValid,
        selected: isValid && !isDuplicate,
        validationError,
      });
    });

    setParsedRows(parsed);
  };

  // Re-run parsing when column settings change
  const updateMapping = (
    newMode: ColumnMode,
    newNCol: number,
    newCCol: number,
    newSCol: number,
    newOrder: 'first_last' | 'last_first',
    newGCol: number,
    newDefG: 'M' | 'F'
  ) => {
    setColumnMode(newMode);
    setNameColIndex(newNCol);
    setCognomeColIndex(newCCol);
    setSingleColIndex(newSCol);
    setNameOrder(newOrder);
    setGenderColIndex(newGCol);
    setDefaultGender(newDefG);
    recomputeParsedRows(newMode, newNCol, newCCol, newSCol, newOrder, newGCol, newDefG, rawRows);
  };

  // --- HANDLE FILE UPLOAD ---
  const handleFile = (file: File) => {
    if (!file) return;
    const isExcelOrCsv =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel') ||
      file.type.includes('csv');

    if (!isExcelOrCsv) {
      onShowToast('Seleziona un file valido Excel (.xlsx, .xls) o .csv');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        setRawWorkbook(workbook);
        setSheetNames(workbook.SheetNames);

        const initialSheet = workbook.SheetNames[0];
        setSelectedSheet(initialSheet);

        const worksheet = workbook.Sheets[initialSheet];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        analyzeColumnsAndRows(rows);

        onShowToast(`File caricato: ${file.name}`);
      } catch (err) {
        console.error('Errore lettura file Excel:', err);
        onShowToast('Impossibile leggere il file Excel. Verifica che non sia protetto o danneggiato.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // When sheet changes
  const handleSheetChange = (sheetName: string) => {
    if (!rawWorkbook) return;
    setSelectedSheet(sheetName);
    const worksheet = rawWorkbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    analyzeColumnsAndRows(rows);
  };

  // Whenever rawRows or mapping changes, recompute
  React.useEffect(() => {
    if (rawRows.length > 0) {
      recomputeParsedRows(
        columnMode,
        nameColIndex,
        cognomeColIndex,
        singleColIndex,
        nameOrder,
        genderColIndex,
        defaultGender,
        rawRows
      );
    }
  }, [rawRows]);

  // Toggle individual row selection
  const toggleRowSelected = (tempId: string) => {
    setParsedRows(prev =>
      prev.map(r => (r.tempId === tempId ? { ...r, selected: !r.selected } : r))
    );
  };

  // Toggle gender on click in table
  const toggleRowGender = (tempId: string) => {
    setParsedRows(prev =>
      prev.map(r => (r.tempId === tempId ? { ...r, gender: r.gender === 'M' ? 'F' : 'M' } : r))
    );
  };

  // Bulk selection
  const handleSelectAll = (select: boolean) => {
    setParsedRows(prev =>
      prev.map(r => (r.isValid ? { ...r, selected: select } : r))
    );
  };

  const handleSelectOnlyNew = () => {
    setParsedRows(prev =>
      prev.map(r => (r.isValid ? { ...r, selected: !r.isDuplicate } : r))
    );
  };

  // Summary counts
  const validRows = parsedRows.filter(r => r.isValid);
  const newRows = validRows.filter(r => !r.isDuplicate);
  const duplicateRows = validRows.filter(r => r.isDuplicate);
  const selectedRows = parsedRows.filter(r => r.selected && r.isValid);

  // Filtered rows for preview table
  const displayedRows = parsedRows.filter(r => {
    if (previewFilter === 'new') return !r.isDuplicate && r.isValid;
    if (previewFilter === 'duplicate') return r.isDuplicate && r.isValid;
    return true;
  });

  // --- CONFIRM AND IMPORT ---
  const handleConfirmImport = () => {
    if (selectedRows.length === 0) {
      onShowToast('Nessun nominativo selezionato per l\'importazione.');
      return;
    }

    const peopleToCreate: Person[] = selectedRows.map(r => {
      return {
        id: 'p' + Math.random().toString(36).slice(2, 9),
        name: r.fullName,
        gender: r.gender,
        spouseId: null,
        roles: {
          uscieri: false,
          console: false,
          microfoni: false,
          presidente: false,
          preghiera: false,
          lettore: false,
        },
      };
    });

    onImportPeople(peopleToCreate, updateExisting);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Importa Anagrafica da Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Carica un file Excel con Nome e Cognome per aggiungere rapidamente i proclamatori
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg font-semibold transition-colors"
              title="Scarica un file Excel pronto all'uso con colonne Nome, Cognome, Sesso"
            >
              <Download className="w-3.5 h-3.5" /> Modello Excel
            </button>
            <button
              onClick={onClose}
              className="icon-button"
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-sm">
          
          {/* STEP 1: Upload or change file */}
          {!fileName ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
              onDrop={e => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-emerald-500 hover:bg-emerald-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-inner">
                <Upload className="w-7 h-7 animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-base">
                  Trascina qui il file Excel oppure fai clic per sfogliare
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supporta file <span className="font-semibold text-slate-700 dark:text-slate-300">.xlsx, .xls</span> o <span className="font-semibold text-slate-700 dark:text-slate-300">.csv</span>
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs bg-slate-200/80 dark:bg-slate-700 px-3 py-1 rounded-full text-slate-700 dark:text-slate-300 font-medium">
                  Colonne supportate: Nome, Cognome, Sesso (opzionale)
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                    {fileName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {rawRows.length} righe trovate · {validRows.length} nominativi validi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {sheetNames.length > 1 && (
                  <select
                    value={selectedSheet}
                    onChange={e => handleSheetChange(e.target.value)}
                    className="inp text-xs py-1 px-2 max-w-[140px]"
                    title="Seleziona foglio Excel"
                  >
                    {sheetNames.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFileName(null);
                    setRawWorkbook(null);
                    setParsedRows([]);
                    setRawRows([]);
                    setHeaders([]);
                  }}
                  className="btn-ghost text-xs py-1 px-2.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Cambia file
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping Configuration (visible if file is loaded) */}
          {fileName && headers.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  Mappatura Colonne Excel
                </span>
                <span className="text-[11px] text-slate-500">
                  Verifica o modifica la corrispondenza delle colonne
                </span>
              </div>

              {/* Mode choice: 2 separate columns or 1 single column */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => updateMapping('split', nameColIndex, cognomeColIndex, singleColIndex, nameOrder, genderColIndex, defaultGender)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors border ${
                    columnMode === 'split'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Due colonne separate (Nome + Cognome)
                </button>
                <button
                  type="button"
                  onClick={() => updateMapping('single', nameColIndex, cognomeColIndex, singleColIndex, nameOrder, genderColIndex, defaultGender)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors border ${
                    columnMode === 'single'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Colonna unica (Nome e Cognome insieme)
                </button>
              </div>

              {/* Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {columnMode === 'split' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Colonna Nome
                      </label>
                      <select
                        value={nameColIndex}
                        onChange={e => updateMapping('split', Number(e.target.value), cognomeColIndex, singleColIndex, nameOrder, genderColIndex, defaultGender)}
                        className="inp text-xs py-1.5"
                      >
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Colonna Cognome
                      </label>
                      <select
                        value={cognomeColIndex}
                        onChange={e => updateMapping('split', nameColIndex, Number(e.target.value), singleColIndex, nameOrder, genderColIndex, defaultGender)}
                        className="inp text-xs py-1.5"
                      >
                        <option value={-1}>— Nessuna —</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Formato Unione
                      </label>
                      <select
                        value={nameOrder}
                        onChange={e => updateMapping('split', nameColIndex, cognomeColIndex, singleColIndex, e.target.value as any, genderColIndex, defaultGender)}
                        className="inp text-xs py-1.5"
                      >
                        <option value="first_last">Nome Cognome (es. Mario Rossi)</option>
                        <option value="last_first">Cognome Nome (es. Rossi Mario)</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Colonna con Nome e Cognome
                    </label>
                    <select
                      value={singleColIndex}
                      onChange={e => updateMapping('single', nameColIndex, cognomeColIndex, Number(e.target.value), nameOrder, genderColIndex, defaultGender)}
                      className="inp text-xs py-1.5"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Colonna Sesso (M/F)
                  </label>
                  <select
                    value={genderColIndex}
                    onChange={e => updateMapping(columnMode, nameColIndex, cognomeColIndex, singleColIndex, nameOrder, Number(e.target.value), defaultGender)}
                    className="inp text-xs py-1.5"
                  >
                    <option value={-1}>— Nessuna (usa predefinito) —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>

                {genderColIndex === -1 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Sesso Predefinito
                    </label>
                    <select
                      value={defaultGender}
                      onChange={e => updateMapping(columnMode, nameColIndex, cognomeColIndex, singleColIndex, nameOrder, genderColIndex, e.target.value as 'M' | 'F')}
                      className="inp text-xs py-1.5"
                    >
                      <option value="M">Uomo (Fratello)</option>
                      <option value="F">Donna (Sorella)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Preview Table & Selection */}
          {fileName && parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Summary stats and action controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1">Mostra:</span>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                      previewFilter === 'all'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Tutti ({validRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('new')}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                      previewFilter === 'new'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    Nuovi da aggiungere ({newRows.length})
                  </button>
                  {duplicateRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('duplicate')}
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                        previewFilter === 'duplicate'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      Già in anagrafica ({duplicateRows.length})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyNew()}
                    className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                  >
                    Seleziona solo nuovi
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="text-sky-700 dark:text-sky-400 hover:underline font-medium"
                  >
                    Seleziona tutti
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="text-slate-500 hover:underline font-medium"
                  >
                    Deseleziona tutti
                  </button>
                </div>
              </div>

              {/* Duplicate Handling Note */}
              {duplicateRows.length > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{duplicateRows.length} persone</strong> sono già presenti nell'anagrafica.
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={e => setUpdateExisting(e.target.checked)}
                      className="accent-amber-600 rounded"
                    />
                    Aggiorna sesso per i duplicati
                  </label>
                </div>
              )}

              {/* Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={displayedRows.length > 0 && displayedRows.every(r => r.selected)}
                            onChange={e => {
                              const check = e.target.checked;
                              setParsedRows(prev =>
                                prev.map(r =>
                                  displayedRows.some(d => d.tempId === r.tempId) && r.isValid
                                    ? { ...r, selected: check }
                                    : r
                                )
                              );
                            }}
                            className="accent-emerald-600 rounded"
                          />
                        </th>
                        <th className="p-2.5">Nome e Cognome</th>
                        <th className="p-2.5 w-28 text-center">Sesso</th>
                        <th className="p-2.5 w-40">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400">
                            Nessun nominativo corrisponde al filtro selezionato.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row) => (
                          <tr
                            key={row.tempId}
                            className={`transition-colors ${
                              !row.isValid
                                ? 'bg-rose-50/40 dark:bg-rose-950/20 text-slate-400'
                                : row.selected
                                ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                disabled={!row.isValid}
                                onChange={() => toggleRowSelected(row.tempId)}
                                className="accent-emerald-600 rounded cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100">
                              {row.fullName || <span className="italic text-slate-400">— vuoto —</span>}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRowGender(row.tempId)}
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-transform active:scale-95 cursor-pointer ${
                                  row.gender === 'M'
                                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                }`}
                                title="Fai clic per invertire Uomo/Donna"
                              >
                                {row.gender === 'M' ? 'Uomo (M)' : 'Donna (F)'}
                              </button>
                            </td>
                            <td className="p-2.5">
                              {!row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                                  <X className="w-3.5 h-3.5" /> Nome non valido
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                                  <AlertTriangle className="w-3 h-3" /> Già presente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
                                  <CheckCircle2 className="w-3 h-3" /> Nuovo
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Quick instructions box */}
          <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-xl p-3 text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <p className="font-bold">Come funziona l'importazione:</p>
              <p className="mt-0.5 text-sky-900/80 dark:text-sky-300/80">
                Il sistema riconosce automaticamente se il foglio ha due colonne separate (Nome e Cognome) oppure una colonna unica. Puoi verificare l'anteprima, escludere chi non desideri importare e cambiare il sesso con un semplice clic prima di confermare.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {fileName ? (
              <span>
                <strong>{selectedRows.length}</strong> nominativi selezionati per l'importazione.
              </span>
            ) : (
              <span>Carica un file Excel per iniziare.</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-xs"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={selectedRows.length === 0}
              onClick={handleConfirmImport}
              className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Importa {selectedRows.length > 0 ? `(${selectedRows.length}) persone` : ''}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
