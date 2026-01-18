import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Input } from "../common/Input";
import { PhoneInput } from "../common/PhoneInput";
import { AddressAutocomplete } from "../appointment/AddressAutocomplete";

type Props = {
  styles: any;
  t: any;
  editFirstName: string;
  editLastName: string;
  editPhone: string;
  editAddress: string;
  editAddress2: string;
  handleFirstNameChange: (v: string) => void;
  handleLastNameChange: (v: string) => void;
  handlePhoneChange: (v: string) => void;
  handleAddressChange: (v: string) => void;
  handleAddress2Change: (v: string) => void;
  updatePending: boolean;
  canSwitchViewMode: boolean;
  resolvedViewMode: string;
  handleViewModeChange: (mode: any) => void;
  currentLanguage: string;
  handleLanguageChange: (lang: string) => void;
  languagePending: boolean;
};

export default function ProfileInfo({
  styles,
  t,
  editFirstName,
  editLastName,
  editPhone,
  editAddress,
  editAddress2,
  handleFirstNameChange,
  handleLastNameChange,
  handlePhoneChange,
  handleAddressChange,
  handleAddress2Change,
  updatePending,
  canSwitchViewMode,
  resolvedViewMode,
  handleViewModeChange,
  currentLanguage,
  handleLanguageChange,
  languagePending,
}: Props) {
  return (
    <>
      <View style={styles.section}>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Input
              label={t("profile.firstNamePlaceholder")}
              value={editFirstName}
              onChangeText={handleFirstNameChange}
              placeholder={t("profile.firstNamePlaceholder")}
              autoCapitalize="words"
              labelStyle={styles.inputLabel}
            />
          </View>
          <View style={styles.inputGroup}>
            <Input
              label={t("profile.lastNamePlaceholder")}
              value={editLastName}
              onChangeText={handleLastNameChange}
              placeholder={t("profile.lastNamePlaceholder")}
              autoCapitalize="words"
              labelStyle={styles.inputLabel}
            />
          </View>
        </View>
        <View style={styles.inputGroup}>
          <PhoneInput
            label={t("common.phone")}
            labelStyle={[styles.inputLabel, styles.inputLabelRegular]}
            containerStyle={styles.phoneField}
            value={editPhone}
            onChange={handlePhoneChange}
            placeholder={t("common.phone")}
            disabled={updatePending}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t("profile.addressLabel")}</Text>
          <AddressAutocomplete
            value={editAddress}
            onSelect={handleAddressChange}
            placeholder={t("profile.addressPlaceholder")}
          />
        </View>
        <View style={styles.inputGroup}>
          <Input
            value={editAddress2}
            onChangeText={handleAddress2Change}
            placeholder={t("profile.address2Placeholder")}
            autoCapitalize="sentences"
          />
        </View>
        <View style={{ height: 12 }} />
      </View>

      {canSwitchViewMode ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profile.viewModeTitle")}</Text>
          <Text style={styles.sectionText}>
            {t("profile.viewModeDescription")}
          </Text>
          <View style={styles.modeOptions}>
            <TouchableOpacity
              style={[styles.modeOption]}
              onPress={() => handleViewModeChange("consumer")}
              disabled={updatePending || languagePending}
            >
              <Text
                style={[
                  styles.modeOptionText,
                  resolvedViewMode === "consumer" &&
                    styles.modeOptionTextActive,
                ]}
              >
                {t("profile.viewModeConsumer")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeOption]}
              onPress={() => handleViewModeChange("private")}
              disabled={updatePending || languagePending}
            >
              <Text
                style={[
                  styles.modeOptionText,
                  resolvedViewMode === "private" && styles.modeOptionTextActive,
                ]}
              >
                {t("profile.viewModePrivate")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.language")}</Text>
        <View style={styles.modeOptions}>
          {(["pt", "en"] as const).map((lang) => {
            const isActive = currentLanguage === lang;
            return (
              <TouchableOpacity
                key={lang}
                style={[styles.modeOption, isActive && styles.modeOptionActive]}
                onPress={() => handleLanguageChange(lang)}
                disabled={updatePending || languagePending}
              >
                <Text
                  style={[
                    styles.modeOptionText,
                    isActive && styles.modeOptionTextActive,
                  ]}
                >
                  {t(`language.${lang}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}
