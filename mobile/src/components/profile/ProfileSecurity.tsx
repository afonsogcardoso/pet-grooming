import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  styles: any;
  colors: any;
  t: any;
  linkingProvider: "google" | "apple" | null;
  isGoogleLinked: boolean;
  isAppleLinked: boolean;
  googleButtonLabel: string;
  appleButtonLabel: string;
  handleLinkProvider: (p: "google" | "apple") => void;
  showAppleLink: boolean;
  showPasswordForm: boolean;
  newPassword: string;
  confirmPassword: string;
  passwordError: string | null;
  resetPending: boolean;
  handleNewPasswordChange: (v: string) => void;
  handleConfirmPasswordChange: (v: string) => void;
  handlePasswordSave: () => void;
  handleOpenPasswordForm: () => void;
  handlePasswordCancel: () => void;
  updatePending: boolean;
  languagePending: boolean;
};

export default function ProfileSecurity({
  styles,
  colors,
  t,
  linkingProvider,
  isGoogleLinked,
  isAppleLinked,
  googleButtonLabel,
  appleButtonLabel,
  handleLinkProvider,
  showAppleLink,
  showPasswordForm,
  newPassword,
  confirmPassword,
  passwordError,
  resetPending,
  handleNewPasswordChange,
  handleConfirmPasswordChange,
  handlePasswordSave,
  handleOpenPasswordForm,
  handlePasswordCancel,
  updatePending,
  languagePending,
}: Props) {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("profile.linkTitle")}</Text>
        <Text style={styles.sectionText}>{t("profile.linkDescription")}</Text>
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
                <Text style={styles.linkButtonText}>{appleButtonLabel}</Text>
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
              disabled={resetPending}
            >
              {resetPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t("common.save")}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              onPress={handlePasswordCancel}
              disabled={resetPending}
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
            disabled={updatePending || languagePending}
          >
            <Text style={styles.buttonText}>{t("profile.changePassword")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
