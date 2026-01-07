import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  Image,
  StyleSheet,
  Linking,
  Platform,
  TextInput,
  SectionListData,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
  ActivityIndicator,
} from "react-native";
import { RectButton } from "react-native-gesture-handler";
import SwipeableRow from "../common/SwipeableRow";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { getCardVariants } from "../../theme/uiTokens";
import { getDateLocale } from "../../i18n";
import { matchesSearchQuery } from "../../utils/textHelpers";
import {
  formatCustomerAddress,
  formatCustomerName,
  getCustomerFirstName,
} from "../../utils/customer";
import type { Appointment } from "../../api/appointments";
import { getStatusColor, getStatusLabel } from "../../utils/appointmentStatus";
import {
  formatPetLabel,
  formatServiceLabels,
  getAppointmentPetNames,
  getAppointmentServiceEntries,
} from "../../utils/appointmentSummary";
import AppointmentCard from "./AppointmentCard";
import { Button } from "../common";
import { meta } from "zod/v4/core";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || "";

type ListViewProps = {
  appointments: Appointment[];
  filterMode: "upcoming" | "past" | "unpaid";
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string, time?: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  deletingId?: string | null;
  onScrollYChange?: (y: number) => void;
  scrollY?: any;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
};

const SEARCH_HEADER_HEIGHT = 44;
type Section = { dayKey: string; title: string; data: Appointment[] };

function formatTime(value?: string | null) {
  if (!value) return "—";
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hh, mm] = match;
    return `${hh.padStart(2, "0")}:${mm}`;
  }
  return value;
}

function formatDateLabel(
  value: string | null | undefined,
  locale: string,
  fallback: string
) {
  if (!value) return fallback;
  try {
    return new Date(value + "T00:00:00").toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return value;
  }
}

function toDayKey(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("sv-SE");
}

function todayLocalISO() {
  return new Date().toLocaleDateString("sv-SE");
}

function getAppointmentDateTime(appointment: Appointment, dayKey: string) {
  const timeValue = appointment.appointment_time;
  if (!timeValue) return null;
  const match = String(timeValue).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, hh, mm] = match;
  return new Date(`${dayKey}T${hh.padStart(2, "0")}:${mm}:00`);
}

type ThemeColors = ReturnType<typeof useBrandingTheme>["colors"];

