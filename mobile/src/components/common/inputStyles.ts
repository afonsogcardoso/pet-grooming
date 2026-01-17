import { StyleSheet } from "react-native";

export default function createInputStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      height: 52,
    },
    inputWrapperMultiline: {
      height: "auto",
      minHeight: 80,
      alignItems: "flex-start",
      paddingVertical: 12,
    },
    inputWrapperError: {
      borderColor: colors.danger,
    },
    inputWrapperDisabled: {
      opacity: 0.6,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      padding: 0,
      height: "100%",
      textAlignVertical: "center",
    },
    inputWithLeftIcon: {
      marginLeft: 8,
    },
    leftIcon: {
      fontSize: 20,
    },
    leftIconMultiline: {
      marginTop: 2,
    },
    rightIcon: {
      marginLeft: 8,
    },
    error: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 6,
      marginLeft: 4,
    },
    suggestionsContainer: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginTop: 4,
      overflow: "hidden",
    },
    suggestionItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
    },
    suggestionText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
      flex: 1,
    },
    suggestionActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    suggestionHint: {
      color: colors.muted,
      fontWeight: "500",
    },
    suggestionWithIcon: {
      marginLeft: 8,
    },
    suggestionDescription: {
      color: colors.muted,
      fontSize: 13,
      flex: 1,
      marginTop: 2,
    },
  });
}
