import { useEffect, useMemo, useRef, useState, useCallback } from "react";
// ...existing code...
import { debounce } from "../utils/debounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  Platform,
  ActionSheetIOS,
  PermissionsAndroid,
} from "react-native";
import Switch from "../components/StyledSwitch";
// SafeAreaView is provided by ProfileLayout
// import { useCallback } from "react"; // duplicado
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  resetPassword,
  Profile,
} from "../api/profile";
import {
  Branding,
  BrandingUpdatePayload,
  getBranding,
  updateBranding,
  uploadBrandLogo,
  uploadPortalImage,
} from "../api/branding";
import {
  getNotificationPreferences,
  registerPushToken,
  unregisterPushToken,
  updateNotificationPreferences,
  NotificationPreferences,
  NotificationPreferencesPayload,
} from "../api/notifications";
import { useAuthStore } from "../state/authStore";
import { useViewModeStore, ViewMode } from "../state/viewModeStore";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { getCardStyle, getSegmentStyles } from "../theme/uiTokens";
import { ScreenHeader } from "../components/ScreenHeader";
import { getDateLocale, normalizeLanguage, setAppLanguage } from "../i18n";
import { Input } from "../components/common";
import { buildPhone, splitPhone } from "../utils/phone";
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from "../config/supabase";
import { formatVersionLabel } from "../utils/version";
import { hapticError, hapticSelection, hapticSuccess } from "../utils/haptics";
import { registerForPushNotifications } from "../utils/pushNotifications";
import * as Notifications from "expo-notifications";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";
import { compressImage } from "../utils/imageCompression";
import createStyles from "./profileStyles";
import ProfileLayout from "./profile/ProfileLayout";
import ProfileHeader from "../components/profile/ProfileHeader";
import ProfileInfo from "../components/profile/ProfileInfo";
import ProfileNotifications from "../components/profile/ProfileNotifications";
import ProfileSecurity from "../components/profile/ProfileSecurity";
import ProfileMarketplace from "../components/profile/ProfileMarketplace";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<any>;
type ProfileSection = "info" | "account" | "security" | "notifications";
const REMINDER_PRESETS = [15, 30, 60, 120, 1440];
const MAX_REMINDER_OFFSETS = 2;

function formatDate(
  value: string | null | undefined,
  locale: string,
  fallback: string
) {
  if (!value) return fallback;
  try {
    return new Date(value).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
      enabled:
        typeof source.enabled === "boolean"
          ? source.enabled
          : current.push.enabled,
      appointments: {
        created:
          typeof appointments.created === "boolean"
            ? appointments.created
            : current.push.appointments.created,
        confirmed:
          typeof appointments.confirmed === "boolean"
            ? appointments.confirmed
            : current.push.appointments.confirmed,
        cancelled:
          typeof appointments.cancelled === "boolean"
            ? appointments.cancelled
            : current.push.appointments.cancelled,
        reminder:
          typeof appointments.reminder === "boolean"
            ? appointments.reminder
            : current.push.appointments.reminder,
        reminder_offsets: Array.isArray(reminderOffsets)
          ? reminderOffsets
          : current.push.appointments.reminder_offsets,
      },
      marketplace: {
        request:
          typeof marketplace.request === "boolean"
            ? marketplace.request
            : current.push.marketplace.request,
      },
      payments: {
        updated:
          typeof payments.updated === "boolean"
            ? payments.updated
            : current.push.payments.updated,
      },
      marketing:
        typeof source.marketing === "boolean"
          ? source.marketing
          : current.push.marketing,
    },
  };
}

