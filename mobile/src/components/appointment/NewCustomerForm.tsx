import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { AddressAutocomplete } from './AddressAutocomplete';
import { Input } from '../common/Input';

type NewCustomerFormProps = {
  customerName: string;
  setCustomerName: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerEmail: string;
  setCustomerEmail: (value: string) => void;
  customerAddress: string;
  setCustomerAddress: (value: string) => void;
  customerNif: string;
  setCustomerNif: (value: string) => void;
  petName: string;
  setPetName: (value: string) => void;
  petBreed: string;
  setPetBreed: (value: string) => void;
  addressPlaceholder: string;
};

export function NewCustomerForm({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  customerAddress,
  setCustomerAddress,
  customerNif,
  setCustomerNif,
  petName,
  setPetName,
  petBreed,
  setPetBreed,
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
      <View style={styles.field}>
        <Text style={styles.label}>{t('newCustomerForm.customerNameLabel')}</Text>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder={t('customerForm.namePlaceholder')}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>{t('common.phone')}</Text>
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder={t('common.phone')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="phone-pad"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
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
        <Text style={styles.label}>{t('customerDetail.address')}</Text>
        <AddressAutocomplete
          value={customerAddress}
          onSelect={setCustomerAddress}
          placeholder={addressPlaceholder}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('newCustomerForm.petNameLabel')}</Text>
        <TextInput
          value={petName}
          onChangeText={setPetName}
          placeholder={t('newCustomerForm.petNamePlaceholder')}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('newCustomerForm.petBreedLabel')}</Text>
        <TextInput
          value={petBreed}
          onChangeText={setPetBreed}
          placeholder={t('newCustomerForm.petBreedPlaceholder')}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
    </>
  );
}
