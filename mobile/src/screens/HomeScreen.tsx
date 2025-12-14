import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../state/authStore';
import { getBranding } from '../api/branding';

type Props = NativeStackScreenProps<any>;

export default function HomeScreen({ navigation }: Props) {
  const token = useAuthStore((s) => s.token);
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);

  const { data: branding, isLoading: brandingLoading } = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const primary = branding?.brand_primary || '#22c55e';
  const primarySoft = branding?.brand_primary_soft || '#22c55e1a';
  const background = branding?.brand_background || '#0f172a';
  const accent = branding?.brand_accent || '#f97316';
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#0f172a',
  },
  hero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#111827',
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
  },
  badgeText: {
    fontWeight: '700',
    color: '#22c55e',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  heroSubtitle: {
    color: '#cbd5e1',
    marginTop: 6,
  },
  heroMeta: {
    marginTop: 8,
    fontWeight: '700',
  },
  actions: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#22c55e1a',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#1e293b',
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
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
});
