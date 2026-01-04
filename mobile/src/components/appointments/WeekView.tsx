import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert, Pressable, PanResponder } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { getDateLocale } from '../../i18n';
import type { Appointment } from '../../api/appointments';
import { getStatusColor } from '../../utils/appointmentStatus';
import {
  formatPetLabel,
  formatServiceLabels,
  getAppointmentPetNames,
  getAppointmentServiceEntries,
} from '../../utils/appointmentSummary';
import { getCardStyle } from '../../theme/uiTokens';

type WeekViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string, time?: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const HOUR_HEIGHT = 60; // Height of each hour slot
const TIME_COLUMN_WIDTH = 50; // Width of the time column on the left
const START_HOUR = 7; // Start at 7 AM
const END_HOUR = 21; // End at 9 PM
const MIN_SLOT_MINUTES = 30;
const MAX_SLOT_MINUTES = 60;
const TAP_HIGHLIGHT_DURATION_MS = 700;
const TAP_NAV_DELAY_MS = 120;
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 0.3;

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(sunday);
    current.setDate(sunday.getDate() + i);
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
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const [tapHighlight, setTapHighlight] = useState<{ day: string; top: number; height: number } | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current);
      }
    };
  }, []);
  const screenWidth = Dimensions.get('window').width;
  const dayColumnWidth = (screenWidth - TIME_COLUMN_WIDTH - 32) / 7; // 32 for padding
  
  const weekDays = getWeekDays(selectedDate);
  const today = new Date().toLocaleDateString('sv-SE');

  const getAvailableSlotDuration = (dayAppointments: Appointment[], startMinutes: number) => {
    const dayEndMinutes = END_HOUR * 60;
    const nextStart = dayAppointments
      .map((apt) => toMinutes(apt.appointment_time))
      .filter((value): value is number => value !== null && value >= startMinutes)
      .sort((a, b) => a - b)[0];
    const limit = typeof nextStart === 'number' ? Math.min(nextStart, dayEndMinutes) : dayEndMinutes;
    const availableMinutes = limit - startMinutes;
    if (availableMinutes >= MAX_SLOT_MINUTES) return MAX_SLOT_MINUTES;
    if (availableMinutes >= MIN_SLOT_MINUTES) return MIN_SLOT_MINUTES;
    return 0;
  };

  const getSlotFromOffset = (offsetY: number, dayAppointments: Appointment[]) => {
    const maxStartMinutes = END_HOUR * 60 - MIN_SLOT_MINUTES;
    const totalMinutes = Math.min(
      Math.max(Math.floor(offsetY / HOUR_HEIGHT * 60) + START_HOUR * 60, START_HOUR * 60),
      maxStartMinutes,
    );
    const minutesRounded = totalMinutes - (totalMinutes % 30);
    const durationMinutes = getAvailableSlotDuration(dayAppointments, minutesRounded);
    if (!durationMinutes) return null;
    const hh = `${Math.floor(minutesRounded / 60)}`.padStart(2, '0');
    const mm = `${minutesRounded % 60}`.padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    const minutesFromStart = minutesRounded - START_HOUR * 60;
    const highlightTop = (minutesFromStart / 60) * HOUR_HEIGHT;
    const highlightHeight = (durationMinutes / 60) * HOUR_HEIGHT;
    return { minutesRounded, timeStr, highlightTop, highlightHeight, durationMinutes };
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
    onDateChange(date);
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
            const date = new Date(selectedDate);
            date.setDate(date.getDate() + 7);
            onDateChange(date);
          } else if (dx >= SWIPE_THRESHOLD || vx >= SWIPE_VELOCITY) {
            const date = new Date(selectedDate);
            date.setDate(date.getDate() - 7);
            onDateChange(date);
          }
        },
      }),
    [selectedDate, onDateChange],
  );

  // Group appointments by day
  const appointmentsByDay = weekDays.reduce((acc, day) => {
    const dayStr = day.toLocaleDateString('sv-SE');
    acc[dayStr] = appointments.filter(apt => apt.appointment_date === dayStr)
      .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));
    return acc;
  }, {} as Record<string, Appointment[]>);

  const handleCreateAtPosition = (dayStr: string, dayAppointments: Appointment[], offsetY: number) => {
    const slot = getSlotFromOffset(offsetY, dayAppointments);
    if (!slot || !isSlotFree(dayAppointments, slot.minutesRounded, slot.durationMinutes)) {
      setTapHighlight(null);
      Alert.alert(t('dayView.slotUnavailableTitle'), t('dayView.slotUnavailableMessage'));
      return;
    }

    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
    }
    navTimerRef.current = setTimeout(() => {
      onNewAppointment(dayStr, slot.timeStr);
    }, TAP_NAV_DELAY_MS);
  };

  const handlePressInAtPosition = (dayStr: string, dayAppointments: Appointment[], offsetY: number) => {
    const slot = getSlotFromOffset(offsetY, dayAppointments);
    if (!slot || !isSlotFree(dayAppointments, slot.minutesRounded, slot.durationMinutes)) {
      setTapHighlight(null);
      return;
    }

    setTapHighlight({ day: dayStr, top: slot.highlightTop, height: slot.highlightHeight });

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setTapHighlight(null);
    }, TAP_HIGHLIGHT_DURATION_MS);
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const cardBase = getCardStyle(colors);
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
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
      justifyContent: 'center',
      paddingHorizontal: 8,
      pointerEvents: 'none',
    },
    weekLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
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
    tapHighlight: {
      position: 'absolute',
      left: 2,
      right: 2,
      backgroundColor: colors.primarySoft,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.primary,
      opacity: 0.45,
    },
    appointmentBlock: {
      position: 'absolute',
      left: 2,
      right: 2,
      ...cardBase,
      borderRadius: 6,
      padding: 4,
      borderLeftWidth: 3,
      overflow: 'hidden',
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
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const formatDayLabel = (d: Date, withYear: boolean) =>
    d.toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'short',
      year: withYear ? 'numeric' : undefined,
    });
  const weekLabel = sameYear
    ? `${formatDayLabel(weekStart, false)} - ${formatDayLabel(weekEnd, true)}`
    : `${formatDayLabel(weekStart, true)} - ${formatDayLabel(weekEnd, true)}`;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Navigation Header */}
      <View style={styles.weekNav}>
        <View style={styles.navButtonWrap}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('prev')}>
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.weekInfo}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
        </View>

        <View style={styles.navButtonWrap}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('next')}>
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Days of Week Header */}
      <View style={styles.weekHeader}>
        <View style={styles.timeColumnHeader} />
        {weekDays.map((day) => {
          const dayStr = day.toLocaleDateString('sv-SE');
          const isToday = dayStr === today;
          const dayName = day.toLocaleDateString(dateLocale, { weekday: 'short' });
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
                <Pressable
                  key={dayStr}
                  style={styles.dayColumn}
                  onPressIn={(e) => handlePressInAtPosition(dayStr, dayAppointments, e.nativeEvent.locationY)}
                  onPress={(e) => handleCreateAtPosition(dayStr, dayAppointments, e.nativeEvent.locationY)}
                >
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
                  {tapHighlight && tapHighlight.day === dayStr ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.tapHighlight,
                        { top: tapHighlight.top, height: tapHighlight.height },
                      ]}
                    />
                  ) : null}

                  {/* Appointments */}
                  {dayAppointments.map((appointment) => {
                    const topPosition = calculatePosition(appointment.appointment_time);
                    const duration = appointment.duration || 60;
                    const height = (duration / 60) * HOUR_HEIGHT - 4; // -4 for spacing
                    const appointmentServices = getAppointmentServiceEntries(appointment);
                    const petNames = getAppointmentPetNames(appointment, appointmentServices);
                    const petLabel = formatPetLabel(petNames);
                    const appointmentServiceLines = formatServiceLabels(appointmentServices);

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
                          {petLabel || appointment.pets?.name}
                        </Text>
                        {appointmentServiceLines.length > 0 ? (
                          appointmentServiceLines.map((label, idx) => (
                            <Text key={idx} style={styles.appointmentService} numberOfLines={1}>
                              {label}
                            </Text>
                          ))
                        ) : (
                          <Text style={styles.appointmentService} numberOfLines={1}>
                            {appointment.services?.name}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
