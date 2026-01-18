import { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { getDateLocale } from "../../i18n";
import type { Appointment } from "../../api/appointments";

type MonthViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onDayPress: (date: Date) => void;
};

const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 0.3;

function formatLocalDate(value: Date) {
  return value.toLocaleDateString("sv-SE");
}

function getMonthDays(
  date: Date
): Array<{ date: string; isCurrentMonth: boolean }> {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: Array<{ date: string; isCurrentMonth: boolean }> = [];

  // Preenche dias anteriores ao mês
  const firstDayOfWeek = firstDay.getDay();
  const daysToFill = firstDayOfWeek;
  for (let i = daysToFill; i > 0; i--) {
    const prevDate = new Date(year, month, 1 - i);
    days.push({
      date: formatLocalDate(prevDate),
      isCurrentMonth: false,
    });
  }

  // Dias do mês atual
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const currentDate = new Date(year, month, day);
    days.push({
      date: formatLocalDate(currentDate),
      isCurrentMonth: true,
    });
  }

  // Preenche até completar semanas
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: formatLocalDate(nextDate),
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
}: MonthViewProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const monthDays = getMonthDays(selectedDate);
  const today = new Date().toLocaleDateString("sv-SE");

  const monthLabelRaw = selectedDate.toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  });
  const monthLabel =
    monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
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
    [selectedDate, onDateChange]
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
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      gap: 8,
    },
    navButtonWrap: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    navButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    monthInfo: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    monthLabel: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textTransform: "capitalize",
      letterSpacing: 0.2,
    },
    calendar: {
      padding: 18,
      backgroundColor: colors.background,
    },
    weekDays: {
      flexDirection: "row",
      marginBottom: 12,
    },
    weekDay: {
      width: "14.2857%",
      alignItems: "center",
      paddingVertical: 10,
    },
    weekDayText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    daysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    dayCell: {
      width: "14.2857%",
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 4,
    },
    dayButton: {
      width: "100%",
      height: "100%",
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    dayNumber: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    inactiveDay: {
      opacity: 0.35,
    },
    todayDay: {
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    todayText: {
      color: colors.primary,
      fontWeight: "800",
    },
    hasAppointments: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primarySoft,
    },
    appointmentDots: {
      position: "absolute",
      bottom: 6,
      flexDirection: "row",
      gap: 3,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    appointmentCount: {
      position: "absolute",
      top: 6,
      right: 6,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 5,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    countText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#fff",
    },
    legend: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
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
      fontWeight: "600",
    },
  });

  const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.monthNav}>
        <View style={styles.navButtonWrap}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth("prev")}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.monthInfo} pointerEvents="none">
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </View>

        <View style={styles.navButtonWrap}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth("next")}
          >
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
            const dayNumber = new Date(dayDate + "T00:00:00").getDate();
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
                      const date = new Date(dayDate + "T00:00:00");
                      onDayPress(date);
                    }
                  }}
                  disabled={!isCurrentMonth}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !isCurrentMonth && styles.inactiveDay,
                      isToday && styles.todayText,
                    ]}
                  >
                    {dayNumber}
                  </Text>

                  {hasAppointments && isCurrentMonth && (
                    <>
                      {appointmentCount <= 3 ? (
                        <View style={styles.appointmentDots}>
                          {Array.from({
                            length: Math.min(appointmentCount, 3),
                          }).map((_, i) => (
                            <View key={i} style={styles.dot} />
                          ))}
                        </View>
                      ) : (
                        <View style={styles.appointmentCount}>
                          <Text style={styles.countText}>
                            {appointmentCount}
                          </Text>
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
          <View
            style={[styles.legendDot, { backgroundColor: colors.primary }]}
          />
          <Text style={styles.legendText}>
            {t("monthView.legendAppointments")}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendDot,
              { borderWidth: 2, borderColor: colors.primary },
            ]}
          />
          <Text style={styles.legendText}>{t("monthView.legendToday")}</Text>
        </View>
      </View>
    </View>
  );
}
