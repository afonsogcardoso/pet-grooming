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
  const timeLabel = time || '—';
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] }).catch(() => null);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading && !isRefetching ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
        ) : null}
        {error ? (
          <Text style={styles.error}>Erro ao carregar marcação.</Text>
        ) : null}

        {appointment ? (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{service?.name || 'Serviço'}</Text>
              <Text style={styles.subtitle}>{formatDateTime(appointment.appointment_date, appointment.appointment_time)}</Text>
              {service?.price !== undefined && service?.price !== null ? (
                <Text style={styles.meta}>Valor: € {Number(service.price).toFixed(2)}</Text>
              ) : null}
              <Text style={styles.meta}>Duração: {appointment.duration ? `${appointment.duration} min` : '—'}</Text>
              <Text style={styles.meta}>Estado: {statusLabels[displayStatus] || displayStatus}</Text>
              <View style={styles.inlineActions}>
                <TouchableOpacity style={[styles.chip, { borderColor: colors.primary }]} onPress={togglePayment}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    Pagamento: {paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Cliente</Text>
              <Text style={styles.meta}>{customer?.name || 'Sem cliente'}</Text>
              {customer?.phone ? <Text style={styles.meta}>{customer.phone}</Text> : null}
              {customer?.address ? <Text style={styles.meta}>{customer.address}</Text> : null}
              <View style={styles.inlineActions}>
                {customer?.address ? (
                  <TouchableOpacity style={[styles.chip, { borderColor: colors.primary }]} onPress={openMaps}>
                    <Text style={styles.chipText}>Ver nos mapas</Text>
                  </TouchableOpacity>
                ) : null}
                {customer?.phone ? (
                  <TouchableOpacity style={[styles.chip, { borderColor: colors.primary }]} onPress={callCustomer}>
                    <Text style={styles.chipText}>Ligar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {pet ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Pet</Text>
                <Text style={styles.meta}>{pet.name || 'Pet'}</Text>
                {pet.breed ? <Text style={styles.meta}>{pet.breed}</Text> : null}
                {pet.photo_url ? (
                  <Image source={{ uri: pet.photo_url }} style={styles.petImage} />
                ) : null}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Fotos do serviço</Text>
              <View style={styles.photoRow}>
                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>Antes</Text>
                  {appointment?.before_photo_url ? (
                    <Image source={{ uri: appointment.before_photo_url }} style={styles.servicePhoto} />
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.surfaceBorder }]}>
                      <Text style={styles.placeholderText}>Sem foto</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.photoButton, { borderColor: colors.primary }]}
                    onPress={() => pickImage('before')}
                    disabled={photoMutation.isPending}
                  >
                    <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                      {appointment?.before_photo_url ? 'Alterar' : 'Adicionar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>Depois</Text>
                  {appointment?.after_photo_url ? (
                    <Image source={{ uri: appointment.after_photo_url }} style={styles.servicePhoto} />
                  ) : (
                    <View style={[styles.photoPlaceholder, { borderColor: colors.surfaceBorder }]}>
                      <Text style={styles.placeholderText}>Sem foto</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.photoButton, { borderColor: colors.primary }]}
                    onPress={() => pickImage('after')}
                    disabled={photoMutation.isPending}
                  >
                    <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                      {appointment?.after_photo_url ? 'Alterar' : 'Adicionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {photoMutation.isPending ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Estado da marcação</Text>
              <View style={styles.segment}>
                {['scheduled', 'pending', 'completed', 'cancelled'].map((value) => {
                  const active = displayStatus === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.segmentButton,
                        active && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                      ]}
                      onPress={() => saveStatus(value)}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: active ? colors.primary : colors.text },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {statusLabels[value] || value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {mutation.isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
            </View>

            {appointment.notes ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Notas</Text>
                <Text style={styles.meta}>{appointment.notes}</Text>
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
      paddingBottom: 32,
      gap: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      color: colors.muted,
      marginTop: 4,
    },
    meta: {
      color: colors.muted,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 4,
    },
    sectionTitle: {
      color: colors.text,
      fontWeight: '700',
      marginBottom: 6,
    },
    error: {
      color: colors.danger,
      textAlign: 'center',
      marginVertical: 12,
    },
    segment: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentText: {
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      paddingHorizontal: 4,
      minWidth: '100%',
    },
    inlineActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: {
      color: colors.text,
      fontWeight: '700',
    },
    petImage: {
      width: '100%',
      height: 160,
      borderRadius: 12,
      marginTop: 8,
    },
    photoRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    photoContainer: {
      flex: 1,
      alignItems: 'center',
    },
    photoLabel: {
      color: colors.text,
      fontWeight: '700',
      marginBottom: 8,
      fontSize: 14,
    },
    servicePhoto: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      marginBottom: 8,
    },
    photoPlaceholder: {
      width: '100%',
      height: 140,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    placeholderText: {
      color: colors.muted,
      fontSize: 12,
    },
    photoButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: colors.surface,
    },
    photoButtonText: {
      fontWeight: '600',
      fontSize: 13,
    },
  });
}
