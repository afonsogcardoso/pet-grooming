import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Keyboard,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { Ionicons } from "@expo/vector-icons";

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
  const [searchQuery, setSearchQuery] = useState("");

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId]
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

  useEffect(() => {
    setSearchQuery(selectedService?.name || "");
  }, [selectedService]);

  const fieldPlaceholder =
    placeholder || t("serviceSelector.placeholder") || t("serviceSelector.searchPlaceholder");

  const styles = StyleSheet.create({
    field: {
      marginBottom: 12,
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
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    selectText: {
      color: colors.text,
      fontWeight: "600",
      flex: 1,
    },
    placeholderText: {
      color: colors.muted,
      fontWeight: "600",
      flex: 1,
    },
    dropdown: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      marginTop: 6,
      borderColor: colors.surfaceBorder,
      overflow: "hidden",
    },
    dropdownSearch: {
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
    },
    option: {
      width: "100%",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
      padding: 10,
    },
    optionActive: {
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      padding: 10,
    },
    optionTitle: {
      color: colors.text,
      fontWeight: "700",
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
      fontWeight: "700",
      fontSize: 15,
    },
  });

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={styles.select}
        onPress={() => setOpen((prev) => !prev)}
        activeOpacity={0.8}
      >
        <Text
          style={
            selectedService ? styles.selectText : styles.placeholderText
          }
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {selectedService?.name || fieldPlaceholder}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.muted}
        />
      </TouchableOpacity>

      {open ? (
        <View style={styles.dropdown}>
          <TextInput
            style={[styles.dropdownSearch, { fontSize: 15 }]}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
            }}
            placeholder={t("serviceSelector.searchPlaceholder")}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
          />
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <ScrollView
              style={{ maxHeight: 240 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {filteredServices.length === 0 ? (
                <Text
                  style={{
                    color: colors.muted,
                    textAlign: "center",
                    paddingVertical: 20,
                  }}
                >
                  {t("serviceSelector.empty")}
                </Text>
              ) : (
                filteredServices.map((service) => {
                  const isSelected = selectedServiceId === service.id;
                  return (
                    <TouchableOpacity
                      key={service.id}
                      style={[styles.option, isSelected && styles.optionActive]}
                      onPress={() => {
                        if (isSelected && allowClear) {
                          onSelect("");
                          setSearchQuery("");
                        } else {
                          onSelect(service.id);
                          setSearchQuery(service.name);
                        }
                        setOpen(false);
                        Keyboard.dismiss();
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text style={styles.optionTitle}>{service.name}</Text>
                        {service.price != null && (
                          <Text style={styles.priceText}>
                            {service.price.toFixed(2)}€
                          </Text>
                        )}
                      </View>
                      {service.description ? (
                        <Text style={styles.optionDescription}>
                          {service.description}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