function createStyles(colors: ThemeColors) {
  const { listItem } = getCardVariants(colors);
  return StyleSheet.create({
    list: {
      flex: 1,
    },
    card: {
      ...listItem,
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 18,
    },
    petThumb: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: `${colors.primary}12`,
      borderWidth: 0,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    petImage: {
      width: "100%",
      height: "100%",
    },
    petInitial: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.primary,
    },
    content: {
      flex: 1,
      gap: 4,
    },
    time: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    service: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "700",
    },
    meta: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "500",
    },
    badges: {
      gap: 8,
      alignItems: "flex-end",
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
    },
    pillText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
    },
    paymentAmount: {
      fontSize: 12,
      fontWeight: "600",
      marginTop: 4,
      marginRight: 4,
      alignSelf: "flex-end",
      color: colors.muted,
    },
    actions: {
      flexDirection: "row",
      gap: 6,
      marginTop: 4,
    },
    actionContainerLeft: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 12,
      justifyContent: "center",
      height: "100%",
    },
    iconButton: {
      width: 44,
      height: 36,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: 6,
      alignSelf: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 60,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
    },
    emptyAction: {
      marginTop: 16,
      minWidth: 180,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      marginBottom: 10,
      marginTop: 14,
      backgroundColor: `${colors.primary}12`,
      gap: 8,
    },
    sectionHeaderText: {
      color: colors.primary,
      fontWeight: "600",
      fontSize: 13,
    },
    addButton: {
      height: 20,
      width: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    addButtonText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 12,
    },
    searchContainer: {
      height: SEARCH_HEADER_HEIGHT,
      justifyContent: "center",
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${colors.primary}08`,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 0,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    clearButton: {
      padding: 2,
    },
  });
}

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList as any
);

type AppointmentRowProps = {
  item: Appointment;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  t: (key: string, options?: any) => string;
  onAppointmentPress: (appointment: Appointment) => void;
  isDeleting: boolean;
  onSwipeOpen: (ref: any) => void;
  onSwipeClose: (ref: any) => void;
};

const AppointmentRow = React.memo(function AppointmentRow({
  item,
  colors,
  styles,
  t,
  onAppointmentPress,
  isDeleting,
  onSwipeOpen,
  onSwipeClose,
}: AppointmentRowProps) {
  const appointmentServices = getAppointmentServiceEntries(item);
  const petNames = getAppointmentPetNames(item, appointmentServices);
  const petLabel = formatPetLabel(petNames);
  const primaryPetName = petNames[0] || "";
  const petInitial = primaryPetName
    ? primaryPetName.charAt(0).toUpperCase()
    : "🐾";
  const servicesTotal =
    appointmentServices.length > 0
      ? appointmentServices.reduce((sum, entry) => {
          const basePrice =
            entry.price_tier_price ?? entry.services?.price ?? 0;
          const addonsTotal = Array.isArray(entry.appointment_service_addons)
            ? entry.appointment_service_addons.reduce(
                (addonSum, addon) => addonSum + (addon.price || 0),
                0
              )
            : 0;
          return sum + basePrice + addonsTotal;
        }, 0)
      : item.services?.price ?? null;
  const amount = item.amount ?? servicesTotal;
  const serviceNames = formatServiceLabels(appointmentServices);
  const address = formatCustomerAddress(item.customers);
  const phone = item.customers?.phone;
  const statusColor = getStatusColor(item.status);
  const statusLabel = getStatusLabel(item.status);
  const paymentStatus = item.payment_status ?? null;
  const paymentColor =
    paymentStatus === "paid" ? colors.success : colors.warning;
  const paymentLabel =
    paymentStatus === "paid" ? t("listView.paid") : t("listView.unpaid");

  const renderLeftActions = (_progress?: any, _dragX?: any) => (
    <View style={styles.actionContainerLeft}>
      {address ? (
        <RectButton
          style={[
            styles.iconButton,
            { backgroundColor: colors.primarySoft || `${colors.primary}22` },
          ]}
          onPress={async () => {
            try {
              const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                  address
                )}&key=${GOOGLE_MAPS_API_KEY}`
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
              console.error("Geocoding error:", error);
            }
          }}
        >
          <Ionicons name="location" size={18} color={colors.primary} />
        </RectButton>
      ) : null}

      {phone ? (
        <RectButton
          style={[styles.iconButton, { backgroundColor: colors.surface }]}
          onPress={() => Linking.openURL(`tel:${phone}`).catch(() => null)}
        >
          <Ionicons name="call" size={18} color={colors.primary} />
        </RectButton>
      ) : null}

      {phone ? (
        <RectButton
          style={[
            styles.iconButton,
            { backgroundColor: `${colors.success}22` },
          ]}
          onPress={() => {
            const cleanPhone = phone.replace(/[^0-9]/g, "");
            const formattedPhone = cleanPhone.startsWith("9")
              ? `351${cleanPhone}`
              : cleanPhone;
            const customerFirstName = getCustomerFirstName(item.customers);
            const message = t("listView.whatsappMessage", {
              name: customerFirstName,
            });
            Linking.openURL(
              `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(
                message
              )}`
            ).catch(() => null);
          }}
        >
          <FontAwesome name="whatsapp" size={18} color={colors.success} />
        </RectButton>
      ) : null}
    </View>
  );

  return (
    <SwipeableRow
      isDeleting={isDeleting}
      onDelete={() => {
        try {
          if ((globalThis as any).onDeleteAppointment) {
            (globalThis as any).onDeleteAppointment(item);
          }
        } catch {
          // ignore
        }
      }}
      onOpen={onSwipeOpen}
      onClose={onSwipeClose}
      renderLeftActions={renderLeftActions}
    >
      <AppointmentCard
        appointment={item}
        onPress={() => onAppointmentPress(item)}
      />
    </SwipeableRow>
  );
});

