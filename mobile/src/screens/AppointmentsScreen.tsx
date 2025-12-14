import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SectionList,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAppointments, Appointment } from '../api/appointments';
import { getBranding } from '../api/branding';

type Props = NativeStackScreenProps<any>;
type FilterMode = 'upcoming' | 'past';

const statusColor: Record<string, string> = {
  scheduled: '#22c55e',
  pending: '#fbbf24',
  cancelled: '#f87171',
  completed: '#60a5fa',
};

function formatDateLabel(value?: string | null) {
  if (!value) return 'Sem data';
  try {
    return new Date(value).toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return value;
  }
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hh, mm] = match;
    return `${hh.padStart(2, '0')}:${mm}`;
  }
  return value;
}

function toDayKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayLocalISO() {
  // YYYY-MM-DD usando timezone local (evita “pular” para amanhã em UTC)
  return new Date().toLocaleDateString('sv-SE'); // sv-SE => 2024-07-01
}

function StatusPill({ label, type }: { label: string; type: string }) {
  const bg = statusColor[type] || '#22c55e';
  return (
    <View style={[styles.pill, { backgroundColor: bg + '33', borderColor: bg }]}>
      <Text style={[styles.pillText, { color: bg }]}>{label}</Text>
    </View>
  );
}

function PaymentPill({ label }: { label: string }) {
  const paid = label === 'paid';
  const color = paid ? '#22c55e' : '#fbbf24';
  return (
    <View style={[styles.pill, { backgroundColor: color + '33', borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{paid ? 'Pago' : 'Pendente'}</Text>
    </View>
  );
}

function AppointmentItem({
  item,
  primary,
  surface,
  primarySoft,
}: {
  item: Appointment;
  primary: string;
  surface: string;
  primarySoft: string;
}) {
  const petInitial = item.pets?.name?.charAt(0)?.toUpperCase() || '🐾';
  return (
    <View style={[styles.card, { backgroundColor: surface, borderColor: primarySoft }]}>
      <View style={[styles.petThumb, { backgroundColor: surface, borderColor: primarySoft }]}>
        {item.pets?.photo_url ? (
          <Image source={{ uri: item.pets.photo_url }} style={styles.petImage} />
        ) : (
          <Text style={[styles.petInitial, { color: primary }]}>{petInitial}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{formatTime(item.appointment_time)}</Text>
        <Text style={styles.cardSubtitle}>{item.services?.name || 'Serviço'}</Text>
        <Text style={styles.cardMeta}>
          {item.customers?.name || 'Cliente'} • {item.pets?.name || 'Pet'}
        </Text>
      </View>
      <View style={styles.badges}>
        {item.status ? <StatusPill label={item.status} type={item.status} /> : null}
        {item.payment_status ? <PaymentPill label={item.payment_status} /> : null}
      </View>
    </View>
  );
}

export default function AppointmentsScreen({ navigation }: Props) {
  const today = todayLocalISO();
  const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');

  const {
    data: brandingData,
    isLoading: isBrandingLoading,
    error: brandingError,
    refetch: refetchBranding,
    isRefetching: isBrandingRefetching,
  } = useQuery({
    queryKey: ['branding'],
    queryFn: () => getBranding(),
    staleTime: 1000 * 60 * 60 * 6, // 6h cache in-memory
  });

  const {
    data: appointmentsData,
    isLoading,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['appointments', today, filterMode],
    queryFn: ({ pageParam = 0 }) =>
      getAppointments({
        from: filterMode === 'upcoming' ? today : undefined,
        to: filterMode === 'past' ? today : undefined,
        limit: 25,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    initialPageParam: 0,
    retry: 1,
  });

  const appointments = (appointmentsData?.pages || []).flatMap((page) => page.items) || [];
  const branding = brandingData;
  const primary = branding?.brand_primary || '#22c55e';
  const background = branding?.brand_background || '#0f172a';
  const surface = '#1e293b';
  const primarySoft = branding?.brand_primary_soft || `${primary}33`;

  const sections = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {};
    for (const item of appointments) {
      const key = toDayKey(item.appointment_date) || item.appointment_date || 'Sem data';
      grouped[key] = grouped[key] ? [...grouped[key], item] : [item];
    }
    const todayKey = today;
    const entries = Object.entries(grouped).map(([rawKey, items]) => {
      const dayKey = toDayKey(rawKey) || rawKey;
      const titleLabel = dayKey === todayKey ? 'Hoje' : formatDateLabel(rawKey);
      return {
        dayKey,
        title: titleLabel,
        data: items.sort((x, y) => (x.appointment_time || '').localeCompare(y.appointment_time || '')),
      };
    });

    const today = entries.filter((entry) => entry.dayKey === todayKey);
    const future = entries
      .filter((entry) => entry.dayKey !== todayKey)
      .sort((a, b) => {
        if (a.dayKey && b.dayKey) return a.dayKey.localeCompare(b.dayKey);
        if (a.dayKey) return -1;
        if (b.dayKey) return 1;
        return 0;
      });

    const ordered = [...today, ...future];
    return filterMode === 'past' ? ordered.reverse() : ordered;
  }, [appointments, filterMode]);

  const handleNew = () => {
    navigation.navigate('NewAppointment');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Agendamentos</Text>
          <Text style={styles.subtitle}>Veja horários, serviços, clientes e status.</Text>
        </View>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: primary }]} onPress={handleNew}>
          <Text style={styles.primaryButtonText}>Nova</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.segment}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            filterMode === 'upcoming' && { backgroundColor: primarySoft, borderColor: primary },
          ]}
          onPress={() => setFilterMode('upcoming')}
        >
          <Text style={[styles.segmentText, { color: filterMode === 'upcoming' ? primary : '#e2e8f0' }]}>
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
          <Text style={[styles.segmentText, { color: filterMode === 'past' ? primary : '#e2e8f0' }]}>
            Anteriores
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading || isRefetching ? <ActivityIndicator color="#22c55e" style={{ marginVertical: 12 }} /> : null}
      {error ? (
        <Text style={styles.error}>
          Não foi possível carregar agendamentos{'\n'}
          {(error as any)?.response?.data?.error || (error as Error)?.message || ''}
        </Text>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AppointmentItem item={item} primary={primary} surface={surface} primarySoft={primarySoft} />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionChip, { backgroundColor: primarySoft, borderColor: primary }]}>
            <Text style={[styles.sectionHeader, { color: primary }]}>{title}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          !isLoading && !isRefetching ? (
            <Text style={styles.empty}>Nenhum agendamento encontrado.</Text>
          ) : null
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={primary} style={{ marginVertical: 12 }} /> : null
        }
      />

      <TouchableOpacity style={[styles.secondaryButton, { borderColor: primary }]} onPress={() => refetch()}>
        <Text style={styles.secondaryButtonText}>Recarregar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondaryButton, { borderColor: primary }]} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>Voltar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27354a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  petThumb: {
    height: 44,
    width: 44,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#27354a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petImage: {
    height: '100%',
    width: '100%',
  },
  petInitial: {
    color: '#22c55e',
    fontWeight: '800',
  },
  cardTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
  cardSubtitle: {
    color: '#94a3b8',
    marginTop: 4,
  },
  cardMeta: {
    color: '#94a3b8',
    fontSize: 12,
  },
  status: {
    color: '#22c55e',
    fontWeight: '700',
  },
  badges: {
    gap: 6,
    alignItems: 'flex-end',
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontWeight: '700',
    color: '#e2e8f0',
  },
  error: {
    color: '#f87171',
    marginBottom: 10,
  },
  empty: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 20,
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#22c55e',
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  sectionHeader: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  sectionChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
    marginTop: 12,
  },
});
