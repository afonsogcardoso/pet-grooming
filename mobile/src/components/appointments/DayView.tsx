import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
  Linking,
  Platform,
  PanResponder,
} from "react-native";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { getDateLocale } from "../../i18n";
import type { Appointment } from "../../api/appointments";
import { getStatusColor } from "../../utils/appointmentStatus";
import {
  formatCustomerAddress,
  formatCustomerName,
} from "../../utils/customer";
import {
  formatPetLabel,
  getAppointmentPetNames,
  getAppointmentServiceEntries,
} from "../../utils/appointmentSummary";
import { getCardStyle } from "../../theme/uiTokens";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || "";

type DayViewProps = {
  appointments: Appointment[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string, time?: string) => void;
};

function formatTime(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hh, mm] = match;
    return `${hh.padStart(2, "0")}:${mm}`;
  }
  return value;
}

function formatDateLabel(date: Date, locale: string) {
  try {
    const label = date.toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    // Capitaliza a primeira letra para melhor legibilidade
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return date.toLocaleDateString("sv-SE");
  }
}

const HOUR_HEIGHT = 56; // slightly tighter grid
const START_HOUR = 7;
const END_HOUR = 21;
const MIN_SLOT_MINUTES = 30;
const MAX_SLOT_MINUTES = 60;
const TAP_HIGHLIGHT_DURATION_MS = 700;
const TAP_NAV_DELAY_MS = 120;
const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 0.3;

