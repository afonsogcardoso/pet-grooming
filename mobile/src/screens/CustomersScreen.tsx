import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCustomers, type Customer } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import SwipeableRow from '../components/common/SwipeableRow';
import { deleteCustomer } from '../api/customers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { EmptyState } from '../components/common/EmptyState';
import { UndoToast } from '../components/common/UndoToast';
import { CustomerCard } from '../components/customers/CustomerCard';
import { matchesSearchQuery } from '../utils/textHelpers';
import { formatCustomerName } from '../utils/customer';
import { useTranslation } from 'react-i18next';
import { hapticError, hapticSuccess, hapticWarning } from '../utils/haptics';
import { useSwipeDeleteIndicator } from '../hooks/useSwipeDeleteIndicator';

type Props = NativeStackScreenProps<any>;
type DeletePayload = {
  customer: Customer;
  index: number;
};
const UNDO_TIMEOUT_MS = 4000;

export default function CustomersScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const undoBottomOffset = tabBarHeight > 0 ? tabBarHeight : insets.bottom + 16;

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const queryClient = useQueryClient();
  const [undoVisible, setUndoVisible] = useState(false);
  const { deletingId, beginDelete, clearDeletingId } = useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePayload | null>(null);
  const restoreCustomer = useCallback((payload: DeletePayload) => {
    queryClient.setQueryData(['customers'], (old: Customer[] | undefined) => {
      if (!old) return old;
      if (old.some((item) => item.id === payload.customer.id)) return old;
      const nextItems = [...old];
      const insertIndex = Math.min(Math.max(payload.index, 0), nextItems.length);
      nextItems.splice(insertIndex, 0, payload.customer);
      return nextItems;
    });
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: ({ customer }: DeletePayload) => deleteCustomer(customer.id),
    onSuccess: () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables) {
        restoreCustomer(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }
      Alert.alert(t('common.error'), err?.response?.data?.error || err.message || t('customers.deleteError'));
    },
  });

  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    deleteMutation.mutate(pending);
  }, [clearDeletingId, deleteMutation]);

  const startOptimisticDelete = useCallback((customer: Customer) => {
    if (pendingDeleteRef.current) {
      commitPendingDelete();
    }

    const cached = queryClient.getQueryData<Customer[]>(['customers']);
    const index = cached ? cached.findIndex((item) => item.id === customer.id) : -1;

    queryClient.setQueryData(['customers'], (old: Customer[] | undefined) => {
      if (!old) return old;
      if (!old.some((item) => item.id === customer.id)) return old;
      return old.filter((item) => item.id !== customer.id);
    });

    pendingDeleteRef.current = { customer, index: Math.max(index, 0) };
    setUndoVisible(true);
  }, [commitPendingDelete, queryClient]);

  const handleUndo = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    restoreCustomer(pending);
  }, [clearDeletingId, restoreCustomer]);

  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      pendingDeleteRef.current = null;
      deleteMutation.mutate(pending);
    };
  }, [deleteMutation]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    return customers.filter(
      (c) => {
        const nameValue = formatCustomerName(c);
        return (
          (nameValue && matchesSearchQuery(nameValue, searchQuery)) ||
          (c.phone && matchesSearchQuery(c.phone, searchQuery)) ||
          (c.email && matchesSearchQuery(c.email, searchQuery)) ||
          (c.pets && c.pets.some((pet) => pet.name && matchesSearchQuery(pet.name, searchQuery)))
        );
      }
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
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              placeholder={t('customers.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
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
          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SwipeableRow
                  isDeleting={item.id === deletingId}
                  onDelete={() => {
                  const displayName = formatCustomerName(item);
                  Alert.alert(t('customers.deleteTitle'), t('customers.deletePrompt', { name: displayName }), [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('customers.deleteAction'),
                      style: 'destructive',
                      onPress: () => {
                        hapticWarning();
                        beginDelete(item.id, () => startOptimisticDelete(item));
                      },
                    },
                  ]);
                }}
                >
                  <CustomerCard customer={item} onPress={() => handleCustomerPress(item)} />
                </SwipeableRow>
              )}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
      <UndoToast
        visible={undoVisible}
        message={t('customers.deleteUndoMessage')}
        actionLabel={t('customers.deleteUndoAction')}
        onAction={handleUndo}
        onTimeout={commitPendingDelete}
        onDismiss={commitPendingDelete}
        durationMs={UNDO_TIMEOUT_MS}
        bottomOffset={undoBottomOffset}
      />
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
      paddingTop: 12,
    },
    searchContainer: {
      height: 44,
      justifyContent: 'center',
      marginBottom: 0,
      paddingHorizontal: 16,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    clearButton: {
      padding: 2,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 20,
    },
    itemSeparator: {
      height: 12,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
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
