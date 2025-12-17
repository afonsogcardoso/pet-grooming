import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getAllServices, Service, updateServiceOrder } from '../api/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/common';
import SwipeableRow from '../components/common/SwipeableRow';
import { deleteService } from '../api/services';

type Props = NativeStackScreenProps<any>;

export default function ServicesScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [localServices, setLocalServices] = useState<Service[]>([]);
  const queryClient = useQueryClient();

  const { data: services = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: getAllServices,
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', 'all'] }),
    onError: (err: any) => Alert.alert('Erro', err?.response?.data?.error || err.message || 'Erro ao apagar serviço'),
  });

  // Sync local services with API data
  useState(() => {
    if (services.length > 0 && localServices.length === 0) {
      setLocalServices(services);
    }
  });

  // Update local services when API data changes
  useMemo(() => {
    if (services.length > 0) {
      setLocalServices(services);
    }
  }, [services]);

  const updateOrderMutation = useMutation({
    mutationFn: updateServiceOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível atualizar a ordem dos serviços');
      setLocalServices(services); // Revert to original order
    },
  });

  const filteredServices = useMemo(() => {
    const data = localServices.length > 0 ? localServices : services;
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (service) =>
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
    );
  }, [localServices, services, searchQuery]);

  const handleNewService = () => {
    navigation.navigate('ServiceForm', { mode: 'create' });
  };

  const handleEditService = (service: Service) => {
    navigation.navigate('ServiceForm', { mode: 'edit', serviceId: service.id });
  };

  const handleDragEnd = ({ data }: { data: Service[] }) => {
    // Update local state immediately for smooth UX
    setLocalServices(data);

    // Prepare updates with new display_order
    const updates = data.map((service, index) => ({
      id: service.id,
      display_order: index,
    }));

    // Send to API
    updateOrderMutation.mutate(updates);
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

  const renderServiceItem = ({ item, drag, isActive }: RenderItemParams<Service>) => {
    return (
      <ScaleDecorator>
        {isEditMode ? (
          <TouchableOpacity
            style={[styles.serviceCard, isActive && styles.serviceCardDragging]}
            onPress={isEditMode ? undefined : () => handleEditService(item)}
            onLongPress={isEditMode && !searchQuery ? drag : undefined}
            disabled={isActive}
            activeOpacity={isEditMode ? 1 : 0.7}
          >
            {isEditMode && !searchQuery && (
              <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
                <Ionicons name="menu" size={24} color={colors.muted} />
              </TouchableOpacity>
            )}
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
            {!isEditMode && <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
          </TouchableOpacity>
        ) : (
          <SwipeableRow onDelete={() => {
            Alert.alert('Apagar serviço', `Apagar ${item.name}?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => deleteServiceMutation.mutate(item.id) },
            ]);
          }}>
            <TouchableOpacity
              style={[styles.serviceCard, isActive && styles.serviceCardDragging]}
              onPress={() => handleEditService(item)}
              onLongPress={isEditMode && !searchQuery ? drag : undefined}
              disabled={isActive}
              activeOpacity={0.7}
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
              {!isEditMode && <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
            </TouchableOpacity>
          </SwipeableRow>
        )}
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader 
          title="Serviços" 
          showBackButton
          rightElement={
            filteredServices.length > 1 && !searchQuery ? (
              <TouchableOpacity 
                onPress={() => setIsEditMode(!isEditMode)}
                style={{ paddingHorizontal: 8 }}
              >
                <Text style={{ fontSize: 24 }}>
                  {isEditMode ? '✓' : '✏️'}
                </Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

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

          {/* Stats & Instructions */}
          <View style={styles.stats}>
            <Text style={styles.statsText}>
              {filteredServices.length} {filteredServices.length === 1 ? 'serviço' : 'serviços'}
            </Text>
            {isEditMode && !searchQuery && filteredServices.length > 1 && (
              <Text style={styles.hintText}>Arrasta para reorganizar</Text>
            )}
          </View>

          {/* Services List */}
          {filteredServices.length === 0 ? (
            <EmptyState
              icon="🛠️"
              title="Nenhum serviço"
              subtitle={searchQuery ? 'Tenta outra pesquisa' : 'Adiciona o teu primeiro serviço'}
            />
          ) : (
            <DraggableFlatList
              data={filteredServices}
              keyExtractor={(item) => item.id}
              renderItem={renderServiceItem}
              onDragEnd={isEditMode && !searchQuery ? handleDragEnd : undefined}
              contentContainerStyle={styles.listContent}
              activationDistance={20}
            />
          )}
        </View>

        {/* Floating Add Button */}
        <TouchableOpacity style={styles.fab} onPress={handleNewService}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </GestureHandlerRootView>
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
    hintText: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 4,
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
    serviceCardDragging: {
      opacity: 0.9,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 10,
    },
    dragHandle: {
      padding: 4,
      marginRight: 4,
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
    editButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    editButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
