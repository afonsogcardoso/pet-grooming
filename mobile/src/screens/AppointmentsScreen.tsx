import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Alert,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  getAppointments,
  Appointment,
  deleteAppointment,
} from "../api/appointments";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { ViewSelector } from "../components/appointments/ViewSelector";
import { ListView } from "../components/appointments/ListView";
import { DayView } from "../components/appointments/DayView";
import { WeekView } from "../components/appointments/WeekView";
import { MonthView } from "../components/appointments/MonthView";
import { ScreenHeader } from "../components/ScreenHeader";
import { useTranslation } from "react-i18next";
import { UndoToast } from "../components/common/UndoToast";
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from "../utils/haptics";
import { useSwipeDeleteIndicator } from "../hooks/useSwipeDeleteIndicator";
import { getSegmentStyles } from "../theme/uiTokens";

type Props = NativeStackScreenProps<any>;
type ViewMode = "list" | "day" | "week" | "month";
type FilterMode = "upcoming" | "past" | "unpaid";
type DeletePayload = {
  appointment: Appointment;
  affectedQueries: Array<{ key: readonly unknown[]; index: number }>;
};
const UNDO_TIMEOUT_MS = 4000;

function todayLocalISO() {
  // YYYY-MM-DD usando timezone local (evita “pular” para amanhã em UTC)
  return new Date().toLocaleDateString("sv-SE"); // sv-SE => 2024-07-01
}

type AppointmentRouteParams = Partial<{
  filterMode: FilterMode;
  viewMode: ViewMode;
  pendingOnly: boolean;
  selectedDate: string;
}>;

