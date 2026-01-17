import React, { useMemo, useRef } from "react";
import {
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import createInputStyles from "./inputStyles";

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
  const shared = useMemo(() => createInputStyles(colors), [colors]);
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          ...shared.input,
        },
        clearButton: {
          padding: 2,
        },
      }),
    [shared, colors]
  );
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable
      style={[styles.container, containerStyle]}
      onPress={() => inputRef.current?.focus()}
    >
      <Ionicons name="search" size={SEARCH_ICON_SIZE} color={colors.muted} />
      <TextInput
        ref={inputRef}
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
    </Pressable>
  );
}

// styles constructed above to reuse shared input styles
