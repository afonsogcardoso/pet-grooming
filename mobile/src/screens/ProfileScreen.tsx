import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image, TextInput, Alert, Platform, ActionSheetIOS, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';
import { useTranslation } from 'react-i18next';
import { getProfile, updateProfile, uploadAvatar, Profile } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { getDateLocale, normalizeLanguage, setAppLanguage } from '../i18n';

type Props = NativeStackScreenProps<any>;

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  try {
    return new Date(value).toLocaleString(locale, {
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
  const user = useAuthStore((s) => s.user);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    placeholderData: () => queryClient.getQueryData(['profile']),
  });
  const currentLanguage = normalizeLanguage(data?.locale || i18n.language);

  const mergeProfileUpdate = (current: Profile | undefined, updated: Profile, payload?: Partial<Profile>) => {
    if (!current) return updated;
    const next: Profile = { ...current };
    const isBlankString = (value: unknown) => typeof value === 'string' && value.trim().length === 0;
    const applyIfProvided = <K extends keyof Profile>(key: K) => {
      const value = updated[key];
      if (payload && key in payload) {
        if (value !== undefined) {
          next[key] = value;
        }
        return;
      }
      if (value !== undefined && value !== null && !isBlankString(value)) {
        next[key] = value;
      }
    };
    applyIfProvided('displayName');
    applyIfProvided('phone');
    applyIfProvided('locale');
    applyIfProvided('avatarUrl');
    applyIfProvided('email');
    applyIfProvided('lastLoginAt');
    applyIfProvided('createdAt');
    applyIfProvided('memberships');
    applyIfProvided('platformAdmin');
    return next;
  };

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onMutate: () => {
      const previousProfile =
        queryClient.getQueryData<Profile>(['profile']) ||
        data ||
        (user
          ? {
              email: user.email,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            }
          : undefined);
      if (previousProfile && !queryClient.getQueryData(['profile'])) {
        queryClient.setQueryData(['profile'], previousProfile);
      }
      return { previousProfile };
    },
    onSuccess: (updated, payload, context) => {
      const current =
        queryClient.getQueryData<Profile>(['profile']) ||
        context?.previousProfile ||
        data ||
        (user
          ? {
              email: user.email,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            }
          : undefined);
      const merged = current ? mergeProfileUpdate(current, updated, payload) : updated;
      queryClient.setQueryData<Profile | undefined>(['profile'], merged);
      const nextUser = {
        email: merged.email ?? user?.email,
        displayName:
          payload && 'displayName' in payload ? merged.displayName : merged.displayName ?? user?.displayName,
        avatarUrl:
          payload && 'avatarUrl' in payload ? merged.avatarUrl : merged.avatarUrl ?? user?.avatarUrl,
      };
      setUser(nextUser);
      setIsEditing(false);
      // profile updated
    },
    onError: () => Alert.alert(t('common.error'), t('profile.updateError')),
  });

  const languageMutation = useMutation({
    mutationFn: async (language: string) => updateProfile({ locale: normalizeLanguage(language) }),
    onMutate: async (language) => {
      const normalized = normalizeLanguage(language);
      const previousProfile = queryClient.getQueryData<Profile>(['profile']);
      queryClient.setQueryData<Profile | undefined>(['profile'], (current) =>
        current ? { ...current, locale: normalized } : current
      );
      const previousLanguage = i18n.language;
      await setAppLanguage(normalized);
      return { previousProfile, previousLanguage, normalized };
    },
    onSuccess: (updated, _language, context) => {
      if (updated?.locale) {
        queryClient.setQueryData<Profile | undefined>(['profile'], (current) =>
          current ? { ...current, locale: normalizeLanguage(updated.locale) } : current
        );
      } else if (context?.normalized) {
        queryClient.setQueryData<Profile | undefined>(['profile'], (current) =>
          current ? { ...current, locale: context.normalized } : current
        );
      }
    },
    onError: (_err, _language, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['profile'], context.previousProfile);
      }
      if (context?.previousLanguage) {
        setAppLanguage(context.previousLanguage);
      }
      Alert.alert(t('common.error'), t('profile.updateError'));
    },
  });

  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('profile.cameraPermissionTitle'),
            message: t('profile.cameraPermissionMessage'),
            buttonNeutral: t('common.later'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const openCamera = async () => {
    const hasPermission = await requestAndroidPermissions();
    if (!hasPermission) {
      Alert.alert(t('profile.cameraPermissionDeniedTitle'), t('profile.cameraPermissionDeniedMessage'));
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
      saveToPhotos: false,
    };

    launchCamera(options, async (response) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error('Erro ao abrir câmara:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openCameraError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadAvatarFromUri(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const openGallery = async () => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
      selectionLimit: 1,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error('Erro ao abrir galeria:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openGalleryError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadAvatarFromUri(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const uploadAvatarFromUri = async (uri: string, fileName?: string | null) => {
    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const filename = `profile-${user?.id || 'unknown'}-${timestamp}.${extension}`;
      const fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      formData.append('file', {
        uri,
        type: fileType,
        name: filename,
      } as any);

      const { url } = await uploadAvatar(formData);
      await updateMutation.mutateAsync({ avatarUrl: url });
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      Alert.alert(t('common.error'), t('profile.uploadError'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickImage = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('profile.takePhoto'), t('profile.chooseFromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera();
          } else if (buttonIndex === 2) {
            openGallery();
          }
        }
      );
    } else {
      Alert.alert(
        t('profile.choosePhotoTitle'),
        t('profile.choosePhotoMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.takePhoto'), onPress: openCamera },
          { text: t('profile.chooseFromGallery'), onPress: openGallery },
        ]
      );
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

  const handleLanguageChange = (language: string) => {
    if (isEditing || updateMutation.isPending || languageMutation.isPending) return;
    languageMutation.mutate(language);
  };

  const avatarFallback = data?.displayName ? data.displayName.charAt(0).toUpperCase() : '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('profile.title')} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <TouchableOpacity style={styles.avatar} onPress={pickImage} disabled={uploadingAvatar || updateMutation.isPending}>
            {data?.avatarUrl ? (
              <Image source={{ uri: data.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{avatarFallback}</Text>
            )}
            {uploadingAvatar ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>📷</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>{t('profile.header')}</Text>
            {isEditing ? (
              <>
                <TextInput
                  style={styles.editInput}
                  value={editDisplayName}
                  onChangeText={setEditDisplayName}
                  placeholder={t('common.name')}
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  style={styles.editInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder={t('common.phone')}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.muted}
                />
              </>
            ) : (
              <>
                <Text style={styles.headerTitle}>{data?.displayName}</Text>
                <Text style={styles.headerSubtitle}>{data?.email}</Text>
                <Text style={styles.headerMeta}>
                  {t('profile.lastLogin', { date: formatDate(data?.lastLoginAt, dateLocale, t('common.noData')) })}
                </Text>
              </>
            )}
          </View>
        </View>

        {isLoading || isRefetching ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        {error ? <Text style={styles.error}>{t('profile.loadError')}</Text> : null}

        <View style={styles.infoGrid}>
          <InfoPill label={t('profile.createdAt')} value={formatDate(data?.createdAt, dateLocale, t('common.noData'))} />
          <InfoPill label={t('common.phone')} value={data?.phone || t('common.noData')} />
          <InfoPill label={t('profile.language')} value={t(`language.${normalizeLanguage(data?.locale || 'pt')}`)} />
          <InfoPill label={t('profile.associations')} value={0} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
          <View style={styles.languageOptions}>
            {(['pt', 'en'] as const).map((lang) => {
              const isActive = currentLanguage === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.languageOption, isActive && styles.languageOptionActive]}
                  onPress={() => handleLanguageChange(lang)}
                  disabled={updateMutation.isPending || languageMutation.isPending || isEditing}
                >
                  <Text style={[styles.languageOptionText, isActive && styles.languageOptionTextActive]}>
                    {t(`language.${lang}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.actions')}</Text>
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
                  <Text style={styles.buttonText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.secondary]} 
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.buttonTextSecondary}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.button} onPress={handleEdit}>
                <Text style={styles.buttonText}>{t('profile.editProfile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => refetch()}>
                <Text style={styles.buttonTextSecondary}>{t('profile.reloadProfile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.danger]} onPress={async () => {
                await useAuthStore.getState().clear();
                navigation.replace('Login');
              }}>
                <Text style={styles.buttonText}>{t('profile.logout')}</Text>
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
    avatarLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
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
    languageOptions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    languageOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
    },
    languageOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    languageOptionText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    languageOptionTextActive: {
      color: colors.primary,
      fontWeight: '700',
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
    danger: {
      backgroundColor: '#ef4444',
      marginTop: 20,
    },
  });
}
