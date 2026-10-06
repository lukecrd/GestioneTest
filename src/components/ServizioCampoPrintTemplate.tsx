import React from 'react';
import type { ServizioCampoMeetingAssignment, ServizioCampoDefaultSlotConfig } from '../types';
import './ServizioCampoPrintTemplate.css';

export const DEFAULT_FIELD_TOPIC = 'Usiamo Puoi vivere felice per sempre per iniziare studi';
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
type PrintMeeting = ServizioCampoMeetingAssignment & { conductorName: string; placeholder?: boolean };

function localDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function monday(date: Date) {
  const result = new Date(date);
  result.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return result;
}

export function groupFieldPrintWeeks(meetings: PrintMeeting[], year: number, month: number, defaults: Partial<Record<string, ServizioCampoDefaultSlotConfig>>) {
  const groups = new Map<string, { start: Date; meetings: PrintMeeting[] }>();
  for (const meeting of meetings) {
    const start = monday(localDate(meeting.dateStr));
    const key = iso(start);
    if (!groups.has(key)) groups.set(key, { start, meetings: [] });
    groups.get(key)!.meetings.push(meeting);
  }
  const slots = [{ day: 1, key: 'martediMattina' }, { day: 3, key: 'giovediMattina' }, { day: 5, key: 'sabatoPomeriggio' }, { day: 6, key: 'domenicaPomeriggio' }];
  for (const group of groups.values()) {
    for (const slot of slots) {
      const date = new Date(group.start);
      date.setDate(date.getDate() + slot.day);
      const dateStr = iso(date);
      if ((date.getFullYear() !== year || date.getMonth() !== month) && defaults[slot.key]?.active !== false && !group.meetings.some(m => m.dateStr === dateStr && m.slotKey === slot.key)) {
        group.meetings.push({ dateStr, slotKey: slot.key as PrintMeeting['slotKey'], dayOfWeek: 'martedi', timeSlot: 'mattina', time: defaults[slot.key]?.time || '', location: '', conductorId: null, conductorName: '', isActive: true, placeholder: true });
      }
    }
    group.meetings.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || a.time.localeCompare(b.time));
  }
  return [...groups.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function ServizioCampoPrintTemplate({ meetings, year, month, topic, defaults }: {
  meetings: PrintMeeting[];
  year: number;
  month: number;
  topic: string;
  defaults: Partial<Record<string, ServizioCampoDefaultSlotConfig>>;
}) {
  const weeks = groupFieldPrintWeeks(meetings, year, month, defaults);
  const monthLabel = MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1);
  return (
    <div className="excel-service field-service-print">
      <table className="field-service-table">
        <colgroup><col style={{ width: '11.35%' }} /><col style={{ width: '9.2%' }} /><col style={{ width: '19.7%' }} /><col style={{ width: '22%' }} /><col style={{ width: '37.75%' }} /></colgroup>
        <thead><tr className="field-service-banner-row"><td colSpan={5}><div className="field-service-banner">
        <img className="field-service-banner__background" src="/servizio-campo-sfondo.png" alt="" />
        <h1>Programma adunanze per il servizio di campo</h1>
        <h2>Mese di {monthLabel}</h2>
        <img className="field-service-banner__people" src="/servizio-campo-gruppo.jpg" alt="" />
      </div></td></tr><tr><th>Giorno</th><th>Ora</th><th>Conduttore</th><th>Luogo</th><th aria-label="Argomento" /></tr></thead>
        <tbody>
          <tr className="field-service-topic"><td colSpan={5}>Cosa trattare? {topic}</td></tr>
          {weeks.map(week => (
            <React.Fragment key={iso(week.start)}>
              <tr className="field-service-week"><td colSpan={5}>Settimana del {week.start.getDate()} {MONTHS[week.start.getMonth()]}</td></tr>
              {week.meetings.map((meeting, index) => {
                const special = meeting.isActive === false || (!!meeting.meetingType && meeting.meetingType !== 'standard');
                const description = meeting.placeholder ? '' : meeting.isActive === false
                  ? `Adunanza sospesa${meeting.specialNote ? `: ${meeting.specialNote}` : ''}`
                  : meeting.specialNote || meeting.notes || topic;
                return <tr className="field-service-meeting" key={meeting.id || `${meeting.dateStr}-${meeting.slotKey}-${index}`}>
                  <td>{DAYS[localDate(meeting.dateStr).getDay()]}</td>
                  <td>{meeting.time.replace(':', ',')}</td>
                  <td>{meeting.isActive === false ? '' : meeting.conductorName}</td>
                  <td>{meeting.isActive === false ? '' : meeting.location}</td>
                  <td className={special ? 'field-service-special' : 'field-service-description'}>{description}</td>
                </tr>;
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
