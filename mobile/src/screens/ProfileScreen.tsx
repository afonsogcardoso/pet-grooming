import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Image, TextInput, Alert, Platform, ActionSheetIOS, PermissionsAndroid, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getProfile, updateProfile, uploadAvatar, resetPassword, Profile } from '../api/profile';
import { Branding, getBranding, updateBranding, uploadBrandLogo, uploadPortalImage } from '../api/branding';
import { getNotificationPreferences, registerPushToken, updateNotificationPreferences, NotificationPreferences, NotificationPreferencesPayload } from '../api/notifications';
import { useAuthStore } from '../state/authStore';
import { useViewModeStore, ViewMode } from '../state/viewModeStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { getDateLocale, normalizeLanguage, setAppLanguage } from '../i18n';
import { PhoneInput } from '../components/common/PhoneInput';
import { AddressAutocomplete } from '../components/appointment/AddressAutocomplete';
import { Input } from '../components/common';
import { buildPhone, splitPhone } from '../utils/phone';
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '../config/supabase';
import { formatVersionLabel } from '../utils/version';
import { hapticError, hapticSelection, hapticSuccess } from '../utils/haptics';
import { registerForPushNotifications } from '../utils/pushNotifications';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<any>;
type ProfileSection = 'info' | 'marketplace' | 'security' | 'notifications';
const REMINDER_PRESETS = [15, 30, 60, 120, 1440];
const MAX_REMINDER_OFFSETS = 2;

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

function normalizeReminderOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.round(entry))
    .filter((entry) => entry > 0 && entry <= 1440);
  const unique = Array.from(new Set(normalized)).sort((a, b) => a - b);
  return unique.slice(0, MAX_REMINDER_OFFSETS);
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push: {
    enabled: false,
    appointments: {
      created: true,
      confirmed: true,
      cancelled: true,
      reminder: true,
      reminder_offsets: [30],
    },
    marketplace: {
      request: true,
    },
    payments: {
      updated: true,
    },
    marketing: false,
  },
};

function mergeNotificationPreferences(
  current: NotificationPreferences,
  updates: NotificationPreferencesPayload
): NotificationPreferences {
  const source = updates?.push || {};
  const appointments = source.appointments || {};
  const marketplace = source.marketplace || {};
  const payments = source.payments || {};
  const reminderOffsets = appointments.reminder_offsets;

  return {
    push: {
      enabled: typeof source.enabled === 'boolean' ? source.enabled : current.push.enabled,
      appointments: {
        created: typeof appointments.created === 'boolean'
          ? appointments.created
          : current.push.appointments.created,
        confirmed: typeof appointments.confirmed === 'boolean'
          ? appointments.confirmed
          : current.push.appointments.confirmed,
        cancelled: typeof appointments.cancelled === 'boolean'
          ? appointments.cancelled
          : current.push.appointments.cancelled,
        reminder: typeof appointments.reminder === 'boolean'
          ? appointments.reminder
          : current.push.appointments.reminder,
        reminder_offsets: Array.isArray(reminderOffsets)
          ? reminderOffsets
          : current.push.appointments.reminder_offsets,
      },
      marketplace: {
        request: typeof marketplace.request === 'boolean'
          ? marketplace.request
          : current.push.marketplace.request,
      },
      payments: {
        updated: typeof payments.updated === 'boolean'
          ? payments.updated
          : current.push.payments.updated,
      },
      marketing: typeof source.marketing === 'boolean'
        ? source.marketing
        : current.push.marketing,
    },
  };
}

