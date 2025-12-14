import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { Customer, Pet } from '../../api/customers';

type ExistingCustomerFormProps = {
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  showCustomerList: boolean;
  setShowCustomerList: (value: boolean) => void;
  searchResults: Array<
    | { type: 'customer'; customer: Customer; label: string; subtitle?: string }
    | { type: 'pet'; customer: Customer; pet: Pet; label: string; subtitle?: string }
  >;
  loadingCustomers: boolean;
  selectedCustomer: string;
  setSelectedCustomer: (id: string) => void;
  setSelectedPet: (id: string) => void;
  setShowPetList: (value: boolean) => void;
  selectedCustomerData?: Customer;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerAddress: string;
  setCustomerAddress: (value: string) => void;
  customerNif: string;
  setCustomerNif: (value: string) => void;
  addressPlaceholder: string;
  showPetList: boolean;
  selectedPet: string;
  petOptions: Pet[];
  primarySoft: string;
};

export function ExistingCustomerForm({
  customerSearch,
  setCustomerSearch,
  showCustomerList,
  setShowCustomerList,
  searchResults,
  loadingCustomers,
  selectedCustomer,
  setSelectedCustomer,
  setSelectedPet,
  setShowPetList,
  selectedCustomerData,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  customerNif,
  setCustomerNif,
  addressPlaceholder,
  showPetList,
  selectedPet,
  petOptions,
  primarySoft,
}: ExistingCustomerFormProps) {
  const { colors } = useBrandingTheme();

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
    select: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    selectText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
    },
    placeholder: {
      color: colors.muted,
      fontWeight: '500',
    },
    dropdown: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
      marginBottom: 12,
      borderColor: colors.primarySoft,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
    option: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    optionTitle: {
      color: colors.text,
      fontWeight: '700',
    },
    optionSubtitle: {
      color: colors.muted,
      marginTop: 2,
    },
    customerCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    customerDetailLabel: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    inlineInput: {
      marginBottom: 4,
    },
  });

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Cliente</Text>
        <TouchableOpacity
          style={styles.select}
          onPress={() => setShowCustomerList(!showCustomerList)}
        >
          <Text style={[styles.selectText, !selectedCustomerData && styles.placeholder]}>
            {selectedCustomerData?.name ||
              (loadingCustomers ? 'A carregar...' : '🔍 Pesquisar cliente ou pet')}
          </Text>
        </TouchableOpacity>
        
        {selectedCustomerData ? (
          <View style={styles.customerCard}>
            <Text style={styles.customerDetailLabel}>📱 Telefone</Text>
            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Telefone"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.inlineInput]}
              keyboardType="phone-pad"
            />
            <Text style={styles.customerDetailLabel}>📍 Morada</Text>
            <AddressAutocomplete
              value={customerAddress}
              onSelect={setCustomerAddress}
              placeholder={addressPlaceholder}
            />
            <Text style={styles.customerDetailLabel}>🆔 NIF</Text>
            <TextInput
              value={customerNif}
              onChangeText={setCustomerNif}
              placeholder="NIF"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.inlineInput]}
              keyboardType="number-pad"
            />
          </View>
        ) : null}
      </View>

      {showCustomerList ? (
        <View style={[styles.dropdown, { borderColor: primarySoft }]}>
          <TextInput
            value={customerSearch}
            onChangeText={setCustomerSearch}
            placeholder="Pesquisar por cliente ou pet"
            placeholderTextColor={colors.muted}
            style={[styles.input, { borderColor: primarySoft, marginBottom: 10 }]}
          />
          <ScrollView style={{ maxHeight: 200 }}>
            {searchResults.map((result) => {
              const key =
                result.type === 'customer'
                  ? `customer-${result.customer.id}`
                  : `pet-${result.pet.id}`;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.option}
                  onPress={() => {
                    setSelectedCustomer(result.customer.id);
                    if (result.type === 'pet') {
                      setSelectedPet(result.pet.id);
                    }
                    setShowCustomerList(false);
                    setShowPetList(false);
                  }}
                >
                  <Text style={styles.optionTitle}>
                    {result.label}
                    {result.type === 'pet' ? ' (pet)' : ''}
                  </Text>
                  {result.subtitle ? <Text style={styles.optionSubtitle}>{result.subtitle}</Text> : null}
                  {result.type === 'pet' && result.customer.phone ? (
                    <Text style={styles.optionSubtitle}>{result.customer.phone}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            {!loadingCustomers && searchResults.length === 0 ? (
              <Text style={styles.optionSubtitle}>Nenhum resultado</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Animal</Text>
        <TouchableOpacity
          style={styles.select}
          onPress={() => {
            if (!selectedCustomer) return;
            setShowPetList(!showPetList);
          }}
        >
          <Text style={[styles.selectText, !petOptions.find((p) => p.id === selectedPet) && styles.placeholder]}>
            {petOptions.find((p) => p.id === selectedPet)?.name ||
              (selectedCustomer ? 'Escolhe um pet' : 'Seleciona primeiro o cliente')}
          </Text>
        </TouchableOpacity>
      </View>

      {showPetList ? (
        <View style={[styles.dropdown, { borderColor: primarySoft }]}>
          {petOptions.length === 0 ? (
            <Text style={styles.optionSubtitle}>Este cliente não tem pets registados.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 160 }}>
              {petOptions.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={styles.option}
                  onPress={() => {
                    setSelectedPet(pet.id);
                    setShowPetList(false);
                  }}
                >
                  <Text style={styles.optionTitle}>{pet.name}</Text>
                  {pet.breed ? <Text style={styles.optionSubtitle}>{pet.breed}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </>
  );
}
