import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image, TextInput, Alert, Platform, ActionSheetIOS, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getProfile, updateProfile, uploadAvatar, resetPassword, Profile } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { getDateLocale, normalizeLanguage, setAppLanguage } from '../i18n';
import { PhoneInput } from '../components/common/PhoneInput';
import { buildPhone, splitPhone } from '../utils/phone';
import { resolveSupabaseUrl } from '../config/supabase';

WebBrowser.maybeCompleteAuthSession();

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
  const token = useAuthStore((s) => s.token);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<'google' | 'apple' | null>(null);

  const { data, isLoading, error, isRefetching } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: 1,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    placeholderData: () => queryClient.getQueryData(['profile']),
  });
  const currentLanguage = normalizeLanguage(data?.locale || i18n.language);
  const authProviders = Array.isArray(data?.authProviders) ? data.authProviders : [];
  const linkedProviders = new Set(
    authProviders.map((provider) => provider?.toString().toLowerCase()).filter(Boolean)
  );
  const isGoogleLinked = linkedProviders.has('google');
  const isAppleLinked = linkedProviders.has('apple');
  const googleButtonLabel = isGoogleLinked ? t('profile.linked') : t('profile.linkGoogle');
  const appleButtonLabel = isAppleLinked ? t('profile.linked') : t('profile.linkApple');
  const availableRoles = useMemo(() => {
    const roles = Array.isArray(data?.availableRoles) ? data?.availableRoles : [];
    if (roles.length) return Array.from(new Set(roles));
    if (data?.activeRole) return [data.activeRole];
    return [];
  }, [data?.availableRoles, data?.activeRole]);
  const activeRole = data?.activeRole ?? user?.activeRole ?? 'provider';

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
    applyIfProvided('firstName');
    applyIfProvided('lastName');
    applyIfProvided('phone');
    applyIfProvided('phoneCountryCode');
    applyIfProvided('phoneNumber');
    applyIfProvided('locale');
    applyIfProvided('avatarUrl');
    applyIfProvided('activeRole');
    applyIfProvided('availableRoles');
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
              firstName: user.firstName,
              lastName: user.lastName,
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
              firstName: user.firstName,
              lastName: user.lastName,
              avatarUrl: user.avatarUrl,
            }
          : undefined);
      const merged = current ? mergeProfileUpdate(current, updated, payload) : updated;
      queryClient.setQueryData<Profile | undefined>(['profile'], merged);
      const nextUser = {
        email: merged.email ?? user?.email,
        displayName:
          payload && 'displayName' in payload ? merged.displayName : merged.displayName ?? user?.displayName,
        firstName:
          payload && 'firstName' in payload ? merged.firstName : merged.firstName ?? user?.firstName,
        lastName:
          payload && 'lastName' in payload ? merged.lastName : merged.lastName ?? user?.lastName,
        avatarUrl:
          payload && 'avatarUrl' in payload ? merged.avatarUrl : merged.avatarUrl ?? user?.avatarUrl,
        activeRole: merged.activeRole ?? user?.activeRole,
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

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setPasswordError(null);
      Alert.alert(t('common.done'), t('profile.passwordUpdated'));
    },
    onError: () => Alert.alert(t('common.error'), t('profile.passwordUpdateError')),
  });

  const handleLinkProvider = async (provider: 'google' | 'apple') => {
    if (linkingProvider || updateMutation.isPending || languageMutation.isPending) return;
    if (linkedProviders.has(provider)) return;

    const supabaseUrl = resolveSupabaseUrl();
    if (!supabaseUrl || !token) {
      Alert.alert(t('common.error'), t('profile.linkConfigError'));
      return;
    }

    const providerLabel = t(`login.providers.${provider}`);
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'pawmi',
      path: 'auth/callback',
    });
    const scopeParam = provider === 'apple' ? '&scopes=name%20email' : '';
    const requestUrl = `${supabaseUrl}/auth/v1/user/identities/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectUri
    )}&response_type=token${scopeParam}`;

    setLinkingProvider(provider);

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
        return;
      }

      const payload = await response.json().catch(() => null);
      const authUrl = payload?.url;

      if (!authUrl) {
        Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === 'success') {
        Alert.alert(t('common.done'), t('profile.linkSuccess', { provider: providerLabel }));
        await queryClient.refetchQueries({ queryKey: ['profile'] });
      } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
        Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
      }
    } catch {
      Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
    } finally {
      setLinkingProvider(null);
    }
  };

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
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert(t('common.warning'), t('profile.nameRequired'));
      return;
    }
    updateMutation.mutate({
      firstName: editFirstName.trim() || null,
      lastName: editLastName.trim() || null,
      phone: editPhone.trim() || null,
    });
  };

  const handleEdit = () => {
    const fallbackName = data?.displayName || user?.displayName || '';
    const [fallbackFirst, ...fallbackLast] = fallbackName.split(' ');
    setEditFirstName(data?.firstName || fallbackFirst || '');
    setEditLastName(data?.lastName || fallbackLast.join(' ') || '');
    setEditPhone(data?.phone || '');
    setIsEditing(true);
  };

  const handleLanguageChange = (language: string) => {
    if (isEditing || updateMutation.isPending || languageMutation.isPending) return;
    languageMutation.mutate(language);
  };

  const handleRoleChange = (role: 'consumer' | 'provider') => {
    if (isEditing || updateMutation.isPending || languageMutation.isPending) return;
    if (role === activeRole) return;
    updateMutation.mutate({ activeRole: role });
  };

  const handleOpenPasswordForm = () => {
    if (isEditing || updateMutation.isPending || languageMutation.isPending) return;
    setShowPasswordForm(true);
    setPasswordError(null);
  };

  const handlePasswordCancel = () => {
    if (resetPasswordMutation.isPending) return;
    setShowPasswordForm(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleNewPasswordChange = (value: string) => {
    if (passwordError) setPasswordError(null);
    setNewPassword(value);
  };

  const handleConfirmPasswordChange = (value: string) => {
    if (passwordError) setPasswordError(null);
    setConfirmPassword(value);
  };

  const handlePasswordSave = () => {
    if (resetPasswordMutation.isPending) return;
    if (newPassword.length < 8) {
      setPasswordError(t('profile.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }
    setPasswordError(null);
    resetPasswordMutation.mutate(newPassword);
  };

  const displayName =
    [data?.firstName, data?.lastName].filter(Boolean).join(' ') ||
    data?.displayName ||
    user?.displayName ||
    t('common.user');
  const emailValue = data?.email || user?.email || t('common.noData');
  const createdAtValue = formatDate(data?.createdAt, dateLocale, t('common.noData'));
  const phoneParts = splitPhone(data?.phone);
  const phoneDisplay = buildPhone(
    data?.phoneCountryCode || phoneParts.phoneCountryCode,
    data?.phoneNumber || phoneParts.phoneNumber,
  );
  const avatarFallback = displayName.charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('profile.title')} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={pickImage}
              disabled={uploadingAvatar || updateMutation.isPending}
            >
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
            <View style={styles.headerInfo}>
              <Text style={styles.headerLabel}>{t('profile.header')}</Text>
              <Text style={styles.headerTitle}>{displayName}</Text>
              <Text style={styles.headerSubtitle}>{emailValue}</Text>
              {phoneDisplay ? <Text style={styles.headerDetail}>{phoneDisplay}</Text> : null}
              <Text style={styles.headerMeta}>
                {t('profile.createdAt')}: {createdAtValue}
              </Text>
            </View>
          </View>
          {!isEditing ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleEdit}
              disabled={updateMutation.isPending}
            >
              <Text style={styles.headerButtonText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editArea}>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.firstNamePlaceholder')}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editFirstName}
                    onChangeText={setEditFirstName}
                    placeholder={t('profile.firstNamePlaceholder')}
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.lastNamePlaceholder')}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editLastName}
                    onChangeText={setEditLastName}
                    placeholder={t('profile.lastNamePlaceholder')}
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <PhoneInput
                  label={t('common.phone')}
                  value={editPhone}
                  onChange={setEditPhone}
                  placeholder={t('common.phone')}
                  disabled={updateMutation.isPending}
                />
              </View>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonInline]}
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
                  style={[styles.button, styles.secondary, styles.buttonInline]}
                  onPress={() => setIsEditing(false)}
                  disabled={updateMutation.isPending}
                >
                  <Text style={styles.buttonTextSecondary}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {isLoading || isRefetching ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        {error ? <Text style={styles.error}>{t('profile.loadError')}</Text> : null}

        {availableRoles.length > 1 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.roleTitle')}</Text>
            <Text style={styles.sectionText}>{t('profile.roleDescription')}</Text>
            <View style={styles.roleOptions}>
              {availableRoles.includes('provider') ? (
                <TouchableOpacity
                  style={[styles.roleOption, activeRole === 'provider' && styles.roleOptionActive]}
                  onPress={() => handleRoleChange('provider')}
                  disabled={updateMutation.isPending || languageMutation.isPending || isEditing}
                >
                  <Text style={[styles.roleOptionText, activeRole === 'provider' && styles.roleOptionTextActive]}>
                    {t('profile.roleProvider')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {availableRoles.includes('consumer') ? (
                <TouchableOpacity
                  style={[styles.roleOption, activeRole === 'consumer' && styles.roleOptionActive]}
                  onPress={() => handleRoleChange('consumer')}
                  disabled={updateMutation.isPending || languageMutation.isPending || isEditing}
                >
                  <Text style={[styles.roleOptionText, activeRole === 'consumer' && styles.roleOptionTextActive]}>
                    {t('profile.roleConsumer')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

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
          <Text style={styles.sectionTitle}>{t('profile.linkTitle')}</Text>
          <Text style={styles.sectionText}>{t('profile.linkDescription')}</Text>
          <View style={styles.linkGroup}>
            <TouchableOpacity
              style={[
                styles.linkButton,
                (linkingProvider || isGoogleLinked) && styles.buttonDisabled,
              ]}
              onPress={() => handleLinkProvider('google')}
              disabled={Boolean(linkingProvider) || isGoogleLinked}
            >
              <View style={styles.linkButtonContent}>
                <Ionicons name="logo-google" size={18} color={colors.text} />
                <Text style={styles.linkButtonText}>{googleButtonLabel}</Text>
                {linkingProvider === 'google' ? <ActivityIndicator color={colors.text} /> : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.linkButton,
                (linkingProvider || isAppleLinked) && styles.buttonDisabled,
              ]}
              onPress={() => handleLinkProvider('apple')}
              disabled={Boolean(linkingProvider) || isAppleLinked}
            >
              <View style={styles.linkButtonContent}>
                <Ionicons name="logo-apple" size={18} color={colors.text} />
                <Text style={styles.linkButtonText}>{appleButtonLabel}</Text>
                {linkingProvider === 'apple' ? <ActivityIndicator color={colors.text} /> : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.security')}</Text>
          <Text style={styles.sectionText}>{t('profile.changePasswordDescription')}</Text>
          {showPasswordForm ? (
            <>
              <TextInput
                style={styles.editInput}
                value={newPassword}
                onChangeText={handleNewPasswordChange}
                placeholder={t('profile.newPassword')}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                secureTextEntry
              />
              <TextInput
                style={styles.editInput}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                placeholder={t('profile.confirmPassword')}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                secureTextEntry
              />
              {passwordError ? <Text style={[styles.error, { marginTop: 6 }]}>{passwordError}</Text> : null}
              <TouchableOpacity
                style={styles.button}
                onPress={handlePasswordSave}
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.secondary]}
                onPress={handlePasswordCancel}
                disabled={resetPasswordMutation.isPending}
              >
                <Text style={styles.buttonTextSecondary}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={handleOpenPasswordForm}
              disabled={isEditing || updateMutation.isPending || languageMutation.isPending}
            >
              <Text style={styles.buttonText}>{t('profile.changePassword')}</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.danger]}
          onPress={async () => {
            await useAuthStore.getState().clear();
            navigation.replace('Login');
          }}
        >
          <Text style={styles.buttonText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </View>
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
      paddingBottom: 120,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
      shadowColor: colors.background,
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
    headerInfo: {
      flex: 1,
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
    headerDetail: {
      color: colors.muted,
      marginTop: 2,
      fontSize: 13,
    },
    headerMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 6,
    },
    headerButton: {
      marginTop: 14,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    headerButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 14,
    },
    editArea: {
      marginTop: 12,
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
    section: {
      marginTop: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputGroup: {
      flex: 1,
      marginBottom: 10,
    },
    inputLabel: {
      color: colors.muted,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 6,
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
    roleOptions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    roleOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    roleOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    roleOptionText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    roleOptionTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    sectionText: {
      color: colors.muted,
      marginBottom: 12,
    },
    linkGroup: {
      gap: 12,
    },
    linkButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    linkButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    linkButtonText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 10,
    },
    buttonInline: {
      flex: 1,
      marginBottom: 0,
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
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
  });
}
