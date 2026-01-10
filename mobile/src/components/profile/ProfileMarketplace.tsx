import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Switch from "../StyledSwitch";
import { Input } from "../common/Input";
import ImageWithDownload from "../common/ImageWithDownload";

type Props = {
  styles: any;
  colors: any;
  t: any;
  accountActive: boolean;
  handleToggleAccountActive: (v: boolean) => void;
  accountName: string;
  setAccountName: (s: string) => void;
  accountRegion: string;
  setAccountRegion: (s: string) => void;
  accountDescription: string;
  setAccountDescription: (s: string) => void;
  brandPrimary: string;
  setBrandPrimary: (s: string) => void;
  brandPrimarySoft: string;
  setBrandPrimarySoft: (s: string) => void;
  brandAccent: string;
  setBrandAccent: (s: string) => void;
  brandAccentSoft: string;
  setBrandAccentSoft: (s: string) => void;
  brandBackground: string;
  setBrandBackground: (s: string) => void;
  accountLogoUrl: string | null;
  accountHeroUrl: string | null;
  uploadingAccountLogo: boolean;
  uploadingAccountHero: boolean;
  pickAccountImage: (
    onSelected: (uri: string, fn?: string | null) => Promise<void>
  ) => void;
  accountUploadLogoFromUri: (uri: string, fn?: string | null) => Promise<void>;
  accountUploadHeroFromUri: (uri: string, fn?: string | null) => Promise<void>;
  accountInstagram: string;
  setAccountInstagram: (s: string) => void;
  accountFacebook: string;
  setAccountFacebook: (s: string) => void;
  accountTiktok: string;
  setAccountTiktok: (s: string) => void;
  accountWebsite: string;
  setAccountWebsite: (s: string) => void;
  accountMutationPending: boolean;
  deleteAccountLogo: () => void;
  deleteAccountHero: () => void;
};

type ColorFieldProps = {
  styles: any;
  colors: any;
  label: string;
  value: string;
  placeholder: string;
  setter: (value: string) => void;
};

function ColorField({
  styles,
  colors,
  label,
  value,
  placeholder,
  setter,
}: ColorFieldProps) {
  const swatchColor = value || placeholder;

  return (
    <View style={styles.colorCell}>
      <Text style={styles.colorLabel}>{label}</Text>
      <View style={styles.colorInputRow}>
        <View
          style={[
            styles.colorSwatch,
            { backgroundColor: swatchColor || colors.surface },
          ]}
        />
        <TextInput
          style={styles.colorInput}
          value={value}
          placeholder={placeholder}
          onChangeText={setter}
          autoCapitalize="none"
          placeholderTextColor={colors.muted}
        />
      </View>
    </View>
  );
}

