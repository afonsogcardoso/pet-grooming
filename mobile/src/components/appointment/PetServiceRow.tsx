import { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { ServicePicker } from './ServicePicker';
import { getServicePriceTiers, getServiceAddons } from '../../api/services';
import type { ServiceAddon, ServicePriceTier, Service } from '../../api/services';

export type ServiceRow = {
  id: string;
  serviceId: string;
  priceTierId?: string;
  tierSelectionSource?: 'auto' | 'manual' | 'stored' | null;
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
  onTotalsChange: (totals: RowTotals) => void;
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
}: PetServiceRowProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();

  const selectedService = useMemo(
    () => services.find((service) => service.id === row.serviceId) || null,
    [services, row.serviceId],
  );

  const { data: priceTiers = [], isLoading: loadingTiers } = useQuery<ServicePriceTier[]>({
    queryKey: ['service-tiers', row.serviceId],
    queryFn: () => getServicePriceTiers(row.serviceId),
    enabled: Boolean(row.serviceId),
  });

  const { data: serviceAddons = [], isLoading: loadingAddons } = useQuery<ServiceAddon[]>({
    queryKey: ['service-addons', row.serviceId],
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
    onTotalsChange({ price: rowTotal, duration, requiresTier });
  }, [rowTotal, duration, requiresTier, onTotalsChange]);

  useEffect(() => {
    if (!row.serviceId) return;
    if (!priceTiers.length) return;
    if (row.tierSelectionSource === 'manual' || row.tierSelectionSource === 'stored') return;

    const weight = petWeight != null ? Number(petWeight) : null;
    if (weight == null || Number.isNaN(weight)) {
      if (row.tierSelectionSource === 'auto') {
        onChange({ priceTierId: '', tierSelectionSource: null });
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
      onChange({ priceTierId: match.id, tierSelectionSource: 'auto' });
    }
  }, [row.serviceId, priceTiers, petWeight, row.priceTierId, row.tierSelectionSource, onChange]);

  const showWeightHint =
    priceTiers.length > 0 &&
    (petWeight == null || Number.isNaN(Number(petWeight))) &&
    !row.priceTierId;

  const styles = StyleSheet.create({
    card: {
      borderWidth: 1,
      borderRadius: 14,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 14,
      marginBottom: 12,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    headerTitle: {
      fontWeight: '700',
      color: colors.text,
      fontSize: 15,
    },
    removeButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    removeButtonText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 12,
    },
    metaText: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    sectionLabel: {
      fontWeight: '600',
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
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    optionTitle: {
      fontWeight: '700',
      color: colors.text,
    },
    optionPrice: {
      fontWeight: '700',
      color: colors.text,
    },
    optionSubtitle: {
      color: colors.muted,
      marginTop: 2,
    },
    helperText: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    totalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      paddingTop: 10,
      marginTop: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      color: colors.muted,
      fontWeight: '600',
    },
    totalValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t('appointmentForm.serviceLabel', { index: index + 1 })}</Text>
        {allowRemove ? (
          <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
            <Text style={styles.removeButtonText}>{t('appointmentForm.removeService')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ServicePicker
        selectedServiceId={row.serviceId}
        services={services}
        loading={loadingServices}
        onSelect={(serviceId) => onChange({ serviceId })}
        placeholder={t('serviceSelector.placeholder')}
      />

      {selectedService?.category || selectedService?.subcategory ? (
        <Text style={styles.metaText}>
          {[selectedService.category, selectedService.subcategory].filter(Boolean).join(' / ')}
        </Text>
      ) : null}

      {row.serviceId ? (
        <>
          <Text style={styles.sectionLabel}>{t('appointmentForm.tierLabel')}</Text>
          {loadingTiers ? (
            <ActivityIndicator color={colors.primary} />
          ) : priceTiers.length === 0 ? (
            <Text style={styles.helperText}>{t('appointmentForm.noTiers')}</Text>
          ) : (
            <View style={styles.optionGroup}>
              {priceTiers.map((tier) => {
                const active = row.priceTierId === tier.id;
                const rangeLabel = [tier.min_weight_kg ?? '-', tier.max_weight_kg ?? '+'].join(' - ');
                return (
                  <TouchableOpacity
                    key={tier.id}
                    style={[styles.optionCard, active && styles.optionCardActive]}
                    onPress={() => {
                      if (active) {
                        onChange({ priceTierId: '', tierSelectionSource: null });
                      } else {
                        onChange({ priceTierId: tier.id, tierSelectionSource: 'manual' });
                      }
                    }}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionTitle}>{tier.label || t('appointmentForm.tierDefault')}</Text>
                      <Text style={styles.optionPrice}>{`€${tier.price}`}</Text>
                    </View>
                    <Text style={styles.optionSubtitle}>{`${rangeLabel} kg`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {showWeightHint ? (
            <Text style={styles.helperText}>{t('appointmentForm.tierWeightHint')}</Text>
          ) : null}

          <Text style={styles.sectionLabel}>{t('appointmentForm.addonsLabel')}</Text>
          {loadingAddons ? (
            <ActivityIndicator color={colors.primary} />
          ) : serviceAddons.length === 0 ? (
            <Text style={styles.helperText}>{t('appointmentForm.noAddons')}</Text>
          ) : (
            <View style={styles.optionGroup}>
              {serviceAddons.map((addon) => {
                const active = row.addonIds.includes(addon.id);
                return (
                  <TouchableOpacity
                    key={addon.id}
                    style={[styles.optionCard, active && styles.optionCardActive]}
                    onPress={() => {
                      if (active) {
                        onChange({ addonIds: row.addonIds.filter((id) => id !== addon.id) });
                      } else {
                        onChange({ addonIds: [...row.addonIds, addon.id] });
                      }
                    }}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionTitle}>{addon.name}</Text>
                      <Text style={styles.optionPrice}>{`€${addon.price}`}</Text>
                    </View>
                    {addon.description ? (
                      <Text style={styles.optionSubtitle}>{addon.description}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      ) : (
        <Text style={styles.helperText}>{t('appointmentForm.selectServiceHint')}</Text>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('appointmentForm.serviceTotalLabel')}</Text>
        <Text style={styles.totalValue}>{`${rowTotal.toFixed(2)}€`}</Text>
      </View>
    </View>
  );
}
