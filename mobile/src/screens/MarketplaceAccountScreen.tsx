import { useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/common';
import {
  getMarketplaceAccount,
  getMarketplaceAccountServices,
  MarketplaceService,
} from '../api/marketplace';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

function formatPrice(value?: number | null) {
  if (value === undefined || value === null) return null;
  const rounded = Math.round(value);
  return `€${rounded}`;
}

export default function MarketplaceAccountScreen({ route, navigation }: Props) {
  const { slug } = route.params as { slug: string };
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: account } = useQuery({
    queryKey: ['marketplaceAccount', slug],
    queryFn: () => getMarketplaceAccount(slug),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['marketplaceAccountServices', slug],
    queryFn: () => getMarketplaceAccountServices(slug),
  });

  const categories = account?.marketplace_categories || [];

  const handleRequest = (service: MarketplaceService) => {
    if (!account) return;
    navigation.navigate('MarketplaceRequest', {
      accountSlug: account.slug,
      accountName: account.name,
      serviceId: service.id,
      serviceName: service.name,
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={account?.name || t('marketplaceAccount.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {account ? (
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              {account.logo_url ? (
                <Image source={{ uri: account.logo_url }} style={styles.heroLogo} />
              ) : (
                <View style={styles.heroLogoFallback}>
                  <Text style={styles.heroLogoFallbackText}>
                    {account.name?.slice(0, 1) || 'P'}
                  </Text>
                </View>
              )}
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>{account.name}</Text>
                <Text style={styles.heroSubtitle}>
                  {account.marketplace_description || t('marketplace.cardFallback')}
                </Text>
              </View>
            </View>
            {categories.length > 0 && (
              <View style={styles.categoryRow}>
                {categories.map((category) => (
                  <View key={category} style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{category}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t('marketplaceAccount.servicesTitle')}</Text>
        <View style={styles.servicesGrid}>
          {services.map((service) => {
            const price = formatPrice(service.price);
            return (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.serviceHeader}>
                  <Text style={styles.serviceName} numberOfLines={2}>
                    {service.name}
                  </Text>
                  {price ? (
                    <View style={styles.pricePill}>
                      <Text style={styles.priceText}>{price}</Text>
                    </View>
                  ) : (
                    <View style={styles.pricePillMuted}>
                      <Text style={styles.priceTextMuted}>
                        {t('marketplace.priceOnRequest')}
                      </Text>
                    </View>
                  )}
                </View>
                {service.description ? (
                  <Text style={styles.serviceDescription} numberOfLines={2}>
                    {service.description}
                  </Text>
                ) : null}
                {service.default_duration ? (
                  <View style={styles.serviceMetaRow}>
                    <View style={styles.durationPill}>
                      <Text style={styles.durationText}>
                        {service.default_duration} {t('common.minutesShort')}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <Button
                  title={t('marketplace.requestAction')}
                  onPress={() => handleRequest(service)}
                  size="small"
                  variant="primary"
                  style={styles.serviceButton}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
      marginBottom: 18,
    },
    heroHeader: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
    },
    heroLogo: {
      width: 62,
      height: 62,
      borderRadius: 20,
      backgroundColor: colors.background,
    },
    heroLogoFallback: {
      width: 62,
      height: 62,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroLogoFallbackText: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.primary,
    },
    heroText: {
      flex: 1,
    },
    heroTitle: {
      fontSize: 21,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    categoryBadge: {
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 12,
    },
    servicesGrid: {
      gap: 16,
    },
    serviceCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
      gap: 8,
    },
    serviceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    serviceName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    serviceDescription: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    serviceMetaRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 8,
    },
    pricePill: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    priceText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    pricePillMuted: {
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    priceTextMuted: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    durationPill: {
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    durationText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    serviceButton: {
      marginTop: 4,
      alignSelf: 'stretch',
    },
  });
}
