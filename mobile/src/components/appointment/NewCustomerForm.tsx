import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { AddressAutocomplete } from './AddressAutocomplete';
import { Input } from '../common/Input';
import { useState, useEffect } from 'react';
import MapView, { Marker } from 'react-native-maps';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

type NewCustomerFormProps = {
  customerName: string;
  setCustomerName: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerEmail: string;
  setCustomerEmail: (value: string) => void;
  customerAddress: string;
  setCustomerAddress: (value: string) => void;
  customerNif: string;
  setCustomerNif: (value: string) => void;
  petName: string;
  setPetName: (value: string) => void;
  petBreed: string;
  setPetBreed: (value: string) => void;
  addressPlaceholder: string;
};

export function NewCustomerForm({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  customerAddress,
  setCustomerAddress,
  customerNif,
  setCustomerNif,
  petName,
  setPetName,
  petBreed,
  setPetBreed,
  addressPlaceholder,
}: NewCustomerFormProps) {
  const { colors } = useBrandingTheme();
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (customerAddress && customerAddress.length > 10) {
      const geocodeAddress = async () => {
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(customerAddress)}&key=${GOOGLE_MAPS_API_KEY}`
          );
          const data = await response.json();
          if (data.results?.[0]?.geometry?.location) {
            const { lat, lng } = data.results[0].geometry.location;
            setCoordinates({ latitude: lat, longitude: lng });
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }
      };
      geocodeAddress();
    } else {
      setCoordinates(null);
    }
  }, [customerAddress]);

  const styles = StyleSheet.create({
    field: {
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    label: {
      color: colors.text,
      marginBottom: 8,
      fontWeight: '600',
      fontSize: 15,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
      fontSize: 15,
      fontWeight: '500',
    },
  });

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Nome do Cliente</Text>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Nome completo"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
      
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            placeholder="Telefone"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="phone-pad"
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>NIF</Text>
          <TextInput
            value={customerNif}
            onChangeText={setCustomerNif}
            placeholder="NIF"
            placeholderTextColor={colors.muted}
            style={styles.input}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <Input
        label="Email"
        value={customerEmail}
        onChangeText={setCustomerEmail}
        placeholder="email@dominio.com"
        keyboardType="email-address"
        autoCapitalize="none"
        showEmailSuggestions
      />

      <View style={styles.field}>
        <Text style={styles.label}>Morada</Text>
        <AddressAutocomplete
          value={customerAddress}
          onSelect={setCustomerAddress}
          placeholder={addressPlaceholder}
        />
        {coordinates && (
          <View style={{ marginTop: 12, height: 200, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.surfaceBorder }}>
            <MapView
              style={{ flex: 1 }}
              region={{
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
            >
              <Marker coordinate={coordinates} />
            </MapView>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Nome do Animal</Text>
        <TextInput
          value={petName}
          onChangeText={setPetName}
          placeholder="Nome do animal"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Raça (opcional)</Text>
        <TextInput
          value={petBreed}
          onChangeText={setPetBreed}
          placeholder="Raça"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>
    </>
  );
}
