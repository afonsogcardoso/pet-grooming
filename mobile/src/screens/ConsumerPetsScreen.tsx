import { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/common';
import { ConsumerPet, getConsumerPets } from '../api/consumerPets';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

function formatWeight(weight?: number | null, label: string) {
  if (weight === null || weight === undefined) return null;
  return `${weight} ${label}`;
}

export default function ConsumerPetsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: pets = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['consumerPets'],
    queryFn: getConsumerPets,
  });

  const renderItem = ({ item }: { item: ConsumerPet }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ConsumerPetForm', { pet: item })}
      activeOpacity={0.8}
    >
      <Text style={styles.petName}>{item.name}</Text>
      {item.breed ? <Text style={styles.petMeta}>{item.breed}</Text> : null}
      {item.weight !== undefined && item.weight !== null ? (
        <Text style={styles.petMeta}>{formatWeight(item.weight, t('consumerPets.weightUnit'))}</Text>
      ) : null}
    </TouchableOpacity>
  );

  const rightElement = (
    <TouchableOpacity
      onPress={() => navigation.navigate('ConsumerPetForm')}
      style={[styles.addButton, { backgroundColor: colors.primary }]}
      activeOpacity={0.7}
    >
      <Text style={styles.addButtonText}>+</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t('consumerPets.title')} rightElement={rightElement} />
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t('consumerPets.title')} rightElement={rightElement} />
        <EmptyState
          icon="⚠️"
          title={t('consumerPets.errorTitle')}
          description={t('consumerPets.errorMessage')}
          actionLabel={t('consumerPets.retryAction')}
          onAction={() => refetch()}
        />
      </View>
    );
  }

  if (!pets.length) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t('consumerPets.title')} rightElement={rightElement} />
        <EmptyState
          icon="🐾"
          title={t('consumerPets.emptyTitle')}
          description={t('consumerPets.emptyMessage')}
          actionLabel={t('consumerPets.emptyAction')}
          onAction={() => navigation.navigate('ConsumerPetForm')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t('consumerPets.title')} rightElement={rightElement} />
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => refetch()}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    petName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    petMeta: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 4,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: {
      color: colors.onPrimary,
      fontSize: 22,
      fontWeight: '700',
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.muted,
    },
  });
}
