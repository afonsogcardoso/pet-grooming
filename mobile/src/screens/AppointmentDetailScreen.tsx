import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAppointment, updateAppointment } from '../api/appointments';
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId),
  });

  const mutation = useMutation({
    mutationFn: (payload: { status?: string | null }) => updateAppointment(appointmentId, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      queryClient.setQueryData(['appointment', appointmentId], updated);
      Alert.alert('Sucesso', 'Marcação atualizada.');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao atualizar marcação';
      Alert.alert('Erro', message);
    },
  });

  const appointment = data;
  const displayStatus = status ?? appointment?.status ?? 'scheduled';
  const customer = appointment?.customers;
  const service = appointment?.services;

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
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
              <Text style={styles.meta}>Estado: {displayStatus}</Text>
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
                      <Text style={[styles.segmentText, { color: active ? colors.primary : colors.text }]}>
                        {value}
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
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
    },
    segmentText: {
      fontWeight: '700',
      color: colors.text,
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
  });
}
