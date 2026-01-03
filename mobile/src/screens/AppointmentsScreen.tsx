import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAppointments, Appointment, deleteAppointment } from '../api/appointments';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { ViewSelector } from '../components/appointments/ViewSelector';
import { ListView } from '../components/appointments/ListView';
import { DayView } from '../components/appointments/DayView';
import { WeekView } from '../components/appointments/WeekView';
import { MonthView } from '../components/appointments/MonthView';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { UndoToast } from '../components/common/UndoToast';
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from '../utils/haptics';
import { useSwipeDeleteIndicator } from '../hooks/useSwipeDeleteIndicator';

type Props = NativeStackScreenProps<any>;
type ViewMode = 'list' | 'day' | 'week' | 'month';
type FilterMode = 'upcoming' | 'past' | 'unpaid';
type DeletePayload = {
  appointment: Appointment;
  affectedQueries: Array<{ key: unknown; index: number }>;
};
const UNDO_TIMEOUT_MS = 4000;

function todayLocalISO() {
  // YYYY-MM-DD usando timezone local (evita “pular” para amanhã em UTC)
  return new Date().toLocaleDateString('sv-SE'); // sv-SE => 2024-07-01
}

export default function AppointmentsScreen({ navigation }: Props) {
  const today = todayLocalISO();
  const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pendingOnly, setPendingOnly] = useState(false);

  const { branding: brandingData, colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const undoBottomOffset = tabBarHeight > 0 ? tabBarHeight : insets.bottom + 16;

  // For list/day view: fetch appointments based on filter mode
  // For week/month view: fetch a broader range
  const dateRange = useMemo(() => {
    if (viewMode === 'list') {
      return {
        from: filterMode === 'upcoming' ? today : undefined,
        to: filterMode === 'past' ? today : undefined,
      };
    }
    
    if (viewMode === 'day') {
      const dayStr = selectedDate.toLocaleDateString('sv-SE');
      return { from: dayStr, to: dayStr };
    }

    if (viewMode === 'week') {
      // Calculate Monday as start of week (like in WeekView)
      const day = selectedDate.getDay();
      const startOfWeek = new Date(selectedDate);
      startOfWeek.setDate(selectedDate.getDate() - (day === 0 ? 6 : day - 1));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      return {
        from: startOfWeek.toLocaleDateString('sv-SE'),
        to: endOfWeek.toLocaleDateString('sv-SE'),
      };
    }

    if (viewMode === 'month') {
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      
      return {
        from: startOfMonth.toLocaleDateString('sv-SE'),
        to: endOfMonth.toLocaleDateString('sv-SE'),
      };
    }

    return {};
  }, [viewMode, filterMode, selectedDate, today]);

  const {
    data: appointmentsData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['appointments', viewMode, filterMode, dateRange.from, dateRange.to],
    queryFn: () =>
      getAppointments({
        from: dateRange.from,
        to: dateRange.to,
        limit: 1000, // Fetch all for the period
        offset: 0,
      }),
    retry: 1,
  });

  const appointments = appointmentsData?.items || [];
  const pendingAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'pending'),
    [appointments],
  );
  const pendingCount = pendingAppointments.length;
  const hasPendingAppointments = pendingCount > 0;
  const queryClient = useQueryClient();
  const [undoVisible, setUndoVisible] = useState(false);
  const { deletingId, beginDelete, clearDeletingId } = useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePayload | null>(null);

  const restoreAppointment = useCallback((payload: DeletePayload) => {
    payload.affectedQueries.forEach(({ key, index }) => {
      queryClient.setQueryData(key, (old: any) => {
        if (!old || !Array.isArray(old.items)) return old;
        if (old.items.some((item: Appointment) => item.id === payload.appointment.id)) return old;
        const nextItems = [...old.items];
        const insertIndex = Math.min(Math.max(index, 0), nextItems.length);
        nextItems.splice(insertIndex, 0, payload.appointment);
        return { ...old, items: nextItems };
      });
    });
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: ({ appointment }: DeletePayload) => deleteAppointment(appointment.id),
    onSuccess: () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables?.appointment) {
        restoreAppointment(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      }
      Alert.alert(t('common.error'), err?.response?.data?.error || err.message || t('appointments.deleteError'));
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

  const startOptimisticDelete = useCallback((appointment: Appointment) => {
    if (pendingDeleteRef.current) {
      commitPendingDelete();
    }

    const affectedQueries: DeletePayload['affectedQueries'] = [];
    queryClient.getQueriesData({ queryKey: ['appointments'] }).forEach(([key, data]) => {
      const items = (data as any)?.items;
      if (!Array.isArray(items)) return;
      const index = items.findIndex((item: Appointment) => item.id === appointment.id);
      if (index !== -1) {
        affectedQueries.push({ key, index });
      }
    });

    queryClient.setQueriesData({ queryKey: ['appointments'] }, (old: any) => {
      if (!old || !Array.isArray(old.items)) return old;
      if (!old.items.some((item: Appointment) => item.id === appointment.id)) return old;
      return { ...old, items: old.items.filter((item: Appointment) => item.id !== appointment.id) };
    });

    pendingDeleteRef.current = { appointment, affectedQueries };
    setUndoVisible(true);
  }, [commitPendingDelete, queryClient]);

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
    (global as any).onDeleteAppointment = (appointment: Appointment) => {
      Alert.alert(t('appointments.deleteTitle'), t('appointments.deleteMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('appointments.deleteAction'),
          style: 'destructive',
          onPress: () => {
            hapticWarning();
            beginDelete(appointment.id, () => startOptimisticDelete(appointment));
          },
        },
      ]);
    };
    return () => {
      try { delete (global as any).onDeleteAppointment; } catch {}
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
    if (viewMode === 'list' && !hasPendingAppointments && pendingOnly) {
      setPendingOnly(false);
    }
  }, [hasPendingAppointments, pendingOnly, viewMode]);
  const primary = colors.primary;
  const surface = colors.surface;
  const primarySoft = colors.primarySoft;

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
      navigation.navigate('AppointmentDetail', { id: appointment.id });
    },
    [navigation]
  );

  const handleNewAppointment = useCallback(
    (date?: string, time?: string) => {
      navigation.navigate('NewAppointment', { date, time });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader 
        title={t('appointments.title')}
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
      <View style={styles.headerInfo}>
        <Text style={styles.subtitle}>{t('appointments.subtitle')}</Text>
      </View>

      {/* View Mode Selector */}
      <ViewSelector currentView={viewMode} onViewChange={handleViewChange} />

      {/* Filter for List view only */}
      {viewMode === 'list' && (
        <>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                filterMode === 'upcoming' && { backgroundColor: primarySoft, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => handleFilterChange('upcoming')}
            >
              <Text style={[styles.segmentText, { color: filterMode === 'upcoming' ? primary : colors.text }]}>
                {t('appointments.filterUpcoming')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                filterMode === 'past' && { backgroundColor: primarySoft, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => handleFilterChange('past')}
            >
              <Text style={[styles.segmentText, { color: filterMode === 'past' ? primary : colors.text }]}>
                {t('appointments.filterPast')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                filterMode === 'unpaid' && { backgroundColor: primarySoft, borderColor: colors.surfaceBorder },
              ]}
              onPress={() => handleFilterChange('unpaid')}
            >
              <Text style={[styles.segmentText, { color: filterMode === 'unpaid' ? primary : colors.text }]}>
                {t('appointments.filterUnpaid')}
              </Text>
            </TouchableOpacity>
            {hasPendingAppointments ? (
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  pendingOnly && { backgroundColor: primarySoft, borderColor: colors.surfaceBorder },
                ]}
                onPress={() => setPendingOnly((prev) => !prev)}
              >
                <Text style={[styles.segmentText, { color: pendingOnly ? primary : colors.text }]}>
                  {t('appointments.filterPending', { count: pendingCount })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}

      {/* Loading State */}
      {isLoading && !isRefetching ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : null}

      {/* Error State */}
      {error ? (
        <Text style={styles.error}>
          {t('appointments.loadError')}{'\n'}
          {(error as any)?.response?.data?.error || (error as Error)?.message || ''}
        </Text>
      ) : null}

      {/* View Content */}
      {!isLoading && !error && (
        <>
          {viewMode === 'list' && (
            <ListView
              appointments={pendingOnly ? pendingAppointments : appointments}
              filterMode={filterMode}
              onAppointmentPress={handleAppointmentPress}
              onNewAppointment={handleNewAppointment}
              onRefresh={refetch}
              isRefreshing={isRefetching}
              deletingId={deletingId}
            />
          )}

          {viewMode === 'day' && (
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

          {viewMode === 'week' && (
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

          {viewMode === 'month' && (
            <MonthView
              appointments={appointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onDayPress={(date) => {
                setSelectedDate(date);
                setViewMode('day');
              }}
              onRefresh={refetch}
              isRefreshing={isRefetching}
            />
          )}
        </>
      )}

      <UndoToast
        visible={undoVisible}
        message={t('appointments.deleteUndoMessage')}
        actionLabel={t('appointments.deleteUndoAction')}
        onAction={handleUndo}
        onTimeout={commitPendingDelete}
        onDismiss={commitPendingDelete}
        durationMs={UNDO_TIMEOUT_MS}
        bottomOffset={undoBottomOffset}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonText: {
      fontSize: 28,
      fontWeight: '300',
      color: '#ffffff',
      lineHeight: 28,
    },
    headerInfo: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 13,
    },
    segment: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    segmentButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    segmentText: {
      fontWeight: '700',
      color: colors.text,
    },
    error: {
      color: colors.danger,
      marginBottom: 10,
      textAlign: 'center',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
  });
}
