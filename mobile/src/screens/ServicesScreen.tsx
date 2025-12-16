import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getAllServices, Service } from '../api/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/common';

type Props = NativeStackScreenProps<any>;

export default function ServicesScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: services = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: getAllServices,
  });

  const filteredServices = useMemo(() => {
    if (!searchQuery) return services;
    const query = searchQuery.toLowerCase();
    return services.filter(
      (service) =>
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
    );
  }, [services, searchQuery]);

  const handleNewService = () => {
    navigation.navigate('ServiceForm', { mode: 'create' });
  };

  const handleEditService = (service: Service) => {
    navigation.navigate('ServiceForm', { mode: 'edit', serviceId: service.id });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Serviços" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Serviços" showBackButton />

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar serviços..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            {filteredServices.length} {filteredServices.length === 1 ? 'serviço' : 'serviços'}
          </Text>
        </View>

        {/* Services List */}
        {filteredServices.length === 0 ? (
          <EmptyState
            icon="🛠️"
            title="Nenhum serviço"
            subtitle={searchQuery ? 'Tenta outra pesquisa' : 'Adiciona o teu primeiro serviço'}
          />
        ) : (
          <FlatList
            data={filteredServices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.serviceCard}
                onPress={() => handleEditService(item)}
              >
                <View style={styles.serviceInfo}>
                  <View style={styles.serviceHeader}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    {!item.active && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inativo</Text>
                      </View>
                    )}
                  </View>
                  {item.description && (
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  <View style={styles.serviceDetails}>
                    {item.price && (
                      <Text style={styles.detailText}>💰 {item.price.toFixed(2)}€</Text>
                    )}
                    {item.default_duration && (
                      <Text style={styles.detailText}>⏱️ {item.default_duration}min</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
            refreshing={isRefetching}
            onRefresh={refetch}
          />
        )}
      </View>

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={handleNewService}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
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
      paddingHorizontal: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    stats: {
      paddingVertical: 12,
    },
    statsText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.muted,
    },
    listContent: {
      paddingBottom: 100,
    },
    serviceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    serviceInfo: {
      flex: 1,
      gap: 6,
    },
    serviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    serviceName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    inactiveBadge: {
      backgroundColor: colors.muted + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    inactiveBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
    },
    serviceDescription: {
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
    },
    serviceDetails: {
      flexDirection: 'row',
      gap: 16,
    },
    detailText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  });
}
