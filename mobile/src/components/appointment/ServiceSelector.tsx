import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
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

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter(id => id !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

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
  });

  const displayText = selectedServicesData.length > 0
    ? selectedServicesData.map(s => s.name).join(', ')
    : (loadingServices ? 'A carregar...' : 'Escolhe os serviços');

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Serviços ({selectedServices.length})</Text>
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
            <ScrollView style={{ maxHeight: 300 }}>
              {services.map((service) => {
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
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
