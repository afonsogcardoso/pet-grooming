import { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: React.ReactNode;
  showEmailSuggestions?: boolean;
}

const EMAIL_DOMAINS = ['@gmail.com', '@hotmail.com', '@outlook.com', '@icloud.com', '@yahoo.com'];

export function Input({ label, error, leftIcon, rightIcon, style, showEmailSuggestions, value, onChangeText, ...props }: InputProps) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleEmailChange = (text: string) => {
    if (onChangeText) {
      onChangeText(text);
    }

    if (showEmailSuggestions && text && !text.includes('@')) {
      setSuggestions(EMAIL_DOMAINS.map(domain => text + domain));
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

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, props.multiline && styles.inputWrapperMultiline, error && styles.inputWrapperError]}>
        {leftIcon && <Text style={[styles.leftIcon, props.multiline && styles.leftIconMultiline]}>{leftIcon}</Text>}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithLeftIcon, style]}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={showEmailSuggestions ? handleEmailChange : onChangeText}
          autoCorrect={showEmailSuggestions ? false : props.autoCorrect}
          autoComplete={showEmailSuggestions ? 'off' : props.autoComplete}
          {...props}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => selectSuggestion(suggestion)}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      height: 52,
    },
    inputWrapperMultiline: {
      height: 'auto',
      minHeight: 52,
      alignItems: 'flex-start',
      paddingVertical: 12,
    },
    inputWrapperError: {
      borderColor: colors.danger,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      padding: 0,
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
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      marginTop: 4,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    suggestionItem: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: '#FFFFFF',
    },
    suggestionText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
  });
}
