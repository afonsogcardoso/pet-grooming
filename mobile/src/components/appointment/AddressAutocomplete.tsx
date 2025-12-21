import { useRef, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Keyboard } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import MapView, { Marker } from 'react-native-maps';
import { normalizeLanguage } from '../../i18n';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

type AddressAutocompleteProps = {
  value: string;
  onSelect: (address: string) => void;
  placeholder: string;
};

export function AddressAutocomplete({ value, onSelect, placeholder }: AddressAutocompleteProps) {
  const { colors } = useBrandingTheme();
  const { i18n } = useTranslation();
  const autocompleteRef = useRef<any>(null);
  const placesKey = Constants.expoConfig?.extra?.googlePlacesKey;
  const [listVisible, setListVisible] = useState<boolean | 'auto'>('auto');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (autocompleteRef.current && value) {
      autocompleteRef.current.setAddressText(value);
    }
  }, [value]);

  useEffect(() => {
    if (value && value.length > 10) {
      geocodeAddress(value);
    } else {
      setCoordinates(null);
    }
  }, [value]);

  const geocodeAddress = async (address: string) => {
    if (!address || address.length < 5) {
      setCoordinates(null);
      return;
    }
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      if (data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        setCoordinates({ latitude: lat, longitude: lng });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setCoordinates(null);
    }
  };

  if (!placesKey) {
    return (
      <TextInput
        value={value}
        onChangeText={onSelect}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { 
          borderColor: colors.surfaceBorder,
          backgroundColor: colors.surface,
          color: colors.text 
        }]}
      />
    );
  }

  return (
    <View style={{ zIndex: 1000, marginBottom: 8 }}>
      <GooglePlacesAutocomplete
        ref={autocompleteRef}
        placeholder={placeholder}
        fetchDetails={true}
        enablePoweredByContainer={false}
        minLength={2}
        listViewDisplayed={listVisible}
        debounce={300}
        disableScroll={true}
        renderRow={(data) => (
          <View style={{ padding: 12 }}>
            <Text style={{ color: colors.text, fontSize: 13 }}>
              {data.description}
            </Text>
          </View>
        )}
        textInputProps={{
          placeholderTextColor: colors.muted,
          autoCorrect: false,
          autoComplete: 'off',
          textContentType: 'none',
          spellCheck: false,
          returnKeyType: 'done',
          onFocus: () => setListVisible('auto'),
          onChangeText: () => setListVisible('auto'),
        }}
        query={{
          key: placesKey,
          language: normalizeLanguage(i18n.language),
          components: 'country:pt',
        }}
        onPress={(data, details = null) => {
          const address = details?.formatted_address || data.description || '';
          onSelect(address);
          setListVisible(false);
          Keyboard.dismiss();
          
          // Usar coordenadas dos details se disponíveis
          if (details?.geometry?.location) {
            setCoordinates({
              latitude: details.geometry.location.lat,
              longitude: details.geometry.location.lng,
            });
          } else {
            geocodeAddress(address);
          }
        }}
        keepResultsAfterBlur={false}
        styles={{
          container: {
            flex: 0,
            width: '100%',
          },
          textInputContainer: {
            paddingHorizontal: 0,
            backgroundColor: 'transparent',
          },
          textInput: {
            backgroundColor: colors.surface,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            color: colors.text,
            fontWeight: '600',
            fontSize: 14,
            height: 44,
          },
          listView: {
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: colors.primary,
            borderRadius: 12,
            marginTop: 4,
            maxHeight: 200,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
          },
          row: {
            padding: 12,
            minHeight: 44,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceBorder,
            backgroundColor: '#FFFFFF',
          },
          description: {
            color: colors.text,
            fontSize: 13,
          },
          separator: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.surfaceBorder,
          },
          poweredContainer: {
            display: 'none',
          },
          powered: {
            display: 'none',
          },
        }}
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
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
  },
});
