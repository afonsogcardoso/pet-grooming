import { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/common';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getConsumerAppointments, ConsumerAppointment } from '../api/consumerAppointments';
import { getStatusColor, getStatusLabel } from '../utils/appointmentStatus';
import { getDateLocale } from '../i18n';
import { getCardStyle } from '../theme/uiTokens';
import { getMarketplaceAccounts } from '../api/marketplace';

type Props = NativeStackScreenProps<any>;

function formatDateTime(value?: ConsumerAppointment | null, locale?: string) {
  if (!value?.appointment_date) return null;
  const time = value.appointment_time ? value.appointment_time.slice(0, 5) : '00:00';
  const dateTime = new Date(`${value.appointment_date}T${time}:00`);
  if (Number.isNaN(dateTime.getTime())) return null;
  const dateLabel = dateTime.toLocaleDateString(locale || undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return { dateLabel, timeLabel: time };
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

export default function ConsumerHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const user = useAuthStore((s) => s.user);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dateLocale = getDateLocale();
  const firstName =
    user?.firstName ||
    user?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    t('common.user');

  const today = new Date().toLocaleDateString('sv-SE');
  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: ['consumerAppointments', 'next'],
    queryFn: () => getConsumerAppointments({ from: today, limit: 20 }),
  });

  const { data: recommendedAccounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['marketplaceAccounts', 'home'],
    queryFn: () => getMarketplaceAccounts({ limit: 6 }),
  });

  const nextAppointment = useMemo(() => {
    const items = appointmentsData?.items || [];
    const now = new Date();
    const upcoming = items
      .map((appointment) => {
        const time = appointment.appointment_time ? appointment.appointment_time.slice(0, 5) : '00:00';
        const dateTime = appointment.appointment_date
          ? new Date(`${appointment.appointment_date}T${time}:00`)
          : null;
        return { appointment, dateTime };
      })
      .filter((entry) => entry.dateTime && !Number.isNaN(entry.dateTime.getTime()))
      .filter((entry) => entry.dateTime && entry.dateTime >= now)
      .sort((a, b) => (a.dateTime?.getTime() || 0) - (b.dateTime?.getTime() || 0));
    return upcoming[0]?.appointment || null;
  }, [appointmentsData]);

  const nextDateTime = formatDateTime(nextAppointment, dateLocale);
  const serviceList = nextAppointment ? getServiceNames(nextAppointment) : [];
  const nextStatusColor = nextAppointment ? getStatusColor(nextAppointment.status) : colors.muted;
  const recentAppointments = useMemo(() => {
    const items = appointmentsData?.items || [];
    return items
      .slice()
      .sort((a, b) => {
        const aDate = `${a.appointment_date || ''}T${(a.appointment_time || '00:00').slice(0, 5)}:00`;
        const bDate = `${b.appointment_date || ''}T${(b.appointment_time || '00:00').slice(0, 5)}:00`;
        return bDate.localeCompare(aDate);
      })
      .slice(0, 3);
  }, [appointmentsData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('consumerHome.title')} showBack={false} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.greeting}>{t('consumerHome.greeting', { name: firstName })}</Text>
            <Text style={styles.subtitle}>{t('consumerHome.subtitle')}</Text>
            <Text style={styles.body}>{t('consumerHome.body')}</Text>
            <Button
              title={t('consumerHome.marketplaceAction')}
              onPress={() => navigation.navigate('Marketplace')}
              style={styles.primaryButton}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('consumerHome.nextAppointmentTitle')}</Text>
            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
              </View>
            ) : nextAppointment ? (
              <TouchableOpacity
                style={styles.appointmentCard}
                onPress={() => navigation.navigate('ConsumerAppointmentDetail', { id: nextAppointment.id })}
                activeOpacity={0.8}
              >
                <View style={styles.appointmentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appointmentTitle}>
                      {nextAppointment.account?.name || t('consumerAppointments.unknownProvider')}
                    </Text>
                    <Text style={styles.appointmentSubtitle} numberOfLines={1}>
                      {serviceList.length > 0 ? serviceList.join(', ') : t('common.service')}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { borderColor: nextStatusColor }]}>
                    <View style={[styles.statusDot, { backgroundColor: nextStatusColor }]} />
                    <Text style={[styles.statusText, { color: nextStatusColor }]}>
                      {getStatusLabel(nextAppointment.status)}
                    </Text>
                  </View>
                </View>
                {nextDateTime ? (
                  <Text style={styles.appointmentMeta}>
                    {nextDateTime.dateLabel} {t('common.at')} {nextDateTime.timeLabel}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('consumerHome.nextAppointmentEmpty')}</Text>
                <Button
                  title={t('consumerHome.nextAppointmentAction')}
                  onPress={() => navigation.navigate('Marketplace')}
                  size="small"
                />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('consumerHome.recommendedTitle')}</Text>
            {loadingAccounts ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
              </View>
            ) : recommendedAccounts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('consumerHome.recommendedEmpty')}</Text>
                <Button
                  title={t('consumerHome.marketplaceAction')}
                  onPress={() => navigation.navigate('Marketplace')}
                  size="small"
                />
              </View>
            ) : (
              <View style={styles.recommendedGrid}>
                {recommendedAccounts.slice(0, 4).map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    style={styles.recommendedCard}
                    onPress={() => navigation.navigate('MarketplaceAccount', { slug: account.slug })}
                    activeOpacity={0.8}
                  >
                    {account.logo_url ? (
                      <Image source={{ uri: account.logo_url }} style={styles.recommendedLogo} />
                    ) : (
                      <View style={styles.recommendedLogoFallback}>
                        <Text style={styles.recommendedLogoText}>{account.name?.slice(0, 1) || 'P'}</Text>
                      </View>
                    )}
                    <Text style={styles.recommendedName} numberOfLines={1}>
                      {account.name}
                    </Text>
                    <Text style={styles.recommendedSubtitle} numberOfLines={1}>
                      {(account.marketplace_categories || []).slice(0, 1).join(', ') || t('common.service')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('consumerHome.recentTitle')}</Text>
            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>{t('common.loading')}</Text>
              </View>
            ) : recentAppointments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('consumerHome.recentEmpty')}</Text>
              </View>
            ) : (
              <View style={styles.recentList}>
                {recentAppointments.map((appointment) => {
                  const dateTime = formatDateTime(appointment, dateLocale);
                  const statusColor = getStatusColor(appointment.status);
                  const services = getServiceNames(appointment);
                  return (
                    <TouchableOpacity
                      key={appointment.id}
                      style={styles.recentCard}
                      onPress={() => navigation.navigate('ConsumerAppointmentDetail', { id: appointment.id })}
                      activeOpacity={0.8}
                    >
                      <View style={styles.recentHeader}>
                        <Text style={styles.recentTitle} numberOfLines={1}>
                          {appointment.account?.name || t('consumerAppointments.unknownProvider')}
                        </Text>
                        <View style={[styles.statusPill, { borderColor: statusColor }]}>
                          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {getStatusLabel(appointment.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.recentSubtitle} numberOfLines={1}>
                        {services.length > 0 ? services.join(', ') : t('common.service')}
                      </Text>
                      {dateTime ? (
                        <Text style={styles.recentMeta}>
                          {dateTime.dateLabel} {t('common.at')} {dateTime.timeLabel}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  const cardBase = getCardStyle(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    card: {
      ...cardBase,
      borderRadius: 20,
      padding: 20,
    },
    greeting: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    body: {
      fontSize: 14,
      color: colors.muted,
      marginBottom: 16,
      lineHeight: 20,
    },
    primaryButton: {
      marginBottom: 10,
    },
    section: {
      marginTop: 18,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    loadingCard: {
      ...cardBase,
      alignItems: 'center',
      gap: 8,
    },
    loadingText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '500',
    },
    appointmentCard: {
      ...cardBase,
    },
    appointmentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appointmentTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    appointmentSubtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    appointmentMeta: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
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
    emptyCard: {
      ...cardBase,
      alignItems: 'center',
      gap: 12,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
    },
    recommendedGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    recommendedCard: {
      ...cardBase,
      flex: 1,
      minWidth: 140,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    recommendedLogo: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.background,
    },
    recommendedLogoFallback: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendedLogoText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    recommendedName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    recommendedSubtitle: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
    },
    recentList: {
      gap: 12,
    },
    recentCard: {
      ...cardBase,
    },
    recentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    recentTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    recentSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 6,
    },
    recentMeta: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
