import { useMemo, useState, useRef, forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableWithoutFeedback,
} from "react-native";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import createInputStyles from "./inputStyles";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: React.ReactNode;
  showEmailSuggestions?: boolean;
  labelStyle?: any;
}

const EMAIL_DOMAINS = [
  "@gmail.com",
  "@hotmail.com",
  "@outlook.com",
  "@icloud.com",
  "@yahoo.com",
];

export const Input = forwardRef<TextInput | null, InputProps>(function Input(
  {
    label,
    error,
    leftIcon,
    rightIcon,
    style,
    labelStyle,
    showEmailSuggestions,
    value,
    onChangeText,
    ...props
  }: InputProps,
  ref
) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createInputStyles(colors), [colors]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<TextInput | null>(null);

  const setRef = (r: TextInput | null) => {
    inputRef.current = r;
    if (typeof ref === "function") ref(r);
    else if (ref && typeof ref === "object") (ref as any).current = r;
  };

  const resolvedAutoCapitalize = useMemo(() => {
    if (showEmailSuggestions) return "none";
    return props.autoCapitalize ?? "sentences";
  }, [props.autoCapitalize, showEmailSuggestions]);

  const handleEmailChange = (text: string) => {
    if (onChangeText) {
      onChangeText(text);
    }

    if (showEmailSuggestions && text && !text.includes("@")) {
      setSuggestions(EMAIL_DOMAINS.map((domain) => text + domain));
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    if (onChangeText) {
      onChangeText(suggestion);
    }
    setSuggestions([]);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <TouchableWithoutFeedback onPress={focusInput} accessible={false}>
        <View
          style={[
            styles.inputWrapper,
            props.multiline && styles.inputWrapperMultiline,
            error && styles.inputWrapperError,
          ]}
        >
          {leftIcon && (
            <Text
              style={[
                styles.leftIcon,
                props.multiline && styles.leftIconMultiline,
              ]}
            >
              {leftIcon}
            </Text>
          )}
          <TextInput
            ref={setRef}
            style={[styles.input, leftIcon && styles.inputWithLeftIcon, style]}
            placeholderTextColor={colors.muted}
            value={value}
            onChangeText={
              showEmailSuggestions ? handleEmailChange : onChangeText
            }
            {...props}
            autoCorrect={showEmailSuggestions ? false : props.autoCorrect}
            autoComplete={showEmailSuggestions ? "off" : props.autoComplete}
            autoCapitalize={resolvedAutoCapitalize}
          />
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </View>
      </TouchableWithoutFeedback>
      {error && <Text style={styles.error}>{error}</Text>}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <TouchableWithoutFeedback
              key={index}
              onPress={() => selectSuggestion(suggestion)}
            >
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>
      )}
    </View>
  );
});
