/** Monday heading for a monthly week; legacy Sunday headings shift forward one day. */
export function mensileWeekStart(value) {
  const date = value instanceof Date ? new Date(value.getTime())
    : new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value);
  if (Number.isNaN(date.getTime())) return date;
  date.setHours(12, 0, 0, 0);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? 1 : 1 - weekday));
  return date;
}

export function mondayDates(year, month) {
  const result = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day, 12);
    if (date.getDay() === 1) result.push(date);
  }
  return result;
}
