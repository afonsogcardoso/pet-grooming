import { ScrollView, Text, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getAccountMembers } from "../../api/accountMembers";
import { getAllServices } from "../../api/services";
import { getCustomers } from "../../api/customers";
import { getProfile } from "../../api/profile";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import createStyles from "./styles";
import AccountSectionCard from "./components/AccountSectionCard";
import { ScreenHeader } from "../../components/ScreenHeader";

function withAlpha(color: string, alpha: number) {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return color;
  }
  const int = Number.parseInt(hex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function AccountSettingsScreen() {
  const { colors, branding } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  const servicesQuery = useQuery({
    queryKey: ["services", "all"],
    queryFn: getAllServices,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getCustomers,
  });

  const { data: accountMembers = [] } = useQuery({
    queryKey: ["accountMembers"],
    queryFn: getAccountMembers,
  });

  const services = servicesQuery.data || [];
  const totalServices = services.length;
  const activeServices = services.filter(
    (service) => service.active !== false
  ).length;

  const customers = customersQuery.data || [];
  const missingContacts = customers.filter(
    (customer) => !customer.email && !customer.phone
  ).length;

  const recentCustomers = customers
    .slice()
    .reverse()
    .slice(0, 3)
    .map(
      (customer) => customer.firstName || customer.lastName || customer.email
    );

  const navigateRoot = (route: string, params?: object) => {
    if (!rootNavigation) return;
    rootNavigation.navigate(route, params);
  };

  const handleBranding = () => navigateRoot("AccountBranding");

  const handleTeam = () => navigateRoot("Team");
  const handleViewServices = () => navigateRoot("Services");
  const handleAddService = () =>
    navigateRoot("ServiceForm", { mode: "create" });
  const handleViewClients = () => navigateRoot("Customers");
  const handleAddClient = () =>
    navigateRoot("CustomerForm", { mode: "create" });
  const handleBilling = () => navigateRoot("Billing");

  const brandingBadge =
    branding?.account_name && branding?.marketplace_region
      ? `${branding.account_name} • ${branding.marketplace_region}`
      : branding?.account_name || undefined;

  const marketplaceBadge =
    typeof branding?.marketplace_enabled === "boolean"
      ? {
          label: branding.marketplace_enabled
            ? t("accountSettings.marketplaceEnabled")
            : t("accountSettings.marketplaceDisabled"),
          borderColor: branding.marketplace_enabled
            ? colors.success
            : colors.surfaceBorder,
          textColor: branding.marketplace_enabled
            ? colors.success
            : colors.muted,
          backgroundColor: branding.marketplace_enabled
            ? withAlpha(colors.success, 0.15)
            : colors.surface,
        }
      : null;

  const badgeLabel = marketplaceBadge?.label || brandingBadge;
  const badgeStyle = marketplaceBadge
    ? {
        borderColor: marketplaceBadge.borderColor,
        backgroundColor: marketplaceBadge.backgroundColor,
      }
    : undefined;
  const badgeTextStyle = marketplaceBadge
    ? { color: marketplaceBadge.textColor }
    : undefined;

  const billingStatus = t("accountSettings.billingStatusDefault");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? Math.max(insets.top - 8, 0) : 0
        }
      >
        <ScreenHeader title={t("accountSettings.title")} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.introText}>{t("accountSettings.intro")}</Text>

          <AccountSectionCard
            title={t("accountSettings.clientsTitle")}
            subtitle={t("accountSettings.clientsSubtitle")}
            badge={t("accountSettings.clientsBadge", {
              total: customers.length,
            })}
            colors={colors}
            actions={[
              {
                label: t("accountSettings.actions.viewClients"),
                onPress: handleViewClients,
              },
              {
                label: t("accountSettings.actions.addClient"),
                onPress: handleAddClient,
                variant: "primary",
              },
            ]}
          ></AccountSectionCard>

          <AccountSectionCard
            title={t("accountSettings.servicesTitle")}
            subtitle={t("accountSettings.servicesSubtitle")}
            badge={t("accountSettings.servicesBadge", {
              active: activeServices,
            })}
            colors={colors}
            actions={[
              {
                label: t("accountSettings.actions.reviewServices"),
                onPress: handleViewServices,
              },
              {
                label: t("accountSettings.actions.addService"),
                onPress: handleAddService,
                variant: "primary",
              },
            ]}
          ></AccountSectionCard>

          <AccountSectionCard
            title={t("accountSettings.billingTitle")}
            subtitle={t("accountSettings.billingSubtitle")}
            badge={t("accountSettings.billingBadge", { status: billingStatus })}
            colors={colors}
            actions={[
              {
                label: t("accountSettings.actions.viewBilling"),
                onPress: handleBilling,
                variant: "primary",
              },
            ]}
          ></AccountSectionCard>

          <AccountSectionCard
            title={t("accountSettings.teamTitle")}
            subtitle={t("accountSettings.teamSubtitle")}
            badge={t("accountSettings.teamBadge", {
              count: accountMembers.length,
            })}
            colors={colors}
            actions={[
              {
                label: t("accountSettings.actions.manageTeam"),
                onPress: handleTeam,
                variant: "primary",
              },
            ]}
          ></AccountSectionCard>

          <AccountSectionCard
            title={t("accountSettings.brandingTitle")}
            subtitle={t("accountSettings.brandingSubtitle")}
            badge={badgeLabel}
            badgeStyle={badgeStyle}
            badgeTextStyle={badgeTextStyle}
            colors={colors}
            actions={[
              {
                label: t("accountSettings.actions.viewBranding"),
                onPress: handleBranding,
                variant: "primary",
              },
            ]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
