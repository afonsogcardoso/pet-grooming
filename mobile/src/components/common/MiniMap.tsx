import { useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Linking, TouchableOpacity, Text, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

interface MiniMapProps {
  address: string;
  height?: number;
  borderless?: boolean;
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';

export function MiniMap({
  address,
  height = 180,
  borderless = false,
}: MiniMapProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () => createStyles(colors, borderless),
    [colors, borderless]
  );
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    geocodeAddress(address);
  }, [address]);

  const geocodeAddress = async (addr: string) => {
    if (!addr || !GOOGLE_MAPS_API_KEY) {
      setError(true);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        setCoordinates({
          latitude: location.lat,
          longitude: location.lng,
        });
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMaps = () => {
    if (coordinates) {
      const url = Platform.select({
        ios: `maps:0,0?q=${coordinates.latitude},${coordinates.longitude}`,
        android: `geo:0,0?q=${coordinates.latitude},${coordinates.longitude}`,
        default: `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`,
      });
      Linking.openURL(url);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !coordinates) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.container, { height }]}
      onPress={handleOpenMaps}
      activeOpacity={0.9}
    >
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Marker
          coordinate={coordinates}
          title={address}
        />
      </MapView>
      <View style={styles.overlay}>
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{t('common.openMaps')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(
  colors: ReturnType<typeof useBrandingTheme>['colors'],
  borderless: boolean
) {
  return StyleSheet.create({
    container: {
      width: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 16,
      marginBottom: 4,
      backgroundColor: borderless ? 'transparent' : colors.surface,
      borderWidth: borderless ? 0 : 1,
      borderColor: colors.surfaceBorder,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    map: {
      width: '100%',
      height: '100%',
    },
    overlay: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      right: 12,
      alignItems: 'center',
    },
    badge: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
