import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getProfile } from '../api/profile';
import { useAuthStore } from '../state/authStore';

type Props = NativeStackScreenProps<any>;

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function InfoPill({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value ? String(value) : '—'}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: 1,
  });

  const displayEmail = data?.email || user?.email || 'sem email';
  const displayName = data?.displayName || user?.email || 'Perfil';
  const avatarFallback = displayName?.charAt(0)?.toUpperCase() || '👤';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            {data?.avatarUrl ? (
              <Image source={{ uri: data.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{avatarFallback}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Perfil</Text>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <Text style={styles.headerSubtitle}>{displayEmail}</Text>
            <Text style={styles.headerMeta}>Último login: {formatDate(data?.lastLoginAt)}</Text>
          </View>
        </View>

        {isLoading || isRefetching ? <ActivityIndicator color="#22c55e" style={{ marginVertical: 12 }} /> : null}
        {error ? <Text style={styles.error}>Não foi possível buscar perfil agora.</Text> : null}

        <View style={styles.infoGrid}>
          <InfoPill label="Criado em" value={formatDate(data?.createdAt)} />
          <InfoPill label="Telefone" value={data?.phone || '—'} />
          <InfoPill label="Idioma" value={data?.locale || 'pt'} />
          <InfoPill label="Associações" value={0} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessão</Text>
          <Text style={styles.sectionText}>
            Token carregado no app, protegido via SecureStore. Recarregue o perfil para validar sessão.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => refetch()}>
            <Text style={styles.buttonText}>Recarregar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonTextSecondary}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  avatar: {
    height: 64,
    width: 64,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#22c55e',
    fontWeight: '800',
    fontSize: 24,
  },
  headerLabel: {
    color: '#94a3b8',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#cbd5e1',
    marginTop: 2,
  },
  headerMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  error: {
    color: '#f87171',
    marginBottom: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 12,
  },
  pill: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#27354a',
    width: '47%',
  },
  pillLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  pillValue: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
  section: {
    marginTop: 10,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 6,
  },
  sectionText: {
    color: '#94a3b8',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  secondary: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  buttonTextSecondary: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
});
