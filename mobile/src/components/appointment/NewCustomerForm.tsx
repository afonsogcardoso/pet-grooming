import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { AddressAutocomplete } from './AddressAutocomplete';
import { Input } from '../common/Input';
import { PhoneInput } from '../common/PhoneInput';

type NewCustomerFormProps = {
  customerFirstName: string;
  setCustomerFirstName: (value: string) => void;
  customerLastName: string;
  setCustomerLastName: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerEmail: string;
  setCustomerEmail: (value: string) => void;
  customerAddress: string;
  setCustomerAddress: (value: string) => void;
  customerNif: string;
  setCustomerNif: (value: string) => void;
  addressPlaceholder: string;
};

export function NewCustomerForm({
  customerFirstName,
  setCustomerFirstName,
  customerLastName,
  setCustomerLastName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  customerAddress,
  setCustomerAddress,
  customerNif,
  setCustomerNif,
  addressPlaceholder,
}: NewCustomerFormProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    field: {
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    label: {
      color: colors.text,
      marginBottom: 8,
      fontWeight: '600',
      fontSize: 15,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
      fontSize: 15,
      fontWeight: '500',
    },
  });

  return (
    <>
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>{t('profile.firstNamePlaceholder')}</Text>
          <TextInput
            value={customerFirstName}
            onChangeText={setCustomerFirstName}
            placeholder={t('profile.firstNamePlaceholder')}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>{t('profile.lastNamePlaceholder')}</Text>
          <TextInput
            value={customerLastName}
            onChangeText={setCustomerLastName}
            placeholder={t('profile.lastNamePlaceholder')}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
      </View>
      
      <View style={[styles.field, { marginBottom: 0 }]}>
        <PhoneInput
          label={t('common.phone')}
          value={customerPhone}
          onChange={setCustomerPhone}
          placeholder={t('common.phone')}
        />
      </View>

      <Input
        label={t('common.email')}
        value={customerEmail}
        onChangeText={setCustomerEmail}
        placeholder={t('newCustomerForm.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        showEmailSuggestions
      />

      <View style={styles.field}>
        <Text style={styles.label}>{t('customerDetail.nif')}</Text>
        <TextInput
          value={customerNif}
          onChangeText={setCustomerNif}
          placeholder={t('customerDetail.nif')}
          placeholderTextColor={colors.muted}
          style={styles.input}
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('customerDetail.address')}</Text>
        <AddressAutocomplete
          value={customerAddress}
          onSelect={setCustomerAddress}
          placeholder={addressPlaceholder}
        />
      </View>

    </>
  );
}
