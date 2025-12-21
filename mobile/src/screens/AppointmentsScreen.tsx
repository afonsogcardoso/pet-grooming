import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
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

type Props = NativeStackScreenProps<any>;
type ViewMode = 'list' | 'day' | 'week' | 'month';
type FilterMode = 'upcoming' | 'past' | 'unpaid';

function todayLocalISO() {
  // YYYY-MM-DD usando timezone local (evita “pular” para amanhã em UTC)
  return new Date().toLocaleDateString('sv-SE'); // sv-SE => 2024-07-01
}

export default function AppointmentsScreen({ navigation }: Props) {
  const today = todayLocalISO();
  const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { branding: brandingData, colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

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
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: any) => {
      Alert.alert(t('common.error'), err?.response?.data?.error || err.message || t('appointments.deleteError'));
    },
  });

  useEffect(() => {
    // Expose a simple global hook used by ListView's SwipeableRow
    (global as any).onDeleteAppointment = (id: string) => {
      Alert.alert(t('appointments.deleteTitle'), t('appointments.deleteMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('appointments.deleteAction'), style: 'destructive', onPress: () => deleteMutation.mutate(id) },
      ]);
    };
    return () => {
      try { delete (global as any).onDeleteAppointment; } catch {}
    };
  }, []);
  const primary = colors.primary;
  const surface = colors.surface;
  const primarySoft = colors.primarySoft;

  const handleViewChange = (nextView: ViewMode) => {
    setSelectedDate(new Date());
    setViewMode(nextView);
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    navigation.navigate('AppointmentDetail', { id: appointment.id });
  };

  const handleNewAppointment = (date?: string, time?: string) => {
    navigation.navigate('NewAppointment', { date, time });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
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
        <View style={styles.segment}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              filterMode === 'upcoming' && { backgroundColor: primarySoft, borderColor: colors.surfaceBorder },
            ]}
            onPress={() => setFilterMode('upcoming')}
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
            onPress={() => setFilterMode('past')}
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
            onPress={() => setFilterMode('unpaid')}
          >
            <Text style={[styles.segmentText, { color: filterMode === 'unpaid' ? primary : colors.text }]}>
              {t('appointments.filterUnpaid')}
            </Text>
          </TouchableOpacity>
        </View>
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
              appointments={appointments}
              filterMode={filterMode}
              onAppointmentPress={handleAppointmentPress}
              onNewAppointment={handleNewAppointment}
              onRefresh={refetch}
              isRefreshing={isRefetching}
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