export default function AppointmentsScreen({ navigation, route }: Props) {
  const routeParams = route?.params as AppointmentRouteParams | undefined;
  const today = todayLocalISO();
  const [filterMode, setFilterMode] = useState<FilterMode>(
    routeParams?.filterMode || "upcoming"
  );
  const [viewMode, setViewMode] = useState<ViewMode>(
    routeParams?.viewMode || "list"
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    if (routeParams?.selectedDate) {
      const parsed = new Date(routeParams.selectedDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [pendingOnly, setPendingOnly] = useState(
    Boolean(routeParams?.pendingOnly)
  );

  const { branding: brandingData, colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const undoBottomOffset = tabBarHeight > 0 ? tabBarHeight : insets.bottom + 16;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isCompactHeader, setIsCompactHeader] = useState(false);

  // For list/day view: fetch appointments based on filter mode
  // For week/month view: fetch a broader range
  const dateRange = useMemo(() => {
    if (viewMode === "list") {
      return {
        from: filterMode === "upcoming" ? today : undefined,
        to:
          filterMode === "past"
            ? today
            : filterMode === "unpaid"
            ? today
            : undefined,
      };
    }

    if (viewMode === "day") {
      const dayStr = selectedDate.toLocaleDateString("sv-SE");
      return { from: dayStr, to: dayStr };
    }

    if (viewMode === "week") {
      // Calculate Sunday as start of week (like in WeekView)
      const day = selectedDate.getDay();
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - day);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return {
        from: startOfWeek.toLocaleDateString("sv-SE"),
        to: endOfWeek.toLocaleDateString("sv-SE"),
      };
    }

    if (viewMode === "month") {
      const startOfMonth = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1
      );
      const endOfMonth = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth() + 1,
        0
      );

      return {
        from: startOfMonth.toLocaleDateString("sv-SE"),
        to: endOfMonth.toLocaleDateString("sv-SE"),
      };
    }

    return {};
  }, [viewMode, filterMode, selectedDate, today]);

  const isUnpaidPastOrCompleted = useCallback(
    (appointment: Appointment, now: Date) => {
      const unpaid = (appointment.payment_status || "unpaid") !== "paid";
      if (!unpaid) return false;
      if (appointment.status === "completed") return true;

      const dayKey = appointment.appointment_date;
      if (!dayKey) return false;
      if (dayKey < today) return true;
      if (dayKey > today) return false;

      const time = appointment.appointment_time;
      if (!time) return false;
      const m = String(time).match(/(\d{1,2}):(\d{2})/);
      if (!m) return false;
      const hh = `${m[1]}`.padStart(2, "0");
      const mm = m[2];
      const apptDate = new Date(`${dayKey}T${hh}:${mm}:00`);
      return apptDate < now;
    },
    [today]
  );

  const PAGE_SIZE = 20;

  const {
    data: appointmentsData,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<any, Error, any, any>({
    queryKey: [
      "appointments",
      viewMode,
      filterMode,
      dateRange.from,
      dateRange.to,
    ],
    queryFn: (context: any) => {
      const pageParam = context?.pageParam ?? 0;
      return getAppointments({
        from: dateRange.from,
        to: dateRange.to,
        limit: PAGE_SIZE,
        offset: pageParam,
      });
    },
    getNextPageParam: (lastPage: any) => lastPage.nextOffset ?? null,
    initialPageParam: 0,
    retry: 1,
  });

  const appointments: Appointment[] =
    (appointmentsData?.pages?.flatMap(
      (page: any) => page.items
    ) as Appointment[]) || [];
  const pendingAppointments = useMemo(
    () =>
      appointments.filter((appointment) => appointment.status === "pending"),
    [appointments]
  );
  const pendingCount = pendingAppointments.length;
  const hasPendingAppointments = pendingCount > 0;
  const hasUnpaidAppointments = useMemo(() => {
    if (isLoading) return false;
    const now = new Date();
    return appointments.some((appointment) =>
      isUnpaidPastOrCompleted(appointment, now)
    );
  }, [appointments, isLoading, isUnpaidPastOrCompleted]);

  // Lightweight server check: only if local pages found none; keep tiny page for speed.
  const { data: unpaidCheckData } = useQuery({
    queryKey: ["appointments-unpaid-check", today],
    queryFn: () => getAppointments({ to: today, limit: 10 }),
    staleTime: 1000 * 60 * 10,
    retry: 1,
    enabled: !hasUnpaidAppointments,
  });

  const hasUnpaidServer = useMemo(() => {
    const items = unpaidCheckData?.items || [];
    const now = new Date();
    return items.some((appointment) =>
      isUnpaidPastOrCompleted(appointment, now)
    );
  }, [isUnpaidPastOrCompleted, unpaidCheckData]);

  const displayAppointments = useMemo(() => {
    const now = new Date();
    let base = appointments;
    if (filterMode === "unpaid") {
      base = appointments.filter((appointment) =>
        isUnpaidPastOrCompleted(appointment, now)
      );
    }
    if (pendingOnly) {
      base = base.filter((appointment) => appointment.status === "pending");
    }
    return base;
  }, [appointments, filterMode, isUnpaidPastOrCompleted, pendingOnly]);

  const showUnpaidTab =
    hasUnpaidAppointments ||
    hasUnpaidServer ||
    routeParams?.filterMode === "unpaid";
  const queryClient = useQueryClient();
  const [undoVisible, setUndoVisible] = useState(false);
  const { deletingId, beginDelete, clearDeletingId } =
    useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePayload | null>(null);

  const restoreAppointment = useCallback(
    (payload: DeletePayload) => {
      payload.affectedQueries.forEach(({ key, index }) => {
        queryClient.setQueryData(key, (old: any) => {
          if (!old || !Array.isArray(old.items)) return old;
          if (
            old.items.some(
              (item: Appointment) => item.id === payload.appointment.id
            )
          )
            return old;
          const nextItems = [...old.items];
          const insertIndex = Math.min(Math.max(index, 0), nextItems.length);
          nextItems.splice(insertIndex, 0, payload.appointment);
          return { ...old, items: nextItems };
        });
      });
    },
    [queryClient]
  );

  const deleteMutation = useMutation({
    mutationFn: ({ appointment }: DeletePayload) =>
      deleteAppointment(appointment.id),
    onSuccess: () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables?.appointment) {
        restoreAppointment(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
      Alert.alert(
        t("common.error"),
        err?.response?.data?.error ||
          err.message ||
          t("appointments.deleteError")
      );
    },
  });

  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    deleteMutation.mutate(pending);
  }, [clearDeletingId, deleteMutation]);

  const startOptimisticDelete = useCallback(
    (appointment: Appointment) => {
      if (pendingDeleteRef.current) {
        commitPendingDelete();
      }

      const affectedQueries: DeletePayload["affectedQueries"] = [];
      queryClient
        .getQueriesData({ queryKey: ["appointments"] })
        .forEach(([key, data]) => {
          const items = (data as any)?.items;
          if (!Array.isArray(items)) return;
          const index = items.findIndex(
            (item: Appointment) => item.id === appointment.id
          );
          if (index !== -1) {
            affectedQueries.push({ key, index });
          }
        });

      queryClient.setQueriesData({ queryKey: ["appointments"] }, (old: any) => {
        if (!old || !Array.isArray(old.items)) return old;
        if (!old.items.some((item: Appointment) => item.id === appointment.id))
          return old;
        return {
          ...old,
          items: old.items.filter(
            (item: Appointment) => item.id !== appointment.id
          ),
        };
      });

      pendingDeleteRef.current = { appointment, affectedQueries };
      setUndoVisible(true);
    },
    [commitPendingDelete, queryClient]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    restoreAppointment(pending);
  }, [clearDeletingId, restoreAppointment]);

  useEffect(() => {
    // Expose a simple global hook used by ListView's SwipeableRow
    (globalThis as any).onDeleteAppointment = (appointment: Appointment) => {
      Alert.alert(
        t("appointments.deleteTitle"),
        t("appointments.deleteMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("appointments.deleteAction"),
            style: "destructive",
            onPress: () => {
              hapticWarning();
              beginDelete(appointment.id, () =>
                startOptimisticDelete(appointment)
              );
            },
          },
        ]
      );
    };
    return () => {
      try {
        delete (globalThis as any).onDeleteAppointment;
      } catch {}
    };
  }, [beginDelete, startOptimisticDelete, t]);

  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      pendingDeleteRef.current = null;
      deleteMutation.mutate(pending);
    };
  }, [deleteMutation]);

  useEffect(() => {
    if (viewMode === "list" && !hasPendingAppointments && pendingOnly) {
      setPendingOnly(false);
    }
  }, [hasPendingAppointments, pendingOnly, viewMode]);

  useEffect(() => {
    if (!routeParams) return;

    if (routeParams.filterMode) {
      setFilterMode(routeParams.filterMode);
    }

    if (routeParams.viewMode) {
      setViewMode(routeParams.viewMode);
    }

    if (typeof routeParams.pendingOnly === "boolean") {
      setPendingOnly(routeParams.pendingOnly);
    }

    if (routeParams.selectedDate) {
      const parsed = new Date(routeParams.selectedDate);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    }
  }, [routeParams]);

  useEffect(() => {
    if (viewMode !== "list") {
      scrollY.setValue(0);
    }
  }, [viewMode, scrollY]);
  const primary = colors.primary;
  const surface = colors.surface;
  const primarySoft = colors.primarySoft;

  const baseHeaderHeight = headerHeight || 150;
  const collapseDistance = Math.min(Math.max(baseHeaderHeight - 60, 50), 160);
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.5, collapseDistance],
    outputRange: [1, 0.88, 0.7],
    extrapolate: "clamp",
  });
  const headerTranslate = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [0, -14],
    extrapolate: "clamp",
  });

  const handleListScroll = useCallback(
    (y: number) => {
      const nextCompact = y > collapseDistance * 0.15;
      setIsCompactHeader((prev) => (prev === nextCompact ? prev : nextCompact));
    },
    [collapseDistance]
  );

  const handleViewChange = useCallback((nextView: ViewMode) => {
    hapticSelection();
    setSelectedDate(new Date());
    setViewMode(nextView);
  }, []);

  const handleFilterChange = (nextFilter: FilterMode) => {
    hapticSelection();
    setFilterMode(nextFilter);
  };

  const handleAppointmentPress = useCallback(
    (appointment: Appointment) => {
      navigation.navigate("AppointmentDetail", { id: appointment.id });
    },
    [navigation]
  );

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleNewAppointment = useCallback(
    (date?: string, time?: string) => {
      navigation.navigate("NewAppointment", { date, time });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("appointments.title")}
        rightElement={
          <TouchableOpacity
            onPress={() => handleNewAppointment()}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>+</Text>
          </TouchableOpacity>
        }
      />
      <Animated.View
        style={{
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslate }],
          paddingTop: isCompactHeader ? 2 : 8,
          paddingBottom: isCompactHeader ? 2 : 8,
          gap: 6,
          marginTop: isCompactHeader ? 8 : 0,
        }}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {/* View Mode Selector */}
        <Animated.View
          style={{
            transform: [{ scale: isCompactHeader ? 0.86 : 1 }],
            marginBottom: isCompactHeader ? -4 : 6,
          }}
        >
          <ViewSelector
            currentView={viewMode}
            onViewChange={handleViewChange}
            compact={isCompactHeader}
          />
        </Animated.View>

        {/* Filter for List view only */}
        {viewMode === "list" && (
          <Animated.View
            style={{
              transform: [{ scale: isCompactHeader ? 0.9 : 1 }],
            }}
          >
            <View style={styles.segment}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  isCompactHeader && styles.segmentButtonCompact,
                  filterMode === "upcoming" && styles.segmentButtonActive,
                ]}
                onPress={() => handleFilterChange("upcoming")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    isCompactHeader && styles.segmentTextCompact,
                    filterMode === "upcoming" && styles.segmentTextActive,
                  ]}
                >
                  {t("appointments.filterUpcoming")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  isCompactHeader && styles.segmentButtonCompact,
                  filterMode === "past" && styles.segmentButtonActive,
                ]}
                onPress={() => handleFilterChange("past")}
              >
                <Text
                  style={[
                    styles.segmentText,
                    isCompactHeader && styles.segmentTextCompact,
                    filterMode === "past" && styles.segmentTextActive,
                  ]}
                >
                  {t("appointments.filterPast")}
                </Text>
              </TouchableOpacity>
              {showUnpaidTab ? (
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    isCompactHeader && styles.segmentButtonCompact,
                    filterMode === "unpaid" && styles.segmentButtonActive,
                  ]}
                  onPress={() => handleFilterChange("unpaid")}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      isCompactHeader && styles.segmentTextCompact,
                      filterMode === "unpaid" && styles.segmentTextActive,
                    ]}
                  >
                    {t("appointments.filterUnpaid")}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {hasPendingAppointments ? (
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    isCompactHeader && styles.segmentButtonCompact,
                    pendingOnly && styles.segmentButtonActive,
                  ]}
                  onPress={() => setPendingOnly((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      isCompactHeader && styles.segmentTextCompact,
                      pendingOnly && styles.segmentTextActive,
                    ]}
                  >
                    {t("appointments.filterPending", { count: pendingCount })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>
        )}
      </Animated.View>

      {/* Loading State */}
      {isLoading && !isRefetching ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginVertical: 12 }}
        />
      ) : null}

      {/* Error State */}
      {error ? (
        <Text style={styles.error}>
          {t("appointments.loadError")}
          {"\n"}
          {(error as any)?.response?.data?.error ||
            (error as Error)?.message ||
            ""}
        </Text>
      ) : null}

      {/* View Content */}
      {!isLoading && !error && (
        <>
          {viewMode === "list" && (
            <ListView
              appointments={displayAppointments}
              filterMode={filterMode}
              onAppointmentPress={handleAppointmentPress}
              onNewAppointment={handleNewAppointment}
              onRefresh={refetch}
              isRefreshing={isRefetching}
              deletingId={deletingId}
              onScrollYChange={handleListScroll}
              scrollY={scrollY}
              onLoadMore={handleLoadMore}
              hasMore={Boolean(hasNextPage)}
              isLoadingMore={isFetchingNextPage}
            />
          )}

          {viewMode === "day" && (
            <DayView
              appointments={appointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onAppointmentPress={handleAppointmentPress}
              onNewAppointment={handleNewAppointment}
              onRefresh={refetch}
              isRefreshing={isRefetching}
            />
          )}

          {viewMode === "week" && (
            <WeekView
              appointments={appointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onAppointmentPress={handleAppointmentPress}
              onNewAppointment={handleNewAppointment}
              onRefresh={refetch}
              isRefreshing={isRefetching}
            />
          )}

          {viewMode === "month" && (
            <MonthView
              appointments={appointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onDayPress={(date) => {
                setSelectedDate(date);
                setViewMode("day");
              }}
              onRefresh={refetch}
              isRefreshing={isRefetching}
            />
          )}
        </>
      )}

      <UndoToast
        visible={undoVisible}
        message={t("appointments.deleteUndoMessage")}
        actionLabel={t("appointments.deleteUndoAction")}
        onAction={handleUndo}
        onTimeout={commitPendingDelete}
        onDismiss={commitPendingDelete}
        durationMs={UNDO_TIMEOUT_MS}
        bottomOffset={undoBottomOffset}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  const segment = getSegmentStyles(colors);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    actionButtonText: {
      fontSize: 28,
      fontWeight: "300",
      color: "#ffffff",
      lineHeight: 28,
    },
    headerInfo: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 4,
    },
    segment: {
      ...segment.container,
      marginBottom: 10,
      marginHorizontal: 16,
      paddingVertical: 2,
    },
    segmentButton: {
      ...segment.button,
      paddingVertical: 12,
    },
    segmentButtonCompact: {
      paddingVertical: 7,
      borderRadius: 11,
    },
    segmentButtonActive: {
      ...segment.buttonActive,
    },
    segmentText: {
      ...segment.text,
      fontWeight: "500",
    },
    segmentTextCompact: {
      fontSize: 12,
      fontWeight: "600",
    },
    segmentTextActive: {
      ...segment.textActive,
    },
    error: {
      color: colors.danger,
      marginBottom: 10,
      textAlign: "center",
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
  });
}
