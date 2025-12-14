import { useMemo, useState } from 'react';
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
import { getAppointments, Appointment } from '../api/appointments';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { ViewSelector } from '../components/appointments/ViewSelector';
import { ListView } from '../components/appointments/ListView';
import { DayView } from '../components/appointments/DayView';
import { WeekView } from '../components/appointments/WeekView';
import { MonthView } from '../components/appointments/MonthView';

type Props = NativeStackScreenProps<any>;
type ViewMode = 'list' | 'day' | 'week' | 'month';
type FilterMode = 'upcoming' | 'past';

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
  const primary = colors.primary;
  const surface = colors.surface;
  const primarySoft = colors.primarySoft;

  const handleAppointmentPress = (appointment: Appointment) => {
    navigation.navigate('AppointmentDetail', { id: appointment.id });
  };

  const handleNewAppointment = (date?: string) => {
    navigation.navigate('NewAppointment', { date });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Agendamentos</Text>
          <Text style={styles.subtitle}>Múltiplas visões para melhor organização</Text>
        </View>
        <TouchableOpacity 
          style={[styles.primaryButton, { backgroundColor: primary }]} 
          onPress={() => handleNewAppointment()}
        >
          <Text style={styles.primaryButtonText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <ViewSelector viewMode={viewMode} onViewChange={setViewMode} />

      {/* Filter for List view only */}
      {viewMode === 'list' && (
        <View style={styles.segment}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              filterMode === 'upcoming' && { backgroundColor: primarySoft, borderColor: primary },
            ]}
            onPress={() => setFilterMode('upcoming')}
          >
            <Text style={[styles.segmentText, { color: filterMode === 'upcoming' ? primary : colors.text }]}>
              Próximos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              filterMode === 'past' && { backgroundColor: primarySoft, borderColor: primary },
            ]}
            onPress={() => setFilterMode('past')}
          >
            <Text style={[styles.segmentText, { color: filterMode === 'past' ? primary : colors.text }]}>
              Anteriores
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
          Não foi possível carregar agendamentos{'\n'}
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

      <View style={{ paddingBottom: 8, paddingTop: 12 }}>
        <TouchableOpacity 
          style={[styles.secondaryButton, { borderColor: primary }]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      marginTop: 4,
      fontSize: 13,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    segment: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
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
