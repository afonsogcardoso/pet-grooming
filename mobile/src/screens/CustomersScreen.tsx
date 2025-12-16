import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCustomers, type Customer } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { CustomerCard } from '../components/customers/CustomerCard';
import { matchesSearchQuery } from '../utils/textHelpers';

type Props = NativeStackScreenProps<any>;

export default function CustomersScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
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
        title="Clientes"
        showBack={true}
        rightElement={
          <Button
            title="Adicionar"
            onPress={handleAddCustomer}
            variant="primary"
            size="small"
            icon="+"
          />
        }
      />

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <Input
            placeholder="Buscar por nome, telefone ou email..."
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
            title={searchQuery ? "Nenhum resultado" : "Nenhum cliente"}
            description={
              searchQuery
                ? "Não encontramos clientes com esse critério"
                : "Adicione seu primeiro cliente para começar"
            }
            actionLabel={!searchQuery ? "Adicionar Cliente" : undefined}
            onAction={!searchQuery ? handleAddCustomer : undefined}
          />
        ) : (
          <>
            <View style={styles.statsBar}>
              <Text style={styles.statsText}>
                {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente' : 'clientes'}
              </Text>
            </View>
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CustomerCard customer={item} onPress={() => handleCustomerPress(item)} />
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
  });
}
