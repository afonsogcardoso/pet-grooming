import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Alert, Image, ActionSheetIOS, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { getAppointment, updateAppointment, uploadAppointmentPhoto } from '../api/appointments';
import { useBrandingTheme } from '../theme/useBrandingTheme';

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
      Alert.alert('Sucesso', 'Marcação atualizada.');
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

  const statusLabels: Record<string, string> = {
    scheduled: 'Agendado',
    pending: 'Em progresso',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };

  const openMaps = () => {
    const address = customer?.address;
    if (!address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir mapas.'));
  };

  const callCustomer = () => {
    const phone = customer?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Erro', 'Não foi possível iniciar a chamada.'));
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

  const pickImage = async (type: 'before' | 'after') => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' && libraryStatus !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de permissão para aceder à câmara ou galeria.');
      return;
    }

    const showOptions = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancelar', 'Tirar foto', 'Escolher da galeria'],
            cancelButtonIndex: 0,
          },
          async (buttonIndex) => {
            if (buttonIndex === 1) {
              await launchCamera(type);
            } else if (buttonIndex === 2) {
              await launchLibrary(type);
            }
          },
        );
      } else {
        Alert.alert(
          'Escolher foto',
          'Como deseja adicionar a foto?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Tirar foto', onPress: () => launchCamera(type) },
            { text: 'Escolher da galeria', onPress: () => launchLibrary(type) },
          ],
        );
      }
    };

    showOptions();
  };

  const launchCamera = async (type: 'before' | 'after') => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(type, result.assets[0].uri);
    }
  };

  const launchLibrary = async (type: 'before' | 'after') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(type, result.assets[0].uri);
    }
  };

  const uploadPhoto = async (type: 'before' | 'after', uri: string) => {
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
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, { backgroundColor: displayStatus === 'completed' ? '#10b981' : displayStatus === 'cancelled' ? '#ef4444' : colors.primary }]} />
                  <Text style={styles.statusBadgeText}>{statusLabels[displayStatus]}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.paymentBadge, paymentStatus === 'paid' && styles.paymentBadgePaid]}
                  onPress={togglePayment}
                >
                  <Text style={[styles.paymentBadgeText, paymentStatus === 'paid' && styles.paymentBadgeTextPaid]}>
                    {paymentStatus === 'paid' ? '✓ Pago' : '⏱ Por pagar'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.heroTitle}>{service?.name || 'Serviço'}</Text>
              
              <View style={styles.dateTimeRow}>
                <Text style={styles.heroSubtitle}>📅 {formatDateTime(appointment.appointment_date, appointment.appointment_time)}</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={handleEditAppointment}
                >
                  <Text style={styles.editButtonText}>✏️ Editar</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.heroDetails}>
                {service?.price ? (
                  <View style={styles.heroDetailItem}>
                    <Text style={styles.heroDetailLabel}>Valor</Text>
                    <Text style={styles.heroDetailValue}>€{Number(service.price).toFixed(2)}</Text>
                  </View>
                ) : null}
                <View style={styles.heroDetailItem}>
                  <Text style={styles.heroDetailLabel}>Duração</Text>
                  <Text style={styles.heroDetailValue}>{appointment.duration ? `${appointment.duration} min` : '—'}</Text>
                </View>
              </View>
            </View>

            {/* Cliente & Pet em Grid */}
            <View style={styles.gridRow}>
              <View style={[styles.compactCard, styles.petCard, { flex: 1 }]}>
                <Text style={styles.compactCardTitle}>👤 Cliente</Text>
                <Text style={styles.compactCardName}>{customer?.name || 'Sem cliente'}</Text>
                {customer?.phone ? (
                  <TouchableOpacity style={styles.compactAction} onPress={callCustomer}>
                    <Text style={styles.compactActionText}>📞 Ligar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

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
              <TouchableOpacity style={styles.mapCard} onPress={openMaps}>
                <Text style={styles.mapIcon}>📍</Text>
                <View style={styles.mapContent}>
                  <Text style={styles.mapTitle}>Morada</Text>
                  <Text style={styles.mapAddress}>{customer.address}</Text>
                </View>
                <Text style={styles.mapArrow}>›</Text>
              </TouchableOpacity>
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
                {['scheduled', 'pending', 'completed', 'cancelled'].map((value) => {
                  const active = displayStatus === value;
                  const emoji = value === 'scheduled' ? '📅' : value === 'pending' ? '⏳' : value === 'completed' ? '✅' : '❌';
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.statusButton,
                        active && { backgroundColor: colors.primary, borderColor: colors.primary },
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
                        {statusLabels[value]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {mutation.isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}
            </View>

            {/* Notas */}
            {appointment.notes ? (
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>📝 Notas</Text>
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
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusBadgeText: {
      color: colors.text,
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
    petThumbnail: {
      width: 60,
      height: 60,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    // Map Card
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
      flexWrap: 'wrap',
      gap: 10,
    },
    statusButton: {
      width: '48%',
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      gap: 6,
    },
    statusButtonEmoji: {
      fontSize: 24,
    },
    statusButtonText: {
      fontSize: 13,
      fontWeight: '700',
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
