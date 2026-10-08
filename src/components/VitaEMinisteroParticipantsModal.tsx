import React, { useState } from 'react';
import {
  VitaEMinisteroParticipant,
  VitaEMinisteroParticipantRoles,
  MinisteroPartTypeDef,
  Person,
} from '../types';
import {
  Users,
  UserPlus,
  Search,
  Check,
  Trash2,
  Edit2,
  Sparkles,
  Download,
  AlertCircle,
  X,
  UserCheck,
  Plus,
  Tag,
} from 'lucide-react';

interface VitaEMinisteroParticipantsModalProps {
  participants: VitaEMinisteroParticipant[];
  congregationPeople: Person[];
  isAdmin: boolean;
  onUpdateParticipants: (participants: VitaEMinisteroParticipant[]) => void;
  onShowToast: (msg: string) => void;
  ministeroPartTypes: MinisteroPartTypeDef[];
  onAddCustomPartType: (label: string) => void;
  onRemoveCustomPartType: (id: string) => void;
}

/**
 * Selettore dei "tipi di parte" (Efficaci nel ministero) per cui il proclamatore
 * è abilitato: nessuna selezione = nessuna restrizione (abilitato a tutti i tipi).
 * Permette anche di aggiungere/rimuovere tipi personalizzati alla lista fissa.
 */
