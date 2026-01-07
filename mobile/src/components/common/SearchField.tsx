import React, { useMemo } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBrandingTheme } from "../../theme/useBrandingTheme";

const SEARCH_ICON_SIZE = 16;
const CLEAR_ICON_SIZE = 18;

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
} & Omit<TextInputProps, "style" | "value" | "onChangeText" | "placeholder">;

export function SearchField({
  value,
  onChangeText,
  placeholder,
  containerStyle,
  inputStyle,
  autoCapitalize,
  autoCorrect,
  returnKeyType = "search",
  ...inputProps
}: SearchFieldProps) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, containerStyle]}>
      <Ionicons name="search" size={SEARCH_ICON_SIZE} color={colors.muted} />
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        {...inputProps}
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          style={styles.clearButton}
          accessibilityRole="button"
          accessibilityLabel="Limpar pesquisa"
        >
          <Ionicons
            name="close-circle"
            size={CLEAR_ICON_SIZE}
            color={colors.muted}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${colors.primary}08`,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 0,
      borderColor: "transparent",
      gap: 8,
      minHeight: 44,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    clearButton: {
      padding: 2,
    },
  });
}
