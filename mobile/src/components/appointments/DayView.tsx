import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Pressable, Linking, Platform } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { getDateLocale } from '../../i18n';
import type { Appointment } from '../../api/appointments';
import { getStatusColor } from '../../utils/appointmentStatus';
import { formatCustomerName } from '../../utils/customer';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

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

function formatDateLabel(date: Date, locale: string) {
  try {
    const label = date.toLocaleDateString(locale, {
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
  const { t } = useTranslation();
  const dateLocale = getDateLocale();

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
      flexDirection: 'row',
      gap: 6,
    },
    appointmentContent: {
      flex: 1,
      justifyContent: 'center',
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
    appointmentActions: {
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: 'center',
      alignItems: 'center',
    },
    whatsappButton: {
      borderColor: '#25D366',
      backgroundColor: '#E7F8EE',
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
      Alert.alert(t('dayView.slotUnavailableTitle'), t('dayView.slotUnavailableMessage'));
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
          <Text style={styles.dateLabel}>{formatDateLabel(selectedDate, dateLocale)}</Text>
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
              const customer = appointment.customers;
              const customerName = formatCustomerName(customer);
              const phone = customer?.phone;
              const address = customer?.address;
              const appointmentServices = Array.isArray(appointment.appointment_services)
                ? appointment.appointment_services
                : [];
              const appointmentServiceLines = appointmentServices
                .map((entry) => {
                  const name = entry.services?.name;
                  if (!name) return null;
                  const price = entry.services?.price;
                  return price ? `${name} (${price.toFixed(2)}€)` : name;
                })
                .filter((value): value is string => Boolean(value));
              
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
                  <View style={styles.appointmentContent}>
                    <Text style={styles.appointmentTime} numberOfLines={1}>
                      {formatTime(appointment.appointment_time)}
                    </Text>
                    <Text style={styles.appointmentTitle} numberOfLines={1}>
                      {appointment.pets?.name}{customerName ? ` | ${customerName}` : ''}
                    </Text>
                    {appointmentServiceLines.length > 0 ? (
                      appointmentServiceLines.map((label, idx) => (
                        <Text key={idx} style={styles.appointmentService} numberOfLines={1}>
                          {label}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.appointmentService} numberOfLines={1}>
                        {appointment.services?.name}{appointment.services?.price ? ` | ${appointment.services.price.toFixed(2)}€` : ''}
                      </Text>
                    )}
                  </View>
                  
                  {height >= 40 && (phone || address) && (
                    <View style={styles.appointmentActions}>
                      {address && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={async (e) => {
                            e.stopPropagation();
                            try {
                              const response = await fetch(
                                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
                              );
                              const data = await response.json();
                              
                              if (data.results && data.results.length > 0) {
                                const location = data.results[0].geometry.location;
                                const url = Platform.select({
                                  ios: `maps:0,0?q=${location.lat},${location.lng}`,
                                  android: `geo:0,0?q=${location.lat},${location.lng}`,
                                  default: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
                                });
                                Linking.openURL(url).catch(() => null);
                              }
                            } catch (error) {
                              console.error('Geocoding error:', error);
                            }
                          }}
                        >
                          <Ionicons name="location" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      {phone && (
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            Linking.openURL(`tel:${phone}`).catch(() => null);
                          }}
                        >
                          <Ionicons name="call" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      {phone && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.whatsappButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            const formattedPhone = phone.startsWith('+') ? phone.replace(/\+/g, '') : '351' + phone;
                            const message = t('dayView.whatsappMessage', {
                              time: formatTime(appointment.appointment_time),
                              date: appointment.appointment_date,
                            });
                            Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`).catch(() => null);
                          }}
                        >
                          <FontAwesome name="whatsapp" size={15} color="#25D366" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {dayAppointments.length === 0 ? (
              <View style={styles.emptySlot}>
                <Text style={styles.emptyIcon}>☀️</Text>
                <Text style={styles.emptyText}>{t('dayView.noAppointments')}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
