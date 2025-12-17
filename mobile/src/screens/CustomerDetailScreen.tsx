import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, ActionSheetIOS, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { getCustomers, getPetsByCustomer, uploadCustomerPhoto, deleteCustomer, type Customer, type Pet } from '../api/customers';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/common/Avatar';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { MiniMap } from '../components/common/MiniMap';
import { PetCard } from '../components/customers/PetCard';
import SwipeableRow from '../components/common/SwipeableRow';
import { deletePet } from '../api/customers';

type Props = NativeStackScreenProps<any, 'CustomerDetail'>;

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params as { customerId: string };
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { data: customers = [], isLoading: isLoadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const { data: pets = [], isLoading: isLoadingPets, refetch: refetchPets } = useQuery({
    queryKey: ['customer-pets', customerId],
    queryFn: () => getPetsByCustomer(customerId),
    enabled: !!customerId,
  });

  const deletePetMutation = useMutation({
    mutationFn: (petId: string) => deletePet(petId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customer-pets', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao apagar pet';
      Alert.alert('Erro', message);
    },
  });

  const customer = customers.find((c) => c.id === customerId);

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) =>
      uploadCustomerPhoto(customerId, file),
    onSuccess: async (data) => {
      const photoUrl = data?.url;
      if (photoUrl && customer) {
        const updatedCustomers = customers.map((c) =>
          c.id === customerId ? { ...c, photo_url: photoUrl } : c
        );
        queryClient.setQueryData(['customers'], updatedCustomers);
      }
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao enviar foto';
      Alert.alert('Erro', message);
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

  const uploadPhoto = async (uri: string, fileName?: string) => {
    try {
      setUploadingPhoto(true);
      const timestamp = Date.now();
      const extension = fileName?.split('.').pop() || uri.split('.').pop() || 'jpg';
      const filename = `customer-${customerId}-${timestamp}.${extension}`;
      const fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;

      await uploadPhotoMutation.mutateAsync({
        uri,
        name: filename,
        type: fileType,
      });
    } catch (error) {
      console.error('Erro ao preparar upload:', error);
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
      if (response.didCancel) {
        return;
      }
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
      if (response.didCancel) {
        return;
      }
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
    mutationFn: () => deleteCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigation.goBack();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error.message || 'Erro ao apagar cliente';
      Alert.alert('Erro', message);
    },
  });

  const handleDeleteCustomer = () => {
    Alert.alert(
      'Apagar Cliente',
      `Tem a certeza que deseja apagar ${customer?.name}? Esta ação não pode ser desfeita e todos os pets associados também serão apagados.`,
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

  const handleEditCustomer = () => {
    navigation.navigate('CustomerForm', { mode: 'edit', customerId, customer });
  };

  const handleAddPet = () => {
    navigation.navigate('PetForm', { mode: 'create', customerId });
  };

  const handlePetPress = (pet: Pet) => {
    navigation.navigate('PetForm', { mode: 'edit', customerId, petId: pet.id, pet });
  };

  if (isLoadingCustomer) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Cliente" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScreenHeader title="Cliente" />
        <EmptyState
          icon="❌"
          title="Cliente não encontrado"
          description="O cliente que você procura não existe"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title="Detalhes do Cliente"
        showBack={true}
        rightElement={
          <TouchableOpacity onPress={handleEditCustomer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.editIcon, { color: colors.primary }]}>✏️</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatarContainer}>
            <Avatar 
              name={customer.name} 
              size="large" 
              imageUrl={customer.photo_url}
              onPress={handleAvatarPress}
            />
            {uploadingPhoto && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
          
          <Text style={styles.customerName}>{customer.name}</Text>
          
          <View style={styles.infoGrid}>
            {customer.phone && (
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Telefone</Text>
                  <Text style={styles.infoValue}>{customer.phone}</Text>
                </View>
              </View>
            )}
            
            {customer.email && (
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{customer.email}</Text>
                </View>
              </View>
            )}
            
            {customer.address && (
              <>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Endereço</Text>
                    <Text style={styles.infoValue}>{customer.address}</Text>
                  </View>
                </View>
                <MiniMap address={customer.address} />
              </>
            )}
            
            {customer.nif && (
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>NIF</Text>
                  <Text style={styles.infoValue}>{customer.nif}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Pets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pets ({pets.length})</Text>
            <Button
              title="Adicionar"
              onPress={handleAddPet}
              variant="ghost"
              size="small"
              icon="+"
            />
          </View>

          {isLoadingPets ? (
            <View style={styles.petsLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : pets.length === 0 ? (
            <EmptyState
              title="Nenhum pet"
              description="Adicione o primeiro pet deste cliente"
              actionLabel="Adicionar Pet"
              onAction={handleAddPet}
            />
          ) : (
            <View style={styles.petsList}>
              {pets.map((pet) => (
                <SwipeableRow key={pet.id} onDelete={() => {
                  Alert.alert('Apagar pet', `Apagar ${pet.name}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Apagar', style: 'destructive', onPress: () => deletePetMutation.mutate(pet.id) },
                  ]);
                }}>
                  <PetCard key={pet.id} pet={pet} onPress={() => handlePetPress(pet)} />
                </SwipeableRow>
              ))}
            </View>
          )}
        </View>

        {/* Delete Customer Button */}
        <View style={styles.dangerZone}>
          <Button
            title="Apagar Cliente"
            onPress={handleDeleteCustomer}
            variant="ghost"
            size="large"
            loading={deleteMutation.isPending}
            disabled={deleteMutation.isPending}
            style={styles.deleteButton}
            textStyle={styles.deleteButtonText}
          />
        </View>
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
      flex: 1,
      paddingHorizontal: 20,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    petsLoadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    editIcon: {
      fontSize: 20,
    },
    customerCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      marginTop: 20,
      marginBottom: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    customerName: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginTop: 16,
      marginBottom: 24,
      textAlign: 'center',
    },
    infoGrid: {
      width: '100%',
      gap: 16,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
    },
    infoIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    petsList: {
      gap: 12,
    },
    dangerZone: {
      marginTop: 16,
      marginBottom: 32,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    deleteButton: {
      borderColor: '#ef4444',
      borderWidth: 1,
    },
    deleteButtonText: {
      color: '#ef4444',
    },
  });
}
