import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

export default function HomeScreen({ navigation }: Props) {
  const token = useAuthStore((s) => s.token);
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
          <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
          
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

          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Appointments')}
            >
              <Text style={styles.secondaryActionIcon}>📅</Text>
              <Text style={styles.secondaryActionTitle}>{t('home.appointmentsTitle')}</Text>
              <Text style={styles.secondaryActionSubtitle}>{t('home.appointmentsSubtitle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Customers')}
            >
              <Text style={styles.secondaryActionIcon}>👥</Text>
              <Text style={styles.secondaryActionTitle}>{t('home.customersTitle')}</Text>
              <Text style={styles.secondaryActionSubtitle}>{t('home.customersSubtitle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Services')}
            >
              <Text style={styles.secondaryActionIcon}>✂️</Text>
              <Text style={styles.secondaryActionTitle}>{t('home.servicesTitle')}</Text>
              <Text style={styles.secondaryActionSubtitle}>{t('home.servicesSubtitle')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.marketplaceSection}>
            <Text style={styles.sectionTitle}>{t('home.marketplaceSection')}</Text>
            <TouchableOpacity
              style={[styles.marketplaceCard, { borderColor: primarySoft }]}
              onPress={() => navigation.navigate('MarketplaceProfile')}
            >
              <View style={[styles.marketplaceIcon, { backgroundColor: primarySoft }]}>
                <Text style={styles.marketplaceIconText}>🛍️</Text>
              </View>
              <View style={styles.marketplaceContent}>
                <Text style={styles.marketplaceTitle}>{t('home.marketplaceProfileTitle')}</Text>
                <Text style={styles.marketplaceSubtitle}>{t('home.marketplaceProfileSubtitle')}</Text>
              </View>
              <Text style={styles.marketplaceArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  const screenWidth = Dimensions.get('window').width;
  
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
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
    primaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
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
    secondaryActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    secondaryAction: {
      width: (screenWidth - 52) / 2,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    secondaryActionIcon: {
      fontSize: 32,
      marginBottom: 10,
    },
    secondaryActionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    secondaryActionSubtitle: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      fontWeight: '500',
    },
    marketplaceSection: {
      marginTop: 20,
    },
    marketplaceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    marketplaceIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    marketplaceIconText: {
      fontSize: 22,
    },
    marketplaceContent: {
      flex: 1,
    },
    marketplaceTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    marketplaceSubtitle: {
      fontSize: 13,
      color: colors.muted,
    },
    marketplaceArrow: {
      fontSize: 22,
      color: colors.text,
      fontWeight: '700',
      marginLeft: 8,
    },
  });
}
