import { useState, useMemo } from 'react';
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

type ServiceSelectorProps = {
  selectedServices: string[];
  selectedServicesData: Service[];
  services: Service[];
  loadingServices: boolean;
  showServiceList: boolean;
  setShowServiceList: (value: boolean) => void;
  setSelectedServices: (ids: string[]) => void;
  setDuration: (duration: number) => void;
};

export function ServiceSelector({
  selectedServices,
  selectedServicesData,
  services,
  loadingServices,
  showServiceList,
  setShowServiceList,
  setSelectedServices,
  setDuration,
}: ServiceSelectorProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter(id => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  const filteredServices = useMemo(() => {
    const category = selectedCategory.trim();
    const subcategory = selectedSubcategory.trim();
    const query = searchQuery.trim().toLowerCase();
    return services.filter(service => {
      if (category && service.category !== category) return false;
      if (subcategory && service.subcategory !== subcategory) return false;
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    });
  }, [services, searchQuery, selectedCategory, selectedSubcategory]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        services
          .map((service) => service.category)
          .filter((value) => typeof value === 'string' && value.trim().length > 0)
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));
  }, [services]);

  const subcategories = useMemo(() => {
    const source = selectedCategory
      ? services.filter((service) => service.category === selectedCategory)
      : services;
    return Array.from(
      new Set(
        source
          .map((service) => service.subcategory)
          .filter((value) => typeof value === 'string' && value.trim().length > 0)
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));
  }, [services, selectedCategory]);

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
    optionMeta: {
      color: colors.muted,
      marginTop: 2,
      fontSize: 12,
    },
  });

  const displayText = selectedServicesData.length > 0
    ? selectedServicesData.map(s => s.name).join(', ')
    : (loadingServices ? t('common.loading') : t('serviceSelector.placeholder'));

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t('serviceSelector.title', { count: selectedServices.length })}</Text>
      <TouchableOpacity 
        style={styles.select} 
        onPress={() => setShowServiceList(!showServiceList)}
      >
        <Text style={[styles.selectText, selectedServices.length === 0 && styles.placeholder]}>
          {displayText}
        </Text>
      </TouchableOpacity>

      {showServiceList ? (
        <View style={styles.dropdown}>
          {loadingServices ? (
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
                      const active = selectedCategory === category;
                      return (
                        <TouchableOpacity
                          key={category}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => {
                            setSelectedCategory(active ? '' : category);
                            setSelectedSubcategory('');
                          }}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{category}</Text>
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
                      const active = selectedSubcategory === subcategory;
                      return (
                        <TouchableOpacity
                          key={subcategory}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSelectedSubcategory(active ? '' : subcategory)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {subcategory}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              <ScrollView style={{ maxHeight: 250 }}>
                {filteredServices.length === 0 ? (
                  <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 20 }}>
                    {t('serviceSelector.empty')}
                  </Text>
                ) : (
                  filteredServices.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.option, isSelected && { backgroundColor: colors.primarySoft }]}
                    onPress={() => toggleService(service.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.surfaceBorder,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        {isSelected && <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.optionTitle}>{service.name}</Text>
                          {service.price && (
                            <Text style={styles.priceText}>{service.price.toFixed(2)}€</Text>
                          )}
                        </View>
                        {service.description ? (
                          <Text style={styles.optionSubtitle}>{service.description}</Text>
                        ) : null}
                        {service.category || service.subcategory ? (
                          <Text style={styles.optionMeta}>
                            {[service.category, service.subcategory].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                    </View>
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
