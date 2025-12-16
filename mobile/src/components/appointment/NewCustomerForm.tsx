import { View, Text, TextInput, StyleSheet } from 'react-native';
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
        <Text style={styles.label}>Nome do Cliente</Text>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Nome completo"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Telefone"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="phone-pad"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>NIF</Text>
          <TextInput
            value={customerNif}
            onChangeText={setCustomerNif}
            placeholder="NIF"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Input
        label="Email"
        value={customerEmail}
        onChangeText={setCustomerEmail}
        placeholder="email@dominio.com"
        keyboardType="email-address"
        autoCapitalize="none"
        showEmailSuggestions
      />

      <View style={styles.field}>
        <Text style={styles.label}>Morada</Text>
        <AddressAutocomplete
          value={customerAddress}
          onSelect={setCustomerAddress}
          placeholder={addressPlaceholder}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Nome do Animal</Text>
        <TextInput
          value={petName}
          onChangeText={setPetName}
          placeholder="Nome do animal"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Raça (opcional)</Text>
        <TextInput
          value={petBreed}
          onChangeText={setPetBreed}
          placeholder="Raça"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
    </>
  );
}
