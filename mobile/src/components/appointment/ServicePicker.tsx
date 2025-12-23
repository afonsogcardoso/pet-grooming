import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type Service = {
  id: string;
  name: string;
  description?: string | null;
  default_duration?: number | null;
  price?: number | null;
  category?: string | null;
  subcategory?: string | null;
};

type ServicePickerProps = {
  selectedServiceId: string;
  services: Service[];
  loading: boolean;
  onSelect: (serviceId: string) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
};

const UNCATEGORIZED = '__uncategorized__';
const NO_SUBCATEGORY = '__no_subcategory__';

export function ServicePicker({
  selectedServiceId,
  services,
  loading,
  onSelect,
  label,
  placeholder,
  allowClear = true,
}: ServicePickerProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId],
  );

  const categories = useMemo(() => {
    const categoriesSet = new Set<string>();
    let hasUncategorized = false;
    services.forEach((service) => {
      if (service.category && service.category.trim()) {
        categoriesSet.add(service.category.trim());
      } else {
        hasUncategorized = true;
      }
    });
    const list = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
    if (hasUncategorized) list.push(UNCATEGORIZED);
    return list;
  }, [services]);

  const subcategories = useMemo(() => {
    const source = selectedCategory
      ? services.filter((service) => {
          if (selectedCategory === UNCATEGORIZED) return !service.category?.trim();
          return service.category === selectedCategory;
        })
      : services;
    const set = new Set<string>();
    let hasNoSubcategory = false;
    source.forEach((service) => {
      if (service.subcategory && service.subcategory.trim()) {
        set.add(service.subcategory.trim());
      } else {
        hasNoSubcategory = true;
      }
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (hasNoSubcategory) list.push(NO_SUBCATEGORY);
    return list;
  }, [services, selectedCategory]);

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return services.filter((service) => {
      if (selectedCategory) {
        if (selectedCategory === UNCATEGORIZED && service.category?.trim()) return false;
        if (selectedCategory !== UNCATEGORIZED && service.category !== selectedCategory) return false;
      }
      if (selectedSubcategory) {
        if (selectedSubcategory === NO_SUBCATEGORY && service.subcategory?.trim()) return false;
        if (selectedSubcategory !== NO_SUBCATEGORY && service.subcategory !== selectedSubcategory) return false;
      }
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    });
  }, [services, searchQuery, selectedCategory, selectedSubcategory]);

  const styles = StyleSheet.create({
    field: {
      marginBottom: 12,
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
      marginTop: 8,
      borderColor: colors.primarySoft,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
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
    optionMeta: {
      color: colors.muted,
      marginTop: 2,
      fontSize: 12,
    },
    priceText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 15,
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
    filterGroup: {
      marginBottom: 12,
    },
    filterLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    chipTextActive: {
      color: colors.primary,
    },
  });

  const displayText = selectedService
    ? selectedService.name
    : (loading ? t('common.loading') : (placeholder || t('serviceSelector.placeholder')));

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.select}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text style={[styles.selectText, !selectedService && styles.placeholder]}>
          {displayText}
        </Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdown}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('serviceSelector.searchPlaceholder')}
                  placeholderTextColor={colors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>
              {categories.length > 0 && (
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>{t('serviceSelector.categoryLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, !selectedCategory && styles.chipActive]}
                      onPress={() => {
                        setSelectedCategory('');
                        setSelectedSubcategory('');
                      }}
                    >
                      <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
                        {t('serviceSelector.filterAll')}
                      </Text>
                    </TouchableOpacity>
                    {categories.map((category) => {
                      const value = category;
                      const active = selectedCategory === value;
                      const labelText =
                        category === UNCATEGORIZED ? t('serviceSelector.uncategorized') : category;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => {
                            setSelectedCategory(active ? '' : value);
                            setSelectedSubcategory('');
                          }}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{labelText}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {subcategories.length > 0 && (
                <View style={styles.filterGroup}>
                  <Text style={styles.filterLabel}>{t('serviceSelector.subcategoryLabel')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <TouchableOpacity
                      style={[styles.chip, !selectedSubcategory && styles.chipActive]}
                      onPress={() => setSelectedSubcategory('')}
                    >
                      <Text style={[styles.chipText, !selectedSubcategory && styles.chipTextActive]}>
                        {t('serviceSelector.filterAll')}
                      </Text>
                    </TouchableOpacity>
                    {subcategories.map((subcategory) => {
                      const value = subcategory;
                      const active = selectedSubcategory === value;
                      const labelText =
                        subcategory === NO_SUBCATEGORY ? t('serviceSelector.noSubcategory') : subcategory;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSelectedSubcategory(active ? '' : value)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{labelText}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              <ScrollView style={{ maxHeight: 240 }}>
                {filteredServices.length === 0 ? (
                  <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 20 }}>
                    {t('serviceSelector.empty')}
                  </Text>
                ) : (
                  filteredServices.map((service) => {
                    const isSelected = selectedServiceId === service.id;
                    return (
                      <TouchableOpacity
                        key={service.id}
                        style={[styles.option, isSelected && { backgroundColor: colors.primarySoft }]}
                        onPress={() => {
                          if (isSelected && allowClear) {
                            onSelect('');
                          } else {
                            onSelect(service.id);
                          }
                          setOpen(false);
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.optionTitle}>{service.name}</Text>
                          {service.price != null && (
                            <Text style={styles.priceText}>{service.price.toFixed(2)}€</Text>
                          )}
                        </View>
                        {service.description ? (
                          <Text style={styles.optionSubtitle}>{service.description}</Text>
                        ) : null}
                        {service.category || service.subcategory ? (
                          <Text style={styles.optionMeta}>
                            {[service.category, service.subcategory].filter(Boolean).join(' / ')}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
