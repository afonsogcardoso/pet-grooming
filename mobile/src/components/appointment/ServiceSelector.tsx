import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type Service = {
  id: string;
  name: string;
  description?: string | null;
  default_duration?: number | null;
};

type ServiceSelectorProps = {
  selectedService: string;
  selectedServiceData?: Service;
  services: Service[];
  loadingServices: boolean;
  showServiceList: boolean;
  setShowServiceList: (value: boolean) => void;
  setSelectedService: (id: string) => void;
  setDuration: (duration: number) => void;
};

export function ServiceSelector({
  selectedService,
  selectedServiceData,
  services,
  loadingServices,
  showServiceList,
  setShowServiceList,
  setSelectedService,
  setDuration,
}: ServiceSelectorProps) {
  const { colors } = useBrandingTheme();

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
  });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Serviço</Text>
      <TouchableOpacity 
        style={styles.select} 
        onPress={() => setShowServiceList(!showServiceList)}
      >
        <Text style={[styles.selectText, !selectedServiceData && styles.placeholder]}>
          {selectedServiceData?.name || (loadingServices ? 'A carregar...' : 'Escolhe um serviço')}
        </Text>
      </TouchableOpacity>

      {showServiceList ? (
        <View style={styles.dropdown}>
          {loadingServices ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ScrollView style={{ maxHeight: 180 }}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={styles.option}
                  onPress={() => {
                    setSelectedService(service.id);
                    setShowServiceList(false);
                    if (service.default_duration) setDuration(service.default_duration);
                  }}
                >
                  <Text style={styles.optionTitle}>{service.name}</Text>
                  {service.description ? (
                    <Text style={styles.optionSubtitle}>{service.description}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
