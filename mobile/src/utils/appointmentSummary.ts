import type { Appointment } from '../api/appointments';

type AppointmentServiceEntry = NonNullable<Appointment['appointment_services']>[number];

export function getAppointmentServiceEntries(appointment: Appointment): AppointmentServiceEntry[] {
  return Array.isArray(appointment.appointment_services) ? appointment.appointment_services : [];
}

export function getAppointmentPetNames(
  appointment: Appointment,
  entries: AppointmentServiceEntry[] = getAppointmentServiceEntries(appointment),
): string[] {
  const names: string[] = [];
  if (appointment.pets?.name) names.push(appointment.pets.name);
  entries.forEach((entry) => {
    if (entry.pets?.name) names.push(entry.pets.name);
  });
  return Array.from(new Set(names));
}

export function formatPetLabel(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

export function formatServiceLabels(entries: AppointmentServiceEntry[]): string[] {
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const name = entry.services?.name;
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([name, count]) => (count > 1 ? `${name} x${count}` : name));
}
