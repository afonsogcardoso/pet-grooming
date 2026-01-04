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

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId],
  );

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return services.filter((service) => {
      if (!query) return true;
      return (
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    });
  }, [services, searchQuery]);

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
    optionDescription: {
      color: colors.muted,
      marginTop: 2,
      fontSize: 12,
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
              <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
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
                          <Text style={styles.optionDescription}>{service.description}</Text>
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
