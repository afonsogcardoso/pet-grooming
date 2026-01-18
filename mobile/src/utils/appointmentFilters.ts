import type { Appointment } from "../api/appointments";

export type AppointmentFilterMode = "upcoming" | "past" | "unpaid";

export function toDayKey(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE");
}

export function getAppointmentDateTime(
  appointment: Appointment,
  dayKey: string,
) {
  const timeValue = appointment.appointment_time;
  if (!timeValue) return null;
  const match = String(timeValue).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, hh, mm] = match;
  return new Date(`${dayKey}T${hh.padStart(2, "0")}:${mm}:00`);
}

export function filterAppointmentsByMode({
  items,
  mode,
  today,
  isUnpaidPastOrCompleted,
  pendingOnly,
  now: nowOverride,
}: {
  items: Appointment[];
  mode: AppointmentFilterMode;
  today: string;
  isUnpaidPastOrCompleted: (appointment: Appointment, now: Date) => boolean;
  pendingOnly?: boolean;
  now?: Date;
}) {
  const now = nowOverride ?? new Date();
  const todayKey = today;

  return items.filter((item) => {
    if (pendingOnly && item.status !== "pending") return false;

    if (mode === "unpaid") {
      return isUnpaidPastOrCompleted(item, now);
    }

    const dayKey = toDayKey(item.appointment_date);
    if (!dayKey) return false;

    if (mode === "upcoming") {
      if (item.status === "completed" || item.status === "cancelled")
        return false;
      if (dayKey > todayKey) return true;
      if (dayKey < todayKey) {
        return item.status === "in_progress" || item.status === "confirmed";
      }
      const dateTime = getAppointmentDateTime(item, dayKey);
      if (!dateTime) return true;
      return dateTime >= now || item.status === "in_progress";
    }

    if (mode === "past") {
      if (dayKey < todayKey) return true;
      if (dayKey > todayKey) return false;
      const dateTime = getAppointmentDateTime(item, dayKey);
      if (!dateTime) return false;
      return dateTime < now;
    }

    return true;
  });
}

export function sortAppointmentsByDateTimeAsc(items: Appointment[]) {
  return [...items].sort((a, b) => {
    const dayA = toDayKey(a.appointment_date);
    const dayB = toDayKey(b.appointment_date);
    if (!dayA || !dayB) return 0;
    const dateA = getAppointmentDateTime(a, dayA) ?? new Date(`${dayA}T00:00:00`);
    const dateB = getAppointmentDateTime(b, dayB) ?? new Date(`${dayB}T00:00:00`);
    return dateA.getTime() - dateB.getTime();
  });
}
