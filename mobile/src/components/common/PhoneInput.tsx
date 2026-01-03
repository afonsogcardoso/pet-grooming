import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Keyboard, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { COUNTRY_CODES } from '../../constants/countryCodes';
import { buildPhone, normalizeCountryCode, splitPhone } from '../../utils/phone';

type PhoneInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export function PhoneInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  labelStyle,
  containerStyle,
}: PhoneInputProps) {
  const { colors } = useBrandingTheme();
  const [code, setCode] = useState('+351');
  const [number, setNumber] = useState('');
  const [showCodeList, setShowCodeList] = useState(false);

  useEffect(() => {
    const parts = splitPhone(value);
    setCode(parts.phoneCountryCode);
    setNumber(parts.phoneNumber);
  }, [value]);

  const options = useMemo(() => {
    const normalized = normalizeCountryCode(code);
    const hasCode = COUNTRY_CODES.some((entry) => entry.dial === normalized);
    if (hasCode) return COUNTRY_CODES;
    return [{ iso: 'XX', dial: normalized }, ...COUNTRY_CODES];
  }, [code]);

  const handleCodeChange = (nextCode: string) => {
    setCode(nextCode);
    onChange(buildPhone(nextCode, number));
  };

  const handleCodeInputChange = (value: string) => {
    const cleaned = value.replace(/[^0-9+]/g, '');
    const normalized = cleaned && !cleaned.startsWith('+') ? `+${cleaned}` : cleaned;
    const nextCode = normalized || '';
    setCode(nextCode);
    onChange(buildPhone(nextCode || '+', number));
  };

  const handleNumberChange = (nextNumber: string) => {
    setNumber(nextNumber);
    onChange(buildPhone(code, nextNumber));
  };

  const filteredOptions = useMemo(() => {
    const query = normalizeCountryCode(code).replace('+', '').toLowerCase();
    if (!query) return options.slice(0, 8);
    return options
      .filter((entry) => {
        const dial = entry.dial.replace('+', '');
        return dial.includes(query) || entry.iso.toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [code, options]);

  const styles = StyleSheet.create({
    field: {
      marginBottom: 16,
    },
    label: {
      color: colors.text,
      marginBottom: 8,
      fontWeight: '600',
      fontSize: 15,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minWidth: 90,
      alignItems: 'center',
      justifyContent: 'center',
      color: colors.text,
      fontWeight: '600',
    },
    numberInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    codeList: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      backgroundColor: colors.surface,
      maxHeight: 180,
      overflow: 'hidden',
    },
    option: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    optionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    optionActive: {
      color: colors.primary,
      fontWeight: '700',
    },
  });

  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={normalizeCountryCode(code)}
          onChangeText={handleCodeInputChange}
          style={styles.codeInput}
          keyboardType="phone-pad"
          editable={!disabled}
          onFocus={() => setShowCodeList(true)}
          onBlur={() => {
            setTimeout(() => setShowCodeList(false), 150);
          }}
        />
        <TextInput
          value={number}
          onChangeText={handleNumberChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.numberInput}
          keyboardType="phone-pad"
          editable={!disabled}
        />
      </View>
      {showCodeList && filteredOptions.length > 0 ? (
        <View style={styles.codeList}>
          {filteredOptions.map((item) => {
            const isActive = normalizeCountryCode(code) === item.dial;
            return (
              <TouchableOpacity
                key={`${item.iso}-${item.dial}`}
                style={styles.option}
                onPress={() => {
                  handleCodeChange(item.dial);
                  setShowCodeList(false);
                  Keyboard.dismiss();
                }}
              >
                <Text style={[styles.optionText, isActive && styles.optionActive]}>
                  {item.iso} {item.dial}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
