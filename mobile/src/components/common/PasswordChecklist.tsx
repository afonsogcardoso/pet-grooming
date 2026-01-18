import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PasswordRuleResult } from "../../utils/passwordRules";
import { useBrandingTheme } from "../../theme/useBrandingTheme";

type MatchStatus = {
  visible: boolean;
  label: string;
  satisfied: boolean;
};

type Props = {
  rules: PasswordRuleResult[];
  matchStatus?: MatchStatus;
};

export function PasswordChecklist({ rules, matchStatus }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {rules.map((rule) => (
        <View key={rule.key} style={styles.row}>
          <Ionicons
            name={rule.satisfied ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={rule.satisfied ? colors.success : colors.muted}
            style={styles.icon}
          />
          <Text
            style={[
              styles.text,
              rule.satisfied ? styles.textSatisfied : styles.textDefault,
            ]}
          >
            {rule.label}
          </Text>
        </View>
      ))}
      {matchStatus?.visible ? (
        <View style={styles.row}>
          <Ionicons
            name={
              matchStatus.satisfied ? "checkmark-circle" : "alert-circle-outline"
            }
            size={16}
            color={matchStatus.satisfied ? colors.success : colors.danger}
            style={styles.icon}
          />
          <Text
            style={[
              styles.text,
              matchStatus.satisfied ? styles.textSatisfied : styles.textError,
            ]}
          >
            {matchStatus.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      marginTop: 6,
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    icon: {
      marginRight: 8,
    },
    text: {
      fontSize: 14,
    },
    textDefault: {
      color: colors.muted,
    },
    textSatisfied: {
      color: colors.success,
    },
    textError: {
      color: colors.danger,
    },
  });
}

