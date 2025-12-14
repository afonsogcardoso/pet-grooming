import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

export default function HomeScreen({ navigation }: Props) {
  const token = useAuthStore((s) => s.token);
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);
  const { branding, colors, isLoading: brandingLoading } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const primary = colors.primary;
  const primarySoft = colors.primarySoft;
  const background = colors.background;
  const accent = colors.accent;
  const accountName = branding?.account_name || 'Pet Grooming';
  const heroImage = branding?.portal_image_url || branding?.logo_url || null;
  const screenWidth = Dimensions.get('window').width;

  const logout = async () => {
    await clear();
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.hero, { borderColor: primarySoft }]}>
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={[styles.heroImage, { width: screenWidth - 40, borderColor: primarySoft }]}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.heroContent}>
          <View style={[styles.badge, { backgroundColor: primarySoft }]}>
            <Text style={[styles.badgeText, { color: primary }]}>Conta</Text>
          </View>
          <Text style={styles.heroTitle}>{accountName}</Text>
          <Text style={styles.heroSubtitle}>Bem-vindo {user?.email ?? 'visitante'}</Text>
          <Text style={[styles.heroMeta, { color: accent }]}>
            {token ? 'Sessão ativa' : 'Sem sessão'}
          </Text>
          {brandingLoading ? <ActivityIndicator color={primary} style={{ marginTop: 10 }} /> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.card, { borderColor: primarySoft }]} onPress={() => navigation.navigate('NewAppointment')}>
          <Text style={styles.cardTitle}>Nova marcação</Text>
          <Text style={styles.cardSubtitle}>Criar uma marcação rápida</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { borderColor: primarySoft }]} onPress={() => navigation.navigate('Appointments')}>
          <Text style={styles.cardTitle}>Agendamentos</Text>
          <Text style={styles.cardSubtitle}>Ver e gerir marcações</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { borderColor: primarySoft }]} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.cardTitle}>Perfil</Text>
          <Text style={styles.cardSubtitle}>Dados da conta e sessão</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: primary }]} onPress={logout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    hero: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      backgroundColor: colors.surface,
      marginBottom: 16,
      overflow: 'hidden',
    },
    heroImage: {
      height: 160,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    heroContent: {
      gap: 4,
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      marginBottom: 10,
      backgroundColor: colors.primarySoft,
    },
    badgeText: {
      fontWeight: '700',
      color: colors.primary,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
    },
    heroSubtitle: {
      color: colors.muted,
      marginTop: 6,
    },
    heroMeta: {
      marginTop: 8,
      fontWeight: '700',
      color: colors.accent,
    },
    actions: {
      gap: 12,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.primarySoft,
      borderRadius: 14,
      padding: 14,
      backgroundColor: colors.surface,
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
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 16,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
  });
}
