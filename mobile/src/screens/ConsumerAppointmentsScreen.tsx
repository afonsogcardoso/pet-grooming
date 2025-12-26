import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/common';
import {
  ConsumerAppointment,
  getConsumerAppointments,
} from '../api/consumerAppointments';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getStatusColor, getStatusLabel } from '../utils/appointmentStatus';

type Props = NativeStackScreenProps<any>;

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTime(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

function getServiceNames(appointment: ConsumerAppointment) {
  const names = new Set<string>();
  (appointment.appointment_services || []).forEach((entry) => {
    if (entry.services?.name) names.add(entry.services.name);
  });
  if (names.size === 0 && appointment.services?.name) {
    names.add(appointment.services.name);
  }
  return Array.from(names);
}

export default function ConsumerAppointmentsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    data: appointmentsData,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['consumerAppointments'],
    queryFn: () => getConsumerAppointments({ limit: 50 }),
  });

  const appointments = appointmentsData?.items || [];

  const renderItem = ({ item }: { item: ConsumerAppointment }) => {
    const accountName = item.account?.name || t('consumerAppointments.unknownProvider');
    const serviceList = getServiceNames(item);
    const statusColor = getStatusColor(item.status);
    const dateLabel = formatDate(item.appointment_date) || t('common.noDate');
    const timeLabel = formatTime(item.appointment_time) || '--';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ConsumerAppointmentDetail', { id: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <Text style={styles.accountName}>{accountName}</Text>
            <Text style={styles.services} numberOfLines={2}>
              {serviceList.length > 0 ? serviceList.join(', ') : t('common.service')}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.datetime}>
          {dateLabel} {t('common.at')} {timeLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t('consumerAppointments.title')} />
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t('consumerAppointments.title')} />
        <EmptyState
          icon="⚠️"
          title={t('consumerAppointments.errorTitle')}
          description={t('consumerAppointments.errorMessage')}
          actionLabel={t('consumerAppointments.retryAction')}
          onAction={() => refetch()}
        />
      </View>
    );
  }

  if (appointments.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t('consumerAppointments.title')} />
        <EmptyState
          icon="🐾"
          title={t('consumerAppointments.emptyTitle')}
          description={t('consumerAppointments.emptyMessage')}
          actionLabel={t('consumerAppointments.emptyAction')}
          onAction={() => navigation.navigate('Marketplace')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t('consumerAppointments.title')} />
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    cardTitle: {
      flex: 1,
    },
    accountName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    services: {
      fontSize: 13,
      color: colors.muted,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: colors.background,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    datetime: {
      marginTop: 12,
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.muted,
    },
  });
}
