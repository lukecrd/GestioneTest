import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, Upload } from 'lucide-react';
import { MappaCongregazione } from '../types';
import { formatDay, leggiKml, puntiAnello } from '../utils/territori';

interface CongregazioneTerritoriProps {
  mappa: MappaCongregazione | null;
  isAdmin: boolean;
  onSalva: (mappa: MappaCongregazione | null) => void;
  onShowToast: (msg: string) => void;
  checkAdminPermission: () => boolean;
}

const COLORE = '#16799e';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Confini della congregazione su OpenStreetMap; i dati vengono dal KML scaricato da JW Hub.
const Mappa: React.FC<{ mappa: MappaCongregazione }> = ({ mappa }) => {
  const contenitore = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contenitore.current) return;
    const carta = L.map(contenitore.current, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(carta);
    const livelli = L.featureGroup().addTo(carta);
    for (const f of mappa.forme) {
      const strato = f.tipo === 'poligono'
        ? L.polygon(f.anelli.map(puntiAnello) as L.LatLngExpression[][], { color: COLORE, weight: 3, fillOpacity: 0.08 })
        : f.tipo === 'linea'
          ? L.polyline(puntiAnello(f.anelli[0]) as L.LatLngExpression[], { color: COLORE, weight: 3 })
          : L.circleMarker(puntiAnello(f.anelli[0])[0] as L.LatLngExpression, { radius: 7, color: COLORE, fillOpacity: 0.9 });
      if (f.nome) strato.bindTooltip(f.nome);
      strato.addTo(livelli);
    }
    carta.fitBounds(livelli.getBounds(), { padding: [24, 24] });
    return () => { carta.remove(); };
  }, [mappa]);

  return <div ref={contenitore} className="h-[520px] w-full rounded-lg border border-slate-200" role="img" aria-label={`Mappa dei confini: ${mappa.nome || 'congregazione'}`} />;
};

export const CongregazioneTerritori: React.FC<CongregazioneTerritoriProps> = ({ mappa, isAdmin, onSalva, onShowToast, checkAdminPermission }) => {
  const carica = async (file: File | undefined) => {
    if (!file || !checkAdminPermission()) return;
    if (!/\.kml$/i.test(file.name)) return onShowToast('Carica un file .kml (da JW Hub). I file .kmz vanno prima estratti.');
    if (file.size > MAX_FILE_BYTES) return onShowToast('Il file supera 5 MB.');
    if (mappa && !window.confirm('Sostituire la mappa attuale con quella del nuovo file?')) return;
    try {
      const { nome, forme } = leggiKml(await file.text());
      onSalva({ nome, file: file.name, caricato: formatDay(new Date()), forme });
      const poligoni = forme.filter(f => f.tipo === 'poligono').length;
      onShowToast(`Mappa caricata: ${forme.length} ${forme.length === 1 ? 'elemento' : 'elementi'}${poligoni ? `, ${poligoni} con confini` : ''}.`);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Il file non è un KML leggibile.');
    }
  };

  const rimuovi = () => {
    if (!checkAdminPermission()) return;
    if (window.confirm('Togliere la mappa della congregazione?')) onSalva(null);
  };

  return (
    <div className="card space-y-4">
      <div className="section-heading-row flex-wrap">
        <div>
          <h2 className="section-title">Congregazione</h2>
          <p className="section-description">
            {mappa
              ? `${mappa.nome || 'Mappa della congregazione'} · ${mappa.forme.length} ${mappa.forme.length === 1 ? 'elemento' : 'elementi'} · da ${mappa.file}, caricata il ${new Date(mappa.caricato + 'T12:00:00').toLocaleDateString('it-IT')}`
              : 'I confini del territorio della congregazione, dal file KML di JW Hub.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer">
              <Upload className="w-4 h-4" /> {mappa ? 'Sostituisci KML' : 'Carica KML'}
              <input type="file" accept=".kml,application/vnd.google-earth.kml+xml" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; carica(f); }} />
            </label>
            {mappa && (
              <button type="button" className="btn-ghost" onClick={rimuovi}>
                <Trash2 className="w-4 h-4" /> Togli mappa
              </button>
            )}
          </div>
        )}
      </div>

      {mappa ? (
        <>
          <Mappa mappa={mappa} />
          {mappa.forme.some(f => f.nome) && (
            <details>
              <summary className="cursor-pointer font-semibold text-slate-900">Elementi della mappa ({mappa.forme.length})</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {mappa.forme.map((f, i) => (
                  <li key={i}>{f.nome || 'Senza nome'} <span className="text-slate-500">· {f.tipo === 'poligono' ? 'confine' : f.tipo}</span></li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-700 space-y-2">
          <p className="font-semibold text-slate-900">Nessuna mappa caricata.</p>
          <p>
            Su JW Hub apri le informazioni della congregazione, poi la sezione del territorio, e scarica il file dei confini in formato KML.
            {isAdmin ? ' Poi caricalo qui con "Carica KML".' : ' Chiedi a un amministratore di caricarlo.'}
          </p>
        </div>
      )}
    </div>
  );
};
