import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import {
  getAllServices,
  createService,
  updateService,
  deleteService,
  uploadServiceImage,
  getServicePriceTiers,
  createServicePriceTier,
  deleteServicePriceTier,
  getServiceAddons,
  createServiceAddon,
  deleteServiceAddon,
  Service,
  ServicePriceTier,
  ServiceAddon,
} from '../api/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input, Button } from '../components/common';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';

type Props = NativeStackScreenProps<any, 'ServiceForm'>;

export default function ServiceFormScreen({ route, navigation }: Props) {
  const { mode, serviceId } = route.params as { mode: 'create' | 'edit'; serviceId?: string };
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [petType, setPetType] = useState('');
  const [pricingModel, setPricingModel] = useState('');
  const [active, setActive] = useState(true);
  const [serviceImageUrl, setServiceImageUrl] = useState<string | null>(null);
  const [uploadingServiceImage, setUploadingServiceImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tierLabel, setTierLabel] = useState('');
  const [tierMinWeight, setTierMinWeight] = useState('');
  const [tierMaxWeight, setTierMaxWeight] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [tierOrder, setTierOrder] = useState('');
  const [addonName, setAddonName] = useState('');
  const [addonDescription, setAddonDescription] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonOrder, setAddonOrder] = useState('');
  const [addonActive, setAddonActive] = useState(true);

  const { data: services = [] } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: getAllServices,
    enabled: mode === 'edit',
  });

  const service = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (mode === 'edit' && service) {
      setName(service.name || '');
      setDescription(service.description || '');
      setPrice(service.price?.toString() || '');
      setDuration(service.default_duration?.toString() || '');
      setDisplayOrder(service.display_order?.toString() || '0');
      setCategory(service.category || '');
      setSubcategory(service.subcategory || '');
      setPetType(service.pet_type || '');
      setPricingModel(service.pricing_model || '');
      setActive(service.active !== false);
      setServiceImageUrl(service.image_url || null);
    } else if (mode === 'create') {
      setServiceImageUrl(null);
    }
  }, [mode, service]);

  const { data: priceTiers = [] } = useQuery({
    queryKey: ['services', serviceId, 'price-tiers'],
    queryFn: () => getServicePriceTiers(serviceId || ''),
    enabled: mode === 'edit' && !!serviceId,
  });

  const { data: addons = [] } = useQuery({
    queryKey: ['services', serviceId, 'addons'],
    queryFn: () => getServiceAddons(serviceId || ''),
    enabled: mode === 'edit' && !!serviceId,
  });

  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigation.goBack();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.createError'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Service> }) => updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigation.goBack();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.updateError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigation.goBack();
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.deleteError'));
    },
  });

  const createTierMutation = useMutation({
    mutationFn: (payload: Omit<ServicePriceTier, 'id' | 'service_id'>) =>
      createServicePriceTier(serviceId || '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', serviceId, 'price-tiers'] });
      setTierLabel('');
      setTierMinWeight('');
      setTierMaxWeight('');
      setTierPrice('');
      setTierOrder('');
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.tierCreateError'));
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: (tierId: string) => deleteServicePriceTier(serviceId || '', tierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', serviceId, 'price-tiers'] });
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.tierDeleteError'));
    },
  });

  const createAddonMutation = useMutation({
    mutationFn: (payload: Omit<ServiceAddon, 'id' | 'service_id'>) =>
      createServiceAddon(serviceId || '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', serviceId, 'addons'] });
      setAddonName('');
      setAddonDescription('');
      setAddonPrice('');
      setAddonOrder('');
      setAddonActive(true);
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.addonCreateError'));
    },
  });

  const deleteAddonMutation = useMutation({
    mutationFn: (addonId: string) => deleteServiceAddon(serviceId || '', addonId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', serviceId, 'addons'] });
    },
    onError: () => {
      Alert.alert(t('common.error'), t('serviceForm.addonDeleteError'));
    },
  });

  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const cameraGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        const storageGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        );
        return cameraGranted === PermissionsAndroid.RESULTS.GRANTED &&
          storageGranted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const uploadImageFromUri = async (uri: string, fileName?: string | null) => {
    if (mode === 'create' || !serviceId) {
      Alert.alert(t('common.warning'), t('serviceForm.imageSaveFirst'));
      return;
    }

    try {
      setUploadingServiceImage(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const safeExtension = extension === 'jpg' ? 'jpeg' : extension;
      const filename = `service-${serviceId}-${timestamp}.${extension}`;
      const fileType = `image/${safeExtension}`;

      formData.append('file', {
        uri,
        name: filename,
        type: fileType,
      } as any);

      const { url } = await uploadServiceImage(serviceId, formData);
      setServiceImageUrl(url || null);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['services', serviceId] });
    } catch (error) {
      console.error('Erro ao carregar imagem do serviço:', error);
      Alert.alert(t('common.error'), t('serviceForm.imageUploadError'));
    } finally {
      setUploadingServiceImage(false);
    }
  };

  const openCamera = async () => {
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
        console.error('Erro ao abrir câmara:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openCameraError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadImageFromUri(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const openGallery = async () => {
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
        await uploadImageFromUri(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const pickServiceImage = () => {
    if (mode === 'create' || !serviceId) {
      Alert.alert(t('common.warning'), t('serviceForm.imageSaveFirst'));
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('profile.takePhoto'), t('profile.chooseFromGallery')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera();
          } else if (buttonIndex === 2) {
            openGallery();
          }
        }
      );
    } else {
      Alert.alert(
        t('profile.choosePhotoTitle'),
        t('profile.choosePhotoMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.takePhoto'), onPress: openCamera },
          { text: t('profile.chooseFromGallery'), onPress: openGallery },
        ]
      );
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('serviceForm.validationNameRequired');
    }

    if (price) {
      const parsedPrice = Number(String(price).replace(',', '.'));
      if (isNaN(parsedPrice)) {
        newErrors.price = t('serviceForm.validationPriceInvalid');
      }
    }

    if (duration && isNaN(Number(duration))) {
      newErrors.duration = t('serviceForm.validationDurationInvalid');
    }
    if (duration) {
      const d = Number(duration);
      if (d < 5 || d > 600) {
        newErrors.duration = t('serviceForm.validationDurationRange');
      } else if (d % 5 !== 0) {
        newErrors.duration = t('serviceForm.validationDurationStep');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const serviceData = {
      name: name.trim(),
      description: description.trim() || null,
      price: price ? Number(String(price).replace(',', '.')) : null,
      default_duration: duration ? Number(duration) : null,
      display_order: displayOrder ? Number(displayOrder) : 0,
      category: category.trim() || null,
      subcategory: subcategory.trim() || null,
      pet_type: petType.trim() || null,
      pricing_model: pricingModel.trim() || null,
      active,
    };

    if (mode === 'create') {
      createMutation.mutate(serviceData);
    } else if (serviceId) {
      updateMutation.mutate({ id: serviceId, data: serviceData });
    }
  };

  const parseNumber = (value: string) => {
    if (!value) return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isNaN(parsed) ? null : parsed;
  };

  const handleAddTier = () => {
    if (!serviceId) return;

    const priceValue = parseNumber(tierPrice);
    const minValue = parseNumber(tierMinWeight);
    const maxValue = parseNumber(tierMaxWeight);
    const orderValue = parseNumber(tierOrder) || 0;

    if (priceValue == null) {
      Alert.alert(t('common.error'), t('serviceForm.tierPriceRequired'));
      return;
    }

    if (minValue == null && maxValue == null) {
      Alert.alert(t('common.error'), t('serviceForm.tierRangeRequired'));
      return;
    }

    createTierMutation.mutate({
      label: tierLabel.trim() || null,
      min_weight_kg: minValue,
      max_weight_kg: maxValue,
      price: priceValue,
      display_order: orderValue,
    });
  };

  const handleAddAddon = () => {
    if (!serviceId) return;

    const priceValue = parseNumber(addonPrice);
    const orderValue = parseNumber(addonOrder) || 0;

    if (!addonName.trim()) {
      Alert.alert(t('common.error'), t('serviceForm.addonNameRequired'));
      return;
    }

    if (priceValue == null) {
      Alert.alert(t('common.error'), t('serviceForm.addonPriceRequired'));
      return;
    }

    createAddonMutation.mutate({
      name: addonName.trim(),
      description: addonDescription.trim() || null,
      price: priceValue,
      display_order: orderValue,
      active: addonActive,
    });
  };

  const handleDelete = () => {
    if (!serviceId) return;

    Alert.alert(
      t('serviceForm.deleteTitle'),
      t('serviceForm.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('serviceForm.deleteAction'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(serviceId),
        },
      ]
    );
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={mode === 'create' ? t('serviceForm.createTitle') : t('serviceForm.editTitle')}
        showBackButton
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          <Input
            label={t('serviceForm.nameLabel')}
            placeholder={t('serviceForm.namePlaceholder')}
            value={name}
            onChangeText={setName}
            error={errors.name}
          />

          <Input
            label={t('serviceForm.descriptionLabel')}
            placeholder={t('serviceForm.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('serviceForm.imageTitle')}</Text>
            {mode === 'create' || !serviceId ? (
              <Text style={styles.sectionHint}>{t('serviceForm.imageSaveFirst')}</Text>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.imagePreview}
                  onPress={pickServiceImage}
                  disabled={uploadingServiceImage}
                >
                  {serviceImageUrl ? (
                    <Image
                      source={{ uri: serviceImageUrl }}
                      style={styles.imagePreviewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={24} color={colors.muted} />
                      <Text style={styles.imagePlaceholderText}>
                        {t('serviceForm.imagePlaceholder')}
                      </Text>
                    </View>
                  )}
                  {uploadingServiceImage ? (
                    <View style={styles.imageLoading}>
                      <ActivityIndicator color={colors.onPrimary} />
                    </View>
                  ) : null}
                </TouchableOpacity>
                <Text style={styles.imageHelper}>{t('serviceForm.imageHelper')}</Text>
                <Button
                  title={t('serviceForm.imageChangeAction')}
                  onPress={pickServiceImage}
                  variant="outline"
                  size="small"
                  disabled={uploadingServiceImage}
                  style={styles.imageButton}
                />
              </>
            )}
          </View>

          <Input
            label={t('serviceForm.priceLabel')}
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            error={errors.price}
            keyboardType="decimal-pad"
          />

          <Input
            label={t('serviceForm.categoryLabel')}
            placeholder={t('serviceForm.categoryPlaceholder')}
            value={category}
            onChangeText={setCategory}
          />

          <Input
            label={t('serviceForm.subcategoryLabel')}
            placeholder={t('serviceForm.subcategoryPlaceholder')}
            value={subcategory}
            onChangeText={setSubcategory}
          />

          <Input
            label={t('serviceForm.petTypeLabel')}
            placeholder={t('serviceForm.petTypePlaceholder')}
            value={petType}
            onChangeText={setPetType}
          />

          <Input
            label={t('serviceForm.pricingModelLabel')}
            placeholder={t('serviceForm.pricingModelPlaceholder')}
            value={pricingModel}
            onChangeText={setPricingModel}
          />

          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.label]}>{t('serviceForm.durationLabel')}</Text>
            <View style={[styles.spinnerRow]}> 
              <TouchableOpacity
                style={styles.spinnerButton}
                onPress={() => {
                  const cur = Number(duration) || 0;
                  const next = Math.max(5, cur - 5);
                  setDuration(String(next));
                }}
                accessibilityLabel={t('serviceForm.durationDecrease')}
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.spinnerValueContainer}>
                <Text style={styles.spinnerValue}>{duration ? String(Number(duration)) : '0'}</Text>
                <Text style={styles.spinnerUnit}>{t('common.minutesShort')}</Text>
              </View>

              <TouchableOpacity
                style={styles.spinnerButton}
                onPress={() => {
                  const cur = Number(duration) || 0;
                  const next = Math.min(600, cur + 5);
                  setDuration(String(next));
                }}
                accessibilityLabel={t('serviceForm.durationIncrease')}
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            {errors.duration && <Text style={styles.error}>{errors.duration}</Text>}
          </View>

          <Input
            label={t('serviceForm.displayOrderLabel')}
            placeholder="0"
            value={displayOrder}
            onChangeText={setDisplayOrder}
            keyboardType="number-pad"
          />

          <View style={styles.switchContainer}>
            <View>
              <Text style={styles.switchLabel}>{t('serviceForm.activeLabel')}</Text>
              <Text style={styles.switchSubtext}>{t('serviceForm.activeHint')}</Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary + '40' }}
              thumbColor={active ? colors.primary : colors.muted}
            />
          </View>

          <Button
            title={mode === 'create' ? t('serviceForm.createAction') : t('serviceForm.saveAction')}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('serviceForm.tiersTitle')}</Text>
            {mode !== 'edit' || !serviceId ? (
              <Text style={styles.sectionHint}>{t('serviceForm.saveFirstHint')}</Text>
            ) : (
              <>
                {priceTiers.length === 0 ? (
                  <Text style={styles.sectionHint}>{t('serviceForm.tiersEmpty')}</Text>
                ) : (
                  priceTiers.map((tier) => (
                    <View key={tier.id} style={styles.rowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>
                          {tier.label || t('serviceForm.tierDefaultLabel')}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {t('serviceForm.tierRangeValue', {
                            min: tier.min_weight_kg ?? '-',
                            max: tier.max_weight_kg ?? '+',
                          })}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {t('serviceForm.tierPriceValue', { price: tier.price })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteTierMutation.mutate(tier.id)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <View style={styles.inlineRow}>
                  <Input
                    label={t('serviceForm.tierLabel')}
                    placeholder="XS"
                    value={tierLabel}
                    onChangeText={setTierLabel}
                    style={styles.inlineInput}
                  />
                  <Input
                    label={t('serviceForm.tierMinWeight')}
                    placeholder="5"
                    value={tierMinWeight}
                    onChangeText={setTierMinWeight}
                    keyboardType="decimal-pad"
                    style={styles.inlineInput}
                  />
                  <Input
                    label={t('serviceForm.tierMaxWeight')}
                    placeholder="9"
                    value={tierMaxWeight}
                    onChangeText={setTierMaxWeight}
                    keyboardType="decimal-pad"
                    style={styles.inlineInput}
                  />
                </View>

                <View style={styles.inlineRow}>
                  <Input
                    label={t('serviceForm.tierPrice')}
                    placeholder="40.00"
                    value={tierPrice}
                    onChangeText={setTierPrice}
                    keyboardType="decimal-pad"
                    style={styles.inlineInput}
                  />
                  <Input
                    label={t('serviceForm.tierOrder')}
                    placeholder="0"
                    value={tierOrder}
                    onChangeText={setTierOrder}
                    keyboardType="number-pad"
                    style={styles.inlineInput}
                  />
                </View>

                <Button
                  title={t('serviceForm.addTierAction')}
                  onPress={handleAddTier}
                  loading={createTierMutation.isPending}
                  disabled={createTierMutation.isPending}
                  variant="outline"
                  size="small"
                  style={{ marginTop: 8 }}
                />
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('serviceForm.addonsTitle')}</Text>
            {mode !== 'edit' || !serviceId ? (
              <Text style={styles.sectionHint}>{t('serviceForm.saveFirstHint')}</Text>
            ) : (
              <>
                {addons.length === 0 ? (
                  <Text style={styles.sectionHint}>{t('serviceForm.addonsEmpty')}</Text>
                ) : (
                  addons.map((addon) => (
                    <View key={addon.id} style={styles.rowCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{addon.name}</Text>
                        {addon.description ? (
                          <Text style={styles.rowMeta}>{addon.description}</Text>
                        ) : null}
                        <Text style={styles.rowMeta}>
                          {t('serviceForm.addonPriceValue', { price: addon.price })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteAddonMutation.mutate(addon.id)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <Input
                  label={t('serviceForm.addonNameLabel')}
                  placeholder={t('serviceForm.addonNamePlaceholder')}
                  value={addonName}
                  onChangeText={setAddonName}
                />

                <Input
                  label={t('serviceForm.addonDescriptionLabel')}
                  placeholder={t('serviceForm.addonDescriptionPlaceholder')}
                  value={addonDescription}
                  onChangeText={setAddonDescription}
                />

                <View style={styles.inlineRow}>
                  <Input
                    label={t('serviceForm.addonPriceLabel')}
                    placeholder="10.00"
                    value={addonPrice}
                    onChangeText={setAddonPrice}
                    keyboardType="decimal-pad"
                    style={styles.inlineInput}
                  />
                  <Input
                    label={t('serviceForm.addonOrderLabel')}
                    placeholder="0"
                    value={addonOrder}
                    onChangeText={setAddonOrder}
                    keyboardType="number-pad"
                    style={styles.inlineInput}
                  />
                </View>

                <View style={styles.switchContainer}>
                  <View>
                    <Text style={styles.switchLabel}>{t('serviceForm.addonActiveLabel')}</Text>
                    <Text style={styles.switchSubtext}>{t('serviceForm.addonActiveHint')}</Text>
                  </View>
                  <Switch
                    value={addonActive}
                    onValueChange={setAddonActive}
                    trackColor={{ false: colors.surfaceBorder, true: colors.primary + '40' }}
                    thumbColor={addonActive ? colors.primary : colors.muted}
                  />
                </View>

                <Button
                  title={t('serviceForm.addAddonAction')}
                  onPress={handleAddAddon}
                  loading={createAddonMutation.isPending}
                  disabled={createAddonMutation.isPending}
                  variant="outline"
                  size="small"
                  style={{ marginTop: 8 }}
                />
              </>
            )}
          </View>

          {mode === 'edit' && (
            <Button
              title={t('serviceForm.deleteAction')}
              onPress={handleDelete}
              loading={deleteMutation.isPending}
              disabled={isLoading}
              variant="danger"
              style={{ marginTop: 16 }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginTop: 20,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    sectionHint: {
      fontSize: 13,
      color: colors.muted,
    },
    imagePreview: {
      height: 160,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      overflow: 'hidden',
      marginBottom: 10,
    },
    imagePreviewImage: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 16,
    },
    imagePlaceholderText: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
    },
    imageLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageHelper: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 8,
    },
    imageButton: {
      alignSelf: 'flex-start',
    },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceBorder,
    },
    rowTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    rowMeta: {
      fontSize: 12,
      color: colors.muted,
    },
    iconButton: {
      padding: 8,
    },
    inlineRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 8,
    },
    inlineInput: {
      minWidth: 120,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    switchSubtext: {
      fontSize: 13,
      color: colors.muted,
      maxWidth: 250,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    spinnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      paddingHorizontal: 12,
      height: 52,
    },
    spinnerButton: {
      width: 44,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    spinnerValueContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    spinnerValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    spinnerUnit: {
      fontSize: 13,
      color: colors.muted,
    },
    error: {
      fontSize: 13,
      color: colors.danger,
      marginTop: 6,
      marginLeft: 4,
    },
  });
}