function MinisteroPartTypesPicker({
  partTypes,
  selectedIds,
  onChange,
  onAddCustomPartType,
  onRemoveCustomPartType,
}: {
  partTypes: MinisteroPartTypeDef[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onAddCustomPartType: (label: string) => void;
  onRemoveCustomPartType: (id: string) => void;
}) {
  const [newTypeLabel, setNewTypeLabel] = useState('');

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(t => t !== id) : [...selectedIds, id]);
  };

  return (
    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
      <label className="lbl block mb-1 text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" />
        Tipi di parte Ministero abilitati (criterio di assegnazione)
      </label>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
        Nessuna selezione = nessuna restrizione, abilitato a qualsiasi tipo di parte. Seleziona uno o più
        criteri per limitare le parti assegnabili (es. solo durata breve, solo dimostrazioni...).
      </p>
      <div className="flex flex-wrap gap-1.5">
        {partTypes.map(pt => {
          const active = selectedIds.includes(pt.id);
          return (
            <span
              key={pt.id}
              className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                active
                  ? 'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-950/70 dark:border-violet-700 dark:text-violet-300'
                  : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <button type="button" onClick={() => toggle(pt.id)} className="cursor-pointer">
                {pt.label}
              </button>
              {!pt.isDefault && (
                <button
                  type="button"
                  onClick={() => onRemoveCustomPartType(pt.id)}
                  title="Rimuovi questo tipo di parte personalizzato"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <input
          type="text"
          value={newTypeLabel}
          onChange={e => setNewTypeLabel(e.target.value)}
          placeholder="Nuovo tipo di parte (es. Video con dimostrazione)"
          className="inp text-xs py-1 flex-1 max-w-xs"
        />
        <button
          type="button"
          onClick={() => {
            if (!newTypeLabel.trim()) return;
            onAddCustomPartType(newTypeLabel.trim());
            setNewTypeLabel('');
          }}
          className="px-2 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Aggiungi tipo
        </button>
      </div>
    </div>
  );
}

const DEFAULT_ROLES: VitaEMinisteroParticipantRoles = {
  presidente: false,
  preghiera: false,
  tesoriDiscorso: false,
  tesoriGemme: false,
  tesoriLettura: false,
  ministeroStudente: true,
  ministeroTipiAbilitati: [],
  ministeroAssistente: true,
  vitaCristianaParti: false,
  studioBiblicoConduttore: false,
  studioBiblicoLettore: false,
};

export function VitaEMinisteroParticipantsModal({
  participants,
  congregationPeople,
  isAdmin,
  onUpdateParticipants,
  onShowToast,
  ministeroPartTypes,
  onAddCustomPartType,
  onRemoveCustomPartType,
}: VitaEMinisteroParticipantsModalProps) {
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'M' | 'F'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // New or editing participant state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'M' | 'F'>('M');
  const [formPersonId, setFormPersonId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRoles, setFormRoles] = useState<VitaEMinisteroParticipantRoles>({ ...DEFAULT_ROLES });
  const [participantToDelete, setParticipantToDelete] = useState<{ id: string; name: string } | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormGender('M');
    setFormPersonId('');
    setFormNotes('');
    setFormRoles({ ...DEFAULT_ROLES });
  };

  const handleEdit = (p: VitaEMinisteroParticipant) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormGender(p.gender);
    setFormPersonId(p.personId || '');
    setFormNotes(p.notes || '');
    setFormRoles({ ...p.roles });
  };

  const confirmDelete = () => {
    if (!isAdmin || !participantToDelete) return;
    const { id, name } = participantToDelete;
    onUpdateParticipants(participants.filter(p => p.id !== id));
    onShowToast(`Rimosso ${name}`);
    if (editingId === id) resetForm();
    setParticipantToDelete(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (!isAdmin) return;
    setParticipantToDelete({ id, name });
  };

  const handleApplyPreset = (preset: 'anziano' | 'servitore' | 'fratello' | 'sorella' | 'assistente') => {
    if (preset === 'anziano') {
      setFormGender('M');
      setFormRoles({
        presidente: true,
        preghiera: true,
        tesoriDiscorso: true,
        tesoriGemme: true,
        tesoriLettura: true,
        ministeroStudente: true,
        ministeroAssistente: true,
        vitaCristianaParti: true,
        studioBiblicoConduttore: true,
        studioBiblicoLettore: true,
      });
    } else if (preset === 'servitore') {
      setFormGender('M');
      setFormRoles({
        presidente: false,
        preghiera: true,
        tesoriDiscorso: false,
        tesoriGemme: true,
        tesoriLettura: true,
        ministeroStudente: true,
        ministeroAssistente: true,
        vitaCristianaParti: true,
        studioBiblicoConduttore: false,
        studioBiblicoLettore: true,
      });
    } else if (preset === 'fratello') {
      setFormGender('M');
      setFormRoles({
        presidente: false,
        preghiera: true,
        tesoriDiscorso: false,
        tesoriGemme: false,
        tesoriLettura: true,
        ministeroStudente: true,
        ministeroAssistente: true,
        vitaCristianaParti: false,
        studioBiblicoConduttore: false,
        studioBiblicoLettore: true,
      });
    } else if (preset === 'sorella') {
      setFormGender('F');
      setFormRoles({
        presidente: false,
        preghiera: false,
        tesoriDiscorso: false,
        tesoriGemme: false,
        tesoriLettura: false,
        ministeroStudente: true,
        ministeroAssistente: true,
        vitaCristianaParti: false,
        studioBiblicoConduttore: false,
        studioBiblicoLettore: false,
      });
    } else if (preset === 'assistente') {
      setFormRoles(prev => ({
        ...prev,
        ministeroStudente: false,
        ministeroAssistente: true,
      }));
    }
  };

  const handleSaveParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const trimmed = formName.trim();
    if (!trimmed) {
      onShowToast('Inserisci il nome del proclamatore.');
      return;
    }

    if (editingId) {
      // Update
      const updated = participants.map(p =>
        p.id === editingId
          ? {
              ...p,
              name: trimmed,
              gender: formGender,
              personId: formPersonId || undefined,
              notes: formNotes.trim() || undefined,
              roles: { ...formRoles },
            }
          : p
      );
      onUpdateParticipants(updated);
      onShowToast(`Aggiornato ${trimmed}`);
    } else {
      // Create
      const newParticipant: VitaEMinisteroParticipant = {
        id: 'vm_' + Math.random().toString(36).substring(2, 9),
        name: trimmed,
        gender: formGender,
        personId: formPersonId || undefined,
        notes: formNotes.trim() || undefined,
        roles: { ...formRoles },
      };
      onUpdateParticipants([...participants, newParticipant]);
      onShowToast(`Aggiunto ${trimmed}`);
    }

    resetForm();
  };

  const handleImportFromAnagrafica = () => {
    if (!isAdmin) return;
    const existingNames = new Set(participants.map(p => p.name.trim().toLowerCase()));
    const toImport = congregationPeople.filter(cp => !existingNames.has(cp.name.trim().toLowerCase()));

    if (toImport.length === 0) {
      onShowToast('Tutti i nominativi dell\'Anagrafica sono già presenti!');
      return;
    }

    const imported: VitaEMinisteroParticipant[] = toImport.map(cp => {
      const isM = cp.gender === 'M';
      return {
        id: 'vm_' + Math.random().toString(36).substring(2, 9),
        name: cp.name,
        gender: cp.gender,
        personId: cp.id,
        roles: isM
          ? {
              presidente: !!cp.roles?.presidenteInfrasettimanale,
              preghiera: !!cp.roles?.preghiera,
              tesoriDiscorso: !!cp.roles?.presidente, // presumibilmente anziano/SM
              tesoriGemme: true,
              tesoriLettura: !!cp.roles?.lettore || true,
              ministeroStudente: true,
              ministeroAssistente: true,
              vitaCristianaParti: !!cp.roles?.presidente,
              studioBiblicoConduttore: !!cp.roles?.presidente,
              studioBiblicoLettore: !!cp.roles?.lettore,
            }
          : {
              presidente: false,
              preghiera: false,
              tesoriDiscorso: false,
              tesoriGemme: false,
              tesoriLettura: false,
              ministeroStudente: true,
              ministeroAssistente: true,
              vitaCristianaParti: false,
              studioBiblicoConduttore: false,
              studioBiblicoLettore: false,
            },
      };
    });

    onUpdateParticipants([...participants, ...imported]);
    onShowToast(`Importati ${imported.length} proclamatori dall'Anagrafica!`);
  };

  // Filter list
  const filtered = participants.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchGender = genderFilter === 'all' || p.gender === genderFilter;
    let matchRole = true;
    if (roleFilter !== 'all') {
      matchRole = !!p.roles[roleFilter as keyof VitaEMinisteroParticipantRoles];
    }
    return matchSearch && matchGender && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Nominativi &amp; Parti
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Specifica per ogni fratello o sorella quali parti può svolgere nell'adunanza Vita e Ministero.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImportFromAnagrafica}
              className="px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Importa da Anagrafica
            </button>
            <button
              onClick={() => {
                resetForm();
                document.getElementById('participant-form-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuovo Proclamatore
            </button>
          </div>
        )}
      </div>

      {/* Editor Form for Participant (if admin) */}
      {isAdmin && (
        <div id="participant-form-section" className="card border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/10">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-indigo-100 dark:border-indigo-900/50">
            <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
              {editingId ? <Edit2 className="w-4 h-4 text-indigo-600" /> : <UserPlus className="w-4 h-4 text-indigo-600" />}
              {editingId ? `Modifica Ruoli e Parti di: ${formName}` : 'Aggiungi / Configura Proclamatore'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Annulla Modifica
              </button>
            )}
          </div>

          <form onSubmit={handleSaveParticipant} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="lbl block mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Es. Mario Rossi"
                  className="inp text-sm"
                  required
                />
              </div>

              <div>
                <label className="lbl block mb-1">Genere</label>
                <div className="flex items-center gap-2 pt-1">
                  <label className="chk">
                    <input
                      type="radio"
                      name="formGender"
                      checked={formGender === 'M'}
                      onChange={() => setFormGender('M')}
                    />
                    <span>Fratello (M)</span>
                  </label>
                  <label className="chk ml-3">
                    <input
                      type="radio"
                      name="formGender"
                      checked={formGender === 'F'}
                      onChange={() => {
                        setFormGender('F');
                        handleApplyPreset('sorella');
                      }}
                    />
                    <span>Sorella (F)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="lbl block mb-1">Collega ad Anagrafica (Opzionale)</label>
                <select
                  value={formPersonId}
                  onChange={e => {
                    const selId = e.target.value;
                    setFormPersonId(selId);
                    if (selId && !formName) {
                      const p = congregationPeople.find(cp => cp.id === selId);
                      if (p) {
                        setFormName(p.name);
                        setFormGender(p.gender);
                      }
                    }
                  }}
                  className="inp text-sm"
                >
                  <option value="">-- Nessun collegamento --</option>
                  {congregationPeople.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.gender === 'M' ? 'Fratello' : 'Sorella'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Presets Buttons */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              <label className="lbl block mb-1.5 text-indigo-700 dark:text-indigo-300">
                Preset Rapidi Parti:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('anziano')}
                  className="px-2.5 py-1 text-xs font-semibold bg-purple-100 hover:bg-purple-200 text-purple-900 dark:bg-purple-950/80 dark:text-purple-300 rounded-md transition-colors"
                >
                  ⭐ Anziano (Tutti i ruoli)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('servitore')}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-100 hover:bg-blue-200 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 rounded-md transition-colors"
                >
                  👔 Servitore di ministero
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('fratello')}
                  className="px-2.5 py-1 text-xs font-semibold bg-sky-100 hover:bg-sky-200 text-sky-900 dark:bg-sky-950/80 dark:text-sky-300 rounded-md transition-colors"
                >
                  📖 Fratello Proclamatore
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('sorella')}
                  className="px-2.5 py-1 text-xs font-semibold bg-pink-100 hover:bg-pink-200 text-pink-900 dark:bg-pink-950/80 dark:text-pink-300 rounded-md transition-colors"
                >
                  🌸 Sorella Proclamatrice
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('assistente')}
                  className="px-2.5 py-1 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 rounded-md transition-colors"
                >
                  🤝 Solo Assistente (Esercitazioni)
                </button>
              </div>
            </div>

            {/* Role Checkboxes Matrix */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              <label className="lbl block mb-2 text-indigo-900 dark:text-indigo-200">
                Seleziona le singole parti abilitate per {formName || 'il proclamatore'}:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {/* Presidente */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.presidente ? 'bg-indigo-100/70 border-indigo-300 text-indigo-950 font-bold dark:bg-indigo-950/80 dark:border-indigo-700 dark:text-indigo-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formPersonId ? !!congregationPeople.find(person => person.id === formPersonId)?.roles.presidenteInfrasettimanale : formRoles.presidente}
                    disabled={!!formPersonId}
                    title={formPersonId ? 'Modifica questa abilitazione nell’anagrafica generale' : undefined}
                    onChange={e => setFormRoles({ ...formRoles, presidente: e.target.checked })}
                    className="accent-indigo-600 w-4 h-4 rounded"
                  />
                  <span>Presidente adunanza infrasettimanale{formPersonId && ' (anagrafica)'}</span>
                </label>

                {/* Preghiera */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.preghiera ? 'bg-indigo-100/70 border-indigo-300 text-indigo-950 font-bold dark:bg-indigo-950/80 dark:border-indigo-700 dark:text-indigo-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.preghiera}
                    onChange={e => setFormRoles({ ...formRoles, preghiera: e.target.checked })}
                    className="accent-indigo-600 w-4 h-4 rounded"
                  />
                  <span>Preghiera (Iniziale / Finale)</span>
                </label>

                {/* Tesori Discorso */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.tesoriDiscorso ? 'bg-teal-100/70 border-teal-300 text-teal-950 font-bold dark:bg-teal-950/80 dark:border-teal-700 dark:text-teal-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.tesoriDiscorso}
                    onChange={e => setFormRoles({ ...formRoles, tesoriDiscorso: e.target.checked })}
                    className="accent-teal-600 w-4 h-4 rounded"
                  />
                  <span>Tesori: Discorso 10 min</span>
                </label>

                {/* Tesori Gemme */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.tesoriGemme ? 'bg-teal-100/70 border-teal-300 text-teal-950 font-bold dark:bg-teal-950/80 dark:border-teal-700 dark:text-teal-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.tesoriGemme}
                    onChange={e => setFormRoles({ ...formRoles, tesoriGemme: e.target.checked })}
                    className="accent-teal-600 w-4 h-4 rounded"
                  />
                  <span>Tesori: Gemme Spirituali 10 min</span>
                </label>

                {/* Tesori Lettura biblica */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.tesoriLettura ? 'bg-teal-100/70 border-teal-300 text-teal-950 font-bold dark:bg-teal-950/80 dark:border-teal-700 dark:text-teal-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.tesoriLettura}
                    onChange={e => setFormRoles({ ...formRoles, tesoriLettura: e.target.checked })}
                    className="accent-teal-600 w-4 h-4 rounded"
                  />
                  <span>Tesori: Lettura biblica 4 min</span>
                </label>

                {/* Ministero: Studente / Titolare */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.ministeroStudente ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold dark:bg-amber-950/80 dark:border-amber-700 dark:text-amber-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.ministeroStudente}
                    onChange={e => setFormRoles({
                      ...formRoles,
                      ministeroStudente: e.target.checked,
                      ministeroTipiAbilitati: e.target.checked ? formRoles.ministeroTipiAbilitati : [],
                    })}
                    className="accent-amber-600 w-4 h-4 rounded"
                  />
                  <span>Ministero: Studente / Titolare</span>
                </label>

                {/* Ministero: Assistente */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.ministeroAssistente ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold dark:bg-amber-950/80 dark:border-amber-700 dark:text-amber-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.ministeroAssistente}
                    onChange={e => setFormRoles({ ...formRoles, ministeroAssistente: e.target.checked })}
                    className="accent-amber-600 w-4 h-4 rounded"
                  />
                  <span>Ministero: Assistente</span>
                </label>

                {/* Vita Cristiana parti */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.vitaCristianaParti ? 'bg-rose-100/70 border-rose-300 text-rose-950 font-bold dark:bg-rose-950/80 dark:border-rose-700 dark:text-rose-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.vitaCristianaParti}
                    onChange={e => setFormRoles({ ...formRoles, vitaCristianaParti: e.target.checked })}
                    className="accent-rose-600 w-4 h-4 rounded"
                  />
                  <span>Vita Cristiana: Parti / Bisogni locali</span>
                </label>

                {/* Studio biblico Conduttore */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.studioBiblicoConduttore ? 'bg-rose-100/70 border-rose-300 text-rose-950 font-bold dark:bg-rose-950/80 dark:border-rose-700 dark:text-rose-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.studioBiblicoConduttore}
                    onChange={e => setFormRoles({ ...formRoles, studioBiblicoConduttore: e.target.checked })}
                    className="accent-rose-600 w-4 h-4 rounded"
                  />
                  <span>Studio Biblico: Conduttore</span>
                </label>

                {/* Studio biblico Lettore */}
                <label className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                  formRoles.studioBiblicoLettore ? 'bg-rose-100/70 border-rose-300 text-rose-950 font-bold dark:bg-rose-950/80 dark:border-rose-700 dark:text-rose-200' : 'bg-white/60 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={formRoles.studioBiblicoLettore}
                    onChange={e => setFormRoles({ ...formRoles, studioBiblicoLettore: e.target.checked })}
                    className="accent-rose-600 w-4 h-4 rounded"
                  />
                  <span>Studio Biblico: Lettore</span>
                </label>
              </div>
            </div>

            {/* Tipi di parte Ministero abilitati (criteri: durata, formato, ecc.) */}
            {formRoles.ministeroStudente && (
              <MinisteroPartTypesPicker
                partTypes={ministeroPartTypes}
                selectedIds={formRoles.ministeroTipiAbilitati || []}
                onChange={ids => setFormRoles({ ...formRoles, ministeroTipiAbilitati: ids })}
                onAddCustomPartType={onAddCustomPartType}
                onRemoveCustomPartType={onRemoveCustomPartType}
              />
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg"
                >
                  Annulla
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {editingId ? 'Salva Modifiche' : 'Aggiungi Proclamatore'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca per nome..."
            className="inp pl-9 text-xs py-1.5"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Gender Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setGenderFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                genderFilter === 'all' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tutti ({participants.length})
            </button>
            <button
              onClick={() => setGenderFilter('M')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                genderFilter === 'M' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Fratelli ({participants.filter(p => p.gender === 'M').length})
            </button>
            <button
              onClick={() => setGenderFilter('F')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                genderFilter === 'F' ? 'bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-400 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sorelle ({participants.filter(p => p.gender === 'F').length})
            </button>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="inp text-xs py-1.5 px-2.5 max-w-[180px]"
          >
            <option value="all">Filtra per parte: Tutte</option>
            <option value="presidente">Presidente</option>
            <option value="preghiera">Preghiere</option>
            <option value="tesoriDiscorso">Tesori: Discorso 10m</option>
            <option value="tesoriGemme">Tesori: Gemme</option>
            <option value="tesoriLettura">Tesori: Lettura</option>
            <option value="ministeroStudente">Ministero: Studente</option>
            <option value="ministeroAssistente">Ministero: Assistente</option>
            <option value="vitaCristianaParti">Vita Cristiana</option>
            <option value="studioBiblicoConduttore">Studio: Conduttore</option>
            <option value="studioBiblicoLettore">Studio: Lettore</option>
          </select>
        </div>
      </div>

      {/* Participants Table */}
      <div className="card p-0 overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4">Proclamatore</th>
                <th className="py-3 px-3">Genere</th>
                <th className="py-3 px-3">Parti Abilitate</th>
                {isAdmin && <th className="py-3 px-4 text-right">Azioni</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-slate-500">
                    Nessun proclamatore trovato con i criteri di ricerca correnti.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const roles = p.roles;
                  const enabledCount = Object.values(roles).filter(Boolean).length;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </div>
                        {p.notes && (
                          <div className="text-[11px] text-slate-400 italic">
                            {p.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.gender === 'M'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                              : 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300'
                          }`}
                        >
                          {p.gender === 'M' ? 'Fratello' : 'Sorella'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {roles.presidente && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                              Presidente
                            </span>
                          )}
                          {roles.preghiera && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                              Preghiera
                            </span>
                          )}
                          {roles.tesoriDiscorso && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-[10px] font-semibold">
                              Tesori 10m
                            </span>
                          )}
                          {roles.tesoriGemme && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-[10px] font-semibold">
                              Gemme
                            </span>
                          )}
                          {roles.tesoriLettura && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-[10px] font-semibold">
                              Lettura biblica
                            </span>
                          )}
                          {roles.ministeroStudente && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                              Studente
                              {roles.ministeroTipiAbilitati && roles.ministeroTipiAbilitati.length > 0 && (
                                <span className="font-normal opacity-80">
                                  {' '}
                                  (
                                  {roles.ministeroTipiAbilitati
                                    .map(id => ministeroPartTypes.find(pt => pt.id === id)?.label || id)
                                    .join(', ')}
                                  )
                                </span>
                              )}
                            </span>
                          )}
                          {roles.ministeroAssistente && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                              Assistente
                            </span>
                          )}
                          {roles.vitaCristianaParti && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[10px] font-semibold">
                              Vita Cristiana
                            </span>
                          )}
                          {roles.studioBiblicoConduttore && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[10px] font-semibold">
                              Studio Conduttore
                            </span>
                          )}
                          {roles.studioBiblicoLettore && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[10px] font-semibold">
                              Studio Lettore
                            </span>
                          )}
                          {enabledCount === 0 && (
                            <span className="text-slate-400 italic text-[11px]">
                              Nessuna parte abilitata
                            </span>
                          )}
                        </div>
                      </td>

                      {isAdmin && (
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                handleEdit(p);
                                document.getElementById('participant-form-section')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="Modifica ruoli"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/60"
                              title="Elimina"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal di Conferma Eliminazione Partecipante */}
      {participantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Elimina nominativo
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Sei sicuro di voler eliminare <span className="font-semibold text-slate-900 dark:text-slate-100">{participantToDelete.name}</span> dalla lista dei partecipanti di Vita e Ministero?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setParticipantToDelete(null)}
                className="btn-ghost text-xs"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="btn-danger text-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
