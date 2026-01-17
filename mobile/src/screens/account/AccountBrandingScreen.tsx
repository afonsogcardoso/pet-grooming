import React, { useMemo } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import ProfileMarketplace from "../../components/profile/ProfileMarketplace";
import ProfileLayout from "../profile/ProfileLayout";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { useAccountBranding } from "./useAccountBranding";

export default function AccountBrandingScreen() {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const {
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
    handleDeleteAccountLogo,
    handleDeleteAccountHero,
    isAccountDirty,
    handleAccountSave,
    handleAccountReset,
    accountMutationPending,
  } = useAccountBranding();

  const rightHeaderElement = isAccountDirty ? (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TouchableOpacity
        onPress={handleAccountReset}
        disabled={accountMutationPending}
        style={{
          marginRight: 12,
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22, color: colors.text }}>×</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleAccountSave}
        disabled={accountMutationPending}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {accountMutationPending ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={{ color: colors.onPrimary, fontSize: 20 }}>✓</Text>
        )}
      </TouchableOpacity>
    </View>
  ) : undefined;

  return (
    <ProfileLayout
      title={t("accountSettings.brandingTitle")}
      rightElement={rightHeaderElement}
    >
      <ProfileMarketplace
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
        deleteAccountLogo={handleDeleteAccountLogo}
        deleteAccountHero={handleDeleteAccountHero}
        accountInstagram={accountInstagram}
        setAccountInstagram={setAccountInstagram}
        accountFacebook={accountFacebook}
        setAccountFacebook={setAccountFacebook}
        accountTiktok={accountTiktok}
        setAccountTiktok={setAccountTiktok}
        accountWebsite={accountWebsite}
        setAccountWebsite={setAccountWebsite}
        accountMutationPending={accountMutationPending}
      />
    </ProfileLayout>
  );
}
