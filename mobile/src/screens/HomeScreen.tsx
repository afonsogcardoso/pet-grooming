import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAppointments, Appointment } from '../api/appointments';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCardStyle } from '../theme/uiTokens';
import { getStatusColor, getStatusLabel } from '../utils/appointmentStatus';
import { formatCustomerName } from '../utils/customer';

type Props = NativeStackScreenProps<any>;

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

function addDaysISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE');
}

function parseAppointmentDateTime(appointment: Appointment) {
  if (!appointment.appointment_date) return null;
  const time = appointment.appointment_time ? appointment.appointment_time.slice(0, 5) : '00:00';
  const dateTime = new Date(`${appointment.appointment_date}T${time}:00`);
  if (Number.isNaN(dateTime.getTime())) return null;
  return dateTime;
}

export default function HomeScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const { branding, colors, isLoading: brandingLoading } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const primary = colors.primary;
  const primarySoft = colors.primarySoft;
  const background = colors.background;
  const accountName = branding?.account_name || 'Pawmi';
  const firstName =
    user?.firstName ||
    user?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    t('common.user');
  const avatarUrl = user?.avatarUrl || null;
  const heroImage = branding?.portal_image_url || branding?.logo_url || null;
  const today = todayLocalISO();
  const upcomingTo = addDaysISO(30);

  const { data: upcomingData, isLoading: loadingAppointments } = useQuery({
    queryKey: ['appointments', 'home', today, upcomingTo],
    queryFn: () =>
      getAppointments({
        from: today,
        to: upcomingTo,
        limit: 1000,
        offset: 0,
      }),
  });

  const upcomingAppointments = upcomingData?.items || [];
  const todayAppointments = useMemo(
    () => upcomingAppointments.filter((appointment) => appointment.appointment_date === today),
    [today, upcomingAppointments],
  );
  const pendingCount = useMemo(
    () => todayAppointments.filter((appointment) => appointment.status === 'pending').length,
    [todayAppointments],
  );
  const unpaidCount = useMemo(
    () => todayAppointments.filter((appointment) => (appointment.payment_status || 'unpaid') !== 'paid').length,
    [todayAppointments],
  );
  const nextAppointment = useMemo(() => {
    const now = new Date();
    return upcomingAppointments
      .map((appointment) => ({ appointment, dateTime: parseAppointmentDateTime(appointment) }))
      .filter((entry) => entry.dateTime && entry.dateTime >= now)
      .sort((a, b) => (a.dateTime?.getTime() || 0) - (b.dateTime?.getTime() || 0))[0]?.appointment || null;
  }, [upcomingAppointments]);
  const nextDateTime = nextAppointment ? parseAppointmentDateTime(nextAppointment) : null;
  const nextTimeLabel = nextDateTime ? nextDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const nextCustomer = nextAppointment ? formatCustomerName(nextAppointment.customers) : '';
  const nextStatusColor = nextAppointment ? getStatusColor(nextAppointment.status) : colors.muted;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
            {t('home.greeting')}
          </Text>
          <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
            {firstName}
          </Text>
        </View>
        {brandingLoading ? (
          <ActivityIndicator color={primary} />
        ) : (
          <TouchableOpacity 
            style={[styles.profileButton, { borderColor: primarySoft }]}
            onPress={() => navigation.navigate('Profile')}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileImage} />
            ) : (
              <View style={[styles.initialsCircle, { backgroundColor: colors.surface }]}> 
                <Text style={styles.initialsText}>{String(firstName).slice(0,1).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: primary }]}>
          {heroImage ? (
            <Image
              source={{ uri: heroImage }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.heroOverlay}>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={styles.heroBadgeText}>✨ {accountName}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('home.welcomeBack')}</Text>
            <Text style={styles.heroSubtitle}>{t('home.heroSubtitle')}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.overviewTitle')}</Text>
          
          <TouchableOpacity 
            style={[styles.primaryAction, { backgroundColor: primary }]}
            onPress={() => navigation.navigate('NewAppointment')}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>✨</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{t('home.newAppointmentTitle')}</Text>
              <Text style={styles.actionSubtitle}>{t('home.newAppointmentSubtitle')}</Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>

          {loadingAppointments ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={primary} />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.overviewGrid}>
              <TouchableOpacity style={styles.overviewCard} onPress={() => navigation.navigate('Appointments')}>
                <Text style={styles.overviewValue}>{todayAppointments.length}</Text>
                <Text style={styles.overviewLabel}>{t('home.overviewToday')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overviewCard} onPress={() => navigation.navigate('Appointments')}>
                <Text style={styles.overviewValue}>{pendingCount}</Text>
                <Text style={styles.overviewLabel}>{t('home.overviewPending')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overviewCard} onPress={() => navigation.navigate('Appointments')}>
                <Text style={styles.overviewValue}>{unpaidCount}</Text>
                <Text style={styles.overviewLabel}>{t('home.overviewUnpaid')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.overviewCard}
                onPress={() => {
                  if (nextAppointment?.id) {
                    navigation.navigate('AppointmentDetail', { id: nextAppointment.id });
                  } else {
                    navigation.navigate('Appointments');
                  }
                }}
              >
                <Text style={styles.overviewValue}>{nextTimeLabel}</Text>
                <Text style={styles.overviewLabel}>{t('home.overviewNext')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {nextAppointment ? (
            <TouchableOpacity
              style={styles.nextCard}
              onPress={() => navigation.navigate('AppointmentDetail', { id: nextAppointment.id })}
              activeOpacity={0.8}
            >
              <View style={styles.nextHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {nextCustomer || t('common.noData')}
                  </Text>
                  <Text style={styles.nextSubtitle} numberOfLines={1}>
                    {nextAppointment.services?.name || t('common.service')}
                  </Text>
                </View>
                <View style={[styles.statusPill, { borderColor: nextStatusColor }]}>
                  <View style={[styles.statusDot, { backgroundColor: nextStatusColor }]} />
                  <Text style={[styles.statusText, { color: nextStatusColor }]}>
                    {getStatusLabel(nextAppointment.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.nextMeta}>
                {nextAppointment.appointment_date} {t('common.at')} {nextTimeLabel}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyNextCard}>
              <Text style={styles.emptyNextText}>{t('home.overviewNextEmpty')}</Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  const screenWidth = Dimensions.get('window').width;
  const cardBase = getCardStyle(colors);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 28,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 20,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 12,
    },
    greeting: {
      fontSize: 16,
      color: colors.muted,
      fontWeight: '500',
    },
    userName: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginTop: 2,
    },
    profileButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileIcon: {
      fontSize: 24,
    },
    profileImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    initialsCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialsText: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    heroCard: {
      marginHorizontal: 20,
      borderRadius: 20,
      height: 180,
      overflow: 'hidden',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    heroImage: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      opacity: 0.3,
    },
    heroOverlay: {
      flex: 1,
      padding: 20,
      justifyContent: 'flex-end',
    },
    heroBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 12,
    },
    heroBadgeText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: '#fff',
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.9)',
      fontWeight: '500',
    },
    section: {
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
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
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    actionIconText: {
      fontSize: 24,
    },
    actionContent: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: '#fff',
      marginBottom: 2,
    },
    actionSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '500',
    },
    actionArrow: {
      fontSize: 24,
      color: '#fff',
      fontWeight: '700',
    },
    overviewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    overviewCard: {
      width: (screenWidth - 52) / 2,
      ...cardBase,
      alignItems: 'center',
    },
    overviewValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    overviewLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      textAlign: 'center',
    },
    nextCard: {
      ...cardBase,
      marginBottom: 16,
    },
    nextHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    nextTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    nextSubtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    nextMeta: {
      marginTop: 10,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    emptyNextCard: {
      ...cardBase,
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyNextText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '600',
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
  });
}
