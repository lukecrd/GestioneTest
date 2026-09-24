import {
  VitaEMinisteroMeeting,
  VitaEMinisteroParticipant,
  VitaEMinisteroParticipantRoles,
} from '../types';

export type VitaRoleCategory =
  | 'presidente'
  | 'preghiera'
  | 'tesoriDiscorso'
  | 'tesoriGemme'
  | 'tesoriLettura'
  | 'ministeroStudente'
  | 'ministeroAssistente'
  | 'vitaCristianaParti'
  | 'studioBiblicoConduttore'
  | 'studioBiblicoLettore';

export interface VitaAssignmentItem {
  meetingId: string;
  dateStr: string;
  dateLabel: string;
  roleCategory: VitaRoleCategory;
  roleLabel: string;
  partTitle: string;
}

export interface ParticipantVitaStats {
  participantId: string;
  name: string;
  gender: 'M' | 'F';
  roles: VitaEMinisteroParticipantRoles;
  totalAssignments: number;
  lastAssignmentDate: string | null; // e.g. "2026-10-26"
  lastAssignmentLabel: string; // e.g. "26 ott 2026"
  lastAssignmentPart: string; // e.g. "Gemme spirituali"
  daysSinceLastAssignment: number | null;
  assignments: VitaAssignmentItem[]; // sorted descending by date
  roleCounts: Record<VitaRoleCategory, number>;
}

export const VITA_ROLE_LABELS: Record<VitaRoleCategory, string> = {
  presidente: 'Presidente',
  preghiera: 'Preghiera',
  tesoriDiscorso: 'Tesori: Discorso',
  tesoriGemme: 'Tesori: Gemme spirituali',
  tesoriLettura: 'Tesori: Lettura biblica',
  ministeroStudente: 'Ministero: Studente',
  ministeroAssistente: 'Ministero: Assistente',
  vitaCristianaParti: 'Vita Cristiana: Parti',
  studioBiblicoConduttore: 'Studio Biblico: Conduttore',
  studioBiblicoLettore: 'Studio Biblico: Lettore',
};

/**
 * Computes comprehensive assignment stats for all participants
 */
