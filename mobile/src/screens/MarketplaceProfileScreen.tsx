import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Input } from '../components/common';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { Branding, getBranding, updateBranding, uploadBrandLogo, uploadPortalImage } from '../api/branding';

export default function MarketplaceProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: branding, isLoading, error } = useQuery({
    queryKey: ['branding'],
    queryFn: () => getBranding(),
    staleTime: 1000 * 60 * 2,
    initialData: () => queryClient.getQueryData<Branding>(['branding']),
    placeholderData: () => queryClient.getQueryData<Branding>(['branding']),
  });

  const applyBranding = (data?: Branding | null) => {
    if (!data) return;
    setName(data.account_name || '');
    setDescription(data.marketplace_description || '');
    setRegion(data.marketplace_region || '');
    setInstagram(data.marketplace_instagram_url || '');
    setFacebook(data.marketplace_facebook_url || '');
    setTiktok(data.marketplace_tiktok_url || '');
    setWebsite(data.marketplace_website_url || '');
    setLogoUrl(data.logo_url || null);
    setHeroImageUrl(data.portal_image_url || null);
  };

  useEffect(() => {
    if (!initialized && branding) {
      applyBranding(branding);
      setInitialized(true);
    }
  }, [branding, initialized]);

  const updateMutation = useMutation({
    mutationFn: updateBranding,
    onSuccess: (updated) => {
      queryClient.setQueryData(['branding'], updated);
      applyBranding(updated);
    },
    onError: () => Alert.alert(t('common.error'), t('marketplaceProfile.updateError')),
  });

  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('profile.cameraPermissionTitle'),
            message: t('profile.cameraPermissionMessage'),
            buttonNeutral: t('common.later'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const uploadLogoFromUri = async (uri: string, fileName?: string | null) => {
    try {
      setUploadingLogo(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
      const filename = `logo-${timestamp}.${extension}`;
      const fileType = `image/${safeExtension}`;

      formData.append('file', {
        uri,
        type: fileType,
        name: filename,
      } as any);

      const { url } = await uploadBrandLogo(formData);
      const updated = await updateBranding({ logo_url: url });
      queryClient.setQueryData(['branding'], updated);
      applyBranding(updated);
    } catch (err) {
      console.error('Erro ao carregar logotipo:', err);
      Alert.alert(t('common.error'), t('marketplaceProfile.logoUploadError'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadHeroImageFromUri = async (uri: string, fileName?: string | null) => {
    try {
      setUploadingHeroImage(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
      const filename = `portal-${timestamp}.${extension}`;
      const fileType = `image/${safeExtension}`;

      formData.append('file', {
        uri,
        type: fileType,
        name: filename,
      } as any);

      const { url } = await uploadPortalImage(formData);
      const updated = await updateBranding({ portal_image_url: url });
      queryClient.setQueryData(['branding'], updated);
      applyBranding(updated);
    } catch (err) {
      console.error('Erro ao carregar imagem de capa:', err);
      Alert.alert(t('common.error'), t('marketplaceProfile.heroUploadError'));
    } finally {
      setUploadingHeroImage(false);
    }
  };

  const openCamera = async (
    onSelected: (uri: string, fileName?: string | null) => Promise<void>
  ) => {
    const hasPermission = await requestAndroidPermissions();
    if (!hasPermission) {
      Alert.alert(t('profile.cameraPermissionDeniedTitle'), t('profile.cameraPermissionDeniedMessage'));
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
      saveToPhotos: false,
    };

    launchCamera(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Erro ao abrir camera:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openCameraError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await onSelected(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const openGallery = async (
    onSelected: (uri: string, fileName?: string | null) => Promise<void>
  ) => {
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
      selectionLimit: 1,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Erro ao abrir galeria:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openGalleryError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await onSelected(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const pickImage = (onSelected: (uri: string, fileName?: string | null) => Promise<void>) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('profile.takePhoto'), t('profile.chooseFromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera(onSelected);
          } else if (buttonIndex === 2) {
            openGallery(onSelected);
          }
        }
      );
    } else {
      Alert.alert(
        t('profile.choosePhotoTitle'),
        t('profile.choosePhotoMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.takePhoto'), onPress: () => openCamera(onSelected) },
          { text: t('profile.chooseFromGallery'), onPress: () => openGallery(onSelected) },
        ]
      );
    }
  };

  const pickLogo = () => pickImage(uploadLogoFromUri);
  const pickHeroImage = () => pickImage(uploadHeroImageFromUri);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert(t('common.warning'), t('marketplaceProfile.nameRequired'));
      return;
    }

    updateMutation.mutate({
      name: trimmedName,
      marketplace_region: region.trim() || null,
      marketplace_description: description.trim() || null,
      marketplace_instagram_url: instagram.trim() || null,
      marketplace_facebook_url: facebook.trim() || null,
      marketplace_tiktok_url: tiktok.trim() || null,
      marketplace_website_url: website.trim() || null,
    });
  };

  const logoFallback = name.trim().charAt(0).toUpperCase() || 'P';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('marketplaceProfile.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
        {error ? <Text style={styles.errorText}>{t('marketplaceProfile.loadError')}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('marketplaceProfile.logoTitle')}</Text>
          <View style={styles.logoRow}>
            <TouchableOpacity style={styles.logo} onPress={pickLogo} disabled={uploadingLogo}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} />
              ) : (
                <Text style={styles.logoFallback}>{logoFallback}</Text>
              )}
              {uploadingLogo ? (
                <View style={styles.logoLoading}>
                  <ActivityIndicator color={colors.onPrimary} />
                </View>
              ) : (
                <View style={styles.logoBadge}>
                  <Text style={styles.logoBadgeText}>📸</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.logoInfo}>
              <Text style={styles.logoLabel}>{t('marketplaceProfile.logoHelper')}</Text>
              <Button
                title={t('marketplaceProfile.changeLogo')}
                onPress={pickLogo}
                variant="outline"
                size="small"
                disabled={uploadingLogo}
                style={styles.logoButton}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('marketplaceProfile.heroTitle')}</Text>
          <TouchableOpacity
            style={styles.heroPreview}
            onPress={pickHeroImage}
            disabled={uploadingHeroImage}
          >
            {heroImageUrl ? (
              <Image source={{ uri: heroImageUrl }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Text style={styles.heroPlaceholderText}>
                  {t('marketplaceProfile.heroPlaceholder')}
                </Text>
              </View>
            )}
            {uploadingHeroImage ? (
              <View style={styles.heroLoading}>
                <ActivityIndicator color={colors.onPrimary} />
              </View>
            ) : null}
          </TouchableOpacity>
          <Text style={styles.heroHelper}>{t('marketplaceProfile.heroHelper')}</Text>
          <Button
            title={t('marketplaceProfile.changeHero')}
            onPress={pickHeroImage}
            variant="outline"
            size="small"
            disabled={uploadingHeroImage}
            style={styles.heroButton}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('marketplaceProfile.businessSection')}</Text>
          <Input
            label={t('marketplaceProfile.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('marketplaceProfile.namePlaceholder')}
          />
          <Input
            label={t('marketplaceProfile.regionLabel')}
            value={region}
            onChangeText={setRegion}
            placeholder={t('marketplaceProfile.regionPlaceholder')}
          />
          <Input
            label={t('marketplaceProfile.descriptionLabel')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('marketplaceProfile.descriptionPlaceholder')}
            multiline
            numberOfLines={4}
            style={styles.textArea}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('marketplaceProfile.socialTitle')}</Text>
          <Input
            label={t('marketplaceProfile.instagramLabel')}
            value={instagram}
            onChangeText={setInstagram}
            placeholder={t('marketplaceProfile.instagramPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('marketplaceProfile.facebookLabel')}
            value={facebook}
            onChangeText={setFacebook}
            placeholder={t('marketplaceProfile.facebookPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('marketplaceProfile.tiktokLabel')}
            value={tiktok}
            onChangeText={setTiktok}
            placeholder={t('marketplaceProfile.tiktokPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('marketplaceProfile.websiteLabel')}
            value={website}
            onChangeText={setWebsite}
            placeholder={t('marketplaceProfile.websitePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <Button
          title={t('marketplaceProfile.saveAction')}
          onPress={handleSave}
          loading={updateMutation.isPending}
          disabled={updateMutation.isPending || uploadingLogo || uploadingHeroImage}
          style={styles.saveButton}
        />
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
      paddingHorizontal: 20,
      paddingBottom: 32,
    },
    loading: {
      marginVertical: 12,
    },
    errorText: {
      color: colors.danger,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
    },
    logoFallback: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
    },
    logoInfo: {
      flex: 1,
    },
    logoLabel: {
      color: colors.muted,
      fontSize: 13,
      marginBottom: 8,
    },
    logoButton: {
      alignSelf: 'flex-start',
    },
    logoBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      backgroundColor: colors.primary,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    logoBadgeText: {
      fontSize: 12,
    },
    logoLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroPreview: {
      height: 140,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      overflow: 'hidden',
      marginBottom: 10,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    heroPlaceholderText: {
      color: colors.muted,
      fontSize: 13,
      textAlign: 'center',
    },
    heroLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroHelper: {
      color: colors.muted,
      fontSize: 13,
      marginBottom: 8,
    },
    heroButton: {
      alignSelf: 'flex-start',
    },
    textArea: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    saveButton: {
      marginTop: 4,
    },
  });
}
