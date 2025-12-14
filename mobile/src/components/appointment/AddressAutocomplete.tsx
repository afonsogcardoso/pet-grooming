import { useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Constants from 'expo-constants';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

type AddressAutocompleteProps = {
  value: string;
  onSelect: (address: string) => void;
  placeholder: string;
};

export function AddressAutocomplete({ value, onSelect, placeholder }: AddressAutocompleteProps) {
  const { colors } = useBrandingTheme();
  const autocompleteRef = useRef<any>(null);
  const placesKey = Constants.expoConfig?.extra?.googlePlacesKey;

  useEffect(() => {
    if (autocompleteRef.current && value) {
      autocompleteRef.current.setAddressText(value);
    }
  }, [value]);

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
        listViewDisplayed="auto"
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
          returnKeyType: 'done',
        }}
        query={{
          key: placesKey,
          language: 'pt',
          components: 'country:pt',
        }}
        onPress={(data, details = null) => {
          const address = details?.formatted_address || data.description || '';
          onSelect(address);
        }}
        keepResultsAfterBlur={true}
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.primarySoft,
            borderRadius: 12,
            marginTop: 6,
            maxHeight: 200,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          },
          row: {
            padding: 12,
            minHeight: 44,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.surfaceBorder,
            backgroundColor: colors.surface,
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
