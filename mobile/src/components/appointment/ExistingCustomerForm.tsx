import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { AddressAutocomplete } from './AddressAutocomplete';
import { PhoneInput } from '../common/PhoneInput';
import { Input } from '../common/Input';
import type { Customer, Pet } from '../../api/customers';
import { useEffect, useState } from 'react';
import { formatCustomerName } from '../../utils/customer';

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
  selectedCustomerId?: string;
  setSelectedCustomer: (id: string) => void;
  onSelectPet: (id: string) => void;
  selectedCustomerData?: Customer;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerAddress: string;
  setCustomerAddress: (value: string) => void;
  customerAddress2: string;
  setCustomerAddress2: (value: string) => void;
  customerNif: string;
  setCustomerNif: (value: string) => void;
  addressPlaceholder: string;
  address2Placeholder: string;
  primarySoft: string;
};

export function ExistingCustomerForm({
  customerSearch,
  setCustomerSearch,
  showCustomerList,
  setShowCustomerList,
  searchResults,
  loadingCustomers,
  selectedCustomerId,
  setSelectedCustomer,
  onSelectPet,
  selectedCustomerData,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  customerAddress2,
  setCustomerAddress2,
  customerNif,
  setCustomerNif,
  addressPlaceholder,
  address2Placeholder,
  primarySoft,
}: ExistingCustomerFormProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (selectedCustomerId) {
      setDetailsOpen(false);
    }
  }, [selectedCustomerId]);

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
    customerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    customerHeaderText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    customerHeaderSubtext: {
      color: colors.muted,
      marginTop: 4,
    },
    customerActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    actionButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
    },
    actionButtonText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 13,
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
            <View style={styles.customerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerHeaderText}>
                  {formatCustomerName(selectedCustomerData)}
                </Text>
                {selectedCustomerData.phone ? (
                  <Text style={styles.customerHeaderSubtext}>{selectedCustomerData.phone}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setDetailsOpen((prev) => !prev)}
              >
                <Text style={styles.actionButtonText}>
                  {detailsOpen ? t('existingCustomerForm.hideDetails') : t('existingCustomerForm.showDetails')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.customerActions}>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => {
                  setShowCustomerList(!showCustomerList);
                }}
              >
                <Text style={styles.changeButtonText}>🔄 {t('existingCustomerForm.changeCustomer')}</Text>
              </TouchableOpacity>
            </View>

            {detailsOpen ? (
              <>
                <PhoneInput
                  label={`📱 ${t('common.phone')}`}
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  placeholder={t('common.phone')}
                />
                <Text style={styles.customerDetailLabel}>📍 {t('customerDetail.address')}</Text>
                <AddressAutocomplete
                  value={customerAddress}
                  onSelect={setCustomerAddress}
                  placeholder={addressPlaceholder}
                />
                <Text style={styles.customerDetailLabel}>🏢 {t('customerDetail.address2')}</Text>
                <Input
                  value={customerAddress2}
                  onChangeText={setCustomerAddress2}
                  placeholder={address2Placeholder}
                  style={styles.inlineInput}
                />
                <Text style={styles.customerDetailLabel}>🆔 {t('customerDetail.nif')}</Text>
                <Input
                  value={customerNif}
                  onChangeText={setCustomerNif}
                  placeholder={t('customerDetail.nif')}
                  keyboardType="number-pad"
                  style={styles.inlineInput}
                />
              </>
            ) : null}

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
