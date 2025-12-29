import { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, ScrollView, Image } from 'react-native';
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
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<any>;

export default function ServicesScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [localServices, setLocalServices] = useState<Service[]>([]);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: getAllServices,
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', 'all'] }),
    onError: (err: any) =>
      Alert.alert(t('common.error'), err?.response?.data?.error || err.message || t('services.deleteError')),
  });

  const updateOrderMutation = useMutation({
    mutationFn: updateServiceOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services', 'all'] }),
    onError: () => {
      Alert.alert(t('common.error'), t('services.updateOrderError'));
      setLocalServices(services);
    },
  });

  // keep a local copy for optimistic reordering
  // guard updates by comparing service ids to avoid repeated setState loops
  const lastServicesIdsRef = useRef<string | null>(null);
  useEffect(() => {
    const ids = (services || []).map((s) => s.id).join(',');
    if (lastServicesIdsRef.current !== ids) {
      lastServicesIdsRef.current = ids;
      setLocalServices(services || []);
    }
  }, [services]);

  const filteredServices = useMemo(() => {
    const data = localServices.length > 0 ? localServices : services;
    const q = searchQuery.toLowerCase().trim();
    return data.filter((service) => {
      if (selectedCategory && service.category !== selectedCategory) return false;
      if (selectedSubcategory && service.subcategory !== selectedSubcategory) return false;
      if (!q) return true;
      return (
        service.name.toLowerCase().includes(q) ||
        (service.description || '').toLowerCase().includes(q)
      );
    });
  }, [localServices, services, searchQuery, selectedCategory, selectedSubcategory]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        (services || [])
          .map((service) => service.category)
          .filter((value) => typeof value === 'string' && value.trim().length > 0)
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));
  }, [services]);

  const subcategories = useMemo(() => {
    const source = selectedCategory
      ? (services || []).filter((service) => service.category === selectedCategory)
      : (services || []);
    return Array.from(
      new Set(
        source
          .map((service) => service.subcategory)
          .filter((value) => typeof value === 'string' && value.trim().length > 0)
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));
  }, [services, selectedCategory]);

  const handleNewService = () => navigation.navigate('ServiceForm', { mode: 'create' });
  const handleEditService = (service: Service) => navigation.navigate('ServiceForm', { mode: 'edit', serviceId: service.id });

  const handleDragEnd = ({ data }: { data: Service[] }) => {
    setLocalServices(data);
    const updates = data.map((service, index) => ({ id: service.id, display_order: index }));
    updateOrderMutation.mutate(updates);
  };

  const renderServiceItem = ({ item, drag, isActive }: RenderItemParams<Service>) => {
    return (
      <ScaleDecorator>
        <SwipeableRow
          onDelete={() =>
            Alert.alert(t('services.deleteTitle'), t('services.deletePrompt', { name: item.name }), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('services.deleteAction'), style: 'destructive', onPress: () => deleteServiceMutation.mutate(item.id) },
            ])
          }
        >
          <TouchableOpacity
            style={[styles.serviceCard, isActive && styles.serviceCardDragging]}
            onPress={() => handleEditService(item)}
            onLongPress={!searchQuery ? drag : undefined}
            disabled={isActive}
            activeOpacity={0.7}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.serviceImage} />
            ) : (
              <View style={styles.serviceImagePlaceholder}>
                <Ionicons name="image-outline" size={18} color={colors.muted} />
              </View>
            )}
            <View style={styles.serviceInfo}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceName}>{item.name}</Text>
                {!item.active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>{t('services.inactive')}</Text>
                  </View>
                )}
              </View>
              {item.description && (
                <Text style={styles.serviceDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              {(item.category || item.subcategory) && (
                <View style={styles.tagRow}>
                  {item.category && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{item.category}</Text>
                    </View>
                  )}
                  {item.subcategory && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{item.subcategory}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.serviceDetails}>
                {item.price != null && <Text style={styles.detailText}>💰 {item.price.toFixed(2)}€</Text>}
                {item.default_duration != null && (
                  <Text style={styles.detailText}>⏱️ {item.default_duration}{t('common.minutesShort')}</Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        </SwipeableRow>
      </ScaleDecorator>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title={t('services.title')} showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader
          title={t('services.title')}
          showBackButton
          rightElement={
            <TouchableOpacity onPress={handleNewService} style={styles.actionButton} activeOpacity={0.7}>
              <Text style={styles.actionButtonText}>+</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.content}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 8 }} />
            <TextInput
              placeholder={t('services.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {categories.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>{t('services.filters.categoryLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedCategory && styles.chipActive]}
                  onPress={() => {
                    setSelectedCategory('');
                    setSelectedSubcategory('');
                  }}
                >
                  <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
                    {t('services.filters.all')}
                  </Text>
                </TouchableOpacity>
                {categories.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        setSelectedCategory(active ? '' : category);
                        setSelectedSubcategory('');
                      }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {subcategories.length > 0 && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>{t('services.filters.subcategoryLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedSubcategory && styles.chipActive]}
                  onPress={() => setSelectedSubcategory('')}
                >
                  <Text style={[styles.chipText, !selectedSubcategory && styles.chipTextActive]}>
                    {t('services.filters.all')}
                  </Text>
                </TouchableOpacity>
                {subcategories.map((subcategory) => {
                  const active = selectedSubcategory === subcategory;
                  return (
                    <TouchableOpacity
                      key={subcategory}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setSelectedSubcategory(active ? '' : subcategory)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {subcategory}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {filteredServices.length === 0 ? (
            <EmptyState
              icon={searchQuery ? '🔍' : '🛎️'}
              title={searchQuery ? t('services.emptySearchTitle') : t('services.emptyTitle')}
              description={
                searchQuery ? t('services.emptySearchDescription') : t('services.emptyDescription')
              }
              actionLabel={!searchQuery ? t('services.addService') : undefined}
              onAction={!searchQuery ? handleNewService : undefined}
            />
          ) : (
            <DraggableFlatList
              data={filteredServices}
              onDragEnd={handleDragEnd}
              keyExtractor={(item) => item.id}
              renderItem={renderServiceItem}
              activationDistance={10}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
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
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    filterGroup: {
      marginBottom: 12,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    chipTextActive: {
      color: colors.primary,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
    },
    serviceImage: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    serviceImagePlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceCardDragging: {
      opacity: 0.95,
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
    tagRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    tagText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    detailText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
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
