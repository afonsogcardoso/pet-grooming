import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAppointment } from '../api/appointments';
import { getBranding } from '../api/branding';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<any>;

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export default function NewAppointmentScreen({ navigation }: Props) {
  const [date, setDate] = useState(todayLocalISO());
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('scheduled');
  const queryClient = useQueryClient();

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const primary = branding?.brand_primary || '#22c55e';
  const primarySoft = branding?.brand_primary_soft || '#22c55e1a';
  const background = branding?.brand_background || '#0f172a';

  const mutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      Alert.alert('Sucesso', 'Marcação criada.');
      navigation.goBack();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao criar marcação';
      Alert.alert('Erro', message);
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      appointment_date: date,
      appointment_time: time || null,
      status,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Nova Marcação</Text>
      <Text style={styles.subtitle}>Informe data, hora e status</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Data (YYYY-MM-DD)</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="2025-12-10"
          style={[styles.input, { borderColor: primarySoft }]}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Hora (HH:MM)</Text>
        <TextInput
          value={time}
          onChangeText={setTime}
          placeholder="14:30"
          style={[styles.input, { borderColor: primarySoft }]}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Status</Text>
        <TextInput
          value={status}
          onChangeText={setStatus}
          placeholder="scheduled"
          style={[styles.input, { borderColor: primarySoft }]}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: primary }]}
        onPress={handleSubmit}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Criar</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.secondary, { borderColor: primary }]} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryText}>Cancelar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 16,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: '#cbd5e1',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e2e8f0',
    backgroundColor: '#0f172a',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
});
