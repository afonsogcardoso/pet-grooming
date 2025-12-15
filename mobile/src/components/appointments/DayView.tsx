import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Pressable } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import type { Appointment } from '../../api/appointments';
import { getStatusColor } from '../../utils/appointmentStatus';

type DayViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string, time?: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hh, mm] = match;
    return `${hh.padStart(2, '0')}:${mm}`;
  }
  return value;
}

function formatDateLabel(date: Date) {
  try {
    const label = date.toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    // Capitaliza a primeira letra para melhor legibilidade
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return date.toLocaleDateString('sv-SE');
  }
}

const HOUR_HEIGHT = 60; // height per hour slot
const START_HOUR = 7;
const END_HOUR = 21;

function getTimeFromString(time?: string | null): { hour: number; minute: number } | null {
  if (!time) return null;
  const match = String(time).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return { hour: parseInt(match[1], 10), minute: parseInt(match[2], 10) };
  }
  return null;
}

function calculatePosition(appointmentTime?: string | null): number {
  const time = getTimeFromString(appointmentTime);
  if (!time) return 0;
  const hourOffset = time.hour - START_HOUR;
  const minuteOffset = time.minute / 60;
  return (hourOffset + minuteOffset) * HOUR_HEIGHT;
}

function toMinutes(time?: string | null): number | null {
  const parsed = getTimeFromString(time);
  if (!parsed) return null;
  return parsed.hour * 60 + parsed.minute;
}

function isSlotFree(dayAppointments: Appointment[], startMinutes: number, durationMinutes: number): boolean {
  const slotStart = startMinutes;
  const slotEnd = startMinutes + durationMinutes;
  return dayAppointments.every((apt) => {
    const aptStart = toMinutes(apt.appointment_time);
    const aptDuration = apt.duration ?? 60;
    if (aptStart === null) return true;
    const aptEnd = aptStart + aptDuration;
    return slotEnd <= aptStart || slotStart >= aptEnd;
  });
}

export function DayView({ 
  appointments, 
  selectedDate, 
  onDateChange, 
  onAppointmentPress,
  onNewAppointment,
  onRefresh,
  isRefreshing,
}: DayViewProps) {
  const { colors } = useBrandingTheme();

  const navigateDay = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    onDateChange(date);
  };

  const selectedDateStr = selectedDate.toLocaleDateString('sv-SE');

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    navButtonWrap: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonText: {
      fontSize: 18,
    },
    dateInfo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      pointerEvents: 'none',
    },
    dateLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'capitalize',
    },
    gridContainer: {
      flex: 1,
    },
    gridContent: {
      flexDirection: 'row',
    },
    timeColumn: {
      width: 60,
      paddingTop: 0,
    },
    hourRow: {
      height: HOUR_HEIGHT,
      justifyContent: 'flex-start',
      paddingTop: 4,
      paddingRight: 4,
    },
    hourText: {
      fontSize: 10,
      color: colors.muted,
      textAlign: 'right',
    },
    dayColumn: {
      flex: 1,
      borderLeftWidth: 1,
      borderLeftColor: colors.surfaceBorder,
      position: 'relative',
    },
    hourLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.surfaceBorder,
    },
    appointmentBlock: {
      position: 'absolute',
      left: 4,
      right: 4,
      backgroundColor: colors.surface,
      borderRadius: 6,
      padding: 6,
      borderLeftWidth: 4,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    appointmentTime: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text,
    },
    appointmentTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    appointmentService: {
      fontSize: 10,
      color: colors.muted,
    },
    emptySlot: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.muted,
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
  });

  // Filter appointments for the selected day
  const dayAppointments = appointments
    .filter((apt) => apt.appointment_date === selectedDateStr)
    .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));

  const handleCreateAtPosition = (offsetY: number) => {
    const totalMinutes = Math.min(
      Math.max(Math.floor((offsetY / HOUR_HEIGHT) * 60) + START_HOUR * 60, START_HOUR * 60),
      END_HOUR * 60 - 30,
    );
    const minutesRounded = totalMinutes - (totalMinutes % 30);
    const hh = `${Math.floor(minutesRounded / 60)}`.padStart(2, '0');
    const mm = `${minutesRounded % 60}`.padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    if (!isSlotFree(dayAppointments, minutesRounded, 60)) {
      Alert.alert('Indisponível', 'Já existe uma marcação neste horário.');
      return;
    }

    onNewAppointment(selectedDateStr, timeStr);
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <View style={styles.container}>
      <View style={styles.dateNav}>
        <View style={styles.navButtonWrap}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateDay('prev')}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateInfo}>
          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>
        </View>

        <View style={styles.navButtonWrap}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateDay('next')}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.gridContainer}>
        <View style={styles.gridContent}>
          {/* Time column */}
          <View style={styles.timeColumn}>
            {hours.map((hour) => (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourText}>{`${hour}:00`}</Text>
              </View>
            ))}
          </View>

          {/* Day column */}
          <Pressable style={styles.dayColumn} onPress={(e) => handleCreateAtPosition(e.nativeEvent.locationY)}>
            {hours.map((hour, index) => (
              <View key={hour} style={[styles.hourLine, { top: index * HOUR_HEIGHT }]} />
            ))}

            {dayAppointments.map((appointment) => {
              const topPosition = calculatePosition(appointment.appointment_time);
              const duration = appointment.duration || 60;
              const height = (duration / 60) * HOUR_HEIGHT - 4;
              return (
                <TouchableOpacity
                  key={appointment.id}
                  style={[
                    styles.appointmentBlock,
                    {
                      top: topPosition,
                      height: Math.max(height, 32),
                      borderLeftColor: getStatusColor(appointment.status),
                    },
                  ]}
                  onPress={() => onAppointmentPress(appointment)}
                >
                  <Text style={styles.appointmentTime} numberOfLines={1}>
                    {formatTime(appointment.appointment_time)}
                  </Text>
                  <Text style={styles.appointmentTitle} numberOfLines={1}>
                    {appointment.pets?.name}
                  </Text>
                  <Text style={styles.appointmentService} numberOfLines={1}>
                    {appointment.services?.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {dayAppointments.length === 0 ? (
              <View style={styles.emptySlot}>
                <Text style={styles.emptyIcon}>☀️</Text>
                <Text style={styles.emptyText}>Nenhuma marcação para este dia</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
