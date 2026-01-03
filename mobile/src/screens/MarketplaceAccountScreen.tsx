import { useMemo } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
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
import { getCardStyle } from '../theme/uiTokens';
import { Ionicons } from '@expo/vector-icons';

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
  const normalizeUrl = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };
  const websiteUrl = normalizeUrl(account?.marketplace_website_url);
  const socialLinks = useMemo(
    () =>
      [
        {
          key: 'instagram',
          label: t('marketplaceAccount.socialInstagram'),
          icon: 'logo-instagram',
          url: normalizeUrl(account?.marketplace_instagram_url),
        },
        {
          key: 'facebook',
          label: t('marketplaceAccount.socialFacebook'),
          icon: 'logo-facebook',
          url: normalizeUrl(account?.marketplace_facebook_url),
        },
        {
          key: 'tiktok',
          label: t('marketplaceAccount.socialTiktok'),
          icon: 'logo-tiktok',
          url: normalizeUrl(account?.marketplace_tiktok_url),
        },
        {
          key: 'website',
          label: t('marketplaceAccount.socialWebsite'),
          icon: 'globe-outline',
          url: websiteUrl,
        },
      ].filter((link) => Boolean(link.url)),
    [account, t, websiteUrl]
  );
  const primaryLink = websiteUrl || socialLinks[0]?.url || null;

  const handleRequest = (service: MarketplaceService) => {
    if (!account) return;
    navigation.navigate('MarketplaceRequest', {
      accountSlug: account.slug,
      accountName: account.name,
      serviceId: service.id,
      serviceName: service.name,
    });
  };

  const openExternalLink = async (url?: string | null) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('common.error'), t('marketplaceAccount.socialOpenError'));
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('Erro ao abrir link externo:', error);
      Alert.alert(t('common.error'), t('marketplaceAccount.socialOpenError'));
    }
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
            {account.portal_image_url ? (
              <Image
                source={{ uri: account.portal_image_url }}
                style={styles.heroCover}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.heroHeader}>
              <TouchableOpacity
                style={styles.heroLogoWrapper}
                onPress={() => openExternalLink(primaryLink)}
                disabled={!primaryLink}
              >
                {account.logo_url ? (
                  <Image source={{ uri: account.logo_url }} style={styles.heroLogo} />
                ) : (
                  <View style={styles.heroLogoFallback}>
                    <Text style={styles.heroLogoFallbackText}>
                      {account.name?.slice(0, 1) || 'P'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
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
            {socialLinks.length > 0 && (
              <View style={styles.socialSection}>
                <Text style={styles.socialTitle}>{t('marketplaceAccount.socialTitle')}</Text>
                <View style={styles.socialRow}>
                  {socialLinks.map((link) => (
                    <TouchableOpacity
                      key={link.key}
                      style={styles.socialButton}
                      onPress={() => openExternalLink(link.url)}
                    >
                      <Ionicons name={link.icon as any} size={16} color={colors.primary} />
                      <Text style={styles.socialText}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                {service.image_url ? (
                  <Image
                    source={{ uri: service.image_url }}
                    style={styles.serviceImage}
                    resizeMode="cover"
                  />
                ) : null}
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
  const cardBase = getCardStyle(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    heroCard: {
      ...cardBase,
      borderRadius: 16,
      padding: 20,
      marginBottom: 18,
    },
    heroCover: {
      width: '100%',
      height: 160,
      borderRadius: 18,
      marginBottom: 16,
      backgroundColor: colors.background,
    },
    heroHeader: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
    },
    heroLogoWrapper: {
      borderRadius: 20,
      overflow: 'hidden',
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
    socialSection: {
      marginTop: 16,
    },
    socialTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    socialRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.background,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    socialText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
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
      ...cardBase,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    serviceImage: {
      width: '100%',
      height: 140,
      borderRadius: 16,
      backgroundColor: colors.background,
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
