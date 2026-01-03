import { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { launchCamera, launchImageLibrary, CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Input } from '../components/common';
import {
  ConsumerPet,
  createConsumerPet,
  updateConsumerPet,
  deleteConsumerPet,
  uploadConsumerPetPhoto,
} from '../api/consumerPets';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { hapticError, hapticSuccess, hapticWarning } from '../utils/haptics';

type Props = NativeStackScreenProps<any>;

export default function ConsumerPetFormScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const pet = route.params?.pet as ConsumerPet | undefined;
  const isEditing = Boolean(pet?.id);

  const [name, setName] = useState(pet?.name || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [weight, setWeight] = useState(
    pet?.weight !== undefined && pet?.weight !== null ? String(pet.weight) : ''
  );
  const [photoUri, setPhotoUri] = useState<string | null>(pet?.photo_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const uploadPetPhotoMutation = useMutation({
    mutationFn: async ({ petId, uri }: { petId: string; uri: string }) => {
      const timestamp = Date.now();
      const extension = uri.split('.').pop() || 'jpg';
      const filename = `consumer-pet-${petId}-${timestamp}.${extension}`;
      const fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      return uploadConsumerPetPhoto(petId, {
        uri,
        name: filename,
        type: fileType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
    },
    onError: () => {
      hapticError();
    },
  });

  const createMutation = useMutation({
    mutationFn: createConsumerPet,
    onSuccess: async (createdPet) => {
      if (photoUri && !photoUri.startsWith('http')) {
        try {
          setUploadingPhoto(true);
          await uploadPetPhotoMutation.mutateAsync({ petId: createdPet.id, uri: photoUri });
        } catch (error) {
          hapticError();
          Alert.alert(t('common.error'), t('consumerPetsForm.photoUploadError'));
        } finally {
          setUploadingPhoto(false);
        }
      }

      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
      navigation.goBack();
    },
    onError: (err: any) => {
      hapticError();
      const message = err?.response?.data?.error || err?.message || t('consumerPetsForm.saveError');
      Alert.alert(t('common.error'), message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: { name?: string; breed?: string | null; weight?: number | null } }) =>
      updateConsumerPet(payload.id, payload.updates),
    onSuccess: async () => {
      if (photoUri && !photoUri.startsWith('http') && pet?.id) {
        try {
          setUploadingPhoto(true);
          await uploadPetPhotoMutation.mutateAsync({ petId: pet.id, uri: photoUri });
        } catch (error) {
          hapticError();
          Alert.alert(t('common.error'), t('consumerPetsForm.photoUploadError'));
        } finally {
          setUploadingPhoto(false);
        }
      }

      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
      navigation.goBack();
    },
    onError: (err: any) => {
      hapticError();
      const message = err?.response?.data?.error || err?.message || t('consumerPetsForm.saveError');
      Alert.alert(t('common.error'), message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConsumerPet,
    onSuccess: () => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
      navigation.goBack();
    },
    onError: (err: any) => {
      hapticError();
      const message = err?.response?.data?.error || err?.message || t('consumerPetsForm.deleteError');
      Alert.alert(t('common.error'), message);
    },
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

    launchCamera(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Error opening camera:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openCameraError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        setPhotoUri(response.assets[0].uri!);
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

    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Error opening gallery:', response.errorMessage);
        Alert.alert(t('common.error'), t('profile.openGalleryError'));
        return;
      }
      if (response.assets && response.assets[0]) {
        setPhotoUri(response.assets[0].uri!);
      }
    });
  };

  const selectImage = () => {
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

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedBreed = breed.trim();
    const weightValue = weight ? Number(weight.replace(',', '.')) : null;

    if (!trimmedName) {
      Alert.alert(t('consumerPetsForm.requiredTitle'), t('consumerPetsForm.requiredMessage'));
      return;
    }
    if (weight && Number.isNaN(weightValue)) {
      Alert.alert(t('common.error'), t('consumerPetsForm.weightInvalid'));
      return;
    }

    if (isEditing && pet?.id) {
      updateMutation.mutate({
        id: pet.id,
        updates: {
          name: trimmedName,
          breed: trimmedBreed || null,
          weight: Number.isNaN(weightValue) ? null : weightValue,
        },
      });
      return;
    }

    createMutation.mutate({
      name: trimmedName,
      breed: trimmedBreed || null,
      weight: Number.isNaN(weightValue) ? null : weightValue,
    });
  };

  const handleDelete = () => {
    if (!pet?.id) return;
    Alert.alert(t('consumerPetsForm.deleteTitle'), t('consumerPetsForm.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('consumerPetsForm.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          hapticWarning();
          deleteMutation.mutate(pet.id);
        },
      },
    ]);
  };

  const saving = createMutation.isPending || updateMutation.isPending || uploadingPhoto;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title={isEditing ? t('consumerPetsForm.editTitle') : t('consumerPetsForm.createTitle')} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photoSection}>
            <Text style={styles.photoLabel}>{t('consumerPetsForm.photoLabel')}</Text>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={selectImage}
              activeOpacity={0.7}
              disabled={uploadingPhoto}
            >
              {photoUri ? (
                <>
                  <Image source={{ uri: photoUri }} style={styles.photo} />
                  {uploadingPhoto && (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color="#fff" size="large" />
                      <Text style={styles.photoOverlayText}>{t('common.loading')}</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  {uploadingPhoto ? (
                    <ActivityIndicator color={colors.primary} size="large" />
                  ) : (
                    <Text style={styles.photoPlaceholderText}>{t('consumerPetsForm.addPhoto')}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Input
              label={t('consumerPetsForm.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('consumerPetsForm.namePlaceholder')}
            />
            <Input
              label={t('consumerPetsForm.breedLabel')}
              value={breed}
              onChangeText={setBreed}
              placeholder={t('consumerPetsForm.breedPlaceholder')}
            />
            <Input
              label={t('consumerPetsForm.weightLabel')}
              value={weight}
              onChangeText={setWeight}
              placeholder={t('consumerPetsForm.weightPlaceholder')}
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            />
          </View>

          <Button
            title={isEditing ? t('consumerPetsForm.saveAction') : t('consumerPetsForm.createAction')}
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />

          {isEditing ? (
            <Button
              title={t('consumerPetsForm.deleteAction')}
              onPress={handleDelete}
              loading={deleteMutation.isPending}
              variant="danger"
              style={styles.deleteButton}
            />
          ) : null}
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
    keyboard: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 16,
    },
    photoSection: {
      alignItems: 'center',
    },
    photoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      alignSelf: 'flex-start',
    },
    photoContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderStyle: 'dashed',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPlaceholderText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '500',
    },
    photoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    photoOverlayText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 6,
    },
    saveButton: {
      marginTop: 8,
    },
    deleteButton: {
      marginTop: 4,
    },
  });
}
