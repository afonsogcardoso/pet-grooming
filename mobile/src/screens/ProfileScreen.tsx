import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { getProfile, updateProfile, uploadAvatar } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

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

export default function ProfileScreen({ navigation }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const InfoPill = ({ label, value }: { label: string; value?: string | number | null }) => (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value ? String(value) : '—'}</Text>
    </View>
  );

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: 1,
  });

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      setUser({ email: updated.email, displayName: updated.displayName, avatarUrl: updated.avatarUrl });
      setIsEditing(false);
      Alert.alert('Sucesso', 'Perfil atualizado');
    },
    onError: () => Alert.alert('Erro', 'Não foi possível atualizar o perfil'),
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso às fotos para atualizar a imagem de perfil');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'avatar.jpg',
      } as any);

      try {
        const { url } = await uploadAvatar(formData);
        await updateMutation.mutateAsync({ avatarUrl: url });
      } catch {
        Alert.alert('Erro', 'Não foi possível fazer upload da imagem');
      }
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      displayName: editDisplayName.trim() || null,
      phone: editPhone.trim() || null,
    });
  };

  const handleEdit = () => {
    setEditDisplayName(data?.displayName || '');
    setEditPhone(data?.phone || '');
    setIsEditing(true);
  };

  const avatarFallback = data?.displayName ? data.displayName.charAt(0).toUpperCase() : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <TouchableOpacity style={styles.avatar} onPress={pickImage} disabled={updateMutation.isPending}>
            {data?.avatarUrl ? (
              <Image source={{ uri: data.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{avatarFallback}</Text>
            )}
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Perfil</Text>
            {isEditing ? (
              <>
                <TextInput
                  style={styles.editInput}
                  value={editDisplayName}
                  onChangeText={setEditDisplayName}
                  placeholder="Nome"
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  style={styles.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Telefone"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.muted}
                />
              </>
            ) : (
              <>
                <Text style={styles.headerTitle}>{data?.displayName}</Text>
                <Text style={styles.headerSubtitle}>{data?.email}</Text>
                <Text style={styles.headerMeta}>Último login: {formatDate(data?.lastLoginAt)}</Text>
              </>
            )}
          </View>
        </View>

        {isLoading || isRefetching ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        {error ? <Text style={styles.error}>Não foi possível buscar perfil agora.</Text> : null}

        <View style={styles.infoGrid}>
          <InfoPill label="Criado em" value={formatDate(data?.createdAt)} />
          <InfoPill label="Telefone" value={data?.phone || '—'} />
          <InfoPill label="Idioma" value={data?.locale || 'pt'} />
          <InfoPill label="Associações" value={0} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações</Text>
          {isEditing ? (
            <>
              <TouchableOpacity 
                style={styles.button} 
                onPress={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Guardar alterações</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.secondary]} 
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.buttonTextSecondary}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.button} onPress={handleEdit}>
                <Text style={styles.buttonText}>Editar perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => refetch()}>
                <Text style={styles.buttonTextSecondary}>Recarregar perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => navigation.goBack()}>
                <Text style={styles.buttonTextSecondary}>Voltar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 24,
      paddingTop: 32,
      paddingBottom: 40,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
      shadowColor: colors.background,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
    avatar: {
      height: 64,
      width: 64,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    avatarText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 24,
    },
    headerLabel: {
      color: colors.muted,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: colors.muted,
      marginTop: 2,
    },
    headerMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 6,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 10,
    },
    avatarBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: colors.primary,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    avatarBadgeText: {
      fontSize: 12,
    },
    editInput: {
      backgroundColor: colors.background,
      borderColor: colors.surfaceBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
      marginTop: 4,
      fontSize: 14,
    },
    error: {
      color: colors.danger,
      marginBottom: 8,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginVertical: 12,
    },
    pill: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      width: '47%',
    },
    pillLabel: {
      color: colors.muted,
      fontSize: 12,
      marginBottom: 4,
    },
    pillValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    section: {
      marginTop: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 6,
    },
    sectionText: {
      color: colors.muted,
      marginBottom: 12,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 10,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonTextSecondary: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
  });
}
