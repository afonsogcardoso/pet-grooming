import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { PhoneInput } from "../common/PhoneInput";
import { Input } from "../common/Input";
import { SearchField } from "../common/SearchField";
import type { Customer, Pet } from "../../api/customers";
import { useEffect, useState } from "react";
import { formatCustomerName } from "../../utils/customer";
import { BottomSheetModal } from "../common/BottomSheetModal";
import { Avatar } from "../common/Avatar";

type ExistingCustomerFormProps = {
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  showCustomerList: boolean;
  setShowCustomerList: (value: boolean) => void;
  searchResults: Array<
    | { type: "customer"; customer: Customer; label: string; subtitle?: string }
    | {
        type: "pet";
        customer: Customer;
        pet: Pet;
        label: string;
        subtitle?: string;
      }
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
      fontWeight: "600",
      fontSize: 15,
    },
    select: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.background,
      borderColor: colors.surfaceBorder,
    },
    selectText: {
      color: colors.text,
      fontWeight: "600",
      fontSize: 15,
    },
    placeholder: {
      color: colors.muted,
      fontWeight: "500",
    },
    dropdown: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.background,
      marginBottom: 12,
      borderColor: colors.primarySoft,
    },
    option: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
      backgroundColor: colors.background,
    },
    optionTitle: {
      color: colors.text,
      fontWeight: "700",
    },
    optionSubtitle: {
      color: colors.muted,
      marginTop: 2,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    optionContent: {
      flex: 1,
    },
    customerCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    customerDetailLabel: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 8,
      marginBottom: 4,
      fontWeight: "400",
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
      fontWeight: "600",
      fontSize: 13,
    },
    customerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 8,
    },
    customerHeaderText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    customerHeaderSubtext: {
      color: colors.muted,
      marginTop: 4,
    },
    customerActions: {
      flexDirection: "row",
      flexWrap: "wrap",
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
      fontWeight: "600",
      fontSize: 13,
    },
    searchField: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
    },
  });

  const renderCustomerList = () => (
    <BottomSheetModal
      visible={showCustomerList}
      onClose={() => setShowCustomerList(false)}
      title={t("existingCustomerForm.selectCustomer")}
      contentStyle={{ width: "100%" }}
    >
      <SearchField
        value={customerSearch}
        onChangeText={setCustomerSearch}
        placeholder={t("existingCustomerForm.searchPlaceholder")}
        autoFocus
        blurOnSubmit={false}
        containerStyle={[{ marginBottom: 10 }, styles.searchField]}
      />
      <ScrollView
        style={{ maxHeight: 240 }}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        {searchResults.map((result) => {
          const key =
            result.type === "customer"
              ? `customer-${result.customer.id}`
              : `pet-${result.pet.id}`;
          const name =
            result.type === "customer"
              ? formatCustomerName(result.customer)
              : result.pet.name;
          const imageUrl =
            result.type === "customer"
              ? result.customer.photo_url
              : result.pet.photo_url;
          return (
            <TouchableOpacity
              key={key}
              style={styles.option}
              onPress={() => {
                setSelectedCustomer(result.customer.id);
                if (result.type === "pet") {
                  onSelectPet(result.pet.id);
                }
                setShowCustomerList(false);
                setCustomerSearch("");
              }}
            >
              <View style={styles.optionRow}>
                <Avatar name={name} imageUrl={imageUrl} size="small" />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>
                    {result.label}
                    {result.type === "pet"
                      ? ` ${t("existingCustomerForm.petSuffix")}`
                      : ""}
                  </Text>
                  {result.subtitle ? (
                    <Text style={styles.optionSubtitle}>{result.subtitle}</Text>
                  ) : null}
                  {result.type === "pet" && result.customer.phone ? (
                    <Text style={styles.optionSubtitle}>
                      {result.customer.phone}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        {!loadingCustomers && searchResults.length === 0 ? (
          <Text style={styles.optionSubtitle}>
            {t("existingCustomerForm.noResults")}
          </Text>
        ) : null}
      </ScrollView>
    </BottomSheetModal>
  );

  return (
    <>
      <View style={styles.field}>
        {!selectedCustomerData ? (
          // Modo de pesquisa: mostrar sempre a caixa de pesquisa
          <>
            <TouchableOpacity
              style={styles.select}
              onPress={() => setShowCustomerList(true)}
            >
              <Text style={[styles.selectText, styles.placeholder]}>
                {loadingCustomers
                  ? t("common.loading")
                  : t("existingCustomerForm.selectCustomer")}
              </Text>
            </TouchableOpacity>
            {renderCustomerList()}
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
                  <Text style={styles.customerHeaderSubtext}>
                    {selectedCustomerData.phone}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setDetailsOpen((prev) => !prev)}
              >
                <Text style={styles.actionButtonText}>
                  {detailsOpen
                    ? t("existingCustomerForm.hideDetails")
                    : t("existingCustomerForm.showDetails")}
                </Text>
              </TouchableOpacity>
            </View>

            {detailsOpen ? (
              <>
                <PhoneInput
                  label={`${t("common.phone")}`}
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  placeholder={t("common.phone")}
                  labelStyle={styles.customerDetailLabel}
                />
                <Text style={styles.customerDetailLabel}>
                  {t("customerDetail.address")}
                </Text>
                <AddressAutocomplete
                  value={customerAddress}
                  onSelect={setCustomerAddress}
                  placeholder={addressPlaceholder}
                />
                <Text style={styles.customerDetailLabel}>
                  {t("customerDetail.address2")}
                </Text>
                <Input
                  value={customerAddress2}
                  onChangeText={setCustomerAddress2}
                  placeholder={address2Placeholder}
                  style={styles.inlineInput}
                />
                <Text style={styles.customerDetailLabel}>
                  {t("customerDetail.nif")}
                </Text>
                <Input
                  value={customerNif}
                  onChangeText={setCustomerNif}
                  placeholder={t("customerDetail.nif")}
                  keyboardType="number-pad"
                  style={styles.inlineInput}
                />
              </>
            ) : null}
            <View style={styles.customerActions}>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => {
                  setShowCustomerList(true);
                }}
              >
                <Text style={styles.changeButtonText}>
                  {t("existingCustomerForm.changeCustomer")}
                </Text>
              </TouchableOpacity>
            </View>
            {renderCustomerList()}
          </View>
        )}
      </View>
    </>
  );
}
