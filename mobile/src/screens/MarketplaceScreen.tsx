import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, EmptyState } from '../components/common';
import { getMarketplaceAccounts, MarketplaceAccount } from '../api/marketplace';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCardStyle } from '../theme/uiTokens';

type Props = NativeStackScreenProps<any>;

function useDebouncedValue(value: string, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MarketplaceScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['marketplaceAccounts', debouncedSearch],
    queryFn: () => getMarketplaceAccounts({ q: debouncedSearch || undefined }),
  });

  const renderItem = ({ item }: { item: MarketplaceAccount }) => {
    const categories = item.marketplace_categories || [];
    const description = item.marketplace_description || t('marketplace.cardFallback');
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('MarketplaceAccount', { slug: item.slug })}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>{item.name?.slice(0, 1) || 'P'}</Text>
            </View>
          )}
          <View style={styles.cardTitle}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </View>
        {categories.length > 0 && (
          <View style={styles.categoryRow}>
            {categories.slice(0, 3).map((category) => (
              <View key={category} style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{category}</Text>
              </View>
            ))}
          </View>
        )}
        <Button
          title={t('marketplace.viewAccount')}
          onPress={() => navigation.navigate('MarketplaceAccount', { slug: item.slug })}
          variant="outline"
          size="small"
          style={styles.cardButton}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('marketplace.title')} />
      <View style={styles.searchWrapper}>
        <TextInput
          placeholder={t('marketplace.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>
      {isLoading && accounts.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon="🐾"
          title={t('marketplace.emptyTitle')}
          description={t('marketplace.emptyDescription')}
        />
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  const cardBase = getCardStyle(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    searchWrapper: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    searchInput: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    loadingState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 40,
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.muted,
    },
    card: {
      ...cardBase,
      marginBottom: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    logo: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: colors.background,
    },
    logoFallback: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoFallbackText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
    },
    cardTitle: {
      flex: 1,
    },
    cardName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    categoryBadge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    cardButton: {
      marginTop: 14,
      alignSelf: 'flex-start',
    },
  });
}