function getTimeFromString(
  time?: string | null
): { hour: number; minute: number } | null {
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

function isSlotFree(
  dayAppointments: Appointment[],
  startMinutes: number,
  durationMinutes: number
): boolean {
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
}: DayViewProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const [tapHighlight, setTapHighlight] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const todayStr = useMemo(() => new Date().toLocaleDateString("sv-SE"), []);

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

  const navigateDay = (direction: "prev" | "next") => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === "next" ? 1 : -1));
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
            date.setDate(date.getDate() + 1);
            onDateChange(date);
          } else if (dx >= SWIPE_THRESHOLD || vx >= SWIPE_VELOCITY) {
            const date = new Date(selectedDate);
            date.setDate(date.getDate() - 1);
            onDateChange(date);
          }
        },
      }),
    [selectedDate, onDateChange]
  );

  const selectedDateStr = selectedDate.toLocaleDateString("sv-SE");
  const isToday = selectedDateStr === todayStr;

  const dayAppointments = appointments
    .filter((apt) => apt.appointment_date === selectedDateStr)
    .sort((a, b) =>
      (a.appointment_time || "").localeCompare(b.appointment_time || "")
    );

  const getAvailableSlotDuration = (startMinutes: number) => {
    const dayEndMinutes = END_HOUR * 60;
    const nextStart = dayAppointments
      .map((apt) => toMinutes(apt.appointment_time))
      .filter(
        (value): value is number => value !== null && value >= startMinutes
      )
      .sort((a, b) => a - b)[0];
    const limit =
      typeof nextStart === "number"
        ? Math.min(nextStart, dayEndMinutes)
        : dayEndMinutes;
    const availableMinutes = limit - startMinutes;
    if (availableMinutes >= MAX_SLOT_MINUTES) return MAX_SLOT_MINUTES;
    if (availableMinutes >= MIN_SLOT_MINUTES) return MIN_SLOT_MINUTES;
    return 0;
  };

  const getSlotFromOffset = (offsetY: number) => {
    const maxStartMinutes = END_HOUR * 60 - MIN_SLOT_MINUTES;
    const totalMinutes = Math.min(
      Math.max(
        Math.floor((offsetY / HOUR_HEIGHT) * 60) + START_HOUR * 60,
        START_HOUR * 60
      ),
      maxStartMinutes
    );
    const minutesRounded = totalMinutes - (totalMinutes % 30);
    const durationMinutes = getAvailableSlotDuration(minutesRounded);
    if (!durationMinutes) return null;
    const hh = `${Math.floor(minutesRounded / 60)}`.padStart(2, "0");
    const mm = `${minutesRounded % 60}`.padStart(2, "0");
    const timeStr = `${hh}:${mm}`;
    const minutesFromStart = minutesRounded - START_HOUR * 60;
    const highlightTop = (minutesFromStart / 60) * HOUR_HEIGHT;
    const highlightHeight = (durationMinutes / 60) * HOUR_HEIGHT;
    return {
      minutesRounded,
      timeStr,
      highlightTop,
      highlightHeight,
      durationMinutes,
    };
  };

  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateNow();
    const id = setInterval(updateNow, 30000);
    return () => clearInterval(id);
  }, []);

  const currentTimeTop = useMemo(() => {
    if (!isToday || nowMinutes == null) return null;
    const offsetMinutes = nowMinutes - START_HOUR * 60;
    if (offsetMinutes < 0 || nowMinutes > END_HOUR * 60) return null;
    return (offsetMinutes / 60) * HOUR_HEIGHT;
  }, [isToday, nowMinutes]);

  const currentTimeStr = useMemo(() => {
    if (nowMinutes == null) return null;
    const hh = Math.floor(nowMinutes / 60)
      .toString()
      .padStart(2, "0");
    const mm = (nowMinutes % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }, [nowMinutes]);

  useEffect(() => {
    if (currentTimeTop == null) return;
    const scrollY = Math.max(currentTimeTop - 180, 0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: scrollY, animated: false });
    });
  }, [currentTimeTop]);

  const cardBase = getCardStyle(colors);
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dateNav: {
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
      width: 38,
      height: 38,
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
    dateInfo: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      pointerEvents: "none",
    },
    dateLabel: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      textTransform: "capitalize",
      letterSpacing: 0.2,
    },
    gridContainer: {
      flex: 1,
    },
    gridContent: {
      flexDirection: "row",
    },
    timeColumn: {
      width: 60,
      paddingTop: 0,
    },
    hourRow: {
      height: HOUR_HEIGHT,
      justifyContent: "flex-start",
      paddingTop: 6,
      paddingRight: 6,
    },
    hourText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.muted,
      textAlign: "right",
    },
    dayColumn: {
      flex: 1,
      borderLeftWidth: 1,
      borderLeftColor: colors.surfaceBorder,
      position: "relative",
      backgroundColor: `${colors.primary}05`,
    },
    hourLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: `${colors.text}10`,
    },
    tapHighlight: {
      position: "absolute",
      left: 10,
      right: 10,
      backgroundColor: colors.primarySoft,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      opacity: 0.35,
    },
    currentTimeLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: "#ff5a5f",
      zIndex: 2,
      pointerEvents: "none",
    },
    currentTimeDot: {
      position: "absolute",
      left: -5,
      top: -5,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: "#ff5a5f",
    },
    currentTimeBadge: {
      position: "absolute",
      left: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: "#ff5a5f",
      zIndex: 3,
      justifyContent: "center",
      alignItems: "center",
    },
    currentTimeBadgeText: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
    },
    appointmentBlock: {
      position: "absolute",
      left: 10,
      right: 10,
      ...cardBase,
      borderRadius: 14,
      padding: 10,
      borderLeftWidth: 4,
      overflow: "hidden",
      flexDirection: "row",
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    appointmentPetsColumn: {
      gap: 2,
      marginBottom: 2,
    },
    appointmentPetLine: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.muted,
    },
    appointmentContent: {
      flex: 1,
      justifyContent: "center",
    },
    appointmentTime: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      letterSpacing: 0.2,
    },
    appointmentTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },
    appointmentService: {
      fontSize: 11,
      color: colors.muted,
    },
    emptySlot: {
      paddingVertical: 20,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 14,
      color: colors.muted,
      fontWeight: "600",
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    appointmentActions: {
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      justifyContent: "center",
      alignItems: "center",
    },
    whatsappButton: {
      borderColor: "#25D366",
      backgroundColor: "#E7F8EE",
    },
  });

  const handlePressInAtPosition = (offsetY: number) => {
    const slot = getSlotFromOffset(offsetY);
    if (
      !slot ||
      !isSlotFree(dayAppointments, slot.minutesRounded, slot.durationMinutes)
    ) {
      setTapHighlight(null);
      return;
    }

    setTapHighlight({ top: slot.highlightTop, height: slot.highlightHeight });

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setTapHighlight(null);
    }, TAP_HIGHLIGHT_DURATION_MS);
  };

  const handleCreateAtPosition = (offsetY: number) => {
    const slot = getSlotFromOffset(offsetY);
    if (
      !slot ||
      !isSlotFree(dayAppointments, slot.minutesRounded, slot.durationMinutes)
    ) {
      setTapHighlight(null);
      Alert.alert(
        t("dayView.slotUnavailableTitle"),
        t("dayView.slotUnavailableMessage")
      );
      return;
    }

    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
    }
    navTimerRef.current = setTimeout(() => {
      onNewAppointment(selectedDateStr, slot.timeStr);
    }, TAP_NAV_DELAY_MS);
  };

  const hours = Array.from(
    { length: END_HOUR - START_HOUR },
    (_, i) => START_HOUR + i
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.dateNav}>
        <View style={styles.navButtonWrap}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDay("prev")}
          >
            <Text style={styles.navButtonText}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateInfo}>
          <Text style={styles.dateLabel}>
            {formatDateLabel(selectedDate, dateLocale)}
          </Text>
        </View>

        <View style={styles.navButtonWrap}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateDay("next")}
          >
            <Text style={styles.navButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.gridContainer} ref={scrollRef}>
        <View style={styles.gridContent}>
          {/* Time column */}
          <View style={styles.timeColumn}>
            {hours.map((hour) => (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourText}>{`${hour}:00`}</Text>
              </View>
            ))}
            {currentTimeTop != null && currentTimeStr ? (
              <View
                pointerEvents="none"
                style={[styles.currentTimeBadge, { top: currentTimeTop - 10 }]}
              >
                <Text style={styles.currentTimeBadgeText}>
                  {currentTimeStr}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Day column */}
          <Pressable
            style={styles.dayColumn}
            onPressIn={(e) => handlePressInAtPosition(e.nativeEvent.locationY)}
            onPress={(e) => handleCreateAtPosition(e.nativeEvent.locationY)}
          >
            {hours.map((hour, index) => (
              <View
                key={hour}
                style={[styles.hourLine, { top: index * HOUR_HEIGHT }]}
              />
            ))}
            {currentTimeTop != null ? (
              <View style={[styles.currentTimeLine, { top: currentTimeTop }]}>
                <View style={styles.currentTimeDot} />
              </View>
            ) : null}
            {tapHighlight ? (
              <View
                pointerEvents="none"
                style={[
                  styles.tapHighlight,
                  { top: tapHighlight.top, height: tapHighlight.height },
                ]}
              />
            ) : null}

            {dayAppointments.map((appointment) => {
              const topPosition = calculatePosition(
                appointment.appointment_time
              );
              const duration = appointment.duration || 60;
              const height = (duration / 60) * HOUR_HEIGHT - 4;
              const customer = appointment.customers;
              const customerName = formatCustomerName(customer);
              const phone = customer?.phone;
              const address = formatCustomerAddress(customer);
              const appointmentServices =
                getAppointmentServiceEntries(appointment);
              const petNames = getAppointmentPetNames(
                appointment,
                appointmentServices
              );
              const petLabel = formatPetLabel(petNames);
              const petServiceMap = new Map<
                string,
                { label: string; services: string[] }
              >();
              appointmentServices.forEach((entry, idx) => {
                const petName =
                  entry.pets?.name || t("listView.serviceFallback");
                const key =
                  entry.pet_id ||
                  entry.pets?.id ||
                  `${petName || "pet"}-${idx}`;
                const serviceName =
                  entry.services?.name || t("listView.serviceFallback");
                const bucket = petServiceMap.get(key) || {
                  label: petName,
                  services: [],
                };
                bucket.services.push(serviceName);
                petServiceMap.set(key, bucket);
              });
              const serviceLineMap = new Map<
                string,
                { count: number; price?: number | null }
              >();
              appointmentServices.forEach((entry) => {
                const name = entry.services?.name;
                if (!name) return;
                const current = serviceLineMap.get(name);
                if (current) {
                  current.count += 1;
                  return;
                }
                serviceLineMap.set(name, {
                  count: 1,
                  price: entry.services?.price ?? null,
                });
              });
              const appointmentServiceLines = Array.from(
                serviceLineMap.entries()
              ).map(([name, info]) => {
                const countLabel = info.count > 1 ? ` x${info.count}` : "";
                const priceLabel =
                  info.price != null ? ` (${info.price.toFixed(2)}€)` : "";
                return `${name}${countLabel}${priceLabel}`;
              });

              const petServiceLines = Array.from(petServiceMap.values()).map(
                (item) => {
                  const servicesLabel = item.services.join(", ");
                  return `${item.label} | ${servicesLabel}`;
                }
              );

              if (petServiceLines.length === 0) {
                const fallbackPet = petLabel || t("listView.serviceFallback");
                const fallbackService =
                  appointmentServiceLines[0] || t("listView.serviceFallback");
                petServiceLines.push(`${fallbackPet} | ${fallbackService}`);
              }

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
                    {petServiceLines.length > 0 ? (
                      <View style={styles.appointmentPetsColumn}>
                        {customerName ? (
                          <Text
                            style={styles.appointmentTitle}
                            numberOfLines={1}
                          >
                            {customerName}
                          </Text>
                        ) : null}
                        {petServiceLines.map((line, idx) => (
                          <Text
                            key={idx}
                            style={styles.appointmentPetLine}
                            numberOfLines={1}
                          >
                            {line}
                          </Text>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.appointmentTitle} numberOfLines={1}>
                        {petLabel || "—"}
                        {customerName ? ` | ${customerName}` : ""}
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
                                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                                  address
                                )}&key=${GOOGLE_MAPS_API_KEY}`
                              );
                              const data = await response.json();

                              if (data.results && data.results.length > 0) {
                                const location =
                                  data.results[0].geometry.location;
                                const url = Platform.select({
                                  ios: `maps:0,0?q=${location.lat},${location.lng}`,
                                  android: `geo:0,0?q=${location.lat},${location.lng}`,
                                  default: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
                                });
                                Linking.openURL(url).catch(() => null);
                              }
                            } catch (error) {
                              console.error("Geocoding error:", error);
                            }
                          }}
                        >
                          <Ionicons
                            name="location"
                            size={14}
                            color={colors.primary}
                          />
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
                          <Ionicons
                            name="call"
                            size={14}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      )}
                      {phone && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.whatsappButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            const formattedPhone = phone.startsWith("+")
                              ? phone.replace(/\+/g, "")
                              : "351" + phone;
                            const message = t("dayView.whatsappMessage", {
                              time: formatTime(appointment.appointment_time),
                              date: appointment.appointment_date,
                            });
                            Linking.openURL(
                              `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(
                                message
                              )}`
                            ).catch(() => null);
                          }}
                        >
                          <FontAwesome
                            name="whatsapp"
                            size={15}
                            color="#25D366"
                          />
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
                <Text style={styles.emptyText}>
                  {t("dayView.noAppointments")}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
