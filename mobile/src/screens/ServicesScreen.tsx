import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getAllServices, Service } from '../api/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/common';
import { UndoToast } from '../components/common/UndoToast';
import SwipeableRow from '../components/common/SwipeableRow';
import { deleteService } from '../api/services';
import { useTranslation } from 'react-i18next';
import { hapticError, hapticSuccess, hapticWarning } from '../utils/haptics';
import { getCardStyle } from '../theme/uiTokens';
import { useSwipeDeleteIndicator } from '../hooks/useSwipeDeleteIndicator';

type Props = NativeStackScreenProps<any>;
type DeletePayload = {
  service: Service;
  index: number;
};
const UNDO_TIMEOUT_MS = 4000;

export default function ServicesScreen({ navigation }: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const undoBottomOffset = tabBarHeight > 0 ? tabBarHeight : insets.bottom + 16;
  const [undoVisible, setUndoVisible] = useState(false);
  const { deletingId, beginDelete, clearDeletingId } = useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePayload | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: getAllServices,
  });

  const restoreService = useCallback((payload: DeletePayload) => {
    queryClient.setQueryData(['services', 'all'], (old: Service[] | undefined) => {
      if (!old) return old;
      if (old.some((item) => item.id === payload.service.id)) return old;
      const nextItems = [...old];
      const insertIndex = Math.min(Math.max(payload.index, 0), nextItems.length);
      nextItems.splice(insertIndex, 0, payload.service);
      return nextItems;
    });
  }, [queryClient]);

  const deleteServiceMutation = useMutation({
    mutationFn: ({ service }: DeletePayload) => deleteService(service.id),
    onSuccess: () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ['services', 'all'] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables) {
        restoreService(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({ queryKey: ['services', 'all'] });
      }
      Alert.alert(t('common.error'), err?.response?.data?.error || err.message || t('services.deleteError'));
    },
  });

  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    deleteServiceMutation.mutate(pending);
  }, [clearDeletingId, deleteServiceMutation]);

  const startOptimisticDelete = useCallback((service: Service) => {
    if (pendingDeleteRef.current) {
      commitPendingDelete();
    }

    const cached = queryClient.getQueryData<Service[]>(['services', 'all']);
    const index = cached ? cached.findIndex((item) => item.id === service.id) : -1;

    queryClient.setQueryData(['services', 'all'], (old: Service[] | undefined) => {
      if (!old) return old;
      if (!old.some((item) => item.id === service.id)) return old;
      return old.filter((item) => item.id !== service.id);
    });

    pendingDeleteRef.current = { service, index: Math.max(index, 0) };
    setUndoVisible(true);
  }, [commitPendingDelete, queryClient]);

  const handleUndo = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    restoreService(pending);
  }, [clearDeletingId, restoreService]);

  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      pendingDeleteRef.current = null;
      deleteServiceMutation.mutate(pending);
    };
  }, [deleteServiceMutation]);

  const filteredServices = useMemo(() => {
    const data = (services || [])
      .slice()
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const q = searchQuery.toLowerCase().trim();
    return data.filter((service) => {
      if (!q) return true;
      const searchValues = [
        service.name,
        service.description,
        service.category,
        service.subcategory,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());
      return searchValues.some((value) => value.includes(q));
    });
  }, [services, searchQuery]);

  const handleNewService = () => navigation.navigate('ServiceForm', { mode: 'create' });
  const handleEditService = (service: Service) => navigation.navigate('ServiceForm', { mode: 'edit', serviceId: service.id });

  const renderServiceItem = ({ item }: { item: Service }) => (
    <SwipeableRow
      isDeleting={item.id === deletingId}
      onDelete={() =>
        Alert.alert(t('services.deleteTitle'), t('services.deletePrompt', { name: item.name }), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('services.deleteAction'),
            style: 'destructive',
            onPress: () => {
              hapticWarning();
              beginDelete(item.id, () => startOptimisticDelete(item));
            },
          },
        ])
      }
    >
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => handleEditService(item)}
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
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title={t('services.title')} showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <UndoToast
          visible={undoVisible}
          message={t('services.deleteUndoMessage')}
          actionLabel={t('services.deleteUndoAction')}
          onAction={handleUndo}
          onTimeout={commitPendingDelete}
          onDismiss={commitPendingDelete}
          durationMs={UNDO_TIMEOUT_MS}
          bottomOffset={undoBottomOffset}
        />
      </SafeAreaView>
    );
  }

  return (
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
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                placeholder={t('services.searchPlaceholder')}
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
            <FlatList
              data={filteredServices}
              keyExtractor={(item) => item.id}
              renderItem={renderServiceItem}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
        <UndoToast
          visible={undoVisible}
          message={t('services.deleteUndoMessage')}
          actionLabel={t('services.deleteUndoAction')}
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
  const cardBase = getCardStyle(colors);
  const listCardBase = {
    ...cardBase,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    shadowOpacity: 0.05,
    elevation: 3,
  };
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
    serviceCard: {
      ...listCardBase,
      flexDirection: 'row',
      alignItems: 'center',
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
