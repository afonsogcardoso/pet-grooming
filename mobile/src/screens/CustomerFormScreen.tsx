import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ActionSheetIOS, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { createCustomer, updateCustomer, uploadCustomerPhoto, type Customer } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { Avatar } from '../components/common/Avatar';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';

type Props = NativeStackScreenProps<any, 'CustomerForm'>;

export default function CustomerFormScreen({ navigation, route }: Props) {
  const params = route.params as { mode: 'create' | 'edit'; customerId?: string; customer?: Customer };
  const { mode, customerId, customer } = params;
  
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [nif, setNif] = useState(customer?.nif || '');
  const [photoUrl, setPhotoUrl] = useState(customer?.photo_url || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      Alert.alert('Sucesso', 'Cliente criado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao criar cliente');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { phone?: string | null; address?: string | null; nif?: string | null }) =>
      updateCustomer(customerId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      Alert.alert('Sucesso', 'Cliente atualizado com sucesso!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao atualizar cliente');
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email inválido';
    }

    if (phone && !/^\d{9,}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Telefone inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    if (mode === 'create') {
      createMutation.mutate({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        nif: nif.trim() || null,
      });
    } else {
      updateMutation.mutate({
        phone: phone.trim() || null,
        address: address.trim() || null,
        nif: nif.trim() || null,
      });
    }
  };

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

  const uploadPhoto = async (uri: string, fileName?: string | null) => {
    if (mode === 'create' || !customerId) {
      Alert.alert('Aviso', 'Guarde o cliente primeiro antes de adicionar uma foto.');
      return;
    }

    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const filename = `customer-${customerId}-${timestamp}.${extension}`;
      const fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      formData.append('photo', {
        uri,
        name: filename,
        type: fileType,
      } as any);

      const result = await uploadCustomerPhoto(customerId, formData);
      setPhotoUrl(result.url);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      Alert.alert('Sucesso', 'Foto atualizada!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      Alert.alert('Erro', 'Não foi possível fazer upload da foto');
    } finally {
      setUploadingPhoto(false);
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
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error('Erro ao abrir câmara:', response.errorMessage);
        Alert.alert('Erro', 'Não foi possível abrir a câmara');
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadPhoto(response.assets[0].uri!, response.assets[0].fileName);
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
        Alert.alert('Erro', 'Não foi possível abrir a galeria');
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadPhoto(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const handleAvatarPress = () => {
    if (mode === 'create') {
      Alert.alert('Aviso', 'Guarde o cliente primeiro antes de adicionar uma foto.');
      return;
    }

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

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={mode === 'create' ? 'Novo Cliente' : 'Editar Cliente'} showBack={true} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Avatar
                  name={name || 'Cliente'}
                  imageUrl={photoUrl}
                  size="large"
                  onPress={mode === 'edit' ? handleAvatarPress : undefined}
                />
                {uploadingPhoto && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator color={colors.onPrimary} size="large" />
                  </View>
                )}
              </View>
              {mode === 'edit' && (
                <Text style={styles.avatarHint}>Toque na foto para alterar</Text>
              )}
            </View>

            <Input
              label="Nome *"
              placeholder="Nome completo"
              value={name}
              onChangeText={setName}
              error={errors.name}
              editable={mode === 'create'}
            />

            <Input
              label="Telefone"
              placeholder="+351 912 345 678"
              value={phone}
              onChangeText={setPhone}
              error={errors.phone}
              keyboardType="phone-pad"
            />

            <Input
              label="Email"
              placeholder="exemplo@email.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={mode === 'create'}
              showEmailSuggestions
            />

            <Input
              label="Endereço"
              placeholder="Rua, número, cidade"
              value={address}
              onChangeText={setAddress}
              error={errors.address}
              multiline
              numberOfLines={3}
            />

            <Input
              label="NIF"
              placeholder="123456789"
              value={nif}
              onChangeText={setNif}
              error={errors.nif}
              keyboardType="number-pad"
            />

            {mode === 'create' && (
              <View style={styles.hint}>
                <Text style={styles.hintText}>* Campos obrigatórios</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={mode === 'create' ? 'Criar Cliente' : 'Salvar Alterações'}
            onPress={handleSubmit}
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={isLoading}
          />
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
    avatarSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatarLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarHint: {
      marginTop: 8,
      fontSize: 13,
      color: colors.muted,
      fontStyle: 'italic',
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
    },
  });
}
