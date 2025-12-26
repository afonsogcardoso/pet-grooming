import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/common';
import {
  cancelConsumerAppointment,
  getConsumerAppointment,
  ConsumerAppointment,
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

function buildServiceItems(appointment: ConsumerAppointment, fallbackLabel: string) {
  const items: Array<{ name: string; pet?: string | null }> = [];
  (appointment.appointment_services || []).forEach((entry) => {
    const name = entry.services?.name || fallbackLabel;
    items.push({ name, pet: entry.pets?.name || null });
  });
  if (items.length === 0 && appointment.services?.name) {
    items.push({ name: appointment.services.name, pet: appointment.pets?.name || null });
  }
  return items;
}

export default function ConsumerAppointmentDetailScreen({ route }: Props) {
  const { id } = route.params as { id: string };
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { data: appointment, isLoading, error, refetch } = useQuery({
    queryKey: ['consumerAppointment', id],
    queryFn: () => getConsumerAppointment(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelConsumerAppointment(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(['consumerAppointment', id], updated);
      queryClient.invalidateQueries({ queryKey: ['consumerAppointments'] }).catch(() => null);
      Alert.alert(
        t('consumerAppointmentDetail.cancelSuccessTitle'),
        t('consumerAppointmentDetail.cancelSuccessMessage')
      );
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || t('consumerAppointmentDetail.cancelError');
      Alert.alert(t('common.error'), message);
    },
  });

  const canCancel =
    appointment?.status && !['completed', 'cancelled', 'in_progress'].includes(appointment.status);
  const statusColor = getStatusColor(appointment?.status);
  const serviceItems = appointment ? buildServiceItems(appointment, t('common.service')) : [];
  const dateLabel = appointment ? formatDate(appointment.appointment_date) || t('common.noDate') : '';
  const timeLabel = appointment ? formatTime(appointment.appointment_time) || '--' : '';

  const handleCancel = () => {
    if (!canCancel) return;
    Alert.alert(
      t('consumerAppointmentDetail.cancelTitle'),
      t('consumerAppointmentDetail.cancelMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('consumerAppointmentDetail.cancelConfirm'),
          style: 'destructive',
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
      >
        <ScreenHeader title={t('consumerAppointmentDetail.title')} />
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !appointment) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
      >
        <ScreenHeader title={t('consumerAppointmentDetail.title')} />
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {t('consumerAppointmentDetail.loadError')}</Text>
          <Button
            title={t('consumerAppointmentDetail.retryAction')}
            onPress={() => refetch()}
            variant="outline"
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={t('consumerAppointmentDetail.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.providerCard}>
          {appointment.account?.logo_url ? (
            <Image source={{ uri: appointment.account.logo_url }} style={styles.providerLogo} />
          ) : (
            <View style={styles.providerLogoFallback}>
              <Text style={styles.providerLogoFallbackText}>
                {appointment.account?.name?.slice(0, 1) || 'P'}
              </Text>
            </View>
          )}
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{appointment.account?.name || t('consumerAppointments.unknownProvider')}</Text>
            {appointment.account?.support_phone ? (
              <Text style={styles.providerContact}>{appointment.account.support_phone}</Text>
            ) : null}
            {appointment.account?.support_email ? (
              <Text style={styles.providerContact}>{appointment.account.support_email}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.statusRow}>
            <Text style={styles.infoLabel}>{t('consumerAppointmentDetail.status')}</Text>
            <View style={[styles.statusPill, { borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(appointment.status)}
              </Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('consumerAppointmentDetail.date')}</Text>
            <Text style={styles.infoValue}>
              {dateLabel} {t('common.at')} {timeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t('consumerAppointmentDetail.services')}</Text>
          {serviceItems.length > 0 ? (
            serviceItems.map((item, index) => (
              <Text key={`${item.name}-${index}`} style={styles.listItem}>
                • {item.name}
                {item.pet ? ` (${item.pet})` : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.infoValue}>{t('common.noData')}</Text>
          )}
        </View>

        {appointment.pets?.name ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t('consumerAppointmentDetail.pet')}</Text>
            <Text style={styles.infoValue}>
              {appointment.pets.name}
              {appointment.pets.breed ? ` • ${appointment.pets.breed}` : ''}
            </Text>
          </View>
        ) : null}

        {appointment.notes ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t('consumerAppointmentDetail.notes')}</Text>
            <Text style={styles.notesText}>{appointment.notes}</Text>
          </View>
        ) : null}

        <Button
          title={t('consumerAppointmentDetail.cancelAction')}
          onPress={handleCancel}
          loading={cancelMutation.isPending}
          disabled={!canCancel || cancelMutation.isPending}
          variant={canCancel ? 'outline' : 'primary'}
          style={styles.cancelButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 16,
    },
    providerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    providerLogo: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.background,
    },
    providerLogoFallback: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    providerLogoFallbackText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
    },
    providerInfo: {
      flex: 1,
    },
    providerName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    providerContact: {
      fontSize: 13,
      color: colors.muted,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 8,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
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
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    infoLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    listItem: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    notesText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    cancelButton: {
      marginTop: 4,
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
    errorCard: {
      margin: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 16,
      alignItems: 'center',
      gap: 12,
    },
    errorText: {
      color: colors.danger ?? '#dc2626',
      fontWeight: '600',
      fontSize: 15,
    },
    retryButton: {
      alignSelf: 'center',
    },
  });
}
