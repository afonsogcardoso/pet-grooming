import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Branding } from "../../api/branding";

type Props = {
  styles: any;
  colors: any;
  pickImage: () => void;
  uploadingAvatar: boolean;
  avatarUrl: string | null;
  avatarFallback: string;
  displayName: string;
  membershipRole: string | null;
  t: (key: string, opts?: any) => string;
  emailValue: string;
  createdAtValue: string;
};

export default function ProfileHeader({
  styles,
  colors,
  pickImage,
  uploadingAvatar,
  avatarUrl,
  avatarFallback,
  displayName,
  membershipRole,
  t,
  emailValue,
  createdAtValue,
}: Props) {
  return (
    <View style={styles.headerCard}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={pickImage}
          disabled={uploadingAvatar}
          activeOpacity={0.85}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{avatarFallback}</Text>
          )}
          {uploadingAvatar ? (
            <View style={styles.avatarLoading}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {membershipRole
                  ? t(`profile.accountRole.${membershipRole}` as any)
                  : t("profile.accountRole.unknown")}
              </Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>{emailValue}</Text>
          <Text style={styles.headerMeta}>
            {t("profile.createdAt")}: {createdAtValue}
          </Text>
        </View>
      </View>
    </View>
  );
}
