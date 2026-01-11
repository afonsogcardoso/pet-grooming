import React from "react";
import {
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

type Action = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
};

type Props = {
  title: string;
  subtitle?: string;
  badge?: string;
  children?: React.ReactNode;
  actions?: Action[];
  colors: any;
  style?: ViewStyle;
  badgeStyle?: ViewStyle;
  badgeTextStyle?: TextStyle;
};

export default function AccountSectionCard({
  title,
  subtitle,
  badge,
  children,
  actions,
  colors,
  style,
  badgeStyle,
  badgeTextStyle,
}: Props) {
  const actionStyles = (variant?: string) => {
    if (variant === "primary") {
      return {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      };
    }
    return {
      backgroundColor: "transparent",
      borderColor: colors.surfaceBorder,
    };
  };

  const actionLabelStyles = (variant?: string) => {
    if (variant === "primary") {
      return { color: colors.onPrimary };
    }
    return { color: colors.primary };
  };

  return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
          },
          style,
        ]}
      >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {badge ? (
          <View
            style={[
              styles.badge,
              { borderColor: colors.primary, backgroundColor: colors.surface },
              badgeStyle,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: colors.primary },
                badgeTextStyle,
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
      ) : null}
      {children ? <View style={styles.body}>{children}</View> : null}
      {actions && actions.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              onPress={action.onPress}
              style={[
                styles.button,
                actionStyles(action.variant),
                action.variant === "primary" && {
                  shadowColor: colors.primary,
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonLabel, actionLabelStyles(action.variant)]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  body: {
    marginBottom: 10,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 6,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
