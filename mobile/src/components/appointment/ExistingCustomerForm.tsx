import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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
  setSelectedCustomer: (id: string) => void;
  onSelectPet: (id: string) => void;
  selectedCustomerData?: Customer;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerAddress: string;
  setCustomerAddress: (value: string) => void;
  customerNif: string;
  setCustomerNif: (value: string) => void;
  addressPlaceholder: string;
  primarySoft: string;
};

export function ExistingCustomerForm({
  customerSearch,
  setCustomerSearch,
  showCustomerList,
  setShowCustomerList,
  searchResults,
  loadingCustomers,
  setSelectedCustomer,
  onSelectPet,
  selectedCustomerData,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  customerNif,
  setCustomerNif,
  addressPlaceholder,
  primarySoft,
}: ExistingCustomerFormProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();

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
    changeButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
    },
    changeButtonText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 13,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 10,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.primarySoft,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
  });

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{t('existingCustomerForm.customerLabel')}</Text>
        
        {!selectedCustomerData ? (
          // Modo de pesquisa: mostrar sempre a caixa de pesquisa
          <>
            <TouchableOpacity
              style={styles.select}
              onPress={() => setShowCustomerList(!showCustomerList)}
            >
              <Text style={[styles.selectText, styles.placeholder]}>
                {loadingCustomers ? t('common.loading') : t('existingCustomerForm.selectCustomer')}
              </Text>
            </TouchableOpacity>

            {showCustomerList ? (
              <View style={[styles.dropdown, { borderColor: primarySoft }]}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={20} color={colors.muted} />
                  <TextInput
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder={t('existingCustomerForm.searchPlaceholder')}
                    placeholderTextColor={colors.muted}
                    style={styles.searchInput}
                    autoFocus
                  />
                  {customerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCustomerSearch('')}>
                      <Ionicons name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                </View>
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
                            onSelectPet(result.pet.id);
                          }
                          setShowCustomerList(false);
                          setCustomerSearch('');
                        }}
                      >
                        <Text style={styles.optionTitle}>
                          {result.label}
                          {result.type === 'pet' ? ` ${t('existingCustomerForm.petSuffix')}` : ''}
                        </Text>
                        {result.subtitle ? <Text style={styles.optionSubtitle}>{result.subtitle}</Text> : null}
                        {result.type === 'pet' && result.customer.phone ? (
                          <Text style={styles.optionSubtitle}>{result.customer.phone}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                  {!loadingCustomers && searchResults.length === 0 ? (
                    <Text style={styles.optionSubtitle}>{t('existingCustomerForm.noResults')}</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : (
          // Modo selecionado: mostrar dados do cliente com opção de trocar
          <View style={styles.customerCard}>
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.selectText}>{selectedCustomerData.name}</Text>
              <Text style={[styles.optionSubtitle, { marginTop: 4 }]}>
                {selectedCustomerData.phone}
              </Text>
            </View>

            <Text style={styles.customerDetailLabel}>📱 {t('common.phone')}</Text>
            <TextInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder={t('common.phone')}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.inlineInput]}
              keyboardType="phone-pad"
            />
            <Text style={styles.customerDetailLabel}>📍 {t('customerDetail.address')}</Text>
            <AddressAutocomplete
              value={customerAddress}
              onSelect={setCustomerAddress}
              placeholder={addressPlaceholder}
            />
            <Text style={styles.customerDetailLabel}>🆔 {t('customerDetail.nif')}</Text>
            <TextInput
              value={customerNif}
              onChangeText={setCustomerNif}
              placeholder={t('customerDetail.nif')}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.inlineInput]}
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => {
                setShowCustomerList(!showCustomerList);
              }}
            >
              <Text style={styles.changeButtonText}>🔄 {t('existingCustomerForm.changeCustomer')}</Text>
            </TouchableOpacity>

            {showCustomerList ? (
              <View style={[styles.dropdown, { borderColor: primarySoft, marginTop: 12 }]}>
                <TextInput
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  placeholder={t('existingCustomerForm.searchPlaceholder')}
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: primarySoft, marginBottom: 10 }]}
                  autoFocus
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
                            onSelectPet(result.pet.id);
                          }
                          setShowCustomerList(false);
                          setCustomerSearch('');
                        }}
                      >
                        <Text style={styles.optionTitle}>
                          {result.label}
                          {result.type === 'pet' ? ` ${t('existingCustomerForm.petSuffix')}` : ''}
                        </Text>
                        {result.subtitle ? <Text style={styles.optionSubtitle}>{result.subtitle}</Text> : null}
                        {result.type === 'pet' && result.customer.phone ? (
                          <Text style={styles.optionSubtitle}>{result.customer.phone}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                  {!loadingCustomers && searchResults.length === 0 ? (
                    <Text style={styles.optionSubtitle}>{t('existingCustomerForm.noResults')}</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}
          </View>
        )}
      </View>

    </>
  );
}