export function computeVitaStats(
  participants: VitaEMinisteroParticipant[],
  meetings: VitaEMinisteroMeeting[],
  referenceDate: Date = new Date()
): Map<string, ParticipantVitaStats> {
  const statsMap = new Map<string, ParticipantVitaStats>();

  // Initialize for all participants
  participants.forEach(p => {
    statsMap.set(p.id, {
      participantId: p.id,
      name: p.name,
      gender: p.gender,
      roles: p.roles,
      totalAssignments: 0,
      lastAssignmentDate: null,
      lastAssignmentLabel: 'Mai assegnato',
      lastAssignmentPart: '',
      daysSinceLastAssignment: null,
      assignments: [],
      roleCounts: {
        presidente: 0,
        preghiera: 0,
        tesoriDiscorso: 0,
        tesoriGemme: 0,
        tesoriLettura: 0,
        ministeroStudente: 0,
        ministeroAssistente: 0,
        vitaCristianaParti: 0,
        studioBiblicoConduttore: 0,
        studioBiblicoLettore: 0,
      },
    });
  });

  // Helper to record an assignment
  const recordAssignment = (
    personId: string | undefined | null,
    meeting: VitaEMinisteroMeeting,
    roleCategory: VitaRoleCategory,
    partTitle: string
  ) => {
    if (!personId) return;
    const stat = statsMap.get(personId);
    if (!stat) return;

    stat.totalAssignments += 1;
    stat.roleCounts[roleCategory] += 1;

    stat.assignments.push({
      meetingId: meeting.id,
      dateStr: meeting.dateStr || '',
      dateLabel: meeting.dateLabel || meeting.dateStr || '',
      roleCategory,
      roleLabel: VITA_ROLE_LABELS[roleCategory] || roleCategory,
      partTitle,
    });
  };

  // Traverse all meetings
  meetings.forEach(meeting => {
    if (meeting.isSpecialEvent) return; // Skip special events without regular parts

    // 1. Presidente
    if (meeting.presidenteId) {
      recordAssignment(meeting.presidenteId, meeting, 'presidente', 'Presidente adunanza');
    }

    // 2. Preghiera Iniziale
    if (meeting.preghieraInizialeId) {
      recordAssignment(meeting.preghieraInizialeId, meeting, 'preghiera', 'Preghiera iniziale');
    }

    // 3. Tesori - Discorso
    if (meeting.tesori1SpeakerId) {
      recordAssignment(
        meeting.tesori1SpeakerId,
        meeting,
        'tesoriDiscorso',
        meeting.tesori1Title || 'Discorso Tesori'
      );
    }

    // 4. Tesori - Gemme
    if (meeting.tesoriGemmeSpeakerId) {
      recordAssignment(
        meeting.tesoriGemmeSpeakerId,
        meeting,
        'tesoriGemme',
        meeting.tesoriGemmeTitle || 'Gemme spirituali'
      );
    }

    // 5. Tesori - Lettura
    if (meeting.tesoriLetturaReaderId) {
      recordAssignment(
        meeting.tesoriLetturaReaderId,
        meeting,
        'tesoriLettura',
        meeting.tesoriLetturaTitle || 'Lettura biblica'
      );
    }

    // 6. Efficaci nel ministero
    (meeting.ministeroParts || []).forEach(part => {
      if (part.studentId) {
        recordAssignment(
          part.studentId,
          meeting,
          'ministeroStudente',
          `${part.number}. ${part.title} (Studente)`
        );
      }
      if (part.hasAssistant && part.assistantId) {
        recordAssignment(
          part.assistantId,
          meeting,
          'ministeroAssistente',
          `${part.number}. ${part.title} (Assistente)`
        );
      }
    });

    // 7. Vita Cristiana parti
    (meeting.vitaCristianaParts || []).forEach(part => {
      if (part.speakerId) {
        recordAssignment(
          part.speakerId,
          meeting,
          'vitaCristianaParti',
          `${part.number}. ${part.title}`
        );
      }
    });

    // 8. Studio Biblico di Congregazione
    if (meeting.studioBiblicoConductorId) {
      recordAssignment(
        meeting.studioBiblicoConductorId,
        meeting,
        'studioBiblicoConduttore',
        'Studio biblico di congregazione (Conduttore)'
      );
    }
    if (meeting.studioBiblicoReaderId) {
      recordAssignment(
        meeting.studioBiblicoReaderId,
        meeting,
        'studioBiblicoLettore',
        'Studio biblico di congregazione (Lettore)'
      );
    }

    // 9. Preghiera Finale
    if (meeting.preghieraFinaleId) {
      recordAssignment(meeting.preghieraFinaleId, meeting, 'preghiera', 'Preghiera finale');
    }
  });

  // Post-process assignments: sort descending by dateStr to determine lastAssignmentDate
  statsMap.forEach(stat => {
    stat.assignments.sort((a, b) => (b.dateStr || '').localeCompare(a.dateStr || ''));

    if (stat.assignments.length > 0) {
      const mostRecent = stat.assignments[0];
      stat.lastAssignmentDate = mostRecent.dateStr;
      stat.lastAssignmentLabel = mostRecent.dateLabel;
      stat.lastAssignmentPart = mostRecent.partTitle;

      if (mostRecent.dateStr) {
        const parts = mostRecent.dateStr.split('-');
        if (parts.length === 3) {
          const assignDate = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10)
          );
          const diffMs = referenceDate.getTime() - assignDate.getTime();
          stat.daysSinceLastAssignment = Math.round(diffMs / (1000 * 60 * 60 * 24));
        }
      }
    }
  });

  return statsMap;
}

/**
 * Comparator implementing the user's rule:
 * "In base all'ultima data di assegnazione gli utenti scendono in basso nella lista della statistica e vengono selezionati come ultimi"
 *
 * 1. Participants with NO assignment date (never assigned) appear at the TOP (highest priority).
 * 2. Participants with an older assignment date appear before those with a more recent assignment date.
 * 3. Participants who were assigned most recently (latest date) SINK TO THE BOTTOM.
 * 4. Tie-breakers: lower total assignments count, then alphabetical name.
 */
export function compareParticipantsByLastAssignmentAsc(
  a: VitaEMinisteroParticipant,
  b: VitaEMinisteroParticipant,
  statsMap: Map<string, ParticipantVitaStats>
): number {
  const statsA = statsMap.get(a.id);
  const statsB = statsMap.get(b.id);

  const dateA = statsA?.lastAssignmentDate || '';
  const dateB = statsB?.lastAssignmentDate || '';

  // 1) Never assigned goes to the TOP
  if (!dateA && dateB) return -1;
  if (dateA && !dateB) return 1;

  // 2) Ascending order of date: older dates come first; newest dates come last (sink to the bottom)
  if (dateA && dateB && dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  // 3) Lower total assignments first
  const countA = statsA?.totalAssignments || 0;
  const countB = statsB?.totalAssignments || 0;
  if (countA !== countB) {
    return countA - countB;
  }

  // 4) Alphabetical by name
  return a.name.localeCompare(b.name);
}
