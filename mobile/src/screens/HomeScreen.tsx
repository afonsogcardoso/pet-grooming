import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

export default function HomeScreen({ navigation }: Props) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { branding, colors, isLoading: brandingLoading } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const primary = colors.primary;
  const primarySoft = colors.primarySoft;
  const background = colors.background;
  const accountName = branding?.account_name || 'Pawmi';
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Utilizador';
  const avatarUrl = user?.avatarUrl || null;
  const heroImage = branding?.portal_image_url || branding?.logo_url || null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Olá! 👋</Text>
          <Text style={styles.userName}>{displayName}</Text>
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
                <Text style={styles.initialsText}>{String(displayName).slice(0,1).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

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
          <Text style={styles.heroTitle}>Bem-vindo de volta!</Text>
          <Text style={styles.heroSubtitle}>Gerencie seus agendamentos com facilidade</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        
        <TouchableOpacity 
          style={[styles.primaryAction, { backgroundColor: primary }]}
          onPress={() => navigation.navigate('NewAppointment')}
        >
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>✨</Text>
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Nova Marcação</Text>
            <Text style={styles.actionSubtitle}>Criar agendamento rápido</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity 
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('Appointments')}
          >
            <Text style={styles.secondaryActionIcon}>📅</Text>
            <Text style={styles.secondaryActionTitle}>Agendamentos</Text>
            <Text style={styles.secondaryActionSubtitle}>Ver marcações</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('Customers')}
          >
            <Text style={styles.secondaryActionIcon}>👥</Text>
            <Text style={styles.secondaryActionTitle}>Clientes</Text>
            <Text style={styles.secondaryActionSubtitle}>Gerir clientes e animais</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryAction}
            onPress={() => navigation.navigate('Services')}
          >
            <Text style={styles.secondaryActionIcon}>✂️</Text>
            <Text style={styles.secondaryActionTitle}>Serviços</Text>
            <Text style={styles.secondaryActionSubtitle}>Gerir catálogo</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 20,
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
      flex: 1,
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
  });
}
