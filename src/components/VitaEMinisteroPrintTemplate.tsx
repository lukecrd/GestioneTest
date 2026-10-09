import React from 'react';
import type { VitaEMinisteroMeeting, VitaEMinisteroParticipant } from '../types';
import './VitaEMinisteroPrintTemplate.css';

export function VitaEMinisteroPrintTemplate({ meetings, participants, congregation }: {
  meetings: VitaEMinisteroMeeting[];
  participants: VitaEMinisteroParticipant[];
  congregation: string;
}) {
  const name = (id?: string) => participants.find(p => p.id === id)?.name || '';
  const names = (...ids: (string | undefined)[]) => ids.map(name).filter(Boolean).join(' / ');
  const pages = Array.from({ length: Math.ceil(meetings.length / 2) }, (_, i) => meetings.slice(i * 2, i * 2 + 2));
  const line = (title: string, assigned = '', key?: string) => <tr className="vm-line" key={key}><td colSpan={2}>{title}</td><td>{assigned}</td></tr>;
  const section = (title: string, kind: string) => <><tr className="vm-gap"><td colSpan={3} /></tr><tr className={`vm-section vm-section--${kind}`}><td colSpan={3}>{title}</td></tr></>;
  return <div className="excel-ministry vm-program">
    {pages.map((page, pageIndex) => <div className="vm-page" key={pageIndex}>
      <table className="vm-table">
        <colgroup><col style={{ width: '50.5%' }} /><col style={{ width: '8%' }} /><col style={{ width: '41.5%' }} /></colgroup>
        <thead><tr className="vm-heading"><th>{congregation}</th><th colSpan={2}>Adunanza infrasettimanale</th></tr></thead>
        {page.map((m, index) => <tbody className={`vm-meeting${index ? ' vm-meeting--next' : ''}`} key={m.id}>
          <tr className="vm-date"><td>{m.dateLabel} | <span>{m.bibleReading}</span></td><td className="vm-role">{!m.isSpecialEvent && 'Presidente'}</td><td>{!m.isSpecialEvent && name(m.presidenteId)}</td></tr>
          {m.isSpecialEvent ? <tr className="vm-event"><td colSpan={3}>{m.specialEventTitle || 'Assemblea di circoscrizione'}</td></tr> : <>
            <tr className="vm-line"><td>{m.canticoIniziale || ''}</td><td className="vm-role">Preghiera</td><td>{name(m.preghieraInizialeId)}</td></tr>
            {line('Commenti introduttivi')}
            {section('TESORI DELLA PAROLA DI DIO', 'treasures')}
            {m.tesori1Title && line(`1. ${m.tesori1Title} (${m.tesori1Minutes || 10} min)`, name(m.tesori1SpeakerId))}
            {line(`2. ${m.tesoriGemmeTitle || 'Gemme spirituali'} (${m.tesoriGemmeMinutes || 10} min)`, name(m.tesoriGemmeSpeakerId))}
            {line(`3. ${m.tesoriLetturaTitle || 'Lettura biblica'} (${m.tesoriLetturaMinutes || 4} min)`, name(m.tesoriLetturaReaderId))}
            {section('EFFICACI NEL MINISTERO', 'ministry')}
            {(m.ministeroParts || []).map(p => line(`${p.number}. ${p.title} (${p.minutes} min)`, names(p.studentId, p.hasAssistant ? p.assistantId : undefined), p.id))}
            {section('VITA CRISTIANA', 'life')}
            {line(m.canticoIntermedio || '')}
            {(m.vitaCristianaParts || []).map(p => line(`${p.number}. ${p.title} (${p.minutes} min)`, name(p.speakerId), p.id))}
            {line(`${Math.max(3, ...(m.ministeroParts || []).map(p => p.number), ...(m.vitaCristianaParts || []).map(p => p.number)) + 1}. ${m.studioBiblicoType === 'discorsoSorvegliante' ? `Discorso del sorvegliante${m.discorsoSorveglianteTitle?.trim() ? `: ${m.discorsoSorveglianteTitle.trim()}` : ''}` : m.studioBiblicoTitle || 'Studio biblico di congregazione'} (${m.studioBiblicoMinutes || 30} min)`, m.studioBiblicoType === 'discorsoSorvegliante' ? 'Sorvegliante di circoscrizione' : names(m.studioBiblicoConductorId, m.studioBiblicoReaderId))}
            {line('Commenti conclusivi')}
            <tr className="vm-line vm-finale"><td>{m.canticoFinale || ''}</td><td className="vm-role">Preghiera</td><td>{name(m.preghieraFinaleId)}</td></tr>
          </>}
        </tbody>)}
      </table>
    </div>)}
  </div>;
}