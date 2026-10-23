const ZONE = 'Europe/Zurich';

const timeFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const weekdayFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  weekday: 'short',
});

const dayMonthFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
});

const dayMonthShortYearFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

const dayMonthYearFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dayPartsFormat = new Intl.DateTimeFormat('de-CH', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const MS_PER_DAY = 86_400_000;

/** Kalendertag (Europe/Zurich) als fortlaufende Tagesnummer. */
function calendarDay(date: Date): number {
  const parts = dayPartsFormat.formatToParts(date);
  const year = Number(partValue(parts, 'year'));
  const month = Number(partValue(parts, 'month'));
  const day = Number(partValue(parts, 'day'));
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '0';
}

/** Ganze Kalendertage zwischen zwei Zeitpunkten (positiv = `now` ist neuer). */
function daysBetween(now: Date, then: Date): number {
  return calendarDay(now) - calendarDay(then);
}

/** Wochentag kurz („Mo.“). */
function weekdayShort(date: Date): string {
  const weekday = weekdayFormat.format(date);
  return weekday.endsWith('.') ? weekday : `${weekday}.`;
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatListTime(iso: string, now: Date): string {
  const date = new Date(iso);
  const days = daysBetween(now, date);
  if (days === 0) {
    return timeFormat.format(date);
  }
  if (days === 1) {
    return 'Gestern';
  }
  if (days > 1 && days <= 7) {
    return weekdayShort(date);
  }
  return dayMonthShortYearFormat.format(date);
}

export function formatLastSeen(iso: string | null, now: Date): string {
  if (iso === null) {
    return 'noch nie empfangen';
  }
  const date = new Date(iso);
  const days = daysBetween(now, date);
  if (days === 0) {
    return `zuletzt ${timeFormat.format(date)}`;
  }
  if (days === 1) {
    return 'zuletzt gestern';
  }
  return `zuletzt ${dayMonthFormat.format(date)}`;
}

export function formatDay(iso: string, now: Date): string {
  const date = new Date(iso);
  const days = daysBetween(now, date);
  if (days === 0) {
    return 'HEUTE';
  }
  if (days === 1) {
    return 'GESTERN';
  }
  return dayMonthYearFormat.format(date);
}
