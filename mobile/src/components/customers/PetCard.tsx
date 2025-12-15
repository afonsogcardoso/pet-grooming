import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import type { Pet } from '../../api/customers';

interface PetCardProps {
  pet: Pet;
  onPress: () => void;
}

export function PetCard({ pet, onPress }: PetCardProps) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🐾</Text>
          </View>
        )}
      </View>
      
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {pet.name}
        </Text>
        {pet.breed && (
          <Text style={styles.breed} numberOfLines={1}>
            {pet.breed}
          </Text>
        )}
      </View>

      <Text style={styles.arrow}>→</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    imageContainer: {
      width: 56,
      height: 56,
      borderRadius: 12,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderIcon: {
      fontSize: 24,
    },
    info: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    breed: {
      fontSize: 14,
      color: colors.muted,
    },
    arrow: {
      fontSize: 20,
      color: colors.muted,
      marginLeft: 8,
    },
  });
}
