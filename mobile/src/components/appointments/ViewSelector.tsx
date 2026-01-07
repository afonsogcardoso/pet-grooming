import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";

type ViewMode = "list" | "day" | "week" | "month";

type ViewSelectorProps = {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  compact?: boolean;
};

export function ViewSelector({
  currentView,
  onViewChange,
  compact = false,
}: ViewSelectorProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();

  const views: Array<{
    mode: ViewMode;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }> = [
    { mode: "list", icon: "list", label: t("viewSelector.list") },
    { mode: "day", icon: "calendar", label: t("viewSelector.day") },
    { mode: "week", icon: "calendar-outline", label: t("viewSelector.week") },
    { mode: "month", icon: "calendar-number", label: t("viewSelector.month") },
  ];

  const styles = StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: `${colors.primary}10`,
      borderRadius: 16,
      paddingHorizontal: compact ? 6 : 10,
      gap: compact ? 6 : 8,
      marginHorizontal: 16,

      alignSelf: "stretch",
      alignItems: "center",
    },
    button: {
      flex: 1,
      paddingVertical: compact ? 7 : 12,
      paddingHorizontal: compact ? 7 : 10,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    activeButton: {
      backgroundColor: colors.surface,
      // backgroundColor: '#F123D2',
    },
    buttonText: {
      marginBottom: compact ? 0 : 4,
    },
    label: {
      fontSize: 12,
      fontWeight: "400",
      color: colors.muted,
    },
    activeLabel: {
      color: colors.primary,
      fontWeight: "600",
    },
  });

  return (
    <View style={styles.container}>
      {views.map((view) => {
        const isActive = currentView === view.mode;
        return (
          <TouchableOpacity
            key={view.mode}
            style={[styles.button, isActive && styles.activeButton]}
            onPress={() => onViewChange(view.mode)}
          >
            <Ionicons
              name={view.icon}
              size={compact ? 16 : 18}
              color={isActive ? colors.primary : colors.muted}
              style={styles.buttonText}
            />
            {compact ? null : (
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {view.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