export default function ProfileScreen({ navigation }: Props) {
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const viewMode = useViewModeStore((s) => s.viewMode);
  const setViewMode = useViewModeStore((s) => s.setViewMode);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale();
  const versionLabel = useMemo(() => formatVersionLabel(), []);
  const scrollRef = useRef<ScrollView>(null);
  const [activeSection, setActiveSection] = useState<ProfileSection>('info');
  const [hasProfileEdits, setHasProfileEdits] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAddress2, setEditAddress2] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [marketplaceName, setMarketplaceName] = useState('');
  const [marketplaceDescription, setMarketplaceDescription] = useState('');
  const [marketplaceRegion, setMarketplaceRegion] = useState('');
  const [marketplaceInstagram, setMarketplaceInstagram] = useState('');
  const [marketplaceFacebook, setMarketplaceFacebook] = useState('');
  const [marketplaceTiktok, setMarketplaceTiktok] = useState('');
  const [marketplaceWebsite, setMarketplaceWebsite] = useState('');
  const [marketplaceLogoUrl, setMarketplaceLogoUrl] = useState<string | null>(null);
  const [marketplaceHeroUrl, setMarketplaceHeroUrl] = useState<string | null>(null);
  const [uploadingMarketplaceLogo, setUploadingMarketplaceLogo] = useState(false);
  const [uploadingMarketplaceHero, setUploadingMarketplaceHero] = useState(false);
  const [marketplaceInitialized, setMarketplaceInitialized] = useState(false);
  const [customReminderInput, setCustomReminderInput] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<'google' | 'apple' | null>(null);
  const showAppleLink = false;

  const { data, isLoading, error, isRefetching } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    retry: 1,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: false,
    placeholderData: () => queryClient.getQueryData(['profile']),
  });
  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => getBranding(),
    staleTime: 1000 * 60 * 2,
    initialData: () => queryClient.getQueryData<Branding>(['branding']),
    placeholderData: () => queryClient.getQueryData<Branding>(['branding']),
  });
  const {
    data: notificationPreferences,
    isLoading: loadingNotifications,
  } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: getNotificationPreferences,
    retry: 1,
    staleTime: 1000 * 60 * 5,
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
    const roles = Array.isArray(data?.availableRoles) ? data.availableRoles : [];
    if (roles.length) return Array.from(new Set(roles));
    if (data?.activeRole) return [data.activeRole];
    if (user?.activeRole) return [user.activeRole];
    return [];
  }, [data?.availableRoles, data?.activeRole, user?.activeRole]);
  const activeRole = data?.activeRole ?? user?.activeRole ?? 'provider';
  const resolvedViewMode: ViewMode = viewMode ?? (activeRole === 'consumer' ? 'consumer' : 'private');
  const canSwitchViewMode = availableRoles.includes('consumer') && availableRoles.includes('provider');
  const resolvedNotificationPreferences = notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;
  const pushEnabled = resolvedNotificationPreferences.push?.enabled ?? false;
  const reminderOffsets = useMemo(() => {
    const offsets = normalizeReminderOffsets(
      resolvedNotificationPreferences.push?.appointments?.reminder_offsets
    );
    return offsets.length ? offsets : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.reminder_offsets;
  }, [resolvedNotificationPreferences]);
  const reminderChipOptions = useMemo(() => {
    const combined = new Set([...REMINDER_PRESETS, ...reminderOffsets]);
    return Array.from(combined).sort((a, b) => a - b);
  }, [reminderOffsets]);
  const profileDefaults = useMemo(() => {
    const fallbackName = data?.displayName || user?.displayName || '';
    const [fallbackFirst, ...fallbackLast] = fallbackName.split(' ');
    return {
      firstName: data?.firstName || fallbackFirst || '',
      lastName: data?.lastName || fallbackLast.join(' ') || '',
      phone: data?.phone || '',
      address: data?.address || user?.address || '',
      address2: data?.address2 || user?.address2 || '',
    };
  }, [
    data?.displayName,
    data?.firstName,
    data?.lastName,
    data?.phone,
    data?.address,
    data?.address2,
    user?.displayName,
    user?.address,
    user?.address2,
  ]);
  const isProfileDirty = useMemo(() => {
    return (
      editFirstName.trim() !== profileDefaults.firstName.trim() ||
      editLastName.trim() !== profileDefaults.lastName.trim() ||
      editPhone.trim() !== profileDefaults.phone.trim() ||
      editAddress.trim() !== profileDefaults.address.trim() ||
      editAddress2.trim() !== profileDefaults.address2.trim()
    );
  }, [editFirstName, editLastName, editPhone, editAddress, editAddress2, profileDefaults]);

  useEffect(() => {
    if (hasProfileEdits) return;
    setEditFirstName(profileDefaults.firstName);
    setEditLastName(profileDefaults.lastName);
    setEditPhone(profileDefaults.phone);
    setEditAddress(profileDefaults.address);
    setEditAddress2(profileDefaults.address2);
  }, [profileDefaults, hasProfileEdits]);

  const applyMarketplaceBranding = (data?: Branding | null) => {
    if (!data) return;
    setMarketplaceName(data.account_name || '');
    setMarketplaceDescription(data.marketplace_description || '');
    setMarketplaceRegion(data.marketplace_region || '');
    setMarketplaceInstagram(data.marketplace_instagram_url || '');
    setMarketplaceFacebook(data.marketplace_facebook_url || '');
    setMarketplaceTiktok(data.marketplace_tiktok_url || '');
    setMarketplaceWebsite(data.marketplace_website_url || '');
    setMarketplaceLogoUrl(data.logo_url || null);
    setMarketplaceHeroUrl(data.portal_image_url || null);
  };

  const isMarketplaceDirty = useMemo(() => {
    const defaults = {
      name: branding?.account_name || '',
      description: branding?.marketplace_description || '',
      region: branding?.marketplace_region || '',
      instagram: branding?.marketplace_instagram_url || '',
      facebook: branding?.marketplace_facebook_url || '',
      tiktok: branding?.marketplace_tiktok_url || '',
      website: branding?.marketplace_website_url || '',
    };
    return (
      marketplaceName.trim() !== defaults.name.trim() ||
      marketplaceDescription.trim() !== defaults.description.trim() ||
      marketplaceRegion.trim() !== defaults.region.trim() ||
      marketplaceInstagram.trim() !== defaults.instagram.trim() ||
      marketplaceFacebook.trim() !== defaults.facebook.trim() ||
      marketplaceTiktok.trim() !== defaults.tiktok.trim() ||
      marketplaceWebsite.trim() !== defaults.website.trim()
    );
  }, [
    branding?.account_name,
    branding?.marketplace_description,
    branding?.marketplace_region,
    branding?.marketplace_instagram_url,
    branding?.marketplace_facebook_url,
    branding?.marketplace_tiktok_url,
    branding?.marketplace_website_url,
    marketplaceName,
    marketplaceDescription,
    marketplaceRegion,
    marketplaceInstagram,
    marketplaceFacebook,
    marketplaceTiktok,
    marketplaceWebsite,
  ]);

  useEffect(() => {
    if (!marketplaceInitialized && branding) {
      applyMarketplaceBranding(branding);
      setMarketplaceInitialized(true);
    }
  }, [branding, marketplaceInitialized]);


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
    applyIfProvided('address');
    applyIfProvided('address2');
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
              address: user.address,
              address2: user.address2,
              avatarUrl: user.avatarUrl,
            }
          : undefined);
      if (previousProfile && !queryClient.getQueryData(['profile'])) {
        queryClient.setQueryData(['profile'], previousProfile);
      }
      return { previousProfile };
    },
    onSuccess: (updated, payload, context) => {
      hapticSuccess();
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
              address: user.address,
              address2: user.address2,
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
        address:
          payload && 'address' in payload ? merged.address : merged.address ?? user?.address,
        address2:
          payload && 'address2' in payload ? merged.address2 : merged.address2 ?? user?.address2,
        avatarUrl:
          payload && 'avatarUrl' in payload ? merged.avatarUrl : merged.avatarUrl ?? user?.avatarUrl,
        activeRole: merged.activeRole ?? user?.activeRole,
      };
      setUser(nextUser);
      if (
        payload &&
        ('firstName' in payload ||
          'lastName' in payload ||
          'phone' in payload ||
          'address' in payload ||
          'address2' in payload)
      ) {
        setHasProfileEdits(false);
        setEditFirstName(merged.firstName ?? '');
        setEditLastName(merged.lastName ?? '');
        setEditPhone(merged.phone ?? '');
        setEditAddress(merged.address ?? '');
        setEditAddress2(merged.address2 ?? '');
      }
      // profile updated
    },
    onError: () => {
      hapticError();
      Alert.alert(t('common.error'), t('profile.updateError'));
    },
  });

  const marketplaceMutation = useMutation({
    mutationFn: updateBranding,
    onSuccess: (updated) => {
      hapticSuccess();
      queryClient.setQueryData(['branding'], updated);
      applyMarketplaceBranding(updated);
    },
    onError: () => {
      hapticError();
      Alert.alert(t('common.error'), t('profile.marketplaceUpdateError'));
    },
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
      hapticSuccess();
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
      hapticError();
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
      hapticSuccess();
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setPasswordError(null);
      Alert.alert(t('common.done'), t('profile.passwordUpdated'));
    },
    onError: () => {
      hapticError();
      Alert.alert(t('common.error'), t('profile.passwordUpdateError'));
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (payload) => {
      hapticSelection();
      await queryClient.cancelQueries({ queryKey: ['notificationPreferences'] });
      const previous =
        queryClient.getQueryData<NotificationPreferences>(['notificationPreferences']) ||
        resolvedNotificationPreferences;
      const merged = mergeNotificationPreferences(previous, payload);
      queryClient.setQueryData(['notificationPreferences'], merged);
      return { previous };
    },
    onSuccess: (updated) => {
      hapticSuccess();
      queryClient.setQueryData(['notificationPreferences'], updated);
    },
    onError: (_error, _payload, context) => {
      hapticError();
      if (context?.previous) {
        queryClient.setQueryData(['notificationPreferences'], context.previous);
      }
      Alert.alert(t('common.error'), t('profile.notificationsUpdateError'));
    },
  });
  const notificationsDisabled = preferencesMutation.isPending || loadingNotifications;
  const remindersDisabled =
    !pushEnabled ||
    notificationsDisabled ||
    !resolvedNotificationPreferences.push.appointments.reminder;

  const handleLinkProvider = async (provider: 'google' | 'apple') => {
    if (linkingProvider || updateMutation.isPending || languageMutation.isPending) return;
    if (linkedProviders.has(provider)) return;

    const supabaseUrl = resolveSupabaseUrl();
    const supabaseAnonKey = resolveSupabaseAnonKey();
    if (!supabaseUrl || !supabaseAnonKey || !token) {
      hapticError();
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
    )}&skip_http_redirect=true${scopeParam}`;

    setLinkingProvider(provider);

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        hapticError();
        Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
        return;
      }

      const payload = await response.json().catch(() => null);
      const authUrl = payload?.url;

      if (!authUrl) {
        hapticError();
        Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === 'success') {
        hapticSuccess();
        Alert.alert(t('common.done'), t('profile.linkSuccess', { provider: providerLabel }));
        await queryClient.refetchQueries({ queryKey: ['profile'] });
      } else if (result.type !== 'cancel' && result.type !== 'dismiss') {
        hapticError();
        Alert.alert(t('common.error'), t('profile.linkError', { provider: providerLabel }));
      }
    } catch {
      hapticError();
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

  const uploadMarketplaceLogoFromUri = async (uri: string, fileName?: string | null) => {
    try {
      setUploadingMarketplaceLogo(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
      const filename = `logo-${timestamp}.${extension}`;
      const fileType = `image/${safeExtension}`;

      formData.append('file', {
        uri,
        type: fileType,
        name: filename,
      } as any);

      const { url } = await uploadBrandLogo(formData);
      const updated = await updateBranding({ logo_url: url });
      queryClient.setQueryData(['branding'], updated);
      applyMarketplaceBranding(updated);
    } catch (err) {
      hapticError();
      console.error('Erro ao carregar logotipo:', err);
      Alert.alert(t('common.error'), t('marketplaceProfile.logoUploadError'));
    } finally {
      setUploadingMarketplaceLogo(false);
    }
  };

  const uploadMarketplaceHeroFromUri = async (uri: string, fileName?: string | null) => {
    try {
      setUploadingMarketplaceHero(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
      const filename = `portal-${timestamp}.${extension}`;
      const fileType = `image/${safeExtension}`;

      formData.append('file', {
        uri,
        type: fileType,
        name: filename,
      } as any);

      const { url } = await uploadPortalImage(formData);
      const updated = await updateBranding({ portal_image_url: url });
      queryClient.setQueryData(['branding'], updated);
      applyMarketplaceBranding(updated);
    } catch (err) {
      hapticError();
      console.error('Erro ao carregar imagem de capa:', err);
      Alert.alert(t('common.error'), t('marketplaceProfile.heroUploadError'));
    } finally {
      setUploadingMarketplaceHero(false);
    }
  };

  const openMarketplaceCamera = async (onSelected: (uri: string, fileName?: string | null) => Promise<void>) => {
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
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Erro ao abrir câmara:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openCameraError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await onSelected(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const openMarketplaceGallery = async (onSelected: (uri: string, fileName?: string | null) => Promise<void>) => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
      selectionLimit: 1,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Erro ao abrir galeria:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openGalleryError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await onSelected(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const pickMarketplaceImage = (onSelected: (uri: string, fileName?: string | null) => Promise<void>) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('profile.takePhoto'), t('profile.chooseFromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openMarketplaceCamera(onSelected);
          } else if (buttonIndex === 2) {
            openMarketplaceGallery(onSelected);
          }
        }
      );
    } else {
      Alert.alert(
        t('profile.choosePhotoTitle'),
        t('profile.choosePhotoMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.takePhoto'), onPress: () => openMarketplaceCamera(onSelected) },
          { text: t('profile.chooseFromGallery'), onPress: () => openMarketplaceGallery(onSelected) },
        ]
      );
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
    if (!isProfileDirty) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert(t('common.warning'), t('profile.nameRequired'));
      return;
    }
    updateMutation.mutate({
      firstName: editFirstName.trim() || null,
      lastName: editLastName.trim() || null,
      phone: editPhone.trim() || null,
      address: editAddress.trim() || null,
      address2: editAddress2.trim() || null,
    });
  };

  const handleProfileReset = () => {
    setEditFirstName(profileDefaults.firstName);
    setEditLastName(profileDefaults.lastName);
    setEditPhone(profileDefaults.phone);
    setEditAddress(profileDefaults.address);
    setEditAddress2(profileDefaults.address2);
    setHasProfileEdits(false);
  };

  const handleMarketplaceSave = () => {
    const trimmedName = marketplaceName.trim();
    if (!trimmedName) {
      Alert.alert(t('common.warning'), t('marketplaceProfile.nameRequired'));
      return;
    }
    marketplaceMutation.mutate({
      name: trimmedName,
      marketplace_region: marketplaceRegion.trim() || null,
      marketplace_description: marketplaceDescription.trim() || null,
      marketplace_instagram_url: marketplaceInstagram.trim() || null,
      marketplace_facebook_url: marketplaceFacebook.trim() || null,
      marketplace_tiktok_url: marketplaceTiktok.trim() || null,
      marketplace_website_url: marketplaceWebsite.trim() || null,
    });
  };

  const handleMarketplaceReset = () => {
    applyMarketplaceBranding(branding);
    setMarketplaceInitialized(true);
  };


  const handleFirstNameChange = (value: string) => {
    setEditFirstName(value);
    setHasProfileEdits(true);
  };

  const handleLastNameChange = (value: string) => {
    setEditLastName(value);
    setHasProfileEdits(true);
  };

  const handlePhoneChange = (value: string) => {
    setEditPhone(value);
    setHasProfileEdits(true);
  };

  const handleAddressChange = (value: string) => {
    setEditAddress(value);
    setHasProfileEdits(true);
  };

  const handleAddress2Change = (value: string) => {
    setEditAddress2(value);
    setHasProfileEdits(true);
  };

  const handleSectionChange = (section: ProfileSection) => {
    setActiveSection(section);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const handleLanguageChange = (language: string) => {
    if (updateMutation.isPending || languageMutation.isPending) return;
    languageMutation.mutate(language);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    if (updateMutation.isPending || languageMutation.isPending) return;
    if (mode === resolvedViewMode) return;
    const previousViewMode = viewMode;
    setViewMode(mode);
    const nextRole = mode === 'consumer' ? 'consumer' : 'provider';
    if (nextRole === activeRole) return;
    updateMutation.mutate(
      { activeRole: nextRole },
      {
        onError: () => {
          setViewMode(previousViewMode ?? null);
        },
      }
    );
  };

  const handleOpenPasswordForm = () => {
    if (updateMutation.isPending || languageMutation.isPending) return;
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

  const updatePreferences = (payload: NotificationPreferencesPayload) => {
    if (preferencesMutation.isPending) return;
    preferencesMutation.mutate(payload);
  };
  const formatReminderOffsetLabel = (offset: number) => {
    if (offset % 1440 === 0) {
      const days = offset / 1440;
      return `${days} ${days === 1 ? t('common.dayShort') : t('common.daysShort')}`;
    }
    if (offset % 60 === 0) {
      const hours = offset / 60;
      return `${hours} ${hours === 1 ? t('common.hourShort') : t('common.hoursShort')}`;
    }
    return `${offset} ${t('common.minutesShort')}`;
  };
  const setReminderOffsets = (nextOffsets: number[]) => {
    updatePreferences({ push: { appointments: { reminder_offsets: nextOffsets } } });
  };
  const handleToggleReminderOffset = (offset: number) => {
    if (remindersDisabled) return;
    if (reminderOffsets.includes(offset)) {
      setReminderOffsets(reminderOffsets.filter((entry) => entry !== offset));
      return;
    }
    if (reminderOffsets.length >= MAX_REMINDER_OFFSETS) {
      Alert.alert(t('common.warning'), t('profile.notificationsRemindersLimit'));
      return;
    }
    setReminderOffsets([...reminderOffsets, offset]);
  };
  const handleAddCustomReminder = () => {
    if (remindersDisabled) return;
    const parsed = Math.round(Number(customReminderInput.replace(',', '.')));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1440) {
      Alert.alert(t('common.error'), t('profile.notificationsRemindersInvalid'));
      return;
    }
    if (reminderOffsets.includes(parsed)) {
      setCustomReminderInput('');
      return;
    }
    if (reminderOffsets.length >= MAX_REMINDER_OFFSETS) {
      Alert.alert(t('common.warning'), t('profile.notificationsRemindersLimit'));
      return;
    }
    setReminderOffsets([...reminderOffsets, parsed]);
    setCustomReminderInput('');
  };

  const handleTogglePushNotifications = async (value: boolean) => {
    if (preferencesMutation.isPending) return;
    if (value) {
      const result = await registerForPushNotifications();
      if (!result.token) {
        const message =
          result.status === 'unavailable'
            ? t('profile.notificationsUnavailableMessage')
            : t('profile.notificationsPermissionMessage');
        Alert.alert(t('common.warning'), message);
        return;
      }
      try {
        await registerPushToken({ pushToken: result.token, platform: Platform.OS });
      } catch {
        Alert.alert(t('common.error'), t('profile.notificationsRegisterError'));
        return;
      }
    }
    updatePreferences({ push: { enabled: value } });
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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
        </View>

        {isLoading || isRefetching ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        {error ? <Text style={styles.error}>{t('profile.loadError')}</Text> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionTabs}
        >
          {(
            [
              { key: 'info', label: t('profile.sectionInfo') },
              { key: 'marketplace', label: t('profile.sectionMarketplace') },
              { key: 'security', label: t('profile.security') },
              { key: 'notifications', label: t('profile.notificationsTitle') },
            ] as const
          ).map((section) => {
            const isActive = activeSection === section.key;
            return (
              <TouchableOpacity
                key={section.key}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                onPress={() => handleSectionChange(section.key)}
              >
                <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
                  {section.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeSection === 'info' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile.sectionInfo')}</Text>
              <Text style={styles.sectionText}>{t('profile.infoDescription')}</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.firstNamePlaceholder')}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editFirstName}
                    onChangeText={handleFirstNameChange}
                    placeholder={t('profile.firstNamePlaceholder')}
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('profile.lastNamePlaceholder')}</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editLastName}
                    onChangeText={handleLastNameChange}
                    placeholder={t('profile.lastNamePlaceholder')}
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <PhoneInput
                  label={t('common.phone')}
                  labelStyle={[styles.inputLabel, styles.inputLabelRegular]}
                  containerStyle={styles.phoneField}
                  value={editPhone}
                  onChange={handlePhoneChange}
                  placeholder={t('common.phone')}
                  disabled={updateMutation.isPending}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('profile.addressLabel')}</Text>
                <AddressAutocomplete
                  value={editAddress}
                  onSelect={handleAddressChange}
                  placeholder={t('profile.addressPlaceholder')}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('profile.address2Label')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editAddress2}
                  onChangeText={handleAddress2Change}
                  placeholder={t('profile.address2Placeholder')}
                  placeholderTextColor={colors.muted}
                />
              </View>
              {isProfileDirty ? (
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
                    onPress={handleProfileReset}
                    disabled={updateMutation.isPending}
                  >
                    <Text style={styles.buttonTextSecondary}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {canSwitchViewMode ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('profile.viewModeTitle')}</Text>
                <Text style={styles.sectionText}>{t('profile.viewModeDescription')}</Text>
                <View style={styles.modeOptions}>
                  <TouchableOpacity
                    style={[styles.modeOption, resolvedViewMode === 'consumer' && styles.modeOptionActive]}
                    onPress={() => handleViewModeChange('consumer')}
                    disabled={updateMutation.isPending || languageMutation.isPending}
                  >
                    <Text style={[styles.modeOptionText, resolvedViewMode === 'consumer' && styles.modeOptionTextActive]}>
                      {t('profile.viewModeConsumer')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeOption, resolvedViewMode === 'private' && styles.modeOptionActive]}
                    onPress={() => handleViewModeChange('private')}
                    disabled={updateMutation.isPending || languageMutation.isPending}
                  >
                    <Text style={[styles.modeOptionText, resolvedViewMode === 'private' && styles.modeOptionTextActive]}>
                      {t('profile.viewModePrivate')}
                    </Text>
                  </TouchableOpacity>
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
                      disabled={updateMutation.isPending || languageMutation.isPending}
                    >
                      <Text style={[styles.languageOptionText, isActive && styles.languageOptionTextActive]}>
                        {t(`language.${lang}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

          </>
        ) : null}

        {activeSection === 'notifications' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.notificationsTitle')}</Text>
            <Text style={styles.sectionText}>{t('profile.notificationsDescription')}</Text>
            {loadingNotifications ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />
            ) : null}
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextGroup}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsPush')}</Text>
                <Text style={styles.toggleHelper}>{t('profile.notificationsPushHelper')}</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePushNotifications}
                disabled={notificationsDisabled}
                thumbColor={pushEnabled ? colors.primary : colors.surfaceBorder}
                trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
              />
            </View>

            <View style={styles.toggleGroup}>
              <Text style={styles.toggleGroupLabel}>{t('profile.notificationsAppointments')}</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsAppointmentsCreated')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.appointments.created}
                  onValueChange={(value) => updatePreferences({ push: { appointments: { created: value } } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.appointments.created ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsAppointmentsConfirmed')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.appointments.confirmed}
                  onValueChange={(value) => updatePreferences({ push: { appointments: { confirmed: value } } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.appointments.confirmed ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsAppointmentsCancelled')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.appointments.cancelled}
                  onValueChange={(value) => updatePreferences({ push: { appointments: { cancelled: value } } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.appointments.cancelled ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsAppointmentsReminder')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.appointments.reminder}
                  onValueChange={(value) => updatePreferences({ push: { appointments: { reminder: value } } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.appointments.reminder ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
              <View style={styles.reminderGroup}>
                <Text style={styles.reminderTitle}>{t('profile.notificationsRemindersTitle')}</Text>
                <Text style={styles.reminderHelper}>{t('profile.notificationsRemindersHelper')}</Text>
                <View style={styles.reminderChipsRow}>
                  {reminderChipOptions.map((offset) => {
                    const isActive = reminderOffsets.includes(offset);
                    return (
                      <TouchableOpacity
                        key={`preset-${offset}`}
                        style={[
                          styles.reminderChip,
                          isActive && styles.reminderChipActive,
                          remindersDisabled && styles.reminderChipDisabled,
                        ]}
                        onPress={() => handleToggleReminderOffset(offset)}
                        disabled={remindersDisabled}
                      >
                        <Text
                          style={[
                            styles.reminderChipText,
                            isActive && styles.reminderChipTextActive,
                            remindersDisabled && styles.reminderChipTextDisabled,
                          ]}
                        >
                          {formatReminderOffsetLabel(offset)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.reminderCustomRow}>
                  <TextInput
                    value={customReminderInput}
                    onChangeText={setCustomReminderInput}
                    placeholder={t('profile.notificationsRemindersCustomPlaceholder')}
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    editable={!remindersDisabled}
                    style={[
                      styles.reminderInput,
                      remindersDisabled && styles.reminderInputDisabled,
                    ]}
                  />
                  <TouchableOpacity
                    style={[
                      styles.reminderAddButton,
                      remindersDisabled && styles.reminderAddButtonDisabled,
                    ]}
                    onPress={handleAddCustomReminder}
                    disabled={remindersDisabled}
                  >
                    <Text style={styles.reminderAddButtonText}>
                      {t('profile.notificationsRemindersAdd')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.toggleGroup}>
              <Text style={styles.toggleGroupLabel}>{t('profile.notificationsMarketplace')}</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsMarketplaceRequests')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.marketplace.request}
                  onValueChange={(value) => updatePreferences({ push: { marketplace: { request: value } } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.marketplace.request ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
            </View>

            <View style={styles.toggleGroup}>
              <Text style={styles.toggleGroupLabel}>{t('profile.notificationsPayments')}</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsPaymentsUpdated')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.payments.updated}
                  onValueChange={(value) => updatePreferences({ push: { payments: { updated: value } } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.payments.updated ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
            </View>

            <View style={styles.toggleGroup}>
              <Text style={styles.toggleGroupLabel}>{t('profile.notificationsMarketing')}</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('profile.notificationsMarketing')}</Text>
                <Switch
                  value={resolvedNotificationPreferences.push.marketing}
                  onValueChange={(value) => updatePreferences({ push: { marketing: value } })}
                  disabled={!pushEnabled || notificationsDisabled}
                  thumbColor={resolvedNotificationPreferences.push.marketing ? colors.primary : colors.surfaceBorder}
                  trackColor={{ false: colors.surfaceBorder, true: colors.primarySoft }}
                />
              </View>
            </View>
          </View>
        ) : null}

        {activeSection === 'security' ? (
          <>
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
                {showAppleLink ? (
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
                ) : null}
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
                  disabled={updateMutation.isPending || languageMutation.isPending}
                >
                  <Text style={styles.buttonText}>{t('profile.changePassword')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : null}

        {activeSection === 'marketplace' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('marketplaceProfile.title')}</Text>
            <Text style={styles.sectionText}>{t('profile.marketplaceSectionDescription')}</Text>

            <View style={styles.marketplaceMediaGrid}>
              <View style={styles.marketplaceMediaCard}>
                <Text style={styles.marketplaceMediaTitle}>{t('marketplaceProfile.logoTitle')}</Text>
                <TouchableOpacity
                  style={styles.marketplaceLogo}
                  onPress={() => pickMarketplaceImage(uploadMarketplaceLogoFromUri)}
                  disabled={uploadingMarketplaceLogo}
                >
                  {marketplaceLogoUrl ? (
                    <Image source={{ uri: marketplaceLogoUrl }} style={styles.marketplaceLogoImage} />
                  ) : (
                    <Text style={styles.marketplaceLogoFallback}>
                      {(marketplaceName.trim().charAt(0) || 'P').toUpperCase()}
                    </Text>
                  )}
                  {uploadingMarketplaceLogo ? (
                    <View style={styles.marketplaceMediaOverlay}>
                      <ActivityIndicator color={colors.onPrimary} />
                    </View>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.marketplaceMediaButton}
                  onPress={() => pickMarketplaceImage(uploadMarketplaceLogoFromUri)}
                  disabled={uploadingMarketplaceLogo}
                >
                  <Text style={styles.marketplaceMediaButtonText}>{t('marketplaceProfile.changeLogo')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.marketplaceMediaCard}>
                <Text style={styles.marketplaceMediaTitle}>{t('marketplaceProfile.heroTitle')}</Text>
                <TouchableOpacity
                  style={styles.marketplaceHero}
                  onPress={() => pickMarketplaceImage(uploadMarketplaceHeroFromUri)}
                  disabled={uploadingMarketplaceHero}
                >
                  {marketplaceHeroUrl ? (
                    <Image source={{ uri: marketplaceHeroUrl }} style={styles.marketplaceHeroImage} />
                  ) : (
                    <View style={styles.marketplaceHeroPlaceholder}>
                      <Text style={styles.marketplaceHeroPlaceholderText}>
                        {t('marketplaceProfile.heroPlaceholder')}
                      </Text>
                    </View>
                  )}
                  {uploadingMarketplaceHero ? (
                    <View style={styles.marketplaceMediaOverlay}>
                      <ActivityIndicator color={colors.onPrimary} />
                    </View>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.marketplaceMediaButton}
                  onPress={() => pickMarketplaceImage(uploadMarketplaceHeroFromUri)}
                  disabled={uploadingMarketplaceHero}
                >
                  <Text style={styles.marketplaceMediaButtonText}>{t('marketplaceProfile.changeHero')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('marketplaceProfile.nameLabel')}</Text>
              <TextInput
                style={styles.editInput}
                value={marketplaceName}
                onChangeText={setMarketplaceName}
                placeholder={t('marketplaceProfile.namePlaceholder')}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('marketplaceProfile.regionLabel')}</Text>
              <TextInput
                style={styles.editInput}
                value={marketplaceRegion}
                onChangeText={setMarketplaceRegion}
                placeholder={t('marketplaceProfile.regionPlaceholder')}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('marketplaceProfile.descriptionLabel')}</Text>
              <TextInput
                style={[styles.editInput, { minHeight: 90, textAlignVertical: 'top' }]}
                value={marketplaceDescription}
                onChangeText={setMarketplaceDescription}
                placeholder={t('marketplaceProfile.descriptionPlaceholder')}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            <Text style={styles.subsectionTitle}>{t('marketplaceProfile.socialTitle')}</Text>
            <View style={styles.inputGroup}>
              <Input
                label={t('marketplaceProfile.instagramLabel')}
                value={marketplaceInstagram}
                onChangeText={setMarketplaceInstagram}
                placeholder={t('marketplaceProfile.instagramPlaceholder')}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Input
                label={t('marketplaceProfile.facebookLabel')}
                value={marketplaceFacebook}
                onChangeText={setMarketplaceFacebook}
                placeholder={t('marketplaceProfile.facebookPlaceholder')}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Input
                label={t('marketplaceProfile.tiktokLabel')}
                value={marketplaceTiktok}
                onChangeText={setMarketplaceTiktok}
                placeholder={t('marketplaceProfile.tiktokPlaceholder')}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Input
                label={t('marketplaceProfile.websiteLabel')}
                value={marketplaceWebsite}
                onChangeText={setMarketplaceWebsite}
                placeholder={t('marketplaceProfile.websitePlaceholder')}
                autoCapitalize="none"
              />
            </View>

            {isMarketplaceDirty ? (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonInline]}
                  onPress={handleMarketplaceSave}
                  disabled={marketplaceMutation.isPending}
                >
                  {marketplaceMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t('profile.marketplaceSave')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondary, styles.buttonInline]}
                  onPress={handleMarketplaceReset}
                  disabled={marketplaceMutation.isPending}
                >
                  <Text style={styles.buttonTextSecondary}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.button, styles.danger]}
            onPress={async () => {
              hapticSelection();
              await useAuthStore.getState().clear();
              navigation.replace('Login');
            }}
          >
            <Text style={styles.buttonText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
          {versionLabel ? <Text style={styles.footerVersion}>{versionLabel}</Text> : null}
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
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
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
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
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
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionTabs: {
      marginTop: 8,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 999,
      padding: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionTab: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      alignItems: 'center',
    },
    sectionTabActive: {
      backgroundColor: colors.primarySoft,
    },
    sectionTabText: {
      color: colors.muted,
      fontWeight: '600',
      fontSize: 13,
    },
    sectionTabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    subsectionTitle: {
      color: colors.text,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 12,
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
    inputLabelRegular: {
      fontWeight: '400',
    },
    phoneField: {
      marginBottom: 0,
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
    modeOptions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modeOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    modeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    modeOptionText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 14,
    },
    modeOptionTextActive: {
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
    marketplaceMediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 12,
    },
    marketplaceMediaCard: {
      flex: 1,
      minWidth: 150,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    marketplaceMediaTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    marketplaceLogo: {
      height: 96,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    marketplaceLogoImage: {
      width: '100%',
      height: '100%',
    },
    marketplaceLogoFallback: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.primary,
    },
    marketplaceHero: {
      height: 96,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    marketplaceHeroImage: {
      width: '100%',
      height: '100%',
    },
    marketplaceHeroPlaceholder: {
      paddingHorizontal: 8,
    },
    marketplaceHeroPlaceholderText: {
      color: colors.muted,
      fontSize: 12,
      textAlign: 'center',
    },
    marketplaceMediaOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    marketplaceMediaButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: 'center',
    },
    marketplaceMediaButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    toggleTextGroup: {
      flex: 1,
      paddingRight: 12,
    },
    toggleLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    toggleHelper: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    toggleGroup: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    toggleGroupLabel: {
      color: colors.muted,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    reminderGroup: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    reminderTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    reminderHelper: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
      marginBottom: 8,
    },
    reminderChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    reminderChip: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.background,
    },
    reminderChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    reminderChipDisabled: {
      opacity: 0.5,
    },
    reminderChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    reminderChipTextActive: {
      color: colors.primary,
    },
    reminderChipTextDisabled: {
      color: colors.muted,
    },
    reminderCustomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    reminderInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
      backgroundColor: colors.background,
    },
    reminderInputDisabled: {
      backgroundColor: colors.surface,
      color: colors.muted,
    },
    reminderAddButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    reminderAddButtonDisabled: {
      backgroundColor: colors.surfaceBorder,
    },
    reminderAddButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 12,
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
    footerVersion: {
      marginTop: 6,
      color: colors.muted,
      fontSize: 11,
      textAlign: 'center',
    },
  });
}
