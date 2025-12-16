import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Image, ActionSheetIOS, PermissionsAndroid, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { createPet, uploadPetPhoto, deletePet, type Pet } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

type Props = NativeStackScreenProps<any, 'PetForm'>;

export default function PetFormScreen({ navigation, route }: Props) {
  const params = route.params as { mode: 'create' | 'edit'; customerId: string; petId?: string; pet?: Pet };
  const { mode, customerId, petId, pet } = params;
  
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [name, setName] = useState(pet?.name || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [photoUri, setPhotoUri] = useState<string | null>(pet?.photo_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: { name: string; breed?: string | null }) => createPet(customerId, data),
    onSuccess: async (createdPet) => {
      // Se há uma foto selecionada, faz upload após criar o pet
      if (photoUri && !photoUri.startsWith('http')) {
        try {
          setUploadingPhoto(true);
          await uploadPetPhotoMutation.mutateAsync({ petId: createdPet.id, uri: photoUri });
        } catch (error) {
          console.error('Erro ao fazer upload da foto:', error);
        } finally {
          setUploadingPhoto(false);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      Alert.alert('Sucesso', 'Pet adicionado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao adicionar pet');
    },
  });

  const uploadPetPhotoMutation = useMutation({
    mutationFn: async ({ petId, uri }: { petId: string; uri: string }) => {
      const timestamp = Date.now();
      const extension = uri.split('.').pop() || 'jpg';
      const filename = `pet-${petId}-${timestamp}.${extension}`;
      const fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      return uploadPetPhoto(petId, {
        uri,
        name: filename,
        type: fileType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
    },
  });

  const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permissão de Câmara',
            message: 'A app precisa de acesso à câmara',
            buttonNeutral: 'Perguntar depois',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
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

  const uploadPhoto = async (uri: string) => {
    // Se estamos editando, faz upload imediatamente
    if (mode === 'edit' && petId) {
      try {
        setUploadingPhoto(true);
        await uploadPetPhotoMutation.mutateAsync({ petId, uri });
        Alert.alert('Sucesso', 'Foto atualizada!');
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível fazer upload da foto');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestAndroidPermissions();
    if (!hasPermission) {
      Alert.alert('Permissão negada', 'Não é possível aceder à câmara sem permissão.');
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
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error('Erro ao abrir câmara:', response.errorMessage);
        Alert.alert('Erro', 'Não foi possível abrir a câmara');
        return;
      }
      if (response.assets && response.assets[0]) {
        setPhotoUri(response.assets[0].uri!);
        await uploadPhoto(response.assets[0].uri!);
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
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error('Erro ao abrir galeria:', response.errorMessage);
        Alert.alert('Erro', 'Não foi possível abrir a galeria');
        return;
      }
      if (response.assets && response.assets[0]) {
        setPhotoUri(response.assets[0].uri!);
        await uploadPhoto(response.assets[0].uri!);
      }
    });
  };

  const selectImage = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tirar foto', 'Escolher da galeria'],
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
        'Escolher foto',
        'Como deseja adicionar a foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tirar foto', onPress: openCamera },
          { text: 'Escolher da galeria', onPress: openGallery },
        ]
      );
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => deletePet(petId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      Alert.alert('Sucesso', 'Pet apagado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error.message || 'Erro ao apagar pet';
      Alert.alert('Erro', message);
    },
  });

  const handleDeletePet = () => {
    Alert.alert(
      'Apagar Pet',
      `Tem a certeza que deseja apagar ${name}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    if (mode === 'create') {
      createMutation.mutate({
        name: name.trim(),
        breed: breed.trim() || null,
      });
    } else {
      // TODO: Implement update mutation
      Alert.alert('Em desenvolvimento', 'Edição de pets será implementada em breve');
    }
  };

  const isLoading = createMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={mode === 'create' ? 'Novo Pet' : 'Editar Pet'} showBack={true} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Photo Picker */}
            <View style={styles.photoSection}>
              <Text style={styles.photoLabel}>Foto do Pet</Text>
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
                        <Text style={styles.photoOverlayText}>A carregar...</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    {uploadingPhoto ? (
                      <ActivityIndicator color={colors.primary} size="large" />
                    ) : (
                      <>
                        <Text style={styles.photoPlaceholderIcon}>📷</Text>
                        <Text style={styles.photoPlaceholderText}>Adicionar Foto</Text>
                      </>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Input
              label="Nome *"
              placeholder="Nome do pet"
              value={name}
              onChangeText={setName}
              error={errors.name}
              leftIcon="🐾"
            />

            <Input
              label="Raça"
              placeholder="Ex: Golden Retriever, Persa..."
              value={breed}
              onChangeText={setBreed}
              error={errors.breed}
              leftIcon="🏷️"
            />

            <View style={styles.hint}>
              <Text style={styles.hintText}>* Campos obrigatórios</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={mode === 'create' ? 'Adicionar Pet' : 'Salvar Alterações'}
            onPress={handleSubmit}
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={isLoading}
          />

          {mode === 'edit' && (
            <Button
              title="Apagar Pet"
              onPress={handleDeletePet}
              variant="ghost"
              size="large"
              loading={deleteMutation.isPending}
              disabled={deleteMutation.isPending}
              style={styles.deleteButton}
              textStyle={styles.deleteButtonText}
            />
          )}
        </View>
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
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    form: {
      paddingTop: 20,
      paddingBottom: 100,
    },
    photoSection: {
      marginBottom: 24,
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
    photoPlaceholderIcon: {
      fontSize: 36,
      marginBottom: 8,
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
    },
    photoOverlayText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    hint: {
      marginTop: 8,
    },
    hintText: {
      fontSize: 13,
      color: colors.muted,
      fontStyle: 'italic',
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      gap: 12,
    },
    deleteButton: {
      borderColor: '#ef4444',
      borderWidth: 1,
      marginTop: 8,
    },
    deleteButtonText: {
      color: '#ef4444',
    },
  });
}
