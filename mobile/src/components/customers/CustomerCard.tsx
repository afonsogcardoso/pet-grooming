import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { Avatar } from '../common/Avatar';
import type { Customer } from '../../api/customers';
import { formatCustomerName } from '../../utils/customer';

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
}

export function CustomerCard({ customer, onPress }: CustomerCardProps) {
  const { colors } = useBrandingTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const petCount = customer.pet_count || customer.pets?.length || 0;
  const displayName = formatCustomerName(customer);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar name={displayName} imageUrl={customer.photo_url} size="medium" />
      
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.details}>
          {customer.phone && (
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>📱</Text>
              <Text style={styles.detailText} numberOfLines={1}>
                {customer.phone}
              </Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Text style={styles.detailIcon}>🐾</Text>
            <Text style={styles.detailText}>
              {t('customerCard.petCount', { count: petCount })}
            </Text>
          </View>
        </View>
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
    info: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    details: {
      flexDirection: 'column',
      gap: 4,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailIcon: {
      fontSize: 12,
      marginRight: 6,
    },
    detailText: {
      fontSize: 13,
      color: colors.muted,
    },
    arrow: {
      fontSize: 20,
      color: colors.muted,
      marginLeft: 8,
    },
  });
}