export default function ProfileMarketplace({
  styles,
  colors,
  t,
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
  accountMutationPending,
  deleteAccountLogo,
  deleteAccountHero,
}: Props) {
  const coloringFields = [
    {
      key: "primary",
      label: t("marketplaceProfile.brandPrimary", {
        defaultValue: "Primary",
      }),
      value: brandPrimary,
      setter: setBrandPrimary,
      placeholder: "#007aff",
    },
    {
      key: "primarySoft",
      label: t("marketplaceProfile.brandPrimarySoft", {
        defaultValue: "Primary (soft)",
      }),
      value: brandPrimarySoft,
      setter: setBrandPrimarySoft,
      placeholder: "#e6f0ff",
    },
    {
      key: "accent",
      label: t("marketplaceProfile.brandAccent", {
        defaultValue: "Accent",
      }),
      value: brandAccent,
      setter: setBrandAccent,
      placeholder: "#ff9500",
    },
    {
      key: "accentSoft",
      label: t("marketplaceProfile.brandAccentSoft", {
        defaultValue: "Accent (soft)",
      }),
      value: brandAccentSoft,
      setter: setBrandAccentSoft,
      placeholder: "#fff2e6",
    },
    {
      key: "background",
      label: t("marketplaceProfile.brandBackground", {
        defaultValue: "Background",
      }),
      value: brandBackground,
      setter: setBrandBackground,
      placeholder: "#f6f9f8",
    },
  ];

  return (
    <>
      <View style={styles.section}>
        <View style={styles.inputGroup}>
          <Input
            label={t("marketplaceProfile.nameLabel")}
            value={accountName}
            onChangeText={setAccountName}
            placeholder={t("marketplaceProfile.namePlaceholder")}
            labelStyle={styles.inputLabel}
          />
        </View>
        <View style={styles.inputGroup}>
          <Input
            label={t("marketplaceProfile.regionLabel")}
            value={accountRegion}
            onChangeText={setAccountRegion}
            placeholder={t("marketplaceProfile.regionPlaceholder")}
            labelStyle={styles.inputLabel}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            {t("marketplaceProfile.descriptionLabel")}
          </Text>
          <TextInput
            style={[
              styles.inputField,
              { minHeight: 90, textAlignVertical: "top" },
            ]}
            value={accountDescription}
            onChangeText={setAccountDescription}
            placeholder={t("marketplaceProfile.descriptionPlaceholder")}
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextGroup}>
            <Text style={styles.toggleLabel}>
              {t("marketplaceProfile.activeLabel")}
            </Text>
          </View>
          <Switch
            value={accountActive}
            onValueChange={handleToggleAccountActive}
            disabled={accountMutationPending}
            ios_backgroundColor={colors.surface}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("marketplaceProfile.brandingTitle")}
        </Text>
        <View style={styles.colorGrid}>
          {coloringFields.map((entry) => (
            <ColorField
              key={entry.key}
              styles={styles}
              colors={colors}
              label={entry.label}
              value={entry.value}
              placeholder={entry.placeholder}
              setter={entry.setter}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.marketplaceMediaGrid}>
          <View style={styles.marketplaceMediaCard}>
            <Text style={styles.marketplaceMediaTitle}>
              {t("marketplaceProfile.logoTitle")}
            </Text>
            {accountLogoUrl ? (
              <View style={styles.marketplaceLogo}>
                <ImageWithDownload
                  uri={accountLogoUrl}
                  style={styles.marketplaceLogoImage}
                  onReplace={
                    uploadingAccountLogo
                      ? undefined
                      : () => pickAccountImage(accountUploadLogoFromUri)
                  }
                  onDelete={uploadingAccountLogo ? undefined : deleteAccountLogo}
                />
                {uploadingAccountLogo ? (
                  <View style={styles.marketplaceMediaOverlay}>
                    <ActivityIndicator color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.marketplaceLogo}
                onPress={() => pickAccountImage(accountUploadLogoFromUri)}
                disabled={uploadingAccountLogo}
              >
                <Text style={styles.marketplaceLogoFallback}>
                  {(accountName.trim().charAt(0) || "P").toUpperCase()}
                </Text>
                {uploadingAccountLogo ? (
                  <View style={styles.marketplaceMediaOverlay}>
                    <ActivityIndicator color={colors.onPrimary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.marketplaceMediaCard}>
            <Text style={styles.marketplaceMediaTitle}>
              {t("marketplaceProfile.heroTitle")}
            </Text>
            {accountHeroUrl ? (
              <View style={styles.marketplaceHero}>
                <ImageWithDownload
                  uri={accountHeroUrl}
                  style={styles.marketplaceHeroImage}
                  onReplace={
                    uploadingAccountHero
                      ? undefined
                      : () => pickAccountImage(accountUploadHeroFromUri)
                  }
                  onDelete={
                    uploadingAccountHero ? undefined : deleteAccountHero
                  }
                />
                {uploadingAccountHero ? (
                  <View style={styles.marketplaceMediaOverlay}>
                    <ActivityIndicator color={colors.onPrimary} />
                  </View>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.marketplaceHero}
                onPress={() => pickAccountImage(accountUploadHeroFromUri)}
                disabled={uploadingAccountHero}
              >
                <View style={styles.marketplaceHeroPlaceholder}>
                  <Text style={styles.marketplaceHeroPlaceholderText}>
                    {t("marketplaceProfile.heroPlaceholder")}
                  </Text>
                </View>
                {uploadingAccountHero ? (
                  <View style={styles.marketplaceMediaOverlay}>
                    <ActivityIndicator color={colors.onPrimary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t("marketplaceProfile.socialTitle")}
        </Text>
        <View style={styles.inputGroup}>
          <Input
            label={t("marketplaceProfile.instagramLabel")}
            value={accountInstagram}
            onChangeText={setAccountInstagram}
            placeholder={t("marketplaceProfile.instagramPlaceholder")}
            autoCapitalize="none"
            labelStyle={styles.inputLabel}
          />
        </View>
        <View style={styles.inputGroup}>
          <Input
            label={t("marketplaceProfile.facebookLabel")}
            value={accountFacebook}
            onChangeText={setAccountFacebook}
            placeholder={t("marketplaceProfile.facebookPlaceholder")}
            autoCapitalize="none"
            labelStyle={styles.inputLabel}
          />
        </View>
        <View style={styles.inputGroup}>
          <Input
            label={t("marketplaceProfile.tiktokLabel")}
            value={accountTiktok}
            onChangeText={setAccountTiktok}
            placeholder={t("marketplaceProfile.tiktokPlaceholder")}
            autoCapitalize="none"
            labelStyle={styles.inputLabel}
          />
        </View>
        <View style={styles.inputGroup}>
          <Input
            label={t("marketplaceProfile.websiteLabel")}
            value={accountWebsite}
            onChangeText={setAccountWebsite}
            placeholder={t("marketplaceProfile.websitePlaceholder")}
            autoCapitalize="none"
            labelStyle={styles.inputLabel}
          />
        </View>
      </View>
    </>
  );
}
