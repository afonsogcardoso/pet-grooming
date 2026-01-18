import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProfile, updateProfile } from "../../api/profile";
import { getNotificationPreferences } from "../../api/notifications";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../state/authStore";
import { useViewModeStore } from "../../state/viewModeStore";
import { getDateLocale, normalizeLanguage, setAppLanguage } from "../../i18n";
import { formatVersionLabel } from "../../utils/version";
import { hapticError, hapticSuccess } from "../../utils/haptics";

export function useProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const setViewMode = useViewModeStore((s) => s.setViewMode);
  const [activeSection, setActiveSection] = useState<"info" | "account" | "security" | "notifications">("info");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const scrollRef = useRef<any>(null);
  const dateLocale = getDateLocale(i18n.language);
  const versionLabel = formatVersionLabel();

  const { data, isLoading, isRefetching, error } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 1000 * 60 * 5,
  });

  const { data: notificationPreferences, isLoading: loadingNotifications } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  // Local editable state
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAddress2, setEditAddress2] = useState("");
  const [hasProfileEdits, setHasProfileEdits] = useState(false);

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
  }, [data?.displayName, data?.firstName, data?.lastName, data?.phone, data?.address, data?.address2, user?.displayName, user?.address, user?.address2]);

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

  const mergeProfileUpdate = (
    current: any | undefined,
    updated: any,
    payload?: Partial<any>
  ) => {
    if (!current) return updated;
    const next: any = { ...current };
    const isBlankString = (value: unknown) => typeof value === "string" && value.trim().length === 0;
    const applyIfProvided = <K extends keyof any>(key: K) => {
      const value = updated[key as any];
      if (payload && key in payload) {
        if (value !== undefined) {
          next[key as any] = value;
        }
        return;
      }
      if (value !== undefined && value !== null && !isBlankString(value)) {
        next[key as any] = value;
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
      const previousProfile = queryClient.getQueryData(["profile"]) || data || undefined;
      if (previousProfile && !queryClient.getQueryData(["profile"])) {
        queryClient.setQueryData(["profile"], previousProfile);
      }
      return { previousProfile };
    },
    onSuccess: (updated: any, payload: any, context: any) => {
      hapticSuccess();
      const current = queryClient.getQueryData(["profile"]) || context?.previousProfile || data || undefined;
      const merged = current ? mergeProfileUpdate(current, updated, payload) : updated;
      queryClient.setQueryData(["profile"], merged);
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
        ("firstName" in payload || "lastName" in payload || "phone" in payload || "address" in payload || "address2" in payload)
      ) {
        setHasProfileEdits(false);
        setEditFirstName(merged.firstName ?? "");
        setEditLastName(merged.lastName ?? "");
        setEditPhone(merged.phone ?? "");
        setEditAddress(merged.address ?? "");
        setEditAddress2(merged.address2 ?? "");
      }
    },
    onError: () => {
      hapticError();
      alert(t("common.error"));
    },
  });

  const handleSave = () => {
    if (!isProfileDirty) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      // Keep same behavior as before
      // Using global Alert in the caller; for now use window alert fallback
      // In React Native this should be Alert.alert; keep simple here
      // but we keep behavior minimal and rely on components to show messages
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

  const languageMutation = useMutation({
    mutationFn: async (language: string) => updateProfile({ locale: normalizeLanguage(language) }),
    onMutate: async (language: string) => {
      const normalized = normalizeLanguage(language);
      const previousProfile = queryClient.getQueryData(["profile"]);
      queryClient.setQueryData(["profile"], (current: any) => (current ? { ...current, locale: normalized } : current));
      const previousLanguage = i18n.language;
      await setAppLanguage(normalized);
      return { previousProfile, previousLanguage, normalized };
    },
    onSuccess: (updated: any) => {
      hapticSuccess();
      if (updated?.locale) {
        queryClient.setQueryData(["profile"], (current: any) => (current ? { ...current, locale: updated.locale } : current));
      }
    },
    onError: async (_err: any, _vars: any, context: any) => {
      hapticError();
      if (context?.previousLanguage) {
        await setAppLanguage(context.previousLanguage);
      }
    },
  });

  return {
    t,
    i18n,
    user,
    setUser,
    queryClient,
    setViewMode,
    activeSection,
    setActiveSection,
    uploadingAvatar,
    setUploadingAvatar,
    scrollRef,
    dateLocale,
    versionLabel,
    isLoading,
    isRefetching,
    error,
    data,
    styles: {},
    notificationPreferences,
    loadingNotifications,
    // profile edit state + handlers
    editFirstName,
    setEditFirstName,
    editLastName,
    setEditLastName,
    editPhone,
    setEditPhone,
    editAddress,
    setEditAddress,
    editAddress2,
    setEditAddress2,
    hasProfileEdits,
    setHasProfileEdits,
    profileDefaults,
    isProfileDirty,
    handleSave,
    handleProfileReset,
    updateMutation,
    languageMutation,
  };
}
