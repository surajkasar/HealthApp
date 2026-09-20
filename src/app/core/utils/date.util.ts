import { formatInTimeZone } from 'date-fns-tz';
import { addDays, parseISO } from 'date-fns';
import { environment } from '../../../environments/environment';

const TZ = environment.timezone;

export function todayInAppTz(date: Date = new Date()): string {
  return formatInTimeZone(date, TZ, 'yyyy-MM-dd');
}

export function formatDisplayDate(dateStr: string): string {
  return formatInTimeZone(parseISO(`${dateStr}T12:00:00`), TZ, 'EEE, d MMM yyyy');
}

export function shiftDate(dateStr: string, days: number): string {
  return formatInTimeZone(
    addDays(parseISO(`${dateStr}T12:00:00`), days),
    TZ,
    'yyyy-MM-dd'
  );
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayInAppTz();
}

/** Inclusive range ending at `endDate`, length = days. */
export function dateRangeEnding(endDate: string, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(shiftDate(endDate, -i));
  }
  return out;
}

export function formatShortDate(dateStr: string): string {
  return formatInTimeZone(parseISO(`${dateStr}T12:00:00`), TZ, 'd MMM');
}
