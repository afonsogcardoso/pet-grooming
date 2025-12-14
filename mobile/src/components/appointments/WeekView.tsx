import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import type { Appointment } from '../../api/appointments';

type WeekViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const HOUR_HEIGHT = 60; // Height of each hour slot
const TIME_COLUMN_WIDTH = 50; // Width of the time column on the left
const START_HOUR = 7; // Start at 7 AM
const END_HOUR = 21; // End at 9 PM

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    days.push(current);
  }
  return days;
}

function getTimeFromString(time?: string | null): { hour: number; minute: number } | null {
  if (!time) return null;
  const match = String(time).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return { hour: parseInt(match[1]), minute: parseInt(match[2]) };
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

export function WeekView({ 
  appointments, 
  selectedDate, 
  onDateChange, 
  onAppointmentPress,
  onNewAppointment,
  onRefresh,
  isRefreshing,
}: WeekViewProps) {
  const { colors } = useBrandingTheme();
  const screenWidth = Dimensions.get('window').width;
  const dayColumnWidth = (screenWidth - TIME_COLUMN_WIDTH - 32) / 7; // 32 for padding
  
  const weekDays = getWeekDays(selectedDate);
  const today = new Date().toLocaleDateString('sv-SE');

  const navigateWeek = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
    onDateChange(date);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  // Group appointments by day
  const appointmentsByDay = weekDays.reduce((acc, day) => {
    const dayStr = day.toLocaleDateString('sv-SE');
    acc[dayStr] = appointments.filter(apt => apt.appointment_date === dayStr)
      .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));
    return acc;
  }, {} as Record<string, Appointment[]>);

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'cancelled': return '#f87171';
      case 'scheduled': return colors.primary;
      default: return colors.warning;
    }
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const isCurrentWeek = weekDays.some(day => day.toLocaleDateString('sv-SE') === today);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButtonText: {
      fontSize: 16,
    },
    weekInfo: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    weekLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    todayButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      backgroundColor: colors.primarySoft,
    },
    todayButtonText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    weekHeader: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    timeColumnHeader: {
      width: TIME_COLUMN_WIDTH,
      paddingVertical: 8,
    },
    dayHeaderCell: {
      width: dayColumnWidth,
      paddingVertical: 8,
      alignItems: 'center',
      borderLeftWidth: 1,
      borderLeftColor: colors.surfaceBorder,
    },
    todayHeaderCell: {
      backgroundColor: colors.primarySoft,
    },
    dayHeaderDay: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.muted,
      textTransform: 'uppercase',
    },
    todayHeaderDay: {
      color: colors.primary,
    },
    dayHeaderDate: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    todayHeaderDate: {
      color: colors.primary,
    },
    gridContainer: {
      flex: 1,
    },
    gridContent: {
      flexDirection: 'row',
    },
    timeColumn: {
      width: TIME_COLUMN_WIDTH,
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
    daysContainer: {
      flex: 1,
      flexDirection: 'row',
    },
    dayColumn: {
      width: dayColumnWidth,
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
      left: 2,
      right: 2,
      backgroundColor: colors.surface,
      borderRadius: 4,
      padding: 4,
      borderLeftWidth: 3,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    appointmentTime: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.text,
    },
    appointmentTitle: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text,
    },
    appointmentService: {
      fontSize: 9,
      color: colors.muted,
    },
  });

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekLabel = `${weekStart.getDate()} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('pt-PT', { month: 'short' })}`;

  return (
    <View style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('prev')}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.weekInfo}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
        </View>

        {!isCurrentWeek ? (
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Hoje</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 50 }} />}
        
        <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('next')}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Days of Week Header */}
      <View style={styles.weekHeader}>
        <View style={styles.timeColumnHeader} />
        {weekDays.map((day) => {
          const dayStr = day.toLocaleDateString('sv-SE');
          const isToday = dayStr === today;
          const dayName = day.toLocaleDateString('pt-PT', { weekday: 'short' });
          const dayNumber = day.getDate();
          
          return (
            <View 
              key={dayStr} 
              style={[styles.dayHeaderCell, isToday && styles.todayHeaderCell]}
            >
              <Text style={[styles.dayHeaderDay, isToday && styles.todayHeaderDay]}>
                {dayName}
              </Text>
              <Text style={[styles.dayHeaderDate, isToday && styles.todayHeaderDate]}>
                {dayNumber}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Grid with Hours and Appointments */}
      <ScrollView style={styles.gridContainer}>
        <View style={styles.gridContent}>
          {/* Time Column (Left Side) */}
          <View style={styles.timeColumn}>
            {hours.map((hour) => (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourText}>{`${hour}:00`}</Text>
              </View>
            ))}
          </View>

          {/* Days Columns */}
          <View style={styles.daysContainer}>
            {weekDays.map((day) => {
              const dayStr = day.toLocaleDateString('sv-SE');
              const dayAppointments = appointmentsByDay[dayStr] || [];

              return (
                <View key={dayStr} style={styles.dayColumn}>
                  {/* Hour Lines */}
                  {hours.map((hour, index) => (
                    <View 
                      key={hour} 
                      style={[
                        styles.hourLine, 
                        { top: index * HOUR_HEIGHT }
                      ]} 
                    />
                  ))}

                  {/* Appointments */}
                  {dayAppointments.map((appointment) => {
                    const topPosition = calculatePosition(appointment.appointment_time);
                    const duration = appointment.duration || 60;
                    const height = (duration / 60) * HOUR_HEIGHT - 4; // -4 for spacing

                    return (
                      <TouchableOpacity
                        key={appointment.id}
                        style={[
                          styles.appointmentBlock,
                          {
                            top: topPosition,
                            height: Math.max(height, 30),
                            borderLeftColor: getStatusColor(appointment.status),
                          }
                        ]}
                        onPress={() => onAppointmentPress(appointment)}
                      >
                        <Text style={styles.appointmentTime} numberOfLines={1}>
                          {appointment.appointment_time?.substring(0, 5)}
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
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