export function ListView({
  appointments,
  filterMode,
  onAppointmentPress,
  onNewAppointment,
  onRefresh,
  isRefreshing,
  deletingId,
  onScrollYChange,
  scrollY,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: ListViewProps) {
  const listRef = React.useRef<SectionList<Appointment, Section>>(null);
  const searchInputRef = React.useRef<TextInput>(null);
  const openSwipeRef = React.useRef<any>(null);
  const hasSetInitialOffset = React.useRef(false);
  const { colors } = useBrandingTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const today = todayLocalISO();
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchTerm = searchQuery.trim();

  const filteredAppointments = React.useMemo(() => {
    if (!searchTerm) return appointments;

    return appointments.filter((appointment) => {
      const appointmentServices = getAppointmentServiceEntries(appointment);
      const serviceNames = formatServiceLabels(appointmentServices);
      const petNames = getAppointmentPetNames(appointment, appointmentServices);
      const petBreeds = appointmentServices
        .map((entry) => entry.pets?.breed)
        .filter((value): value is string => Boolean(value));

      const values = [
        formatCustomerName(appointment.customers),
        appointment.customers?.phone,
        formatCustomerAddress(appointment.customers),
        ...petNames,
        ...petBreeds,
        appointment.appointment_date,
        appointment.appointment_time,
        appointment.notes,
        ...serviceNames,
      ].filter((value): value is string => Boolean(value));

      return values.some((value) => matchesSearchQuery(value, searchTerm));
    });
  }, [appointments, searchTerm]);

  // Group appointments by day
  const sections = React.useMemo<Section[]>(() => {
    const now = new Date();
    const todayKey = today;
    const source = filteredAppointments.filter((item) => {
      if (filterMode === "unpaid") {
        return (item.payment_status || "unpaid") !== "paid";
      }

      const dayKey = toDayKey(item.appointment_date);
      if (!dayKey) return false;

      if (filterMode === "upcoming") {
        // Exclude completed or cancelled
        if (item.status === "completed" || item.status === "cancelled")
          return false;
        // Future days are upcoming
        if (dayKey > todayKey) return true;
        // Past days: include only if appointment is still active (in_progress) or was confirmed (overdue)
        if (dayKey < todayKey) {
          return item.status === "in_progress" || item.status === "confirmed";
        }
        // For today, if time missing treat as upcoming; otherwise compare time to now
        const dateTime = getAppointmentDateTime(item, dayKey);
        if (!dateTime) return true;
        return dateTime >= now || item.status === "in_progress";
      }

      if (filterMode === "past") {
        if (dayKey < todayKey) return true;
        if (dayKey > todayKey) return false;
        const dateTime = getAppointmentDateTime(item, dayKey);
        if (!dateTime) return false;
        return dateTime < now;
      }

      return true;
    });

    const grouped: Record<string, Appointment[]> = {};
    for (const item of source) {
      // Normalize date to YYYY-MM-DD format
      const dayKey = toDayKey(item.appointment_date);
      if (dayKey) {
        grouped[dayKey] = grouped[dayKey] ? [...grouped[dayKey], item] : [item];
      }
    }

    const entries: Section[] = Object.entries(grouped).map(
      ([dayKey, items]) => {
        const titleLabel =
          dayKey === todayKey
            ? t("common.today")
            : formatDateLabel(dayKey, dateLocale, t("common.noDate"));
        return {
          dayKey,
          title: titleLabel,
          data: items.sort((x, y) =>
            (x.appointment_time || "").localeCompare(y.appointment_time || "")
          ),
        };
      }
    );

    if (filterMode === "past") {
      return entries.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    }

    return entries.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [filteredAppointments, filterMode, t, dateLocale, today]);

  const renderAppointmentItem = React.useCallback(
    ({ item }: { item: Appointment }) => (
      <AppointmentRow
        item={item}
        colors={colors}
        styles={styles}
        t={t}
        onAppointmentPress={onAppointmentPress}
        isDeleting={item.id === deletingId}
        onSwipeOpen={(ref) => {
          if (openSwipeRef.current && openSwipeRef.current !== ref) {
            openSwipeRef.current.close();
          }
          openSwipeRef.current = ref;
        }}
        onSwipeClose={(ref) => {
          if (openSwipeRef.current === ref) {
            openSwipeRef.current = null;
          }
        }}
      />
    ),
    [colors, styles, t, onAppointmentPress, deletingId]
  );

  const handleScrollCloseSwipe = React.useCallback(() => {
    if (openSwipeRef.current) {
      try {
        openSwipeRef.current.close();
      } catch {}
      openSwipeRef.current = null;
    }
  }, []);

  const handleScroll = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollCloseSwipe();
      if (onScrollYChange) {
        onScrollYChange(event.nativeEvent.contentOffset.y);
      }
    },
    [handleScrollCloseSwipe, onScrollYChange]
  );

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: SectionListData<Appointment, Section> }) => {
      const isPast = filterMode === "past";
      const sectionIsPast = section.dayKey && section.dayKey < today;
      const canCreate = !isPast && !sectionIsPast;

      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
          {canCreate ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onNewAppointment(section.dayKey)}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    },
    [filterMode, onNewAppointment, styles, today]
  );

  const listHeader = (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          ref={searchInputRef}
          placeholder={t("listView.searchPlaceholder")}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const listEmptyTitle = searchTerm
    ? t("listView.noSearchResults")
    : t("listView.noAppointments");
  const listEmptySubtitle = searchTerm
    ? t("listView.noSearchResultsSubtitle")
    : t("listView.noAppointmentsSubtitle");
  const canCreateOnEmpty = !searchTerm && filterMode !== "past";

  const applyInitialOffset = React.useCallback(() => {
    if (Platform.OS !== "ios" || hasSetInitialOffset.current) return;
    const list = listRef.current as any;
    if (!list) return;

    if (typeof list.scrollToOffset === "function") {
      list.scrollToOffset({ offset: SEARCH_HEADER_HEIGHT, animated: false });
      hasSetInitialOffset.current = true;
      return;
    }

    if (typeof list.scrollToLocation === "function") {
      if (sections.length > 0 && sections[0].data.length > 0) {
        list.scrollToLocation({
          sectionIndex: 0,
          itemIndex: 0,
          viewOffset: SEARCH_HEADER_HEIGHT,
          animated: false,
        });
        hasSetInitialOffset.current = true;
      }
      return;
    }

    const responder =
      typeof list.getScrollResponder === "function"
        ? list.getScrollResponder()
        : null;
    if (responder && typeof responder.scrollResponderScrollTo === "function") {
      responder.scrollResponderScrollTo({
        y: SEARCH_HEADER_HEIGHT,
        animated: false,
      });
      hasSetInitialOffset.current = true;
    }
  }, [sections]);

  React.useEffect(() => {
    if (Platform.OS !== "ios") return;
    searchInputRef.current?.blur();
    hasSetInitialOffset.current = false;
    requestAnimationFrame(applyInitialOffset);
  }, [filterMode]);

  return (
    <AnimatedSectionList
      ref={listRef}
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderAppointmentItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 20,
      }}
      onScroll={
        scrollY
          ? Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              {
                useNativeDriver: true,
                listener: (event: any) => {
                  handleScrollCloseSwipe();
                  if (onScrollYChange)
                    onScrollYChange(event.nativeEvent.contentOffset.y);
                },
              }
            )
          : handleScroll
      }
      SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      onContentSizeChange={applyInitialOffset}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      scrollEventThrottle={16}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          {searchTerm ? (
            <Ionicons
              name="search"
              size={64}
              color={colors.muted}
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Ionicons
              name="mail-open"
              size={64}
              color={colors.muted}
              style={{ marginBottom: 16 }}
            />
          )}
          <Text style={styles.emptyText}>{listEmptyTitle}</Text>
          <Text style={styles.emptySubtext}>{listEmptySubtitle}</Text>
          {canCreateOnEmpty ? (
            <Button
              title={t("appointments.newAppointment")}
              onPress={() => onNewAppointment()}
              style={styles.emptyAction}
            />
          ) : null}
        </View>
      }
      onRefresh={onRefresh}
      refreshing={isRefreshing}
      onEndReached={() => {
        if (hasMore && !isLoadingMore) {
          onLoadMore?.();
        }
      }}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        hasMore ? (
          <View style={{ paddingVertical: 12 }}>
            {isLoadingMore ? (
              <ActivityIndicator color={colors.primary} />
            ) : null}
          </View>
        ) : null
      }
    />
  );
}
