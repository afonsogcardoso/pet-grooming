import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import type { Appointment } from '../../api/appointments';

type DayViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string) => void;
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
    return date.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return date.toLocaleDateString('sv-SE');
  }
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

  const goToToday = () => {
    onDateChange(new Date());
  };

  const selectedDateStr = selectedDate.toLocaleDateString('sv-SE');
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const isToday = selectedDateStr === todayStr;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
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
      paddingHorizontal: 12,
    },
    dateLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'capitalize',
    },
    todayButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    todayButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    timeline: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    timeSlot: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    timeLabel: {
      width: 60,
      paddingTop: 4,
    },
    timeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.muted,
    },
    slotContent: {
      flex: 1,
    },
    appointmentCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    appointmentTime: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 4,
    },
    appointmentTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    appointmentMeta: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 4,
    },
    appointmentService: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: '600',
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      marginTop: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
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
  const dayAppointments = appointments.filter(apt => apt.appointment_date === selectedDateStr);
  
  const sortedAppointments = [...dayAppointments].sort((a, b) => 
    (a.appointment_time || '').localeCompare(b.appointment_time || '')
  );

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'cancelled': return '#f87171';
      case 'scheduled': return colors.primary;
      default: return colors.warning;
    }
  };

  const getStatusLabel = (status?: string | null) => {
    switch (status) {
      case 'completed': return '✓ Concluído';
      case 'cancelled': return '✕ Cancelado';
      case 'scheduled': return '📅 Agendado';
      default: return '⏱ Pendente';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateDay('prev')}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.dateInfo}>
          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>
        </View>

        {!isToday ? (
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Hoje</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
        
        <TouchableOpacity style={styles.navButton} onPress={() => navigateDay('next')}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.timeline} contentContainerStyle={styles.scrollContent}>
        {sortedAppointments.length === 0 ? (
          <View style={styles.emptySlot}>
            <Text style={styles.emptyIcon}>☀️</Text>
            <Text style={styles.emptyText}>Nenhuma marcação para este dia</Text>
          </View>
        ) : (
          sortedAppointments.map((appointment) => (
            <TouchableOpacity
              key={appointment.id}
              style={styles.appointmentCard}
              onPress={() => onAppointmentPress(appointment)}
            >
              <Text style={styles.appointmentTime}>
                {formatTime(appointment.appointment_time)} • {appointment.duration || 60} min
              </Text>
              <Text style={styles.appointmentTitle}>
                {appointment.customers?.name} • {appointment.pets?.name}
              </Text>
              <Text style={styles.appointmentService}>{appointment.services?.name}</Text>
              {appointment.customers?.address ? (
                <Text style={styles.appointmentMeta}>📍 {appointment.customers.address}</Text>
              ) : null}
              
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) + '22' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(appointment.status) }]}>
                  {getStatusLabel(appointment.status)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
