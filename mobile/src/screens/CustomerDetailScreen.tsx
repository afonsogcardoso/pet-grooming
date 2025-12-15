import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCustomers, getPetsByCustomer, type Customer, type Pet } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { PetCard } from '../components/customers/PetCard';

type Props = NativeStackScreenProps<any, 'CustomerDetail'>;

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params as { customerId: string };
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading: isLoadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const { data: pets = [], isLoading: isLoadingPets, refetch: refetchPets } = useQuery({
    queryKey: ['customer-pets', customerId],
    queryFn: () => getPetsByCustomer(customerId),
    enabled: !!customerId,
  });

  const customer = customers.find((c) => c.id === customerId);

  // Debug: log customer data
  console.log('Customer data:', customer);
  console.log('Customer NIF:', customer?.nif);

  const handleEditCustomer = () => {
    navigation.navigate('CustomerForm', { mode: 'edit', customerId, customer });
  };

  const handleAddPet = () => {
    navigation.navigate('PetForm', { mode: 'create', customerId });
  };

  const handlePetPress = (pet: Pet) => {
    navigation.navigate('PetForm', { mode: 'edit', customerId, petId: pet.id, pet });
  };

  if (isLoadingCustomer) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Cliente" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Cliente" />
        <EmptyState
          icon="❌"
          title="Cliente não encontrado"
          description="O cliente que você procura não existe"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Detalhes do Cliente"
        showBack={true}
        rightElement={
          <TouchableOpacity onPress={handleEditCustomer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.editIcon, { color: colors.primary }]}>✏️</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <Avatar name={customer.name} size="large" />
          
          <Text style={styles.customerName}>{customer.name}</Text>
          
          <View style={styles.infoGrid}>
            {customer.phone && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>📱</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefone</Text>
                  <Text style={styles.infoValue}>{customer.phone}</Text>
                </View>
              </View>
            )}
            
            {customer.email && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>✉️</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{customer.email}</Text>
                </View>
              </View>
            )}
            
            {customer.address && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>📍</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Endereço</Text>
                  <Text style={styles.infoValue}>{customer.address}</Text>
                </View>
              </View>
            )}
            
            {customer.nif && (
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🆔</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>NIF</Text>
                  <Text style={styles.infoValue}>{customer.nif}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Pets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pets ({pets.length})</Text>
            <Button
              title="Adicionar"
              onPress={handleAddPet}
              variant="ghost"
              size="small"
              icon="+"
            />
          </View>

          {isLoadingPets ? (
            <View style={styles.petsLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : pets.length === 0 ? (
            <EmptyState
              icon="🐾"
              title="Nenhum pet"
              description="Adicione o primeiro pet deste cliente"
              actionLabel="Adicionar Pet"
              onAction={handleAddPet}
            />
          ) : (
            <View style={styles.petsList}>
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} onPress={() => handlePetPress(pet)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    petsLoadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    editIcon: {
      fontSize: 20,
    },
    customerCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      marginTop: 20,
      marginBottom: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    customerName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 24,
      textAlign: 'center',
    },
    infoGrid: {
      width: '100%',
      gap: 16,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
    },
    infoIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    petsList: {
      gap: 12,
    },
  });
}
