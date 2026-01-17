import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Branding, BrandingUpdatePayload, brandingQueryKey, deleteBrandLogo, deletePortalImage, updateBranding, uploadBrandLogo, uploadPortalImage } from "../../api/branding";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { debounce } from "../../utils/debounce";
import { hapticError, hapticSuccess } from "../../utils/haptics";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { cameraOptions, galleryOptions } from "../../utils/imageOptions";
import { compressImage } from "../../utils/imageCompression";

type PickerCallback = (uri: string, fileName?: string | null) => Promise<void>;

export function useAccountBranding() {
  const { t } = useTranslation();
  const { branding } = useBrandingTheme();
  const queryClient = useQueryClient();
  const [accountDirty, setAccountDirty] = useState(false);
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
  const [accountLogoUrl, setAccountLogoUrl] = useState<string | null>(null);
  const [accountHeroUrl, setAccountHeroUrl] = useState<string | null>(null);
  const [accountActive, setAccountActive] = useState(true);
  const [uploadingAccountLogo, setUploadingAccountLogo] = useState(false);
  const [uploadingAccountHero, setUploadingAccountHero] = useState(false);
  const [accountInitialized, setAccountInitialized] = useState(false);

  useEffect(() => {
    if (typeof branding?.marketplace_enabled === "boolean") {
      setAccountActive(branding.marketplace_enabled);
    }
  }, [branding?.marketplace_enabled]);

  const brandingAccountId = branding?.id || branding?.account_id || null;
  const brandingKey = brandingQueryKey(brandingAccountId);

  const createMarketplaceSetter = useCallback(
    <T extends keyof BrandingUpdatePayload>(
      stateSetter: (value: string) => void,
      brandingKey: keyof Branding,
      _payloadKey: T
    ) => {
      return (value: string, fromBranding = false) => {
        stateSetter(value);
        if (!fromBranding && value !== (branding?.[brandingKey] || "")) {
          setAccountDirty(true);
        }
      };
    },
    [branding]
  );

  const setAccountName = createMarketplaceSetter(
    setAccountNameState,
    "account_name",
    "name"
  );
  const setAccountRegion = createMarketplaceSetter(
    setAccountRegionState,
    "marketplace_region",
    "marketplace_region"
  );
  const setAccountDescription = createMarketplaceSetter(
    setAccountDescriptionState,
    "marketplace_description",
    "marketplace_description"
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

  const debouncedSaveAccountActive = useMemo(
    () =>
      debounce((value: boolean) => {
        updateBranding({ marketplace_enabled: value }, brandingAccountId);
      }, 600),
    [brandingAccountId]
  );

  const handleToggleAccountActive = useCallback(
    (value: boolean) => {
      setAccountActive(value);
      debouncedSaveAccountActive(value);
    },
    [debouncedSaveAccountActive]
  );

  const applyAccountBranding = useCallback(
    (data?: Branding | null) => {
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
      setAccountDirty(false);
      setAccountInitialized(true);
    },
    [
      setAccountName,
      setAccountDescription,
      setAccountRegion,
      setAccountInstagram,
      setAccountFacebook,
      setAccountTiktok,
      setAccountWebsite,
      setBrandPrimary,
      setBrandPrimarySoft,
      setBrandAccent,
      setBrandAccentSoft,
      setBrandBackground,
    ]
  );

  const accountMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateBranding>[0]) =>
      updateBranding(payload, brandingAccountId),
    onSuccess: (updated) => {
      hapticSuccess();
      queryClient.setQueryData(brandingKey, updated);
      applyAccountBranding(updated);
      setAccountDirty(false);
    },
    onError: () => {
      hapticError();
      Alert.alert(t("common.error"), t("profile.marketplaceUpdateError"));
    },
  });

  useEffect(() => {
    if (!accountInitialized && branding) {
      applyAccountBranding(branding);
      setAccountInitialized(true);
      setAccountDirty(false);
    }
  }, [accountInitialized, applyAccountBranding, branding]);

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
  ]);

  const requestAndroidPermissions = useCallback(async () => {
    if (Platform.OS !== "android") return true;
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
  }, [t]);

  const handleUploadLogo = useCallback(
    async (uri: string) => {
      if (!brandingAccountId) return;
      try {
        setUploadingAccountLogo(true);
        const compressed = await compressImage(uri);
        const formData = new FormData();
        const filename = `logo-${Date.now()}.jpg`;
        formData.append("file", {
          uri: compressed,
          type: "image/jpeg",
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
          queryClient.setQueryData(brandingKey, updated);
          applyAccountBranding(updated);
        }
      } catch (err) {
        hapticError();
        Alert.alert(t("common.error"), t("marketplaceProfile.logoUploadError"));
      } finally {
        setUploadingAccountLogo(false);
      }
    },
    [branding, brandingAccountId, applyAccountBranding, queryClient, t]
  );

  const handleUploadHero = useCallback(
    async (uri: string) => {
      if (!brandingAccountId) return;
      try {
        setUploadingAccountHero(true);
        const compressed = await compressImage(uri);
        const formData = new FormData();
        const filename = `portal-${Date.now()}.jpg`;
        formData.append("file", {
          uri: compressed,
          type: "image/jpeg",
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
          queryClient.setQueryData(brandingKey, updated);
          applyAccountBranding(updated);
        }
      } catch (err) {
        hapticError();
        Alert.alert(t("common.error"), t("marketplaceProfile.heroUploadError"));
      } finally {
        setUploadingAccountHero(false);
      }
    },
    [branding, brandingAccountId, applyAccountBranding, queryClient, t]
  );

  const handleDeleteAccountLogo = useCallback(async () => {
    if (!brandingAccountId) return;
    try {
      setUploadingAccountLogo(true);
      const updated = await deleteBrandLogo(brandingAccountId);
      queryClient.setQueryData(brandingKey, updated);
      applyAccountBranding(updated);
    } catch (err) {
      hapticError();
      Alert.alert(t("common.error"), t("marketplaceProfile.logoUploadError"));
    } finally {
      setUploadingAccountLogo(false);
    }
  }, [applyAccountBranding, brandingAccountId, queryClient, t]);

  const handleDeleteAccountHero = useCallback(async () => {
    if (!brandingAccountId) return;
    try {
      setUploadingAccountHero(true);
      const updated = await deletePortalImage(brandingAccountId);
      queryClient.setQueryData(brandingKey, updated);
      applyAccountBranding(updated);
    } catch (err) {
      hapticError();
      Alert.alert(t("common.error"), t("marketplaceProfile.heroUploadError"));
    } finally {
      setUploadingAccountHero(false);
    }
  }, [applyAccountBranding, brandingAccountId, queryClient, t]);

  const openAccountCamera = useCallback(
    async (onSelected: PickerCallback) => {
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
          Alert.alert(t("common.error"), t("profile.openCameraError"));
          return;
        }
        if (response.assets && response.assets[0]) {
          await onSelected(response.assets[0].uri!, response.assets[0].fileName);
        }
      });
    },
    [requestAndroidPermissions, t]
  );

  const openAccountGallery = useCallback(
    async (onSelected: PickerCallback) => {
      launchImageLibrary(galleryOptions, async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert(t("common.error"), t("profile.openGalleryError"));
          return;
        }
        if (response.assets && response.assets[0]) {
          await onSelected(response.assets[0].uri!, response.assets[0].fileName);
        }
      });
    },
    [t]
  );

  const pickAccountImage = useCallback(
    (onSelected: PickerCallback) => {
      if (Platform.OS === "ios") {
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
        return;
      }
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
    },
    [openAccountCamera, openAccountGallery, t]
  );

  const accountUploadLogoFromUri = useCallback(
    async (uri: string) => handleUploadLogo(uri),
    [handleUploadLogo]
  );

  const accountUploadHeroFromUri = useCallback(
    async (uri: string) => handleUploadHero(uri),
    [handleUploadHero]
  );

  const handleAccountSave = useCallback(() => {
    if (!accountName.trim()) {
      Alert.alert(t("common.warning"), t("marketplaceProfile.nameRequired"));
      return;
    }
    accountMutation.mutate({
      name: accountName.trim(),
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
  }, [
    accountName,
    accountRegion,
    accountDescription,
    accountInstagram,
    accountFacebook,
    accountTiktok,
    accountWebsite,
    brandPrimary,
    brandPrimarySoft,
    brandAccent,
    brandAccentSoft,
    brandBackground,
    accountMutation,
    t,
  ]);

  const handleAccountReset = useCallback(() => {
    if (!branding) return;
    setAccountInitialized(false);
    applyAccountBranding(branding);
    setAccountDirty(false);
  }, [applyAccountBranding, branding]);

  return {
    accountActive,
    handleToggleAccountActive,
    accountName,
    setAccountName,
    accountRegion,
    setAccountRegion,
    accountDescription,
    setAccountDescription,
    brandPrimary,
    setBrandPrimary,
    brandPrimarySoft,
    setBrandPrimarySoft,
    brandAccent,
    setBrandAccent,
    brandAccentSoft,
    setBrandAccentSoft,
    brandBackground,
    setBrandBackground,
    accountLogoUrl,
    accountHeroUrl,
    uploadingAccountLogo,
    uploadingAccountHero,
    pickAccountImage,
    accountUploadLogoFromUri,
    accountUploadHeroFromUri,
    accountInstagram,
    setAccountInstagram,
    accountFacebook,
    setAccountFacebook,
    accountTiktok,
    setAccountTiktok,
    accountWebsite,
    setAccountWebsite,
    isAccountDirty,
    handleAccountSave,
    handleAccountReset,
    handleDeleteAccountLogo,
    handleDeleteAccountHero,
    accountMutationPending: accountMutation.isPending,
  };
}
