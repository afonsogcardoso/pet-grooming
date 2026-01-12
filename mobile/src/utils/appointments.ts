export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

export function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export function currentLocalTime() {
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatHHMM(value?: string | null) {
  if (!value) return '';
  const safe = value.trim();
  const parts = safe.split(':');
  if (parts.length >= 2) {
    const hh = `${parts[0]}`.padStart(2, '0');
    const mm = `${parts[1]}`.padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return safe.slice(0, 5);
}

export function parseAmountInput(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const sanitized = normalized.replace(/[^0-9.]/g, '');
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeReminderOffsets(value: unknown, fallback: number[] = [30]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.round(entry))
    .filter((entry) => entry > 0 && entry <= 1440);
  const unique = Array.from(new Set(normalized)).sort((a, b) => a - b);
  return unique.length ? unique.slice(0, 2) : fallback;
}

export function formatReminderOffsetLabel(
  offset: number,
  t: (key: string, options?: any) => string
) {
  if (offset % 1440 === 0) {
    const days = offset / 1440;
    return `${days} ${days === 1 ? t('common.dayShort') : t('common.daysShort')}`;
  }
  if (offset % 60 === 0) {
    const hours = offset / 60;
    return `${hours} ${hours === 1 ? t('common.hourShort') : t('common.hoursShort')}`;
  }
  return `${offset} ${t('common.minutesShort')}`;
}

function getICalByDayFromDate(value?: string) {
  if (!value) return null;
  const safe = new Date(`${value}T00:00:00`);
  if (Number.isNaN(safe.getTime())) return null;
  const weekday = safe.getDay();
  const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return map[weekday] || null;
}

export function buildRecurrenceRule(opts: { frequency: RecurrenceFrequency; date?: string }) {
  const { frequency, date } = opts;
  const byDay = getICalByDayFromDate(date || undefined);
  const baseDay = date ? new Date(`${date}T00:00:00`) : null;
  const dayOfMonth = baseDay && !Number.isNaN(baseDay.getTime()) ? baseDay.getDate() : null;

  if (frequency === 'weekly') {
    if (!byDay) return null;
    return `FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDay}`;
  }
  if (frequency === 'biweekly') {
    if (!byDay) return null;
    return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${byDay}`;
  }
  if (frequency === 'monthly') {
    if (!dayOfMonth) return null;
    return `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${dayOfMonth}`;
  }
  return null;
}
