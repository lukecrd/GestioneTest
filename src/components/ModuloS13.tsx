import React, { useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { AssegnazioneTerritorio } from '../types';
import { formatDay, annoDiServizio, periodoAnnoDiServizio, righeS13, pagineS13, anniS13, BLOCCHI_S13, TERRITORI_PER_PAGINA_S13 } from '../utils/territori';
import './ModuloS13.css';

interface ModuloS13Props {
  territori: { numero: string }[];
  assegnazioni: AssegnazioneTerritorio[];
  onChiudi: () => void;
}

// Sul modulo cartaceo le date sono brevi: 13/10/26.
const dataBreve = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : '');
const meseAnno = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });

const BLOCCHI = Array.from({ length: BLOCCHI_S13 }, (_, i) => i);

export const ModuloS13: React.FC<ModuloS13Props> = ({ territori, assegnazioni, onChiudi }) => {
  const oggi = formatDay(new Date());
  const anni = anniS13(assegnazioni, oggi);
  const [anno, setAnno] = useState(() => annoDiServizio(oggi));
  const pagine = pagineS13(righeS13(territori, assegnazioni, anno));
  const periodo = periodoAnnoDiServizio(anno);

  return (
    <section className="space-y-5 animate-fadeIn">
      <div className="page-heading no-print">
        <div>
          <h1 className="page-title">Modulo S-13</h1>
          <p className="page-description">
            Registrazione delle assegnazioni del territorio. Si compila da solo con ogni assegnazione e rientro: scegli l'anno di servizio e stampa.
          </p>
        </div>
      </div>

      <div className="card no-print flex flex-wrap items-end gap-3">
        <button type="button" className="btn-ghost" onClick={onChiudi}>
          <ArrowLeft className="w-4 h-4" /> Torna ai territori
        </button>
        <div>
          <label className="lbl" htmlFor="s13-anno">Anno di servizio</label>
          <select id="s13-anno" className="inp mt-1 min-w-[230px]" value={anno} onChange={e => setAnno(Number(e.target.value))}>
            {anni.map(a => {
              const p = periodoAnnoDiServizio(a);
              return <option key={a} value={a}>{a} (da {meseAnno(p.inizio)} a {meseAnno(p.fine)})</option>;
            })}
          </select>
        </div>
        <p className="text-sm text-slate-600 flex-1 min-w-[220px]">
          {territori.length} territori su {pagine.length} {pagine.length === 1 ? 'pagina' : 'pagine'}, dal {dataBreve(periodo.inizio)} al {dataBreve(periodo.fine)}.
        </p>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Stampa o salva PDF
        </button>
      </div>

      <div className="s13-anteprima">
        {pagine.map((righe, p) => (
          <article key={p} className="s13-pagina" aria-label={`Modulo S-13, pagina ${p + 1} di ${pagine.length}`}>
            <h2 className="s13-titolo">REGISTRAZIONE DELLE ASSEGNAZIONI DEL TERRITORIO</h2>
            <div className="s13-anno">
              <span>Anno di servizio:</span>
              <span className="s13-anno-valore">{anno}</span>
            </div>
            <table className="s13-tabella">
              <colgroup>
                <col style={{ width: '12.5mm' }} />
                <col style={{ width: '22.5mm' }} />
                {BLOCCHI.map(i => <React.Fragment key={i}><col style={{ width: '18.8mm' }} /><col style={{ width: '18.8mm' }} /></React.Fragment>)}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} className="s13-sx s13-alta">Terr.<br />N.</th>
                  <th rowSpan={2} className="s13-alta">Restituito l'ultima volta il*</th>
                  {BLOCCHI.map(i => <th key={i} colSpan={2} className="s13-sx">Assegnato a</th>)}
                </tr>
                <tr>
                  {BLOCCHI.map(i => (
                    <React.Fragment key={i}>
                      <th className="s13-sub">Assegnato il</th>
                      <th className="s13-sub">Restituito il</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Le righe vuote completano la pagina come sul modulo cartaceo. */}
                {Array.from({ length: TERRITORI_PER_PAGINA_S13 }, (_, r) => {
                  const riga = righe[r];
                  return (
                    <React.Fragment key={r}>
                      <tr className="s13-riga-nome">
                        <td rowSpan={2} className="s13-num">{riga?.numero}</td>
                        <td rowSpan={2} className="s13-ultimo">{dataBreve(riga?.ultimoRientro ?? null)}</td>
                        {BLOCCHI.map(i => (
                          <td key={i} colSpan={2} className="s13-nome" title={riga?.blocchi[i]?.nome}>{riga?.blocchi[i]?.nome}</td>
                        ))}
                      </tr>
                      <tr className="s13-riga-date">
                        {BLOCCHI.map(i => (
                          <React.Fragment key={i}>
                            <td>{dataBreve(riga?.blocchi[i]?.assegnato ?? null)}</td>
                            <td>{dataBreve(riga?.blocchi[i]?.rientro ?? null)}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <p className="s13-nota">*Quando si inizia un nuovo foglio, registrare in questa colonna l'ultima data in cui è stato restituito ogni territorio.</p>
            <p className="s13-sigla">S-13-I 1/22</p>
          </article>
        ))}
      </div>
    </section>
  );
};
