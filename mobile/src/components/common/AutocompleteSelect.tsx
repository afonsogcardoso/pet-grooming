import { useMemo, useRef, useState, forwardRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  Keyboard,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import createInputStyles from "./inputStyles";

export type AutocompleteOption = {
  id: string;
  label: string;
  description?: string;
};

export type AutocompleteSelectProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onSelectOption?: (option: AutocompleteOption | null) => void;
  options: AutocompleteOption[];
  selectedId?: string | null;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  maxOptions?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export const AutocompleteSelect = forwardRef<
  TextInput | null,
  AutocompleteSelectProps
>(function AutocompleteSelect(
  {
    label,
    value,
    onChangeText,
    onSelectOption,
    options,
    selectedId,
    placeholder,
    error,
    disabled,
    loading,
    emptyLabel,
    loadingLabel,
    maxOptions = 8,
    containerStyle,
    inputStyle,
  }: AutocompleteSelectProps,
  ref
) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createInputStyles(colors), [colors]);
  const inputRef = useRef<TextInput | null>(null);
  const setRef = (r: TextInput | null) => {
    inputRef.current = r;
    if (typeof ref === "function") ref(r);
    else if (ref && typeof ref === "object") (ref as any).current = r;
  };
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = value.trim().toLowerCase();
    const base = normalizedQuery
      ? options.filter((option) =>
          option.label.toLowerCase().includes(normalizedQuery)
        )
      : options;
    return base.slice(0, maxOptions);
  }, [maxOptions, options, value]);

  const showList = open && !disabled;

  const renderSuggestions = () => {
    if (!showList) return null;

    if (loading) {
      return (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionItem}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text
              style={[
                styles.suggestionText,
                styles.suggestionHint,
                styles.suggestionWithIcon,
              ]}
            >
              {loadingLabel || "A carregar..."}
            </Text>
          </View>
        </View>
      );
    }

    if (filteredOptions.length === 0) {
      return (
        <View style={styles.suggestionsContainer}>
          <View style={styles.suggestionItem}>
            <Text style={[styles.suggestionText, styles.suggestionHint]}>
              {emptyLabel || "Sem resultados"}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.suggestionsContainer}>
        {filteredOptions.map((option) => {
          const active = selectedId && option.id === selectedId;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.suggestionItem}
              onPress={() => {
                onChangeText(option.label);
                onSelectOption?.(option);
                setOpen(false);
                inputRef.current?.blur();
                Keyboard.dismiss();
              }}
            >
              <Text
                style={[
                  styles.suggestionText,
                  active && styles.suggestionActive,
                ]}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text style={styles.suggestionDescription}>
                  {option.description}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableWithoutFeedback
        onPress={() => inputRef.current?.focus()}
        accessible={false}
      >
        <View
          style={[
            styles.inputWrapper,
            error && styles.inputWrapperError,
            disabled && styles.inputWrapperDisabled,
          ]}
        >
          <TextInput
            ref={setRef}
            value={value}
            onChangeText={(text) => {
              onChangeText(text);
              onSelectOption?.(null);
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            editable={!disabled}
            style={[styles.input, inputStyle]}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
        </View>
      </TouchableWithoutFeedback>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {renderSuggestions()}
    </View>
  );
});

// styles moved to shared inputStyles.ts
