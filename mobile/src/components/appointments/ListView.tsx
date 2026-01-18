import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  StyleSheet,
  Linking,
  Platform,
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
import { getDateLocale } from "../../i18n";
import { formatCustomerAddress, getCustomerFirstName } from "../../utils/customer";
import type { Appointment } from "../../api/appointments";
import AppointmentCard from "./AppointmentCard";
import { Button } from "../common";
import { toDayKey } from "../../utils/appointmentFilters";

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

type Section = { dayKey: string; title: string; data: Appointment[] };

function formatDateLabel(
  value: string | null | undefined,
  locale: string,
  fallback: string,
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

function todayLocalISO() {
  return new Date().toLocaleDateString("sv-SE");
}

type ThemeColors = ReturnType<typeof useBrandingTheme>["colors"];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: { flex: 1 },
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
  });
}

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList as any,
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
  const address = formatCustomerAddress(item.customers);
  const phone = item.customers?.phone;

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
                  address,
                )}&key=${GOOGLE_MAPS_API_KEY}`,
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
                message,
              )}`,
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
  const openSwipeRef = React.useRef<any>(null);
  const { colors } = useBrandingTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const today = todayLocalISO();

  const sections = React.useMemo<Section[]>(() => {
    const todayKey = today;

    const grouped: Record<string, Appointment[]> = {};
    for (const item of appointments) {
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
            (x.appointment_time || "").localeCompare(y.appointment_time || ""),
          ),
        };
      },
    );

    if (filterMode === "past") {
      return entries.sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    }

    return entries.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  }, [appointments, filterMode, t, dateLocale, today]);

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
    [colors, styles, t, onAppointmentPress, deletingId],
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
    [handleScrollCloseSwipe, onScrollYChange],
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
    [filterMode, onNewAppointment, styles, today],
  );

  const listHeader = null;

  return (
    <AnimatedSectionList
      ref={listRef}
      style={styles.list}
      sections={sections}
      keyExtractor={(item: { id: string }) => item.id}
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
              },
            )
          : handleScroll
      }
      SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      scrollEventThrottle={16}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons
            name="mail-open"
            size={64}
            color={colors.muted}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>{t("listView.noAppointments")}</Text>
          <Text style={styles.emptySubtext}>
            {t("listView.noAppointmentsSubtitle")}
          </Text>
          {filterMode !== "past" ? (
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
