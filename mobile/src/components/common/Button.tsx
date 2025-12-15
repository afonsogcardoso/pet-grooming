import { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const buttonStyle = [
    styles.button,
    styles[`button_${variant}`],
    styles[`button_${size}`],
    disabled && styles.buttonDisabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
    disabled && styles.textDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={textStyles}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1.5,
    },
    button_small: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    button_medium: {
      paddingVertical: 14,
      paddingHorizontal: 24,
    },
    button_large: {
      paddingVertical: 16,
      paddingHorizontal: 32,
    },
    button_primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    button_secondary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    button_outline: {
      backgroundColor: 'transparent',
      borderColor: colors.primary,
    },
    button_ghost: {
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
    },
    button_danger: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    text: {
      fontWeight: '600',
      textAlign: 'center',
    },
    text_small: {
      fontSize: 14,
    },
    text_medium: {
      fontSize: 16,
    },
    text_large: {
      fontSize: 18,
    },
    text_primary: {
      color: colors.onPrimary,
    },
    text_secondary: {
      color: colors.onPrimary,
    },
    text_outline: {
      color: colors.primary,
    },
    text_ghost: {
      color: colors.text,
    },
    text_danger: {
      color: colors.onPrimary,
    },
    textDisabled: {
      opacity: 0.7,
    },
    icon: {
      fontSize: 18,
      marginRight: 8,
      color: 'inherit',
    },
  });
}
