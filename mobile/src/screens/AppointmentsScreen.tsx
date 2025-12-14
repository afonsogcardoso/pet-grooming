import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SectionList,
  Image,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAppointments, Appointment } from '../api/appointments';
import { useBrandingTheme } from '../theme/useBrandingTheme';

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

export default function AppointmentsScreen({ navigation }: Props) {
  const today = todayLocalISO();
  const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');

  const { branding: brandingData, colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const primary = colors.primary;
  const surface = colors.surface;
  const primarySoft = colors.primarySoft;

  const PaymentPill = ({ label }: { label: string }) => {
    const paid = label === 'paid';
    const color = paid ? colors.success : colors.warning;
    return (
      <View style={[styles.pill, { backgroundColor: color + '33', borderColor: color }]}>
        <Text style={[styles.pillText, { color }]}>{paid ? 'Pago' : 'Pendente'}</Text>
      </View>
    );
  };

  const AppointmentItem = ({ item }: { item: Appointment }) => {
    const petInitial = item.pets?.name?.charAt(0)?.toUpperCase() || '🐾';
    const price = item.services?.price;
    const address = item.customers?.address;
    const phone = item.customers?.phone;

    const openMaps = () => {
      if (!address) return;
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      Linking.openURL(url).catch(() => null);
    };

    const callCustomer = () => {
      if (!phone) return;
      Linking.openURL(`tel:${phone}`).catch(() => null);
    };

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: surface, borderColor: primarySoft }]}
        onPress={() => navigation.navigate('AppointmentDetail', { id: item.id })}
      >
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
          {price !== undefined && price !== null ? (
            <Text style={styles.cardMeta}>Valor: € {Number(price).toFixed(2)}</Text>
          ) : null}
        </View>
        <View style={styles.badges}>
          {item.payment_status ? <PaymentPill label={item.payment_status} /> : null}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {address ? (
              <TouchableOpacity style={[styles.chip, { borderColor: primary }]} onPress={openMaps}>
                <Text style={[styles.pillText, { color: primary }]}>Mapas</Text>
              </TouchableOpacity>
            ) : null}
            {phone ? (
              <TouchableOpacity style={[styles.chip, { borderColor: primary }]} onPress={callCustomer}>
                <Text style={[styles.pillText, { color: primary }]}>Ligar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
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

      {isLoading && !isRefetching ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      ) : null}
      {error ? (
        <Text style={styles.error}>
          Não foi possível carregar agendamentos{'\n'}
          {(error as any)?.response?.data?.error || (error as Error)?.message || ''}
        </Text>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AppointmentItem item={item} />}
        renderSectionHeader={({ section }) => {
          const isPast = filterMode === 'past';
          const today = todayLocalISO();
          const sectionIsPast = section.dayKey && section.dayKey < today;
          const canCreate = !isPast && !sectionIsPast;
          return (
            <View style={styles.sectionChip}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              {canCreate ? (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => navigation.navigate('NewAppointment', { date: section.dayKey })}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 40 }}
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
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={primary} style={{ marginVertical: 12 }} /> : null
        }
      />

      <View style={{ paddingBottom: 8 }}>
        <TouchableOpacity style={[styles.secondaryButton, { borderColor: primary }]} onPress={() => navigation.goBack()}>
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
      marginBottom: 12,
      gap: 8,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.muted,
      marginTop: 4,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    petThumb: {
      height: 44,
      width: 44,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    petImage: {
      height: '100%',
      width: '100%',
    },
    petInitial: {
      color: colors.primary,
      fontWeight: '800',
    },
    cardTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    cardSubtitle: {
      color: colors.muted,
      marginTop: 4,
    },
    cardMeta: {
      color: colors.muted,
      fontSize: 12,
    },
    status: {
      color: colors.primary,
      fontWeight: '700',
    },
    badges: {
      gap: 6,
      alignItems: 'flex-end',
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
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
    },
    empty: {
      color: colors.muted,
      textAlign: 'center',
      marginTop: 20,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: 12,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.text,
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
      color: colors.primary,
      fontWeight: '700',
    },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 6,
    marginTop: 12,
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    gap: 8,
  },
  addButton: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  addButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  });
}
