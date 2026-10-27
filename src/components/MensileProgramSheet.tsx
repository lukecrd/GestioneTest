import React from 'react';
import { MensileRow } from '../types';
import { mensileWeekStart } from '../utils/mensileWeek';

const MESI_ABBR = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

export function fmtShort(dt: Date) {
  return dt.getDate() + '-' + MESI_ABBR[dt.getMonth()];
}

export type MensileFieldKey = 'ingresso0' | 'ingresso1' | 'auditorium' | 'microfoni0' | 'microfoni1' | 'audioVideo0' | 'audioVideo1';

// Foglio del Programma mensile: lo stesso per la sezione (celle modificabili) e per il PDF (celle di testo).
export function MensileProgramSheet({ rows, title, warn, cell, group, hint }: {
  rows: MensileRow[];
  title: string;
  warn: string | null;
  cell: (rowIndex: number, field: MensileFieldKey, value: string | undefined, duplicates?: string[]) => React.ReactNode;
  group: (rowIndex: number, field: 'riassetto' | 'pulizie', value: string | undefined) => React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="print-sheet">
      {hint}
      <div className="prog-banner">
        <img className="prog-banner__image" src="/programma-mensile-header.jpg" alt="" />
        <div className="prog-title">Programma<br />Uscieri - Microfonisti - Audio / Video -<br />Riassetto e Pulizie</div>
        <div className="prog-month">Mese di {title}</div>
      </div>
      <div className="table-wrapper">
        <table className="prog-table">
          <thead>
            <tr>
              <th className="w-week" rowSpan={2}>Settimana<br />del:</th>
              <th><div>Uscieri ingresso</div><img className="prog-th-image" src="/mensile-ingresso.jpg" alt="" /></th>
              <th><div>Usciere<br />Auditorium</div><img className="prog-th-image" src="/mensile-auditorium.jpg" alt="" /></th>
              <th><div>Microfonisti</div><img className="prog-th-image" src="/mensile-microfoni.jpg" alt="" /></th>
              <th><div>Audio Video</div><img className="prog-th-image" src="/mensile-audio-video.jpg" alt="" /></th>
              <th><div>Riassetto</div><img className="prog-th-image" src="/mensile-riassetto.jpg" alt="" /></th>
              <th><div>Pulizie del<br />fine settimana</div><img className="prog-th-image" src="/mensile-pulizie.jpg" alt="" /></th>
            </tr>
            <tr className="prog-subheader">
              <th>Nominativo</th>
              <th>Nominativo</th>
              <th>Nominativo</th>
              <th>Nominativo</th>
              <th>Gruppo</th>
              <th>Gruppo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              if (r.special) {
                return (
                  <React.Fragment key={i}>
                    <tr className="special-row">
                      <td className="week-cell">{fmtShort(mensileWeekStart(r.date))}</td>
                      <td colSpan={6}>{r.special}</td>
                    </tr>
                    {i < rows.length - 1 && (
                      <tr className="week-spacer"><td colSpan={7} /></tr>
                    )}
                  </React.Fragment>
                );
              }
              const hasDup = r.duplicates && r.duplicates.length > 0;
              const rowClass = hasDup ? 'week-row-warn' : undefined;
              return (
                <React.Fragment key={i}>
                  <tr className={rowClass}>
                    <td className="week-cell" rowSpan={2}>
                      <div className="flex items-center justify-center gap-1">
                        {hasDup && (
                          <span className="text-amber-600 font-bold text-sm" title={r.warnings?.join('\n')}>⚠</span>
                        )}
                        <span>{fmtShort(mensileWeekStart(r.date))}</span>
                      </div>
                    </td>
                    <td>{cell(i, 'ingresso0', r.ingresso?.[0], r.duplicates)}</td>
                    <td rowSpan={2}>{cell(i, 'auditorium', r.auditorium, r.duplicates)}</td>
                    <td>{cell(i, 'microfoni0', r.microfoni?.[0], r.duplicates)}</td>
                    <td>{cell(i, 'audioVideo0', r.audioVideo?.[0], r.duplicates)}</td>
                    <td className="group-cell" rowSpan={2}>{group(i, 'riassetto', r.riassetto)}</td>
                    <td className="group-cell" rowSpan={2}>{group(i, 'pulizie', r.pulizie)}</td>
                  </tr>
                  <tr className={rowClass}>
                    <td>{cell(i, 'ingresso1', r.ingresso?.[1], r.duplicates)}</td>
                    <td>{cell(i, 'microfoni1', r.microfoni?.[1], r.duplicates)}</td>
                    <td>{cell(i, 'audioVideo1', r.audioVideo?.[1], r.duplicates)}</td>
                  </tr>
                  {i < rows.length - 1 && (
                    <tr className="week-spacer"><td colSpan={7} /></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {warn && <div className="warn">⚠ {warn}</div>}
    </div>
  );
}
