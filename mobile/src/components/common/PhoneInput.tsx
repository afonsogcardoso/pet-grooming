import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { COUNTRY_CODES } from '../../constants/countryCodes';
import { buildPhone, normalizeCountryCode, splitPhone } from '../../utils/phone';

type PhoneInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function PhoneInput({ label, value, onChange, placeholder, disabled }: PhoneInputProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [code, setCode] = useState('+351');
  const [number, setNumber] = useState('');

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

  const handleNumberChange = (nextNumber: string) => {
    setNumber(nextNumber);
    onChange(buildPhone(code, nextNumber));
  };

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
    codeButton: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      minWidth: 90,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeText: {
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 24,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    modalClose: {
      color: colors.primary,
      fontWeight: '600',
    },
    option: {
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    optionText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    optionActive: {
      color: colors.primary,
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.codeButton}
          onPress={() => setPickerOpen(true)}
          disabled={disabled}
        >
          <Text style={styles.codeText}>{normalizeCountryCode(code)}</Text>
        </TouchableOpacity>
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

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('common.selectCountryCode')}</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalClose}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => `${item.iso}-${item.dial}`}
              renderItem={({ item }) => {
                const isActive = normalizeCountryCode(code) === item.dial;
                return (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => {
                      handleCodeChange(item.dial);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, isActive && styles.optionActive]}>
                      {item.iso} {item.dial}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
