import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { ScreenHeader } from "../../components/ScreenHeader";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import {
  getAccountMembers,
  AccountMember,
  inviteAccountMember,
  updateAccountMemberRole,
  removeAccountMember,
} from "../../api/accountMembers";
import { Avatar } from "../../components/common/Avatar";

type InviteRole = "member" | "admin";

export default function TeamScreen() {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [isInviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => [
      { key: "admin" as InviteRole, label: t("profile.accountRole.admin") },
      { key: "member" as InviteRole, label: t("profile.accountRole.member") },
    ],
    [t]
  );

  const {
    data: members = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["accountMembers"],
    queryFn: getAccountMembers,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: InviteRole }) =>
      updateAccountMemberRole(memberId, role),
    onSuccess: (member: AccountMember) => {
      queryClient.setQueryData(
        ["accountMembers"],
        (old: AccountMember[] | undefined) => {
          if (!old) return old;
          return old.map((item) => (item.id === member.id ? member : item));
        }
      );
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error || err?.message || t("team.updateRoleError");
      Alert.alert(t("common.error"), message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeAccountMember(memberId),
    onSuccess: (_data, memberId) => {
      queryClient.setQueryData(
        ["accountMembers"],
        (old: AccountMember[] | undefined) => {
          if (!old) return old;
          return old.filter((item) => item.id !== memberId);
        }
      );
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error || err?.message || t("team.removeError");
      Alert.alert(t("common.error"), message);
    },
  });

  const openInviteModal = () => {
    setInviteEmail("");
    setInviteRole("member");
    setInviteError(null);
    setInviteModalVisible(true);
  };

  const closeInviteModal = () => {
    if (inviteLoading) return;
    setInviteModalVisible(false);
  };

  const handleSendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setInviteError(t("team.inviteEmailRequired"));
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);
      const response = await inviteAccountMember({ email, role: inviteRole });
      const inviteLink = response?.inviteLink || null;
      setLastInviteLink(inviteLink);
      if (inviteLink) {
        Alert.alert(
          t("team.inviteSuccessTitle"),
          t("team.inviteSuccessMessage"),
          [
            {
              text: t("team.copyInviteLink"),
              onPress: () => Share.share({ message: inviteLink }),
            },
            { text: t("common.ok") },
          ]
        );
      } else {
        Alert.alert(
          t("team.inviteSuccessTitle"),
          t("team.inviteSuccessMessage"),
          [{ text: t("common.ok") }]
        );
      }
      setInviteModalVisible(false);
      refetch();
    } catch (err: any) {
      const message =
        err?.response?.data?.error || err?.message || t("team.inviteError");
      setInviteError(message);
    } finally {
      setInviteLoading(false);
    }
  };

  const renderMember = ({ item }: { item: AccountMember }) => {
    const email = item.email || t("team.noEmail");
    const name =
      item.displayName ||
      [item.firstName, item.lastName].filter(Boolean).join(" ").trim() ||
      item.email ||
      t("common.unknown");
    const roleKey = typeof item.role === "string" ? item.role : "unknown";
    const roleLabel = t(`profile.accountRole.${roleKey}` as any, {
      defaultValue: roleKey,
    });
    const statusKey = typeof item.status === "string" ? item.status : null;
    const statusLabel = statusKey
      ? t(`team.status.${statusKey}` as any, { defaultValue: statusKey })
      : null;
    const isOwner = roleKey === "owner";
    const nextRole: InviteRole = roleKey === "admin" ? "member" : "admin";
    const isUpdating =
      updatingMemberId === item.id && (updateRoleMutation as any).isLoading;
    const isRemoving =
      removingMemberId === item.id && (removeMemberMutation as any).isLoading;

    const handleChangeRole = () => {
      if (isOwner) return;
      setUpdatingMemberId(item.id);
      updateRoleMutation.mutate(
        { memberId: item.id, role: nextRole },
        {
          onSettled: () => setUpdatingMemberId(null),
        }
      );
    };

    const confirmRemove = () => {
      if (isOwner) return;
      Alert.alert(
        t("team.removeConfirmTitle"),
        t("team.removeConfirmMessage", { name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("team.removeAction"),
            style: "destructive",
            onPress: () => {
              setRemovingMemberId(item.id);
              removeMemberMutation.mutate(item.id, {
                onSettled: () => setRemovingMemberId(null),
              });
            },
          },
        ]
      );
    };

    return (
      <View style={[styles.card, { borderColor: colors.surfaceBorder }]}>
        <Avatar name={name} imageUrl={item.avatarUrl} size="medium" />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.email, { color: colors.muted }]}>{email}</Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.primarySoft,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {roleLabel}
              </Text>
            </View>
            {isOwner ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.text }]}>
                  {t("team.ownerBadge")}
                </Text>
              </View>
            ) : null}
            {statusLabel ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.surfaceBorder,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.muted }]}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {!isOwner ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionPill,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primarySoft,
                  },
                ]}
                disabled={isUpdating || isRemoving}
                onPress={handleChangeRole}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[styles.actionPillLabel, { color: colors.primary }]}
                  >
                    {roleKey === "admin"
                      ? t("team.setMemberAction")
                      : t("team.setAdminAction")}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionPill,
                  {
                    borderColor: colors.danger,
                    backgroundColor: colors.surface,
                  },
                ]}
                disabled={isUpdating || isRemoving}
                onPress={confirmRemove}
              >
                {isRemoving ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text
                    style={[styles.actionPillLabel, { color: colors.danger }]}
                  >
                    {t("team.removeAction")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const rightAction = (
    <TouchableOpacity
      onPress={openInviteModal}
      style={[
        styles.inviteButton,
        { backgroundColor: colors.primarySoft, borderColor: colors.primary },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.inviteLabel, { color: colors.primary }]}>
        {t("team.inviteAction")}
      </Text>
    </TouchableOpacity>
  );

  const contentPadding = {
    paddingBottom: Math.max(insets.bottom + 16, 24),
  };

  return (
    <SafeAreaView
      mode="padding"
      edges={["left", "right", "bottom"]}
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12),
          backgroundColor: colors.background,
        },
      ]}
    >
      <ScreenHeader title={t("team.title")} rightElement={rightAction} />
      <FlatList
        data={members}
        keyExtractor={(item, index) =>
          item?.id?.toString?.() || item?.email || `member-${index}`
        }
        renderItem={renderMember}
        contentContainerStyle={[styles.listContent, contentPadding]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={t("team.emptyTitle")}
              description={t("team.emptyDescription")}
              actionLabel={t("team.inviteAction")}
              onAction={openInviteModal}
            />
          ) : null
        }
      />
      <Modal
        visible={isInviteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeInviteModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboard}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t("team.inviteModalTitle")}
                </Text>
                <TouchableOpacity
                  onPress={closeInviteModal}
                  disabled={inviteLoading}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Text style={[styles.modalClose, { color: colors.muted }]}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalDescription, { color: colors.muted }]}>
                {t("team.inviteModalDescription")}
              </Text>
              <Input
                label={t("team.inviteEmailLabel")}
                placeholder={t("team.inviteEmailPlaceholder")}
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                showEmailSuggestions
              />
              <Text style={[styles.roleLabelHeader, { color: colors.text }]}>
                {t("team.inviteRoleLabel")}
              </Text>
              <Text style={[styles.modalHelper, { color: colors.muted }]}>
                {t("team.inviteRoleHelper")}
              </Text>
              <View style={styles.roleRow}>
                {roleOptions.map((option) => {
                  const isSelected = inviteRole === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.roleOption,
                        {
                          borderColor: isSelected
                            ? colors.primary
                            : colors.surfaceBorder,
                          backgroundColor: isSelected
                            ? colors.primarySoft
                            : "transparent",
                        },
                      ]}
                      onPress={() => setInviteRole(option.key)}
                    >
                      <Text
                        style={[
                          styles.roleOptionLabel,
                          {
                            color: isSelected ? colors.primary : colors.text,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {inviteError ? (
                <Text style={[styles.modalError, { color: colors.danger }]}>
                  {inviteError}
                </Text>
              ) : null}
              {lastInviteLink ? (
                <TouchableOpacity
                  onPress={() => Share.share({ message: lastInviteLink })}
                  style={[
                    styles.copyPill,
                    {
                      borderColor: colors.primary,
                      backgroundColor: colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={[styles.copyPillText, { color: colors.primary }]}
                  >
                    {t("team.copyInviteLink")}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <Button
                title={t("team.inviteSubmit")}
                onPress={handleSendInvite}
                loading={inviteLoading}
                disabled={inviteLoading}
                size="large"
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
    },
    loadingRow: {
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: colors.surface,
      marginBottom: 12,
      gap: 12,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: "700",
    },
    email: {
      fontSize: 13,
    },
    badgeRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 4,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "center",
      padding: 24,
    },
    modalKeyboard: {
      flex: 1,
      justifyContent: "center",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 12,
      maxHeight: "90%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
    },
    modalDescription: {
      fontSize: 15,
      marginBottom: 12,
      lineHeight: 20,
    },
    modalClose: {
      fontSize: 28,
      fontWeight: "600",
    },
    roleLabelHeader: {
      fontSize: 14,
      fontWeight: "600",
    },
    modalHelper: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 6,
    },
    roleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    roleOption: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    roleOptionLabel: {
      fontWeight: "600",
      fontSize: 14,
    },
    modalError: {
      fontSize: 13,
      marginBottom: 8,
    },
    inviteButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
    },
    inviteLabel: {
      fontWeight: "700",
      fontSize: 14,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 12,
    },
    actionPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 120,
    },
    actionPillLabel: {
      fontWeight: "700",
      fontSize: 13,
    },
    copyPill: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignSelf: "flex-start",
      marginBottom: 8,
    },
    copyPillText: {
      fontWeight: "700",
      fontSize: 13,
    },
  });
}
