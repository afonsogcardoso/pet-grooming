import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Keyboard,
  Image,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { Ionicons } from "@expo/vector-icons";
import { SearchField } from "../common/SearchField";
import { BottomSheetModal } from "../common/BottomSheetModal";
import { getServicePriceTiers, getServiceAddons } from "../../api/services";
import type {
  ServiceAddon,
  ServicePriceTier,
  Service,
} from "../../api/services";

export type ServiceRow = {
  id: string;
  serviceId: string;
  priceTierId?: string;
  tierSelectionSource?: "auto" | "manual" | "stored" | null;
  addonIds: string[];
};

type RowTotals = {
  price: number;
  duration: number;
  requiresTier: boolean;
};

type PetServiceRowProps = {
  index: number;
  row: ServiceRow;
  services: Service[];
  loadingServices: boolean;
  petWeight?: number | null;
  onChange: (updates: Partial<ServiceRow>) => void;
  onRemove: () => void;
  allowRemove: boolean;
  servicesError?: unknown;
  refetchServices: () => Promise<unknown>;
  onTotalsChange: (rowId: string, totals: RowTotals) => void;
};

export function PetServiceRow({
  index,
  row,
  services,
  loadingServices,
  petWeight,
  onChange,
  onRemove,
  allowRemove,
  onTotalsChange,
  servicesError,
  refetchServices,
}: PetServiceRowProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();

  const selectedService = useMemo(
    () => services.find((service) => service.id === row.serviceId) || null,
    [services, row.serviceId],
  );
  const [showTierList, setShowTierList] = useState(false);
  const [showAddonList, setShowAddonList] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  const { data: priceTiers = [], isLoading: loadingTiers } = useQuery<
    ServicePriceTier[]
  >({
    queryKey: ["service-tiers", row.serviceId],
    queryFn: () => getServicePriceTiers(row.serviceId),
    enabled: Boolean(row.serviceId),
  });

  const { data: serviceAddons = [], isLoading: loadingAddons } = useQuery<
    ServiceAddon[]
  >({
    queryKey: ["service-addons", row.serviceId],
    queryFn: () => getServiceAddons(row.serviceId),
    enabled: Boolean(row.serviceId),
  });

  const selectedTier = useMemo(
    () => priceTiers.find((tier) => tier.id === row.priceTierId) || null,
    [priceTiers, row.priceTierId],
  );

  const basePrice = selectedTier?.price ?? selectedService?.price ?? 0;
  const addonsTotal = useMemo(() => {
    if (!row.addonIds.length) return 0;
    return row.addonIds.reduce((sum, addonId) => {
      const addon = serviceAddons.find((item) => item.id === addonId);
      return sum + (addon?.price ?? 0);
    }, 0);
  }, [row.addonIds, serviceAddons]);

  const duration = selectedService?.default_duration ?? 0;
  const rowTotal = basePrice + addonsTotal;
  const requiresTier = priceTiers.length > 0 && !row.priceTierId;

  useEffect(() => {
    onTotalsChange(row.id, { price: rowTotal, duration, requiresTier });
  }, [row.id, rowTotal, duration, requiresTier, onTotalsChange]);

  useEffect(() => {
    if (!row.serviceId) return;
    if (!priceTiers.length) return;
    if (
      row.tierSelectionSource === "manual" ||
      row.tierSelectionSource === "stored"
    )
      return;

    const weight = petWeight != null ? Number(petWeight) : null;
    if (weight == null || Number.isNaN(weight)) {
      if (row.tierSelectionSource === "auto") {
        onChange({ priceTierId: "", tierSelectionSource: null });
      }
      return;
    }

    const match = priceTiers.find((tier) => {
      const min = tier.min_weight_kg;
      const max = tier.max_weight_kg;
      if (min != null && weight < Number(min)) return false;
      if (max != null && weight > Number(max)) return false;
      return true;
    });

    if (match && match.id !== row.priceTierId) {
      onChange({ priceTierId: match.id, tierSelectionSource: "auto" });
    }
  }, [
    row.serviceId,
    priceTiers,
    petWeight,
    row.priceTierId,
    row.tierSelectionSource,
    onChange,
  ]);

  const showWeightHint =
    priceTiers.length > 0 &&
    (petWeight == null || Number.isNaN(Number(petWeight))) &&
    !row.priceTierId;

  const tierLabel = selectedTier
    ? `${selectedTier.label || t("appointmentForm.tierDefault")} · €${
        selectedTier.price
      }`
    : t("appointmentForm.selectTierPlaceholder");
  const addonCount = row.addonIds.length;
  const addonLabel =
    addonCount > 0
      ? t("appointmentForm.addonsSelected", { count: addonCount })
      : t("appointmentForm.selectAddonsPlaceholder");
  const selectedAddons = useMemo(
    () => serviceAddons.filter((addon) => row.addonIds.includes(addon.id)),
    [row.addonIds, serviceAddons],
  );
  const formattedDuration =
    duration && duration > 0 ? `${duration} min` : undefined;
  const summaryMetaParts = [
    formattedDuration,
    `${rowTotal.toFixed(2)}€`,
  ].filter(Boolean);
  const summaryMeta = summaryMetaParts.join(" • ");
  const servicePlaceholder = t("serviceSelector.placeholder");

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        services
          .map((service) => service.category)
          .filter(
            (value) => typeof value === "string" && value.trim().length > 0,
          ),
      ),
    ).sort((a, b) => String(a).localeCompare(String(b))) as string[];
  }, [services]);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    return services
      .filter((service) => {
        if (activeCategory && service.category !== activeCategory) return false;
        if (!query) return true;
        return (
          service.name.toLowerCase().includes(query) ||
          service.description?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services, activeCategory, serviceSearch]);

  const errorMessage =
    servicesError &&
    typeof servicesError === "object" &&
    servicesError !== null &&
    "message" in servicesError
      ? (servicesError as { message?: string }).message ||
        t("serviceSelector.error")
      : t("serviceSelector.error");

  const openSelector = () => {
    setShowTierList(false);
    setShowAddonList(false);
    setServiceSearch("");
    setActiveCategory("");
    setSelectorVisible(true);
  };

  const handleSelectService = (service: Service) => {
    onChange({
      serviceId: service.id,
      priceTierId: "",
      tierSelectionSource: null,
      addonIds: [],
    });
    setSelectorVisible(false);
    setServiceSearch("");
    setActiveCategory("");
    Keyboard.dismiss();
  };

  const serviceBadgeLabel =
    selectedService?.name?.charAt(0).toUpperCase() ||
    t("common.service").charAt(0);
  const hasService = Boolean(row.serviceId && selectedService);

  const styles = StyleSheet.create({
    card: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    },
    serviceFieldLabel: {
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      fontSize: 15,
    },
    serviceField: {
      borderWidth: 1,
      borderRadius: 12,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
    },
    serviceFieldActive: {
      borderColor: colors.primary,
    },
    serviceFieldEmpty: {
      backgroundColor: colors.background,
    },
    serviceFieldBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    serviceFieldImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    serviceFieldBadgeText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    serviceFieldDetails: {
      flex: 1,
      marginLeft: 12,
    },
    serviceFieldTitle: {
      fontWeight: "700",
      fontSize: 15,
      color: colors.text,
    },
    serviceFieldPlaceholder: {
      fontWeight: "600",
      fontSize: 15,
      color: colors.muted,
    },
    serviceFieldDescription: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
    },
    serviceFieldMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    sectionLabel: {
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    optionGroup: {
      gap: 8,
      marginBottom: 12,
    },
    optionCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      padding: 12,
    },
    option: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
      borderRadius: 16,
      paddingHorizontal: 16,
    },
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    optionTitle: {
      fontWeight: "700",
      color: colors.text,
    },
    optionPrice: {
      fontWeight: "700",
      color: colors.text,
    },
    optionSubtitle: {
      color: colors.muted,
      marginTop: 2,
    },
    select: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: colors.background,
      borderColor: colors.surfaceBorder,
    },
    selectValue: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    dropdownList: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 10,
      backgroundColor: colors.background,
      borderColor: colors.surfaceBorder,
      marginTop: 8,
      width: "96%",
      alignSelf: "center",
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    helperText: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    addonList: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 8,
    },
    addonBadge: {
      backgroundColor: colors.surface,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 10,
      marginRight: 6,
      marginBottom: 6,
    },
    addonBadgeText: {
      color: colors.text,
      fontSize: 12,
    },
    totalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      paddingTop: 10,
      marginTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalLabel: {
      color: colors.muted,
      fontWeight: "600",
    },
    totalValue: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    modalSearch: {
      marginBottom: 8,
    },
    modalList: {
      maxHeight: 320,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.text,
    },
    chipTextActive: {
      color: colors.primary,
    },
    selectorItem: {
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    selectorItemActive: {
      backgroundColor: colors.primarySoft,
    },
    selectorItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    selectorItemTitle: {
      fontWeight: "700",
      color: colors.text,
      flex: 1,
    },
    selectorPrice: {
      color: colors.primary,
      fontWeight: "700",
    },
    selectorDescription: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    selectorDuration: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    errorRow: {
      alignItems: "center",
      paddingVertical: 24,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      textAlign: "center",
      marginBottom: 8,
    },
    retryButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    retryButtonText: {
      color: colors.primary,
      fontWeight: "700",
    },
    emptyState: {
      color: colors.muted,
      textAlign: "center",
      paddingVertical: 30,
    },
    skeletonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    skeletonIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
    },
    skeletonTextWrapper: {
      flex: 1,
    },
    skeletonLine: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceBorder,
      marginTop: 6,
    },
  });

  return (
    <View style={styles.card}>
      <Text style={styles.serviceFieldLabel}>
        {t("appointmentForm.serviceFieldLabel")}
      </Text>

      <TouchableOpacity
        style={[
          styles.serviceField,
          hasService ? styles.serviceFieldActive : styles.serviceFieldEmpty,
        ]}
        onPress={openSelector}
        activeOpacity={0.8}
      >
        <View style={styles.serviceFieldBadge}>
          {hasService && selectedService?.image_url ? (
            <Image
              source={{ uri: selectedService.image_url }}
              style={styles.serviceFieldImage}
            />
          ) : hasService ? (
            <Text style={styles.serviceFieldBadgeText}>
              {serviceBadgeLabel}
            </Text>
          ) : (
            <Ionicons name="paw" size={18} color={colors.muted} />
          )}
        </View>
        <View style={styles.serviceFieldDetails}>
          <Text
            style={
              hasService
                ? styles.serviceFieldTitle
                : styles.serviceFieldPlaceholder
            }
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedService?.name || servicePlaceholder}
          </Text>
          {selectedService?.description ? (
            <Text
              style={styles.serviceFieldDescription}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectedService.description}
            </Text>
          ) : null}
          {selectedService && summaryMeta ? (
            <Text style={styles.serviceFieldMeta}>{summaryMeta}</Text>
          ) : null}
        </View>
        <Ionicons
          name={selectorVisible ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.muted}
        />
      </TouchableOpacity>

      {selectedAddons.length > 0 ? (
        <View style={styles.addonList}>
          {selectedAddons.map((addon) => (
            <View key={addon.id} style={styles.addonBadge}>
              <Text style={styles.addonBadgeText}>{addon.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!row.serviceId ? (
        <Text style={styles.helperText}>
          {t("appointmentForm.selectServiceHint")}
        </Text>
      ) : null}

      <BottomSheetModal
        visible={selectorVisible}
        onClose={() => setSelectorVisible(false)}
        title={t("serviceSelector.title", { count: services.length })}
        contentStyle={{ width: "100%" }}
      >
        <SearchField
          value={serviceSearch}
          onChangeText={setServiceSearch}
          placeholder={t("serviceSelector.searchPlaceholder")}
          containerStyle={styles.modalSearch}
          inputStyle={{ fontSize: 15 }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {categories.length > 0 ? (
          <View style={styles.chipRow}>
            {categories.map((category) => {
              const active = activeCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setActiveCategory((prev) =>
                      prev === category ? "" : category,
                    )
                  }
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <View style={styles.modalList}>
          {servicesError ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  void refetchServices();
                }}
              >
                <Text style={styles.retryButtonText}>
                  {t("serviceSelector.retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : loadingServices ? (
            <>
              {Array.from({ length: 3 }).map((_, index) => (
                <View key={`loader-${index}`} style={styles.skeletonRow}>
                  <View style={styles.skeletonIcon} />
                  <View style={styles.skeletonTextWrapper}>
                    <View style={[styles.skeletonLine, { width: "70%" }]} />
                    <View style={[styles.skeletonLine, { width: "50%" }]} />
                  </View>
                </View>
              ))}
            </>
          ) : filteredServices.length === 0 ? (
            <Text style={styles.emptyState}>{t("serviceSelector.empty")}</Text>
          ) : (
            <ScrollView
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredServices.map((service) => {
                const isActive = service.id === row.serviceId;
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.selectorItem,
                      isActive && styles.selectorItemActive,
                    ]}
                    onPress={() => handleSelectService(service)}
                  >
                    <View style={styles.selectorItemRow}>
                      <View style={styles.serviceFieldBadge}>
                        {service.image_url ? (
                          <Image
                            source={{ uri: service.image_url }}
                            style={styles.serviceFieldImage}
                          />
                        ) : (
                          <Text style={styles.serviceFieldBadgeText}>
                            {service.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.selectorItemRow}>
                          <Text style={styles.selectorItemTitle}>
                            {service.name}
                          </Text>
                          {service.price != null ? (
                            <Text style={styles.selectorPrice}>
                              €{service.price.toFixed(2)}
                            </Text>
                          ) : null}
                        </View>
                        {service.description ? (
                          <Text
                            style={styles.selectorDescription}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {service.description}
                          </Text>
                        ) : null}
                        <Text style={styles.selectorDuration}>
                          {service.default_duration
                            ? `${service.default_duration} ${t(
                                "common.minutesShort",
                              )}`
                            : t("common.noData")}
                        </Text>
                      </View>
                      {isActive ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.primary}
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </BottomSheetModal>

      {row.serviceId ? (
        <>
          {loadingTiers ? (
            <ActivityIndicator color={colors.primary} />
          ) : priceTiers.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>
                {t("appointmentForm.tierLabel")}
              </Text>
              <TouchableOpacity
                style={styles.select}
                onPress={() => {
                  setShowTierList((prev) => !prev);
                  setShowAddonList(false);
                }}
              >
                <View style={styles.selectValue}>
                  <Text style={styles.optionTitle}>{tierLabel}</Text>
                  <Text style={styles.optionSubtitle}>v</Text>
                </View>
              </TouchableOpacity>
              {showTierList ? (
                <View style={styles.dropdownList}>
                  <ScrollView
                    style={{
                      maxHeight: 200,
                      borderRadius: 12,
                      paddingHorizontal: 16,
                    }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {priceTiers.map((tier) => {
                      const active = row.priceTierId === tier.id;
                      const rangeLabel = [
                        tier.min_weight_kg ?? "-",
                        tier.max_weight_kg ?? "+",
                      ].join(" - ");
                      return (
                        <TouchableOpacity
                          key={tier.id}
                          style={[
                            styles.option,
                            active && styles.optionCardActive,
                          ]}
                          onPress={() => {
                            onChange({
                              priceTierId: tier.id,
                              tierSelectionSource: "manual",
                            });
                            setShowTierList(false);
                          }}
                        >
                          <View style={styles.optionRow}>
                            <Text style={styles.optionTitle}>
                              {tier.label || t("appointmentForm.tierDefault")}
                            </Text>
                            <Text
                              style={styles.optionPrice}
                            >{`€${tier.price}`}</Text>
                          </View>
                          <Text style={styles.optionSubtitle}>
                            {`${rangeLabel} kg`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
              {showWeightHint ? (
                <Text style={styles.helperText}>
                  {t("appointmentForm.tierWeightHint")}
                </Text>
              ) : null}
            </>
          ) : null}
          {loadingAddons ? (
            <ActivityIndicator color={colors.primary} />
          ) : serviceAddons.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>
                {t("appointmentForm.addonsLabel")}
              </Text>
              <TouchableOpacity
                style={styles.select}
                onPress={() => {
                  setShowAddonList((prev) => !prev);
                  setShowTierList(false);
                }}
              >
                <View style={styles.selectValue}>
                  <Text style={styles.optionTitle}>{addonLabel}</Text>
                  <Text style={styles.optionSubtitle}>v</Text>
                </View>
              </TouchableOpacity>
              {showAddonList ? (
                <View style={styles.dropdownList}>
                  <ScrollView
                    style={{ maxHeight: 220 }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {serviceAddons.map((addon) => {
                      const active = row.addonIds.includes(addon.id);
                      return (
                        <TouchableOpacity
                          key={addon.id}
                          style={[
                            styles.option,
                            active && styles.optionCardActive,
                          ]}
                          onPress={() => {
                            if (active) {
                              onChange({
                                addonIds: row.addonIds.filter(
                                  (id) => id !== addon.id,
                                ),
                              });
                            } else {
                              onChange({
                                addonIds: [...row.addonIds, addon.id],
                              });
                            }
                          }}
                        >
                          <View style={styles.optionRow}>
                            <View style={styles.checkbox}>
                              {active ? (
                                <Text style={styles.optionTitle}>x</Text>
                              ) : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.optionTitle}>
                                {addon.name}
                              </Text>
                              {addon.description ? (
                                <Text style={styles.optionSubtitle}>
                                  {addon.description}
                                </Text>
                              ) : null}
                            </View>
                            <Text
                              style={styles.optionPrice}
                            >{`€${addon.price}`}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {t("appointmentForm.serviceTotalLabel")}
        </Text>
        <Text style={styles.totalValue}>{`${rowTotal.toFixed(2)}€`}</Text>
      </View>
    </View>
  );
}
