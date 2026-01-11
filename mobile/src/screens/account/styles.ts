import { StyleSheet } from "react-native";

export default function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 24,
      paddingBottom: 32,
    },
    introText: {
      fontSize: 15,
      color: colors.muted,
      marginBottom: 18,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.muted,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    subText: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 6,
    },
    highlightText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "600",
    },
    emptyState: {
      fontSize: 13,
      color: colors.muted,
    },
  });
}
