import React from 'react';

export type WeekendField = 'oratore' | 'congregazione' | 'titoloDiscorso' | 'presidente' | 'lettore';

type WeekendSheetRow = {
  date: Date;
  placeholder?: boolean;
  special?: string;
} & Partial<Record<WeekendField, string>>;

// Foglio dell'Adunanza del fine settimana: lo stesso per la sezione (campi modificabili) e per il PDF (testo).
export function WeekendProgramSheet({ rows, monthLabel, field, toolbar, warn, children }: {
  rows: WeekendSheetRow[];
  monthLabel: string;
  field: (rowIndex: number, key: WeekendField, value: string | undefined) => React.ReactNode;
  toolbar?: React.ReactNode;
  warn?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="weekend-program">
      {toolbar}
      <header className="weekend-program__banner">
        <div className="weekend-program__banner-title">
          <img className="weekend-program__banner-image" src="/adunanza-header.jpg" alt="" />
          <h2>Programma Adunanza del fine settimana</h2>
          <p>Mese di {monthLabel}</p>
        </div>
        <div className="weekend-program__illustration-wrap">
          <img className="weekend-program__illustration" src="/adunanza-illustrazione.jpg" alt="Oratore che tiene un discorso davanti alla congregazione" />
        </div>
      </header>
      {children}
      <div className="weekend-program__weeks">
        {rows.map((row, index) => {
          const dateLabel = row.placeholder ? 'Domenica' : `Domenica ${String(row.date.getDate()).padStart(2, '0')}`;
          return (
            <article key={`${row.date.toISOString()}-${index}`} className="weekend-program__week">
              <h3>{dateLabel}</h3>
              <dl>
                <div className="weekend-program__line">
                  <dt>Presidente</dt><dd>{field(index, 'presidente', row.presidente)}</dd>
                </div>
                <div className="weekend-program__line">
                  <dt>Oratore</dt><dd>{field(index, 'oratore', row.oratore)}</dd>
                </div>
                <div className="weekend-program__line">
                  <dt>Congregazione</dt><dd>{field(index, 'congregazione', row.congregazione)}</dd>
                </div>
                <div className="weekend-program__line weekend-program__line--topic">
                  <dt>Tema Discorso</dt><dd>{field(index, 'titoloDiscorso', row.titoloDiscorso ?? row.special)}</dd>
                </div>
                <div className="weekend-program__line">
                  <dt>Lettore TdG</dt><dd>{field(index, 'lettore', row.lettore)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
      {warn}
    </div>
  );
}
