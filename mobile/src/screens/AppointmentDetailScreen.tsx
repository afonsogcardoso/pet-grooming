import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Alert, Image, ActionSheetIOS, Platform } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { getAppointment, updateAppointment, uploadAppointmentPhoto, deleteAppointment } from '../api/appointments';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { ScreenHeader } from '../components/ScreenHeader';
import { MiniMap } from '../components/common/MiniMap';
import { getStatusColor, getStatusLabel } from '../utils/appointmentStatus';

type Props = NativeStackScreenProps<any>;

function formatDateTime(date?: string | null, time?: string | null) {
  const safeDate = date ? new Date(`${date}T00:00:00`) : null;
  const dateLabel =
    safeDate && !Number.isNaN(safeDate.getTime())
      ? safeDate.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })
      : date || 'Sem data';
  const timeLabel = time ? time.slice(0, 5) : '—';
  return `${dateLabel} às ${timeLabel}`;
}

export default function AppointmentDetailScreen({ route, navigation }: Props) {
  const appointmentId = route.params?.id as string;
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);

  const { data, isLoading, isRefetching, error } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (payload: { status?: string | null; payment_status?: string | null }) =>
      updateAppointment(appointmentId, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] }).catch(() => null);
      if (updated) {
        queryClient.setQueryData(['appointment', appointmentId], updated);
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao atualizar marcação';
      Alert.alert('Erro', message);
    },
  });

  const photoMutation = useMutation({
    mutationFn: ({ type, file }: { type: 'before' | 'after'; file: { uri: string; name: string; type: string } }) =>
      uploadAppointmentPhoto(appointmentId, type, file),
    onSuccess: async (data, variables) => {
      // Atualiza o cache local imediatamente com a URL da foto
      const photoUrl = data?.url;
      if (photoUrl && appointment) {
        const updatedAppointment = {
          ...appointment,
          [variables.type === 'before' ? 'before_photo_url' : 'after_photo_url']: photoUrl,
        };
        queryClient.setQueryData(['appointment', appointmentId], updatedAppointment);
      }
      // Refetch para garantir sincronização
      await queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      Alert.alert('Sucesso', 'Foto enviada.');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao enviar foto';
      Alert.alert('Erro', message);
    },
  });

  const appointment = data;
  const displayStatus = status ?? appointment?.status ?? 'scheduled';
  const customer = appointment?.customers;
  const service = appointment?.services;
  const pet = appointment?.pets;
  const paymentStatus = appointment?.payment_status || 'unpaid';
  
  // Get all services (from appointment_services or fallback to single service)
  const services = useMemo(() => {
    if (appointment?.appointment_services && appointment.appointment_services.length > 0) {
      return appointment.appointment_services
        .map(as => as.services)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    }
    return service ? [service] : [];
  }, [appointment?.appointment_services, service]);

  const totalAmount = useMemo(() => {
    return services.reduce((sum, s) => sum + (s.price || 0), 0);
  }, [services]);

  const openMaps = async () => {
    const address = customer?.address;
    if (!address) return;
    
    try {
      const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const url = Platform.select({
          ios: `maps:0,0?q=${location.lat},${location.lng}`,
          android: `geo:0,0?q=${location.lat},${location.lng}`,
          default: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
        });
        Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir mapas.'));
      } else {
        Alert.alert('Erro', 'Endereço não encontrado.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Erro', 'Não foi possível obter coordenadas.');
    }
  };

  const callCustomer = () => {
    const phone = customer?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Erro', 'Não foi possível iniciar a chamada.'));
  };

  const whatsappCustomer = () => {
    const phone = customer?.phone;
    if (!phone) return;
    // Remove espaços e caracteres especiais, mantém apenas números
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    // Se começar com 9, adiciona +351 (Portugal)
    const formattedPhone = cleanPhone.startsWith('9') ? `351${cleanPhone}` : cleanPhone;
    const message = `Olá ${customer?.name || ''}! Em relação à marcação de ${formatDateTime(appointment?.appointment_date, appointment?.appointment_time)}...`;
    const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'WhatsApp não instalado ou não foi possível abrir.'));
  };

  const saveStatus = (next: string) => {
    setStatus(next);
    mutation.mutate({ status: next });
  };

  const togglePayment = () => {
    const next = paymentStatus === 'paid' ? 'unpaid' : 'paid';
    mutation.mutate({ payment_status: next });
  };

  const handleEditAppointment = () => {
    navigation.navigate('NewAppointment', { editId: appointmentId });
  };

  const handleDelete = () => {
    Alert.alert(
      'Apagar Marcação',
      'Esta ação é irreversível. Tem a certeza que deseja apagar esta marcação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Attempting to delete appointment:', appointmentId);
              await deleteAppointment(appointmentId);
              queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
              Alert.alert('Sucesso', 'Marcação apagada.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error('Delete error:', error);
              const errorMessage = error?.response?.data?.message || error?.message || 'Não foi possível apagar a marcação.';
              Alert.alert('Erro', errorMessage);
            }
          },
        },
      ]
    );
  };

  const pickImage = async (type: 'before' | 'after') => {
    try {
      // Solicita permissões sem bloquear se uma falhar
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync().catch(() => ({ status: 'denied' as const }));
      const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync().catch(() => ({ status: 'denied' as const }));

      const hasCameraPermission = cameraPermission.status === 'granted';
      const hasLibraryPermission = libraryPermission.status === 'granted';

      if (!hasCameraPermission && !hasLibraryPermission) {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para aceder à câmara ou galeria.');
        return;
      }

      const showOptions = () => {
        const options: string[] = ['Cancelar'];
        const actions: Array<() => Promise<void>> = [];

        if (hasCameraPermission) {
          options.push('Tirar foto');
          actions.push(() => launchCamera(type));
        }
        
        if (hasLibraryPermission) {
          options.push('Escolher da galeria');
          actions.push(() => launchLibrary(type));
        }

        if (Platform.OS === 'ios') {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options,
              cancelButtonIndex: 0,
            },
            async (buttonIndex) => {
              if (buttonIndex > 0 && actions[buttonIndex - 1]) {
                await actions[buttonIndex - 1]();
              }
            },
          );
        } else {
          const buttons = actions.map((action, index) => ({
            text: options[index + 1],
            onPress: () => action(),
          }));

          Alert.alert(
            'Escolher foto',
            'Como deseja adicionar a foto?',
            [
              { text: 'Cancelar', style: 'cancel' },
              ...buttons,
            ],
          );
        }
      };

      showOptions();
    } catch (error) {
      console.error('Erro ao aceder aos serviços de imagem:', error);
      Alert.alert('Erro', 'Módulo de imagem não disponível');
    }
  };

  const launchCamera = async (type: 'before' | 'after') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(type, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao abrir câmara:', error);
      Alert.alert('Erro', 'Não foi possível abrir a câmara');
    }
  };

  const launchLibrary = async (type: 'before' | 'after') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(type, result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao abrir galeria:', error);
      Alert.alert('Erro', 'Não foi possível abrir a galeria');
    }
  };

  const uploadPhoto = async (type: 'before' | 'after', uri: string) => {
    try {
      const filename = uri.split('/').pop() || `${type}-${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : 'image/jpeg';

      photoMutation.mutate({
        type,
        file: {
          uri,
          name: filename,
          type: fileType,
        },
      });
    } catch (error) {
      console.error('Erro ao preparar upload:', error);
      Alert.alert('Erro', 'Não foi possível preparar o upload da foto');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader 
        title="Detalhes" 
        rightElement={
          <TouchableOpacity 
            onPress={handleEditAppointment}
            style={[styles.actionButton, { backgroundColor: colors.surface }]}
          >
            <Text style={{ fontSize: 18 }}>✏️</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && !isRefetching ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} size="large" />
        ) : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ Erro ao carregar marcação</Text>
          </View>
        ) : null}

        {appointment ? (
          <>
            {/* Hero Card - Serviço */}
            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(displayStatus) + '20', borderColor: getStatusColor(displayStatus) }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(displayStatus) }]} />
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(displayStatus) }]}>{getStatusLabel(displayStatus)}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.paymentBadge, paymentStatus === 'paid' && styles.paymentBadgePaid]}
                  onPress={togglePayment}
                >
                  <Text style={[styles.paymentBadgeText, paymentStatus === 'paid' && styles.paymentBadgeTextPaid]}>
                    {paymentStatus === 'paid' ? 'Pago' : 'Por pagar'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.heroTitle}>
                {services.length === 1 
                  ? (services[0]?.name || 'Serviço') 
                  : `${services.length} Serviços`
                }
              </Text>
              
              <View style={styles.dateTimeRow}>
                <Text style={styles.heroSubtitle}>{formatDateTime(appointment.appointment_date, appointment.appointment_time)}</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={handleEditAppointment}
                >
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.heroDetails}>
                {totalAmount > 0 ? (
                  <View style={styles.heroDetailItem}>
                    <Text style={styles.heroDetailLabel}>Valor Total</Text>
                    <Text style={styles.heroDetailValue}>€{totalAmount.toFixed(2)}</Text>
                  </View>
                ) : null}
                <View style={styles.heroDetailItem}>
                  <Text style={styles.heroDetailLabel}>Duração</Text>
                  <Text style={styles.heroDetailValue}>{appointment.duration ? `${appointment.duration} min` : '—'}</Text>
                </View>
              </View>
              
              {services.length > 1 && (
                <View style={styles.servicesDetailBox}>
                  <Text style={styles.servicesDetailTitle}>Serviços Incluídos</Text>
                  {services.map((s, idx) => (
                    <View key={idx} style={styles.serviceDetailRow}>
                      <View style={styles.serviceDetailLeft}>
                        <View style={styles.serviceBullet} />
                        <Text style={styles.serviceDetailName}>{s.name}</Text>
                      </View>
                      {s.price ? (
                        <Text style={styles.serviceDetailPrice}>€{Number(s.price).toFixed(2)}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Cliente & Pet em Grid */}
            <View style={styles.gridRow}>
              <TouchableOpacity 
                style={[styles.compactCard, styles.petCard, { flex: 1 }]}
                onPress={() => customer?.id && navigation.navigate('CustomerDetail', { customerId: customer.id })}
                activeOpacity={0.7}
              >
                <Text style={styles.compactCardTitle}>👤 Cliente</Text>
                <Text style={styles.compactCardName}>{customer?.name || 'Sem cliente'}</Text>
                {customer?.phone ? (
                  <View style={styles.contactActions}>
                    <TouchableOpacity 
                      style={styles.contactButton} 
                      onPress={(e) => {
                        e.stopPropagation();
                        callCustomer();
                      }}
                    >
                      <Ionicons name="call" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.contactButton, styles.whatsappButton]} 
                      onPress={(e) => {
                        e.stopPropagation();
                        whatsappCustomer();
                      }}
                    >
                      <FontAwesome name="whatsapp" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </TouchableOpacity>

              {pet ? (
                <View style={[styles.compactCard, styles.petCard, { flex: 1 }]}>
                  <Text style={styles.compactCardTitle}>🐾 Pet</Text>
                  {pet.photo_url ? (
                    <Image source={{ uri: pet.photo_url }} style={styles.petThumbnail} />
                  ) : null}
                  <Text style={styles.compactCardName}>{pet.name}</Text>
                  {pet.breed ? <Text style={styles.compactCardBreed}>{pet.breed}</Text> : null}
                </View>
              ) : null}
            </View>

            {customer?.address ? (
              <View style={styles.mapCardContainer}>
                <View style={styles.mapCardHeader}>
                  <Text style={styles.mapIcon}>📍</Text>
                  <View style={styles.mapContent}>
                    <Text style={styles.mapTitle}>Morada</Text>
                    <Text style={styles.mapAddress}>{customer.address}</Text>
                  </View>
                </View>
                <MiniMap address={customer.address} />
              </View>
            ) : null}

            {/* Fotos Antes/Depois */}
            <View style={styles.photosCard}>
              <Text style={styles.photosCardTitle}>📸 Fotos do Serviço</Text>
              <View style={styles.photosGrid}>
                <View style={styles.photoItem}>
                  <Text style={styles.photoItemLabel}>Antes</Text>
                  <TouchableOpacity
                    onPress={() => pickImage('before')}
                    disabled={photoMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {appointment?.before_photo_url ? (
                      <Image source={{ uri: appointment.before_photo_url }} style={styles.photoItemImage} />
                    ) : (
                      <View style={styles.photoItemPlaceholder}>
                        <Text style={styles.photoItemPlaceholderText}>+</Text>
                        <Text style={styles.photoItemPlaceholderLabel}>Toca para adicionar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.photoItem}>
                  <Text style={styles.photoItemLabel}>Depois</Text>
                  <TouchableOpacity
                    onPress={() => pickImage('after')}
                    disabled={photoMutation.isPending}
                    activeOpacity={0.7}
                  >
                    {appointment?.after_photo_url ? (
                      <Image source={{ uri: appointment.after_photo_url }} style={styles.photoItemImage} />
                    ) : (
                      <View style={styles.photoItemPlaceholder}>
                        <Text style={styles.photoItemPlaceholderText}>+</Text>
                        <Text style={styles.photoItemPlaceholderLabel}>Toca para adicionar</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              {photoMutation.isPending ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
              ) : null}
            </View>

            {/* Estado - Buttons Modernos */}
            <View style={styles.statusCard}>
              <Text style={styles.statusCardTitle}>Alterar Estado</Text>
              <View style={styles.statusGrid}>
                {['scheduled', 'pending', 'completed'].map((value) => {
                  const active = displayStatus === value;
                  const emoji = value === 'scheduled' ? '📅' : value === 'pending' ? '⏳' : '✅';
                  const statusColor = getStatusColor(value);
                  
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.statusButton,
                        active && { backgroundColor: statusColor, borderColor: statusColor },
                      ]}
                      onPress={() => saveStatus(value)}
                    >
                      <Text style={styles.statusButtonEmoji}>{emoji}</Text>
                      <Text
                        style={[
                          styles.statusButtonText,
                          { color: active ? '#fff' : colors.text },
                        ]}
                      >
                        {getStatusLabel(value)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {/* Botões Cancelar e Apagar */}
              <View style={styles.dangerActions}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    displayStatus === 'cancelled' && { backgroundColor: getStatusColor('cancelled'), borderColor: getStatusColor('cancelled') },
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Cancelar Marcação',
                      'Tem a certeza que deseja cancelar esta marcação?',
                      [
                        { text: 'Não', style: 'cancel' },
                        { text: 'Sim, cancelar', style: 'destructive', onPress: () => saveStatus('cancelled') },
                      ]
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      displayStatus === 'cancelled' && { color: '#fff' },
                    ]}
                  >
                    {displayStatus === 'cancelled' ? 'Cancelado' : 'Cancelar'}
                  </Text>
                </TouchableOpacity>

                {displayStatus === 'cancelled' && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDelete}
                  >
                    <Text style={styles.deleteButtonText}>Apagar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Notas */}
            {appointment.notes ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>Notas</Text>
                <Text style={styles.notesText}>{appointment.notes}</Text>
              </View>
            ) : null}
          </>
        ) : null}
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
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 16,
    },
    errorCard: {
      backgroundColor: '#fee2e2',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
    },
    errorText: {
      color: '#dc2626',
      fontWeight: '600',
      fontSize: 15,
    },
    // Hero Card - Destaque do Serviço
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1.5,
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusBadgeText: {
      fontSize: 13,
      fontWeight: '700',
    },
    paymentBadge: {
      backgroundColor: '#fef3c7',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    paymentBadgePaid: {
      backgroundColor: '#d1fae5',
    },
    paymentBadgeText: {
      color: '#92400e',
      fontSize: 13,
      fontWeight: '700',
    },
    paymentBadgeTextPaid: {
      color: '#065f46',
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: 16,
      color: colors.muted,
      fontWeight: '500',
    },
    dateTimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    editButton: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    editButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    heroDetails: {
      flexDirection: 'row',
      gap: 16,
    },
    heroDetailItem: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    heroDetailLabel: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 4,
      fontWeight: '500',
    },
    heroDetailValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    // Services Detail Box
    servicesDetailBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    servicesDetailTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    serviceDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    serviceDetailLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    serviceBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    serviceDetailName: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    serviceDetailPrice: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    // Grid Row para Cliente/Pet
    gridRow: {
      flexDirection: 'row',
      gap: 12,
    },
    compactCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    petCard: {
      alignItems: 'center',
    },
    compactCardTitle: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 8,
      fontWeight: '600',
    },
    compactCardName: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    compactCardBreed: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 8,
      textAlign: 'center',
    },
    compactAction: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    compactActionText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    contactActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    contactButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    whatsappButton: {
      backgroundColor: '#25D366',
    },
    contactButtonIcon: {
      fontSize: 20,
    },
    petThumbnail: {
      width: 60,
      height: 60,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    // Map Card
    mapCardContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    mapCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    mapCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    mapIcon: {
      fontSize: 28,
    },
    mapContent: {
      flex: 1,
    },
    mapTitle: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 4,
      fontWeight: '600',
    },
    mapAddress: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    mapArrow: {
      fontSize: 24,
      color: colors.muted,
    },
    // Fotos Antes/Depois
    photosCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    photosCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    photosGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    photoItem: {
      flex: 1,
      alignItems: 'center',
    },
    photoItemLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    photoItemImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 16,
      marginBottom: 10,
      backgroundColor: colors.background,
    },
    photoItemPlaceholder: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderStyle: 'dashed',
    },
    photoItemPlaceholderText: {
      fontSize: 48,
      color: colors.muted,
      fontWeight: '200',
    },
    photoItemPlaceholderLabel: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 8,
      fontWeight: '500',
    },
    // Status Card
    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    statusCardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    statusGrid: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    statusButton: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 4,
    },
    statusButtonEmoji: {
      fontSize: 20,
    },
    statusButtonText: {
      fontSize: 11,
      fontWeight: '700',
    },
    dangerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: '#fee2e2',
      borderWidth: 2,
      borderColor: '#fca5a5',
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    cancelButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#dc2626',
    },
    deleteButton: {
      flex: 1,
      backgroundColor: '#fee2e2',
      borderWidth: 2,
      borderColor: '#fca5a5',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#dc2626',
    },
    // Notas
    notesCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    notesTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    notesText: {
      fontSize: 15,
      color: colors.muted,
      lineHeight: 22,
    },
  });
}
