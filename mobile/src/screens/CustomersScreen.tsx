import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCustomers, type Customer } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import SwipeableRow from '../components/common/SwipeableRow';
import { deleteCustomer } from '../api/customers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { Input } from '../components/common/Input';
import { EmptyState } from '../components/common/EmptyState';
import { CustomerCard } from '../components/customers/CustomerCard';
import { matchesSearchQuery } from '../utils/textHelpers';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<any>;

export default function CustomersScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
    onError: (err: any) =>
      Alert.alert(t('common.error'), err?.response?.data?.error || err.message || t('customers.deleteError')),
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    return customers.filter(
      (c) =>
        (c.name && matchesSearchQuery(c.name, searchQuery)) ||
        (c.phone && matchesSearchQuery(c.phone, searchQuery)) ||
        (c.email && matchesSearchQuery(c.email, searchQuery)) ||
        (c.pets && c.pets.some(pet => pet.name && matchesSearchQuery(pet.name, searchQuery)))
    );
  }, [customers, searchQuery]);

  const handleAddCustomer = () => {
    navigation.navigate('CustomerForm', { mode: 'create' });
  };

  const handleCustomerPress = (customer: Customer) => {
    navigation.navigate('CustomerDetail', { customerId: customer.id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={t('customers.title')}
        showBack={true}
        rightElement={
          <TouchableOpacity
            onPress={handleAddCustomer}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Text style={styles.actionButtonText}>+</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <Input
            placeholder={t('customers.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon="🔍"
          />
        </View>

        {/* Customer List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={searchQuery ? "🔍" : "👥"}
            title={searchQuery ? t('customers.emptySearchTitle') : t('customers.emptyTitle')}
            description={
              searchQuery
                ? t('customers.emptySearchDescription')
                : t('customers.emptyDescription')
            }
            actionLabel={!searchQuery ? t('customers.addCustomer') : undefined}
            onAction={!searchQuery ? handleAddCustomer : undefined}
          />
        ) : (
          <>
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>
                {t('customers.count', { count: filteredCustomers.length })}
              </Text>
            </View>
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <SwipeableRow onDelete={() => {
                  Alert.alert(t('customers.deleteTitle'), t('customers.deletePrompt', { name: item.name }), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('customers.deleteAction'), style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
                  ]);
                }}>
                  <CustomerCard customer={item} onPress={() => handleCustomerPress(item)} />
                </SwipeableRow>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    searchSection: {
      paddingTop: 16,
      paddingBottom: 8,
    },
    statsBar: {
      paddingVertical: 12,
    },
    statsText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.muted,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingBottom: 20,
      fontWeight: '700',
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 24,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      backgroundColor: colors.primary,
    },
    actionButtonText: {
      fontSize: 28,
      fontWeight: '300',
      color: '#ffffff',
      lineHeight: 28,
    },
  });
}
