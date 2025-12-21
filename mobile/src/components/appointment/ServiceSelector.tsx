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

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter(id => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const query = searchQuery.toLowerCase();
    return services.filter(service =>
      service.name.toLowerCase().includes(query) ||
      service.description?.toLowerCase().includes(query)
    );
  }, [services, searchQuery]);

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
