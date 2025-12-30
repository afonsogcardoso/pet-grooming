import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, PanResponder } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { getDateLocale } from '../../i18n';
import type { Appointment } from '../../api/appointments';

type MonthViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDayPress: (date: Date) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 0.3;

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
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const screenWidth = Dimensions.get('window').width;
  const daySize = (screenWidth - 40) / 7; // 20px padding on each side
  
  const monthDays = getMonthDays(selectedDate);
  const today = new Date().toLocaleDateString('sv-SE');
  
  const monthLabelRaw = selectedDate.toLocaleDateString(dateLocale, { 
    month: 'long', 
    year: 'numeric' 
  });
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    onDateChange(newDate);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          const { dx, dy } = gestureState;
          return Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2;
        },
        onPanResponderRelease: (_event, gestureState) => {
          const { dx, vx } = gestureState;
          if (dx <= -SWIPE_THRESHOLD || vx <= -SWIPE_VELOCITY) {
            const nextDate = new Date(selectedDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            onDateChange(nextDate);
          } else if (dx >= SWIPE_THRESHOLD || vx >= SWIPE_VELOCITY) {
            const prevDate = new Date(selectedDate);
            prevDate.setMonth(prevDate.getMonth() - 1);
            onDateChange(prevDate);
          }
        },
      }),
    [selectedDate, onDateChange],
  );

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
    monthInfo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    monthLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'capitalize',
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
      borderColor: colors.surfaceBorder,
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

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.monthNav}>
        <View style={styles.navButtonWrap}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateMonth('prev')}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.monthInfo} pointerEvents="none">
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>

        <View style={styles.navButtonWrap}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateMonth('next')}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.legendText}>{t('monthView.legendAppointments')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { borderWidth: 2, borderColor: colors.primary }]} />
          <Text style={styles.legendText}>{t('monthView.legendToday')}</Text>
        </View>
      </View>
    </View>
  );
}
