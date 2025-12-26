import { useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                <Text style={styles.serviceName}>{service.name}</Text>
                {service.description ? (
                  <Text style={styles.serviceDescription} numberOfLines={2}>
                    {service.description}
                  </Text>
                ) : null}
                <View style={styles.serviceMetaRow}>
                  {price ? (
                    <Text style={styles.servicePrice}>{price}</Text>
                  ) : (
                    <Text style={styles.servicePriceMuted}>
                      {t('marketplace.priceOnRequest')}
                    </Text>
                  )}
                  {service.default_duration ? (
                    <Text style={styles.serviceDuration}>
                      {service.default_duration} {t('common.minutesShort')}
                    </Text>
                  ) : null}
                </View>
                <Button
                  title={t('marketplace.requestAction')}
                  onPress={() => handleRequest(service)}
                  size="small"
                  style={styles.serviceButton}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
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
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
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
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
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
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    servicesGrid: {
      gap: 14,
    },
    serviceCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    serviceName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    serviceDescription: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 6,
      lineHeight: 18,
    },
    serviceMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    servicePrice: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    servicePriceMuted: {
      fontSize: 13,
      color: colors.muted,
    },
    serviceDuration: {
      fontSize: 13,
      color: colors.muted,
    },
    serviceButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
    },
  });
}
