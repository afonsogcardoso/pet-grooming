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
import { MiniMap } from '../components/common/MiniMap';
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
  const items: Array<{ name: string; pet?: string | null; price?: number | null }> = [];
  (appointment.appointment_services || []).forEach((entry) => {
    const name = entry.services?.name || fallbackLabel;
    items.push({ name, pet: entry.pets?.name || null, price: entry.services?.price ?? null });
  });
  if (items.length === 0 && appointment.services?.name) {
    items.push({
      name: appointment.services.name,
      pet: appointment.pets?.name || null,
      price: appointment.services?.price ?? null,
    });
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
  const servicesTotal = useMemo(
    () => serviceItems.reduce((sum, item) => sum + (item.price || 0), 0),
    [serviceItems]
  );
  const amount = appointment?.amount ?? (servicesTotal > 0 ? servicesTotal : null);
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
            <View style={styles.serviceList}>
              {serviceItems.map((item, index) => (
                <View
                  key={`${item.name}-${item.pet || 'no-pet'}-${index}`}
                  style={[
                    styles.serviceRow,
                    index !== serviceItems.length - 1 && styles.serviceRowDivider,
                  ]}
                >
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    {item.pet ? <Text style={styles.servicePet}>{item.pet}</Text> : null}
                  </View>
                  <Text style={styles.servicePrice}>
                    {item.price != null ? `€${Number(item.price).toFixed(2)}` : t('marketplace.priceOnRequest')}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.infoValue}>{t('common.noData')}</Text>
          )}
          {amount != null ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('appointmentDetail.totalValue')}</Text>
              <Text style={styles.totalValue}>€{Number(amount).toFixed(2)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>📸 {t('appointmentDetail.servicePhotos')}</Text>
          <View style={styles.photosGrid}>
            <View style={styles.photoItem}>
              <Text style={styles.photoLabel}>{t('appointmentDetail.before')}</Text>
              {appointment.before_photo_url ? (
                <Image source={{ uri: appointment.before_photo_url }} style={styles.photoItemImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>{t('common.noData')}</Text>
                </View>
              )}
            </View>
            <View style={styles.photoItem}>
              <Text style={styles.photoLabel}>{t('appointmentDetail.after')}</Text>
              {appointment.after_photo_url ? (
                <Image source={{ uri: appointment.after_photo_url }} style={styles.photoItemImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>{t('common.noData')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {appointment.customers?.address ? (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>📍 {t('appointmentDetail.address')}</Text>
            <Text style={styles.addressText}>{appointment.customers.address}</Text>
            <MiniMap address={appointment.customers.address} />
          </View>
        ) : null}

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
    serviceList: {
      gap: 12,
    },
    serviceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    serviceRowDivider: {
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    serviceInfo: {
      flex: 1,
    },
    serviceName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    servicePet: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    servicePrice: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    totalRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.surfaceBorder,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '600',
    },
    totalValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    photosGrid: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    photoItem: {
      flex: 1,
      alignItems: 'center',
    },
    photoLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    photoItemImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    photoPlaceholder: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPlaceholderText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: '600',
    },
    addressText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
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