export default function ProfileScreen({ navigation }: Props) {
  // Controla se houve alteração manual nos campos do account
  const [accountDirty, setAccountDirty] = useState(false);
  // Estados para campos do marketplace
  // Fetch branding and profile data
  const { branding, colors } = useBrandingTheme();
  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 1000 * 60 * 5,
  });
  // i18n/translation
  const { t, i18n } = useTranslation();
  // Profile edit state
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAddress2, setEditAddress2] = useState("");
  const [hasProfileEdits, setHasProfileEdits] = useState(false);
  const [accountName, setAccountNameState] = useState("");
  const [accountRegion, setAccountRegionState] = useState("");
  const [accountDescription, setAccountDescriptionState] = useState("");
  const [accountInstagram, setAccountInstagramState] = useState("");
  const [accountFacebook, setAccountFacebookState] = useState("");
  const [accountTiktok, setAccountTiktokState] = useState("");
  const [accountWebsite, setAccountWebsiteState] = useState("");
  const [brandPrimary, setBrandPrimaryState] = useState("");
  const [brandPrimarySoft, setBrandPrimarySoftState] = useState("");
  const [brandAccent, setBrandAccentState] = useState("");
  const [brandAccentSoft, setBrandAccentSoftState] = useState("");
  const [brandBackground, setBrandBackgroundState] = useState("");
  // Query e dados principais
  const queryClient = useQueryClient();
  const primedBranding = queryClient.getQueryData<Branding>(["branding"]);
  const primedAccountId =
    primedBranding?.account_id || primedBranding?.id || null;
  const brandingAccountId = branding?.id || branding?.account_id || null;
  const membershipRole = useMemo(() => {
    const memberships = Array.isArray(data?.memberships)
      ? data?.memberships
      : [];
    if (!memberships.length) return null;
    const byAccount = brandingAccountId
      ? memberships.find(
          (member: any) =>
            member?.account_id === brandingAccountId ||
            member?.account?.id === brandingAccountId
        )
      : null;
    const selected = byAccount || memberships[0];
    return selected?.role || null;
  }, [data?.memberships, brandingAccountId]);
  const isOwner = membershipRole === "owner";
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const viewMode = useViewModeStore((s) => s.viewMode);
  const setViewMode = useViewModeStore((s) => s.setViewMode);
  // Remove duplicate colors declaration
  // Section state
  const [activeSection, setActiveSection] = useState<ProfileSection>("info");
  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  // Scroll ref
  const scrollRef = useRef<ScrollView | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Date locale
  const dateLocale = getDateLocale(i18n.language);
  // Version label
  const versionLabel = formatVersionLabel();
  // Loading and error state for profile query
  const { isLoading, isRefetching, error } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 1000 * 60 * 5,
  });
  const styles = useMemo(() => createStyles(colors), [colors]);
  // ...existing code (outros hooks e lógica do componente)...

  // Manual save flow: we no longer autosave marketplace fields on change.
  // Changes mark `marketplaceDirty` and are persisted when the user taps Save.

  // Generic setter factory for marketplace fields
  const createMarketplaceSetter = <T extends keyof BrandingUpdatePayload>(
    stateSetter: (v: string) => void,
    brandingKey: keyof Branding,
    payloadKey: T
  ) => {
    return (value: string, fromBranding = false) => {
      stateSetter(value);
      if (!fromBranding && value !== (branding?.[brandingKey] || "")) {
        setAccountDirty(true);
      }
    };
  };

  const setAccountName = createMarketplaceSetter(
    setAccountNameState,
    "account_name",
    "name"
  );
  const setAccountDescription = createMarketplaceSetter(
    setAccountDescriptionState,
    "marketplace_description",
    "marketplace_description"
  );
  const setAccountRegion = createMarketplaceSetter(
    setAccountRegionState,
    "marketplace_region",
    "marketplace_region"
  );
  const setAccountInstagram = createMarketplaceSetter(
    setAccountInstagramState,
    "marketplace_instagram_url",
    "marketplace_instagram_url"
  );
  const setAccountFacebook = createMarketplaceSetter(
    setAccountFacebookState,
    "marketplace_facebook_url",
    "marketplace_facebook_url"
  );
  const setAccountTiktok = createMarketplaceSetter(
    setAccountTiktokState,
    "marketplace_tiktok_url",
    "marketplace_tiktok_url"
  );
  const setAccountWebsite = createMarketplaceSetter(
    setAccountWebsiteState,
    "marketplace_website_url",
    "marketplace_website_url"
  );
  const setBrandPrimary = createMarketplaceSetter(
    setBrandPrimaryState,
    "brand_primary",
    "brand_primary"
  );
  const setBrandPrimarySoft = createMarketplaceSetter(
    setBrandPrimarySoftState,
    "brand_primary_soft",
    "brand_primary_soft"
  );
  const setBrandAccent = createMarketplaceSetter(
    setBrandAccentState,
    "brand_accent",
    "brand_accent"
  );
  const setBrandAccentSoft = createMarketplaceSetter(
    setBrandAccentSoftState,
    "brand_accent_soft",
    "brand_accent_soft"
  );
  const setBrandBackground = createMarketplaceSetter(
    setBrandBackgroundState,
    "brand_background",
    "brand_background"
  );
  const [accountLogoUrl, setAccountLogoUrl] = useState<string | null>(null);

  const [accountActive, setAccountActive] = useState<boolean>(true);
  useEffect(() => {
    if (typeof branding?.marketplace_enabled === "boolean") {
      setAccountActive(branding.marketplace_enabled);
    }
  }, [branding?.marketplace_enabled]);

  const debouncedSaveAccountActive = useMemo(
    () =>
      debounce((value: boolean) => {
        updateBranding({ marketplace_enabled: value });
      }, 600),
    []
  );

  const handleToggleAccountActive = (value: boolean) => {
    setAccountActive(value);
    debouncedSaveAccountActive(value);
  };
  const [accountHeroUrl, setAccountHeroUrl] = useState<string | null>(null);
  const [uploadingAccountLogo, setUploadingAccountLogo] = useState(false);
  const [uploadingAccountHero, setUploadingAccountHero] = useState(false);
  const [accountInitialized, setAccountInitialized] = useState(false);
  const [customReminderInput, setCustomReminderInput] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<
    "google" | "apple" | null
  >(null);
  const showAppleLink = false;

  const { data: notificationPreferences, isLoading: loadingNotifications } =
    useQuery({
      queryKey: ["notificationPreferences"],
      queryFn: getNotificationPreferences,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    });
  const currentLanguage = normalizeLanguage(data?.locale || i18n.language);
  const authProviders = Array.isArray(data?.authProviders)
    ? data.authProviders
    : [];
  const linkedProviders = new Set(
    authProviders
      .map((provider) => provider?.toString().toLowerCase())
      .filter(Boolean)
  );
  const isGoogleLinked = linkedProviders.has("google");
  const isAppleLinked = linkedProviders.has("apple");
  const googleButtonLabel = isGoogleLinked
    ? t("profile.linked")
    : t("profile.linkGoogle");
  const appleButtonLabel = isAppleLinked
    ? t("profile.linked")
    : t("profile.linkApple");

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient
        .invalidateQueries({ queryKey: ["branding"] })
        .catch(() => null);
      await queryClient
        .invalidateQueries({ queryKey: ["notificationPreferences"] })
        .catch(() => null);
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);
  const availableRoles = useMemo(() => {
    const roles = Array.isArray(data?.availableRoles)
      ? data.availableRoles
      : [];
    if (roles.length) return Array.from(new Set(roles));
    if (data?.activeRole) return [data.activeRole];
    if (user?.activeRole) return [user.activeRole];
    return [];
  }, [data?.availableRoles, data?.activeRole, user?.activeRole]);
  const activeRole = data?.activeRole ?? user?.activeRole ?? "provider";
  const resolvedViewMode: ViewMode =
    viewMode ?? (activeRole === "consumer" ? "consumer" : "private");
  const canSwitchViewMode =
    availableRoles.includes("consumer") && availableRoles.includes("provider");
  const resolvedNotificationPreferences =
    useMemo<NotificationPreferences>(() => {
      const raw = notificationPreferences;
      if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
      const push = raw.push || {};
      return {
        push: {
          enabled:
            typeof push.enabled === "boolean"
              ? push.enabled
              : DEFAULT_NOTIFICATION_PREFERENCES.push.enabled,
          appointments: {
            created:
              typeof push.appointments?.created === "boolean"
                ? push.appointments!.created
                : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.created,
            confirmed:
              typeof push.appointments?.confirmed === "boolean"
                ? push.appointments!.confirmed
                : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.confirmed,
            cancelled:
              typeof push.appointments?.cancelled === "boolean"
                ? push.appointments!.cancelled
                : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.cancelled,
            reminder:
              typeof push.appointments?.reminder === "boolean"
                ? push.appointments!.reminder
                : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.reminder,
            reminder_offsets: Array.isArray(push.appointments?.reminder_offsets)
              ? (push.appointments!.reminder_offsets as number[])
              : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments
                  .reminder_offsets,
          },
          marketplace: {
            request:
              typeof push.marketplace?.request === "boolean"
                ? push.marketplace!.request
                : DEFAULT_NOTIFICATION_PREFERENCES.push.marketplace.request,
          },
          payments: {
            updated:
              typeof push.payments?.updated === "boolean"
                ? push.payments!.updated
                : DEFAULT_NOTIFICATION_PREFERENCES.push.payments.updated,
          },
          marketing:
            typeof push.marketing === "boolean"
              ? push.marketing
              : DEFAULT_NOTIFICATION_PREFERENCES.push.marketing,
        },
      };
    }, [notificationPreferences]);
  const pushEnabled = resolvedNotificationPreferences.push?.enabled ?? false;
  const reminderOffsets = useMemo(() => {
    const offsets = normalizeReminderOffsets(
      resolvedNotificationPreferences.push?.appointments?.reminder_offsets
    );
    return offsets.length
      ? offsets
      : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.reminder_offsets;
  }, [resolvedNotificationPreferences]);
  const reminderChipOptions = useMemo(() => {
    const combined = new Set([...REMINDER_PRESETS, ...reminderOffsets]);
    return Array.from(combined).sort((a, b) => a - b);
  }, [reminderOffsets]);
  const profileDefaults = useMemo(() => {
    const fallbackName = data?.displayName || user?.displayName || "";
    const [fallbackFirst, ...fallbackLast] = fallbackName.split(" ");
    return {
      firstName: data?.firstName || fallbackFirst || "",
      lastName: data?.lastName || fallbackLast.join(" ") || "",
      phone: data?.phone || "",
      address: data?.address || user?.address || "",
      address2: data?.address2 || user?.address2 || "",
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
  }, [
    editFirstName,
    editLastName,
    editPhone,
    editAddress,
    editAddress2,
    profileDefaults,
  ]);

  useEffect(() => {
    if (hasProfileEdits) return;
    setEditFirstName(profileDefaults.firstName);
    setEditLastName(profileDefaults.lastName);
    setEditPhone(profileDefaults.phone);
    setEditAddress(profileDefaults.address);
    setEditAddress2(profileDefaults.address2);
  }, [profileDefaults, hasProfileEdits]);

  useEffect(() => {
    if (!isOwner && activeSection === "account") {
      setActiveSection("info");
    }
  }, [isOwner, activeSection]);

  // Do not refetch on every focus to avoid extra latency; rely on React Query cache and explicit invalidations

  const applyAccountBranding = (data?: Branding | null) => {
    if (!data) return;
    setAccountName(data.account_name || "", true);
    setAccountDescription(data.marketplace_description || "", true);
    setAccountRegion(data.marketplace_region || "", true);
    setAccountInstagram(data.marketplace_instagram_url || "", true);
    setAccountFacebook(data.marketplace_facebook_url || "", true);
    setAccountTiktok(data.marketplace_tiktok_url || "", true);
    setAccountWebsite(data.marketplace_website_url || "", true);
    setBrandPrimary(data.brand_primary || "", true);
    setBrandPrimarySoft(data.brand_primary_soft || "", true);
    setBrandAccent(data.brand_accent || "", true);
    setBrandAccentSoft(data.brand_accent_soft || "", true);
    setBrandBackground(data.brand_background || "", true);
    setAccountLogoUrl(data.logo_url || null);
    setAccountHeroUrl(data.portal_image_url || null);
  };

  const isAccountDirty = useMemo(() => {
    const defaults = {
      name: branding?.account_name || "",
      description: branding?.marketplace_description || "",
      region: branding?.marketplace_region || "",
      instagram: branding?.marketplace_instagram_url || "",
      facebook: branding?.marketplace_facebook_url || "",
      tiktok: branding?.marketplace_tiktok_url || "",
      website: branding?.marketplace_website_url || "",
      primary: branding?.brand_primary || "",
      primarySoft: branding?.brand_primary_soft || "",
      accent: branding?.brand_accent || "",
      accentSoft: branding?.brand_accent_soft || "",
      background: branding?.brand_background || "",
    };
    return (
      accountName.trim() !== defaults.name.trim() ||
      accountDescription.trim() !== defaults.description.trim() ||
      accountRegion.trim() !== defaults.region.trim() ||
      accountInstagram.trim() !== defaults.instagram.trim() ||
      accountFacebook.trim() !== defaults.facebook.trim() ||
      accountTiktok.trim() !== defaults.tiktok.trim() ||
      accountWebsite.trim() !== defaults.website.trim() ||
      brandPrimary.trim() !== defaults.primary.trim() ||
      brandPrimarySoft.trim() !== defaults.primarySoft.trim() ||
      brandAccent.trim() !== defaults.accent.trim() ||
      brandAccentSoft.trim() !== defaults.accentSoft.trim() ||
      brandBackground.trim() !== defaults.background.trim()
    );
  }, [
    branding?.account_name,
    branding?.marketplace_description,
    branding?.marketplace_region,
    branding?.marketplace_instagram_url,
    branding?.marketplace_facebook_url,
    branding?.marketplace_tiktok_url,
    branding?.marketplace_website_url,
    branding?.brand_primary,
    branding?.brand_primary_soft,
    branding?.brand_accent,
    branding?.brand_accent_soft,
    branding?.brand_background,
    accountName,
    accountDescription,
    accountRegion,
    accountInstagram,
    accountFacebook,
    accountTiktok,
    accountWebsite,
    brandPrimary,
    brandPrimarySoft,
    brandAccent,
    brandAccentSoft,
    brandBackground,
  ]);

  useEffect(() => {
    if (!accountInitialized && branding) {
      applyAccountBranding(branding);
      setAccountInitialized(true);
      setAccountDirty(false); // Reset dirty flag ao inicializar branding
    }
  }, [branding, accountInitialized]);

  const mergeProfileUpdate = (
    current: Profile | undefined,
    updated: Profile,
    payload?: Partial<Profile>
  ) => {
    if (!current) return updated;
    const next: Profile = { ...current };
    const isBlankString = (value: unknown) =>
      typeof value === "string" && value.trim().length === 0;
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
    applyIfProvided("displayName");
    applyIfProvided("firstName");
    applyIfProvided("lastName");
    applyIfProvided("address");
    applyIfProvided("address2");
    applyIfProvided("phone");
    applyIfProvided("phoneCountryCode");
    applyIfProvided("phoneNumber");
    applyIfProvided("locale");
    applyIfProvided("avatarUrl");
    applyIfProvided("activeRole");
    applyIfProvided("availableRoles");
    applyIfProvided("email");
    applyIfProvided("lastLoginAt");
    applyIfProvided("createdAt");
    applyIfProvided("memberships");
    applyIfProvided("platformAdmin");
    return next;
  };

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onMutate: () => {
      const previousProfile =
        queryClient.getQueryData<Profile>(["profile"]) || data || undefined;
      if (previousProfile && !queryClient.getQueryData(["profile"])) {
        queryClient.setQueryData(["profile"], previousProfile);
      }
      return { previousProfile };
    },
    onSuccess: (updated, payload, context) => {
      hapticSuccess();
      const current =
        queryClient.getQueryData<Profile>(["profile"]) ||
        context?.previousProfile ||
        data ||
        undefined;
      const merged = current
        ? mergeProfileUpdate(current, updated, payload)
        : updated;
      queryClient.setQueryData<Profile | undefined>(["profile"], merged);
      const nextUser = {
        email: merged.email ?? user?.email,
        displayName:
          payload && "displayName" in payload
            ? merged.displayName
            : merged.displayName ?? user?.displayName,
        firstName:
          payload && "firstName" in payload
            ? merged.firstName
            : merged.firstName ?? user?.firstName,
        lastName:
          payload && "lastName" in payload
            ? merged.lastName
            : merged.lastName ?? user?.lastName,
        address:
          payload && "address" in payload
            ? merged.address
            : merged.address ?? user?.address,
        address2:
          payload && "address2" in payload
            ? merged.address2
            : merged.address2 ?? user?.address2,
        avatarUrl:
          payload && "avatarUrl" in payload
            ? merged.avatarUrl
            : merged.avatarUrl ?? user?.avatarUrl,
        activeRole: merged.activeRole ?? user?.activeRole,
      };
      setUser(nextUser);
      if (
        payload &&
        ("firstName" in payload ||
          "lastName" in payload ||
          "phone" in payload ||
          "address" in payload ||
          "address2" in payload)
      ) {
        setHasProfileEdits(false);
        setEditFirstName(merged.firstName ?? "");
        setEditLastName(merged.lastName ?? "");
        setEditPhone(merged.phone ?? "");
        setEditAddress(merged.address ?? "");
        setEditAddress2(merged.address2 ?? "");
      }
      // profile updated
    },
    onError: () => {
      hapticError();
      Alert.alert(t("common.error"), t("profile.updateError"));
    },
  });

  const accountMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateBranding>[0]) =>
      updateBranding(payload, brandingAccountId),
    onSuccess: (updated) => {
      hapticSuccess();
      queryClient.setQueryData(["branding"], updated);
      applyAccountBranding(updated);
    },
    onError: () => {
      hapticError();
      Alert.alert(t("common.error"), t("profile.marketplaceUpdateError"));
    },
  });

  const languageMutation = useMutation({
    mutationFn: async (language: string) =>
      updateProfile({ locale: normalizeLanguage(language) }),
    onMutate: async (language) => {
      const normalized = normalizeLanguage(language);
      const previousProfile = queryClient.getQueryData<Profile>(["profile"]);
      queryClient.setQueryData<Profile | undefined>(["profile"], (current) =>
        current ? { ...current, locale: normalized } : current
      );
      const previousLanguage = i18n.language;
      await setAppLanguage(normalized);
      return { previousProfile, previousLanguage, normalized };
    },
    onSuccess: (updated, _language, context) => {
      hapticSuccess();
      if (updated?.locale) {
        queryClient.setQueryData<Profile | undefined>(["profile"], (current) =>
          current
            ? { ...current, locale: normalizeLanguage(updated.locale) }
            : current
        );
      } else if (context?.normalized) {
        queryClient.setQueryData<Profile | undefined>(["profile"], (current) =>
          current ? { ...current, locale: context.normalized } : current
        );
      }
    },
    onError: (_err, _language, context) => {
      hapticError();
      if (context?.previousProfile) {
        queryClient.setQueryData(["profile"], context.previousProfile);
      }
      if (context?.previousLanguage) {
        setAppLanguage(context.previousLanguage);
      }
      Alert.alert(t("common.error"), t("profile.updateError"));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      hapticSuccess();
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setPasswordError(null);
      Alert.alert(t("common.done"), t("profile.passwordUpdated"));
    },
    onError: () => {
      hapticError();
      Alert.alert(t("common.error"), t("profile.passwordUpdateError"));
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onMutate: async (payload) => {
      hapticSelection();
      await queryClient.cancelQueries({
        queryKey: ["notificationPreferences"],
      });
      const previous =
        queryClient.getQueryData<NotificationPreferences>([
          "notificationPreferences",
        ]) || resolvedNotificationPreferences;
      const merged = mergeNotificationPreferences(previous, payload);
      queryClient.setQueryData(["notificationPreferences"], merged);
      return { previous };
    },
    onSuccess: (updated) => {
      hapticSuccess();
      queryClient.setQueryData(["notificationPreferences"], updated);
    },
    onError: (_error, _payload, context) => {
      hapticError();
      if (context?.previous) {
        queryClient.setQueryData(["notificationPreferences"], context.previous);
      }
      Alert.alert(t("common.error"), t("profile.notificationsUpdateError"));
    },
  });
  const notificationsDisabled =
    preferencesMutation.isPending || loadingNotifications;
  const remindersDisabled =
    !pushEnabled ||
    notificationsDisabled ||
    !resolvedNotificationPreferences.push.appointments.reminder;

  const handleLinkProvider = async (provider: "google" | "apple") => {
    if (
      linkingProvider ||
      updateMutation.isPending ||
      languageMutation.isPending
    )
      return;
    if (linkedProviders.has(provider)) return;

    const supabaseUrl = resolveSupabaseUrl();
    const supabaseAnonKey = resolveSupabaseAnonKey();
    if (!supabaseUrl || !supabaseAnonKey || !token) {
      hapticError();
      Alert.alert(t("common.error"), t("profile.linkConfigError"));
      return;
    }

    const providerLabel = t(`login.providers.${provider}`);
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: "pawmi",
      path: "auth/callback",
    });
    const scopeParam = provider === "apple" ? "&scopes=name%20email" : "";
    const requestUrl = `${supabaseUrl}/auth/v1/user/identities/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectUri
    )}&skip_http_redirect=true${scopeParam}`;

    setLinkingProvider(provider);

    try {
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        hapticError();
        Alert.alert(
          t("common.error"),
          t("profile.linkError", { provider: providerLabel })
        );
        return;
      }

      const payload = await response.json().catch(() => null);
      const authUrl = payload?.url;

      if (!authUrl) {
        hapticError();
        Alert.alert(
          t("common.error"),
          t("profile.linkError", { provider: providerLabel })
        );
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri
      );
      if (result.type === "success") {
        hapticSuccess();
        Alert.alert(
          t("common.done"),
          t("profile.linkSuccess", { provider: providerLabel })
        );
        await queryClient.refetchQueries({ queryKey: ["profile"] });
      } else if (result.type !== "cancel" && result.type !== "dismiss") {
        hapticError();
        Alert.alert(
          t("common.error"),
          t("profile.linkError", { provider: providerLabel })
        );
      }
    } catch {
      hapticError();
      Alert.alert(
        t("common.error"),
        t("profile.linkError", { provider: providerLabel })
      );
    } finally {
      setLinkingProvider(null);
    }
  };

  const requestAndroidPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t("profile.cameraPermissionTitle"),
            message: t("profile.cameraPermissionMessage"),
            buttonNeutral: t("common.later"),
            buttonNegative: t("common.cancel"),
            buttonPositive: t("common.ok"),
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
      Alert.alert(
        t("profile.cameraPermissionDeniedTitle"),
        t("profile.cameraPermissionDeniedMessage")
      );
      return;
    }

    launchCamera(cameraOptions, async (response) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error("Erro ao abrir câmara:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openCameraError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadAvatarFromUri(
          response.assets[0].uri!,
          response.assets[0].fileName
        );
      }
    });
  };

  const openGallery = async () => {
    launchImageLibrary(galleryOptions, async (response) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error("Erro ao abrir galeria:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openGalleryError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadAvatarFromUri(
          response.assets[0].uri!,
          response.assets[0].fileName
        );
      }
    });
  };

  const uploadAvatarFromUri = async (uri: string, fileName?: string | null) => {
    try {
      setUploadingAvatar(true);
      const compressedUri = await compressImage(uri);
      const formData = new FormData();
      const timestamp = Date.now();
      const filename = `profile-${timestamp}.jpg`;
      const fileType = "image/jpeg";

      formData.append("file", {
        uri: compressedUri,
        type: fileType,
        name: filename,
      } as any);

      const { url } = await uploadAvatar(formData);
      await updateMutation.mutateAsync({ avatarUrl: url });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      Alert.alert(t("common.error"), t("profile.uploadError"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const accountUploadLogoFromUri = async (
    uri: string,
    fileName?: string | null
  ) => {
    try {
      setUploadingAccountLogo(true);
      const compressedUri = await compressImage(uri);
      const formData = new FormData();
      const timestamp = Date.now();
      const filename = `logo-${timestamp}.jpg`;
      const fileType = "image/jpeg";

      formData.append("file", {
        uri: compressedUri,
        type: fileType,
        name: filename,
      } as any);

      const { url, data: brandingResponse } = await uploadBrandLogo(
        formData,
        brandingAccountId
      );
      const updated =
        brandingResponse ||
        (branding ? { ...branding, logo_url: url } : undefined);
      if (updated) {
        queryClient.setQueryData(["branding"], updated);
        applyAccountBranding(updated);
      }
    } catch (err) {
      hapticError();
      console.error("Erro ao carregar logotipo:", err);
      Alert.alert(t("common.error"), t("marketplaceProfile.logoUploadError"));
    } finally {
      setUploadingAccountLogo(false);
    }
  };

  const accountUploadHeroFromUri = async (
    uri: string,
    fileName?: string | null
  ) => {
    try {
      setUploadingAccountHero(true);
      const compressedUri = await compressImage(uri);
      const formData = new FormData();
      const timestamp = Date.now();
      const filename = `portal-${timestamp}.jpg`;
      const fileType = "image/jpeg";

      formData.append("file", {
        uri: compressedUri,
        type: fileType,
        name: filename,
      } as any);

      const { url, data: brandingResponse } = await uploadPortalImage(
        formData,
        brandingAccountId
      );
      const updated =
        brandingResponse ||
        (branding ? { ...branding, portal_image_url: url } : undefined);
      if (updated) {
        queryClient.setQueryData(["branding"], updated);
        applyAccountBranding(updated);
      }
    } catch (err) {
      hapticError();
      console.error("Erro ao carregar imagem de capa:", err);
      Alert.alert(t("common.error"), t("marketplaceProfile.heroUploadError"));
    } finally {
      setUploadingAccountHero(false);
    }
  };

  const openAccountCamera = async (
    onSelected: (uri: string, fileName?: string | null) => Promise<void>
  ) => {
    const hasPermission = await requestAndroidPermissions();
    if (!hasPermission) {
      Alert.alert(
        t("profile.cameraPermissionDeniedTitle"),
        t("profile.cameraPermissionDeniedMessage")
      );
      return;
    }

    launchCamera(cameraOptions, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error("Erro ao abrir câmara:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openCameraError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await onSelected(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const openAccountGallery = async (
    onSelected: (uri: string, fileName?: string | null) => Promise<void>
  ) => {
    launchImageLibrary(galleryOptions, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error("Erro ao abrir galeria:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openGalleryError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await onSelected(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const pickAccountImage = (
    onSelected: (uri: string, fileName?: string | null) => Promise<void>
  ) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t("common.cancel"),
            t("profile.takePhoto"),
            t("profile.chooseFromGallery"),
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openAccountCamera(onSelected);
          } else if (buttonIndex === 2) {
            openAccountGallery(onSelected);
          }
        }
      );
    } else {
      Alert.alert(
        t("profile.choosePhotoTitle"),
        t("profile.choosePhotoMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("profile.takePhoto"),
            onPress: () => openAccountCamera(onSelected),
          },
          {
            text: t("profile.chooseFromGallery"),
            onPress: () => openAccountGallery(onSelected),
          },
        ]
      );
    }
  };

  const pickImage = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t("common.cancel"),
            t("profile.takePhoto"),
            t("profile.chooseFromGallery"),
          ],
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
        t("profile.choosePhotoTitle"),
        t("profile.choosePhotoMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("profile.takePhoto"), onPress: openCamera },
          { text: t("profile.chooseFromGallery"), onPress: openGallery },
        ]
      );
    }
  };

  const handleSave = () => {
    if (!isProfileDirty) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      Alert.alert(t("common.warning"), t("profile.nameRequired"));
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

  const handleAccountSave = () => {
    if (!isOwner) return;
    const trimmedName = accountName.trim();
    if (!trimmedName) {
      Alert.alert(t("common.warning"), t("marketplaceProfile.nameRequired"));
      return;
    }
    accountMutation.mutate({
      name: trimmedName,
      marketplace_region: accountRegion.trim() || null,
      marketplace_description: accountDescription.trim() || null,
      marketplace_instagram_url: accountInstagram.trim() || null,
      marketplace_facebook_url: accountFacebook.trim() || null,
      marketplace_tiktok_url: accountTiktok.trim() || null,
      marketplace_website_url: accountWebsite.trim() || null,
      brand_primary: brandPrimary.trim() || null,
      brand_primary_soft: brandPrimarySoft.trim() || null,
      brand_accent: brandAccent.trim() || null,
      brand_accent_soft: brandAccentSoft.trim() || null,
      brand_background: brandBackground.trim() || null,
    });
  };

  const handleAccountReset = () => {
    if (!isOwner) return;
    applyAccountBranding(branding);
    setAccountInitialized(true);
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
    if (section === "account" && !isOwner) return;
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
    const nextRole = mode === "consumer" ? "consumer" : "provider";
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
    setNewPassword("");
    setConfirmPassword("");
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
      return `${days} ${
        days === 1 ? t("common.dayShort") : t("common.daysShort")
      }`;
    }
    if (offset % 60 === 0) {
      const hours = offset / 60;
      return `${hours} ${
        hours === 1 ? t("common.hourShort") : t("common.hoursShort")
      }`;
    }
    return `${offset} ${t("common.minutesShort")}`;
  };
  const setReminderOffsets = (nextOffsets: number[]) => {
    updatePreferences({
      push: { appointments: { reminder_offsets: nextOffsets } },
    });
  };
  const handleToggleReminderOffset = (offset: number) => {
    if (remindersDisabled) return;
    if (reminderOffsets.includes(offset)) {
      setReminderOffsets(reminderOffsets.filter((entry) => entry !== offset));
      return;
    }
    if (reminderOffsets.length >= MAX_REMINDER_OFFSETS) {
      Alert.alert(
        t("common.warning"),
        t("profile.notificationsRemindersLimit")
      );
      return;
    }
    setReminderOffsets([...reminderOffsets, offset]);
  };
  const handleAddCustomReminder = () => {
    if (remindersDisabled) return;
    const parsed = Math.round(Number(customReminderInput.replace(",", ".")));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1440) {
      Alert.alert(
        t("common.error"),
        t("profile.notificationsRemindersInvalid")
      );
      return;
    }
    if (reminderOffsets.includes(parsed)) {
      setCustomReminderInput("");
      return;
    }
    if (reminderOffsets.length >= MAX_REMINDER_OFFSETS) {
      Alert.alert(
        t("common.warning"),
        t("profile.notificationsRemindersLimit")
      );
      return;
    }
    setReminderOffsets([...reminderOffsets, parsed]);
    setCustomReminderInput("");
  };

  const handleTogglePushNotifications = async (value: boolean) => {
    if (preferencesMutation.isPending) return;
    if (value) {
      const result = await registerForPushNotifications();
      if (!result.token) {
        const message =
          result.status === "unavailable"
            ? t("profile.notificationsUnavailableMessage")
            : t("profile.notificationsPermissionMessage");
        Alert.alert(t("common.warning"), message);
        return;
      }
      try {
        await registerPushToken({
          pushToken: result.token,
          platform: Platform.OS,
        });
      } catch {
        Alert.alert(t("common.error"), t("profile.notificationsRegisterError"));
        return;
      }
      try {
        await preferencesMutation.mutateAsync({ push: { enabled: true } });
      } catch (err) {
        // If updating preferences failed after registering token, try to unregister the token to avoid orphaned tokens
        try {
          await unregisterPushToken({ pushToken: result.token });
        } catch {}
        Alert.alert(t("common.error"), t("profile.notificationsUpdateError"));
      }
      return;
    }

    // disabling notifications: attempt to unregister current expo token then update preferences
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data;
      if (token) {
        await unregisterPushToken({ pushToken: token });
      }
    } catch (err) {
      // ignore unregister failures
    }

    try {
      await preferencesMutation.mutateAsync({ push: { enabled: false } });
    } catch (err) {
      Alert.alert(t("common.error"), t("profile.notificationsUpdateError"));
    }
  };

  const handlePasswordSave = () => {
    if (resetPasswordMutation.isPending) return;
    if (newPassword.length < 8) {
      setPasswordError(t("profile.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordMismatch"));
      return;
    }
    setPasswordError(null);
    resetPasswordMutation.mutate(newPassword);
  };

  const displayName =
    [data?.firstName, data?.lastName].filter(Boolean).join(" ") ||
    data?.displayName ||
    user?.displayName ||
    t("common.user");
  const emailValue = data?.email || user?.email || t("common.noData");
  const createdAtValue = formatDate(
    data?.createdAt,
    dateLocale,
    t("common.noData")
  );
  const phoneParts = splitPhone(data?.phone);
  const phoneDisplay = buildPhone(
    data?.phoneCountryCode || phoneParts.phoneCountryCode,
    data?.phoneNumber || phoneParts.phoneNumber
  );
  const avatarUrl = data?.avatarUrl || user?.avatarUrl || null;
  const avatarFallback = displayName.charAt(0).toUpperCase() || "?";

  const rightHeaderElement = (() => {
    if (activeSection === "account" && isAccountDirty && isOwner) {
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={handleAccountReset}
            disabled={accountMutation.isPending}
            style={{
              marginRight: 12,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAccountSave}
            disabled={accountMutation.isPending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="save-outline" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      );
    }

    if (activeSection === "info" && isProfileDirty) {
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={handleProfileReset}
            disabled={updateMutation.isPending}
            style={{
              marginRight: 12,
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={updateMutation.isPending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="save-outline" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      );
    }

    return undefined;
  })();

  return (
    <ProfileLayout
      title={t("profile.title")}
      rightElement={rightHeaderElement}
      scrollRef={scrollRef}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <ProfileHeader
        styles={styles}
        colors={colors}
        pickImage={pickImage}
        uploadingAvatar={uploadingAvatar}
        avatarUrl={avatarUrl}
        avatarFallback={avatarFallback}
        displayName={displayName}
        membershipRole={membershipRole}
        t={t}
        emailValue={emailValue}
        createdAtValue={createdAtValue}
      />

      {isLoading || isRefetching ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginVertical: 12 }}
        />
      ) : null}
      {error ? (
        <Text style={styles.error}>{t("profile.loadError")}</Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionTabs}
      >
        {(
          [
            { key: "info", label: t("profile.sectionInfo") },
            { key: "security", label: t("profile.security") },
            { key: "notifications", label: t("profile.notificationsTitle") },
            { key: "account", label: t("profile.sectionAccount") },
          ] as const
        )
          .filter((section) => section.key !== "account" || isOwner)
          .map((section) => {
            const isActive = activeSection === section.key;
            return (
              <TouchableOpacity
                key={section.key}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                onPress={() => handleSectionChange(section.key)}
              >
                <Text
                  style={[
                    styles.sectionTabText,
                    isActive && styles.sectionTabTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {activeSection === "info" ? (
        <ProfileInfo
          styles={styles}
          colors={colors}
          t={t}
          editFirstName={editFirstName}
          editLastName={editLastName}
          editPhone={editPhone}
          editAddress={editAddress}
          editAddress2={editAddress2}
          handleFirstNameChange={handleFirstNameChange}
          handleLastNameChange={handleLastNameChange}
          handlePhoneChange={handlePhoneChange}
          handleAddressChange={handleAddressChange}
          handleAddress2Change={handleAddress2Change}
          updatePending={updateMutation.isPending}
          canSwitchViewMode={canSwitchViewMode}
          resolvedViewMode={resolvedViewMode}
          handleViewModeChange={handleViewModeChange}
          currentLanguage={currentLanguage}
          handleLanguageChange={handleLanguageChange}
          languagePending={languageMutation.isPending}
        />
      ) : null}

      {activeSection === "notifications" ? (
        <ProfileNotifications
          styles={styles}
          colors={colors}
          t={t}
          loadingNotifications={loadingNotifications}
          pushEnabled={pushEnabled}
          notificationsDisabled={notificationsDisabled}
          resolvedNotificationPreferences={resolvedNotificationPreferences}
          reminderChipOptions={reminderChipOptions}
          reminderOffsets={reminderOffsets}
          remindersDisabled={remindersDisabled}
          updatePreferences={updatePreferences}
          handleToggleReminderOffset={handleToggleReminderOffset}
          customReminderInput={customReminderInput}
          setCustomReminderInput={setCustomReminderInput}
          handleAddCustomReminder={handleAddCustomReminder}
          formatReminderOffsetLabel={formatReminderOffsetLabel}
        />
      ) : null}

      {activeSection === "security" ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.linkTitle")}</Text>
            <Text style={styles.sectionText}>
              {t("profile.linkDescription")}
            </Text>
            <View style={styles.linkGroup}>
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  (linkingProvider || isGoogleLinked) && styles.buttonDisabled,
                ]}
                onPress={() => handleLinkProvider("google")}
                disabled={Boolean(linkingProvider) || isGoogleLinked}
              >
                <View style={styles.linkButtonContent}>
                  <Ionicons name="logo-google" size={18} color={colors.text} />
                  <Text style={styles.linkButtonText}>{googleButtonLabel}</Text>
                  {linkingProvider === "google" ? (
                    <ActivityIndicator color={colors.text} />
                  ) : null}
                </View>
              </TouchableOpacity>
              {showAppleLink ? (
                <TouchableOpacity
                  style={[
                    styles.linkButton,
                    (linkingProvider || isAppleLinked) && styles.buttonDisabled,
                  ]}
                  onPress={() => handleLinkProvider("apple")}
                  disabled={Boolean(linkingProvider) || isAppleLinked}
                >
                  <View style={styles.linkButtonContent}>
                    <Ionicons name="logo-apple" size={18} color={colors.text} />
                    <Text style={styles.linkButtonText}>
                      {appleButtonLabel}
                    </Text>
                    {linkingProvider === "apple" ? (
                      <ActivityIndicator color={colors.text} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("profile.security")}</Text>
            <Text style={styles.sectionText}>
              {t("profile.changePasswordDescription")}
            </Text>
            {showPasswordForm ? (
              <>
                <TextInput
                  style={styles.inputField}
                  value={newPassword}
                  onChangeText={handleNewPasswordChange}
                  placeholder={t("profile.newPassword")}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  secureTextEntry
                />
                <TextInput
                  style={styles.inputField}
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  placeholder={t("profile.confirmPassword")}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  secureTextEntry
                />
                {passwordError ? (
                  <Text style={[styles.error, { marginTop: 6 }]}>
                    {passwordError}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={styles.button}
                  onPress={handlePasswordSave}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t("common.save")}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondary]}
                  onPress={handlePasswordCancel}
                  disabled={resetPasswordMutation.isPending}
                >
                  <Text style={styles.buttonTextSecondary}>
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.button}
                onPress={handleOpenPasswordForm}
                disabled={
                  updateMutation.isPending || languageMutation.isPending
                }
              >
                <Text style={styles.buttonText}>
                  {t("profile.changePassword")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : null}

      {isOwner && activeSection === "account" ? (
        <ProfileMarketplace
          styles={styles}
          colors={colors}
          t={t}
          accountActive={accountActive}
          handleToggleAccountActive={handleToggleAccountActive}
          accountName={accountName}
          setAccountName={setAccountName}
          accountRegion={accountRegion}
          setAccountRegion={setAccountRegion}
          accountDescription={accountDescription}
          setAccountDescription={setAccountDescription}
          brandPrimary={brandPrimary}
          setBrandPrimary={setBrandPrimary}
          brandPrimarySoft={brandPrimarySoft}
          setBrandPrimarySoft={setBrandPrimarySoft}
          brandAccent={brandAccent}
          setBrandAccent={setBrandAccent}
          brandAccentSoft={brandAccentSoft}
          setBrandAccentSoft={setBrandAccentSoft}
          brandBackground={brandBackground}
          setBrandBackground={setBrandBackground}
          accountLogoUrl={accountLogoUrl}
          accountHeroUrl={accountHeroUrl}
          uploadingAccountLogo={uploadingAccountLogo}
          uploadingAccountHero={uploadingAccountHero}
          pickAccountImage={pickAccountImage}
          accountUploadLogoFromUri={accountUploadLogoFromUri}
          accountUploadHeroFromUri={accountUploadHeroFromUri}
          accountInstagram={accountInstagram}
          setAccountInstagram={setAccountInstagram}
          accountFacebook={accountFacebook}
          setAccountFacebook={setAccountFacebook}
          accountTiktok={accountTiktok}
          setAccountTiktok={setAccountTiktok}
          accountWebsite={accountWebsite}
          setAccountWebsite={setAccountWebsite}
          accountMutationPending={accountMutation?.isPending}
        />
      ) : null}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.button, styles.danger]}
          onPress={async () => {
            hapticSelection();
            await useAuthStore.getState().clear();
            navigation.replace("Login");
          }}
        >
          <Text style={styles.buttonText}>{t("profile.logout")}</Text>
        </TouchableOpacity>
        {versionLabel ? (
          <Text style={styles.footerVersion}>{versionLabel}</Text>
        ) : null}
      </View>
    </ProfileLayout>
  );
}
