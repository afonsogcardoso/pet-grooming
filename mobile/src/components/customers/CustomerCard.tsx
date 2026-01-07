import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { getCardVariants } from "../../theme/uiTokens";
import type { Customer } from "../../api/customers";
import { formatCustomerName } from "../../utils/customer";

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
}

export function CustomerCard({ customer, onPress }: CustomerCardProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const petCount = customer.pet_count || customer.pets?.length || 0;
  const appointmentCount = customer.appointment_count ?? 0;
  const displayName = formatCustomerName(customer);

  const initial = displayName?.charAt(0)?.toUpperCase() || "?";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumb}>
        {customer.photo_url ? (
          <Image
            source={{ uri: customer.photo_url }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.thumbInitial}>{initial}</Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.details}>
          {customer.phone ? (
            <Text style={styles.detailText} numberOfLines={1}>
              {customer.phone}
            </Text>
          ) : null}
          <Text style={styles.detailText}>
            {t("customerCard.petCount", { count: petCount })} •{" "}
            {t("customerCard.appointmentCount", { count: appointmentCount })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  const { listItem } = getCardVariants(colors);
  const placeholderBg =
    colors.primarySoft && colors.primarySoft !== colors.surface
      ? colors.primarySoft
      : colors.primary
      ? `${colors.primary}12`
      : colors.surfaceBorder;
  return StyleSheet.create({
    card: {
      ...listItem,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    thumb: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: placeholderBg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    thumbImage: {
      width: "100%",
      height: "100%",
      borderRadius: 27,
    },
    thumbInitial: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.primary,
    },
    info: {
      flex: 1,
      gap: 6,
    },
    name: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    details: {
      flexDirection: "column",
      gap: 4,
    },
    detailText: {
      fontSize: 13,
      color: colors.muted,
    },
  });
}
