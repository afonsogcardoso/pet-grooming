import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import type { Appointment } from '../../api/appointments';

type MonthViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDayPress: (date: Date) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

function getMonthDays(date: Date): Array<{ date: string; isCurrentMonth: boolean }> {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const days: Array<{ date: string; isCurrentMonth: boolean }> = [];
  
  // Preenche dias anteriores ao mês
  const firstDayOfWeek = firstDay.getDay();
  const daysToFill = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  for (let i = daysToFill; i > 0; i--) {
    const prevDate = new Date(year, month, 1 - i);
    days.push({
      date: prevDate.toISOString().split('T')[0],
      isCurrentMonth: false,
    });
  }
  
  // Dias do mês atual
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const currentDate = new Date(year, month, day);
    days.push({
      date: currentDate.toISOString().split('T')[0],
      isCurrentMonth: true,
    });
  }
  
  // Preenche até completar semanas
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate.toISOString().split('T')[0],
        isCurrentMonth: false,
      });
    }
  }
  
  return days;
}

export function MonthView({ 
  appointments, 
  selectedDate, 
  onDateChange, 
  onDayPress,
  onRefresh,
  isRefreshing,
}: MonthViewProps) {
  const { colors } = useBrandingTheme();
  const screenWidth = Dimensions.get('window').width;
  const daySize = (screenWidth - 40) / 7; // 20px padding on each side
  
  const monthDays = getMonthDays(selectedDate);
  const today = new Date().toLocaleDateString('sv-SE');
  
  const monthLabel = selectedDate.toLocaleDateString('pt-PT', { 
    month: 'long', 
    year: 'numeric' 
  });

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const appointmentsByDay = appointments.reduce((acc, apt) => {
    if (apt.appointment_date) {
      acc[apt.appointment_date] = (acc[apt.appointment_date] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    monthNav: {
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
    monthInfo: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 12,
    },
    monthLabel: {
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
    calendar: {
      padding: 20,
    },
    weekDays: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    weekDay: {
      width: daySize,
      alignItems: 'center',
      paddingVertical: 8,
    },
    weekDayText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: daySize,
      height: daySize,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 4,
    },
    dayButton: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    dayNumber: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    inactiveDay: {
      opacity: 0.3,
    },
    todayDay: {
      backgroundColor: colors.primarySoft,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    todayText: {
      color: colors.primary,
      fontWeight: '700',
    },
    hasAppointments: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    appointmentDots: {
      position: 'absolute',
      bottom: 4,
      flexDirection: 'row',
      gap: 2,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    appointmentCount: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    countText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#fff',
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    legendText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: '600',
    },
  });

  const weekDayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  const isCurrentMonth = selectedDate.getMonth() === new Date().getMonth() && 
                         selectedDate.getFullYear() === new Date().getFullYear();

  return (
    <View style={styles.container}>
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => navigateMonth('prev')}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.monthInfo}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>

        {!isCurrentMonth ? (
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Hoje</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
        
        <TouchableOpacity style={styles.navButton} onPress={() => navigateMonth('next')}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calendar}>
        <View style={styles.weekDays}>
          {weekDayLabels.map((label) => (
            <View key={label} style={styles.weekDay}>
              <Text style={styles.weekDayText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {monthDays.map(({ date: dayDate, isCurrentMonth }) => {
            const dayNumber = new Date(dayDate + 'T00:00:00').getDate();
            const isToday = dayDate === today;
            const appointmentCount = appointmentsByDay[dayDate] || 0;
            const hasAppointments = appointmentCount > 0;

            return (
              <View key={dayDate} style={styles.dayCell}>
                <TouchableOpacity
                  style={[
                    styles.dayButton,
                    !isCurrentMonth && styles.inactiveDay,
                    isToday && styles.todayDay,
                    hasAppointments && isCurrentMonth && styles.hasAppointments,
                  ]}
                  onPress={() => {
                    if (isCurrentMonth) {
                      const date = new Date(dayDate + 'T00:00:00');
                      onDayPress(date);
                    }
                  }}
                  disabled={!isCurrentMonth}
                >
                  <Text style={[
                    styles.dayNumber,
                    !isCurrentMonth && styles.inactiveDay,
                    isToday && styles.todayText,
                  ]}>
                    {dayNumber}
                  </Text>
                  
                  {hasAppointments && isCurrentMonth && (
                    <>
                      {appointmentCount <= 3 ? (
                        <View style={styles.appointmentDots}>
                          {Array.from({ length: Math.min(appointmentCount, 3) }).map((_, i) => (
                            <View key={i} style={styles.dot} />
                          ))}
                        </View>
                      ) : (
                        <View style={styles.appointmentCount}>
                          <Text style={styles.countText}>{appointmentCount}</Text>
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Com marcações</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { borderWidth: 2, borderColor: colors.primary }]} />
          <Text style={styles.legendText}>Hoje</Text>
        </View>
      </View>
    </View>
  );
}
