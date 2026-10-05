import type { MinisteroPartTypeDef, VitaEMinisteroParticipantRoles } from '../types.js';

// Lista fissa di base. Non rimovibile dall'amministratore (isDefault: true),
// ma può essere estesa con nuovi tipi tramite VitaEMinisteroData.ministeroPartTypes.
export const DEFAULT_MINISTERO_PART_TYPES: MinisteroPartTypeDef[] = [
  { id: 'breve', label: 'Durata breve (fino a 3 min)', isDefault: true },
  { id: 'lunga', label: 'Durata più lunga (4+ min)', isDefault: true },
  { id: 'dimostrazione', label: 'Dimostrazione (con assistente)', isDefault: true },
  { id: 'discorso', label: 'Discorso (senza assistente)', isDefault: true },
  { id: 'primi_passi', label: 'Solo lettura/copione (primi passi)', isDefault: true },
];

/**
 * Combina la lista fissa con i tipi personalizzati aggiunti dall'amministratore.
 */
export function getEffectivePartTypes(customTypes?: MinisteroPartTypeDef[] | null): MinisteroPartTypeDef[] {
  if (!customTypes || customTypes.length === 0) return DEFAULT_MINISTERO_PART_TYPES;
  return [...DEFAULT_MINISTERO_PART_TYPES, ...customTypes];
}

/**
 * Genera un id stabile per un nuovo tipo di parte personalizzato a partire dall'etichetta.
 */
export function slugifyPartTypeLabel(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove accenti
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base || 'tipo'}_${suffix}`;
}

/**
 * Inferisce automaticamente i tipi di parte in base a durata e formato.
 * "Solo lettura/copione" non viene mai dedotto automaticamente: è un criterio
 * che l'amministratore assegna manualmente alle parti adatte ai primi passi.
 */
export function inferPartTypeIds(minutes: number, hasAssistant: boolean): string[] {
  const ids: string[] = [];
  ids.push(minutes <= 3 ? 'breve' : 'lunga');
  ids.push(hasAssistant ? 'dimostrazione' : 'discorso');
  return ids;
}

/**
 * Determina se un proclamatore è idoneo per una parte con i tipi indicati.
 * Retrocompatibilità: se il proclamatore non ha restrizioni configurate
 * (ministeroTipiAbilitati assente o vuoto) è considerato idoneo per qualunque tipo.
 */
export function isParticipantEligibleForPartTypes(
  roles: VitaEMinisteroParticipantRoles,
  requiredPartTypeIds?: string[] | null
): boolean {
  const enabled = roles.ministeroTipiAbilitati;
  if (!enabled || enabled.length === 0) return true; // nessuna restrizione impostata
  if (!requiredPartTypeIds || requiredPartTypeIds.length === 0) return true; // parte senza tag = nessun vincolo
  return requiredPartTypeIds.every(id => enabled.includes(id));
}
