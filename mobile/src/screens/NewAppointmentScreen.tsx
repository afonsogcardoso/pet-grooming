import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Linking,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAppointment } from '../api/appointments';
import { getBranding } from '../api/branding';
import type { Customer } from '../api/customers';
import { getCustomers, updateCustomer } from '../api/customers';
import { getServices } from '../api/services';

type Props = NativeStackScreenProps<any>;

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

function currentLocalTime() {
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Agendado' },
  { value: 'pending', label: 'Pendente' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'completed', label: 'Concluído' },
];

export default function NewAppointmentScreen({ navigation }: Props) {
  const [date, setDate] = useState(todayLocalISO());
  const [time, setTime] = useState(currentLocalTime());
  const [status, setStatus] = useState('scheduled');
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPet, setSelectedPet] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showServiceList, setShowServiceList] = useState(false);
  const [showPetList, setShowPetList] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNif, setCustomerNif] = useState('');

  const queryClient = useQueryClient();

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: getBranding,
    staleTime: 1000 * 60 * 60 * 6,
  });

  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
  });

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: getServices,
  });

  const customers = customersData || [];
  const services = servicesData || [];
  const primary = branding?.brand_primary || '#22c55e';
  const primarySoft = branding?.brand_primary_soft || '#22c55e1a';
  const background = branding?.brand_background || '#0f172a';
  const surface = '#111827';

  const selectedCustomerData = useMemo(
    () => customers.find((c) => c.id === selectedCustomer),
    [customers, selectedCustomer],
  );

  const petOptions = useMemo(() => selectedCustomerData?.pets || [], [selectedCustomerData]);

  const selectedServiceData = useMemo(
    () => services.find((s) => s.id === selectedService),
    [services, selectedService],
  );

  const effectivePhone = customerPhone || selectedCustomerData?.phone || '';
  const phoneDigits = effectivePhone.replace(/\D/g, '');
  const canSendWhatsapp = phoneDigits.length > 0;

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) => {
      const haystack = `${customer.name} ${customer.phone ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [customerSearch, customers]);

  useEffect(() => {
    if (selectedServiceData?.default_duration) {
      setDuration(selectedServiceData.default_duration);
    }
  }, [selectedServiceData]);

  const parsedDate = useMemo(() => {
    const safe = date ? new Date(`${date}T00:00:00`) : new Date();
    return Number.isNaN(safe.getTime()) ? new Date() : safe;
  }, [date]);

  const parsedTime = useMemo(() => {
    const [hh, mm] = time.split(':');
    const base = new Date(parsedDate);
    base.setHours(Number(hh) || 0);
    base.setMinutes(Number(mm) || 0);
    base.setSeconds(0);
    base.setMilliseconds(0);
    return base;
  }, [parsedDate, time]);

  useEffect(() => {
    setSelectedPet('');
    setSendWhatsapp((prev) => prev || canSendWhatsapp);
    if (selectedCustomerData) {
      setCustomerPhone(selectedCustomerData.phone || '');
      setCustomerAddress(selectedCustomerData.address || '');
      setCustomerNif(selectedCustomerData.nif || '');
    } else {
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerNif('');
    }
  }, [selectedCustomer, canSendWhatsapp, selectedCustomerData]);

  const mutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      if (sendWhatsapp && canSendWhatsapp) {
        await openWhatsapp();
      }
      Alert.alert('Sucesso', 'Marcação criada.');
      navigation.goBack();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao criar marcação';
      Alert.alert('Erro', message);
    },
  });

  const timeIsValid = /^\d{2}:\d{2}$/.test(time.trim());
  const canSubmit =
    Boolean(date && timeIsValid && selectedCustomer && selectedPet && selectedService) && !mutation.isPending;

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate.toLocaleDateString('sv-SE'));
    }
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) {
      const hh = `${selectedDate.getHours()}`.padStart(2, '0');
      const mm = `${selectedDate.getMinutes()}`.padStart(2, '0');
      setTime(`${hh}:${mm}`);
    }
  };

  const openDatePicker = () => setShowDatePicker(true);

  const openTimePicker = () => setShowTimePicker(true);

  const closePickers = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Campos obrigatórios', 'Seleciona cliente, pet, serviço, data e hora.');
      return;
    }

    if (selectedCustomerData) {
      const hasChanges =
        customerPhone.trim() !== (selectedCustomerData.phone || '') ||
        customerAddress.trim() !== (selectedCustomerData.address || '') ||
        customerNif.trim() !== (selectedCustomerData.nif || '');
      if (hasChanges) {
        try {
          const updated = await updateCustomer(selectedCustomerData.id, {
            phone: customerPhone.trim() || null,
            address: customerAddress.trim() || '',
            nif: customerNif.trim() || null,
          });
          queryClient.setQueryData(['customers'], (prev: Customer[] | undefined) => {
            if (!prev) return prev;
            return prev.map((c) => (c.id === selectedCustomerData.id ? { ...c, ...(updated || {}) } : c));
          });
        } catch (err: any) {
          const message = err?.response?.data?.error || err.message || 'Erro ao atualizar cliente';
          Alert.alert('Erro', message);
          return;
        }
      }
    }

    await mutation.mutateAsync({
      appointment_date: date,
      appointment_time: time.trim(),
      status,
      duration,
      notes: notes.trim() || null,
      customer_id: selectedCustomer,
      pet_id: selectedPet,
      service_id: selectedService,
      payment_status: 'unpaid',
    });
  };

  const buildWhatsappMessage = () => {
    const dateObj = date ? new Date(`${date}T00:00:00`) : null;
    const dateLabel = dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })
      : date;
    const timeLabel = time || '—';
    const serviceName = selectedServiceData?.name;
    const customerName = selectedCustomerData?.name;
    const pet = petOptions.find((p) => p.id === selectedPet);
    const address = customerAddress || selectedCustomerData?.address;

    const intro = customerName
      ? `Olá ${customerName}! Confirmamos a sua marcação para ${dateLabel} às ${timeLabel}.`
      : `Olá! Confirmamos a sua marcação para ${dateLabel} às ${timeLabel}.`;

    const lines = [
      serviceName && `Serviço: ${serviceName}`,
      pet ? `Pet: ${pet.name}${pet.breed ? ` (${pet.breed})` : ''}` : null,
      address && `Morada: ${address}`,
    ].filter(Boolean);

    return [intro, '', ...lines].join('\n');
  };

  const openWhatsapp = async () => {
    if (!canSendWhatsapp) {
      Alert.alert('WhatsApp', 'Cliente sem número válido.');
      return;
    }
    const message = buildWhatsappMessage();
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.');
      return;
    }
    await Linking.openURL(url);
  };

  const renderSelect = ({
    label,
    value,
    placeholder,
    onPress,
  }: {
    label: string;
    value?: string;
    placeholder: string;
    onPress: () => void;
  }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={[styles.select, { borderColor: primarySoft }]} onPress={onPress}>
        <Text style={[styles.selectText, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Nova Marcação</Text>
      <Text style={styles.subtitle}>Preenche os mesmos campos da página web.</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { borderColor: primarySoft, backgroundColor: surface }]}>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Data</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickInput, { borderColor: primarySoft }]}
              onPress={openDatePicker}
            >
              <Text style={styles.selectText}>{date}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Hora</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickInput, { borderColor: primarySoft }]}
              onPress={openTimePicker}
            >
              <Text style={[styles.selectText, !time && styles.placeholder]}>
                {time || 'Seleciona'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderSelect({
          label: 'Serviço',
          value: selectedServiceData?.name,
          placeholder: loadingServices ? 'A carregar serviços...' : 'Escolhe um serviço',
          onPress: () => setShowServiceList((prev) => !prev),
        })}
        {showServiceList ? (
          <View style={[styles.dropdown, { borderColor: primarySoft }]}>
            {loadingServices ? (
              <ActivityIndicator color={primary} />
            ) : (
              <ScrollView style={{ maxHeight: 180 }}>
                {services.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.option}
                    onPress={() => {
                      setSelectedService(service.id);
                      setShowServiceList(false);
                      if (service.default_duration) setDuration(service.default_duration);
                    }}
                  >
                    <Text style={styles.optionTitle}>{service.name}</Text>
                    {service.description ? (
                      <Text style={styles.optionSubtitle}>{service.description}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Duração</Text>
          <View style={styles.segment}>
            {[30, 60, 90].map((value) => {
              const active = duration === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.segmentButton,
                    active && { backgroundColor: primarySoft, borderColor: primary },
                  ]}
                  onPress={() => setDuration(value)}
                >
                  <Text style={[styles.segmentText, { color: active ? primary : '#e2e8f0' }]}>
                    {value} min
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Cliente</Text>
          <TouchableOpacity
            style={[styles.select, { borderColor: primarySoft }]}
            onPress={() => setShowCustomerList((prev) => !prev)}
          >
            <Text style={[styles.selectText, !selectedCustomerData && styles.placeholder]}>
              {selectedCustomerData?.name ||
                (loadingCustomers ? 'A carregar clientes...' : 'Escolhe um cliente')}
            </Text>
          </TouchableOpacity>
          {selectedCustomerData ? (
            <View style={styles.customerCard}>
              <Text style={styles.customerDetailLabel}>Telefone</Text>
              <TextInput
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="Telefone"
                placeholderTextColor="#64748b"
                style={[styles.input, styles.inlineInput]}
                keyboardType="phone-pad"
              />
              <Text style={styles.customerDetailLabel}>Morada</Text>
              <TextInput
                value={customerAddress}
                onChangeText={setCustomerAddress}
                placeholder="Morada"
                placeholderTextColor="#64748b"
                style={[styles.input, styles.inlineInput]}
              />
              <Text style={styles.customerDetailLabel}>NIF</Text>
              <TextInput
                value={customerNif}
                onChangeText={setCustomerNif}
                placeholder="NIF"
                placeholderTextColor="#64748b"
                style={[styles.input, styles.inlineInput]}
                keyboardType="number-pad"
              />
            </View>
          ) : null}
        </View>
        {showCustomerList ? (
          <View style={[styles.dropdown, { borderColor: primarySoft }]}>
            <TextInput
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Pesquisar por nome/telefone"
              placeholderTextColor="#64748b"
              style={[styles.input, { borderColor: primarySoft, marginBottom: 10 }]}
            />
            <ScrollView style={{ maxHeight: 200 }}>
              {filteredCustomers.map((customer: Customer) => (
                <TouchableOpacity
                  key={customer.id}
                  style={styles.option}
                  onPress={() => {
                    setSelectedCustomer(customer.id);
                    setShowCustomerList(false);
                    setShowPetList(false);
                  }}
                >
                  <Text style={styles.optionTitle}>{customer.name}</Text>
                  <Text style={styles.optionSubtitle}>{customer.phone || 'Sem telefone'}</Text>
                </TouchableOpacity>
              ))}
              {!loadingCustomers && filteredCustomers.length === 0 ? (
                <Text style={styles.optionSubtitle}>Nenhum cliente encontrado</Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {renderSelect({
          label: 'Animal',
          value: petOptions.find((p) => p.id === selectedPet)?.name,
          placeholder: selectedCustomer ? 'Escolhe um pet' : 'Seleciona primeiro o cliente',
          onPress: () => {
            if (!selectedCustomer) return;
            setShowPetList((prev) => !prev);
          },
        })}
        {showPetList ? (
          <View style={[styles.dropdown, { borderColor: primarySoft }]}>
            {petOptions.length === 0 ? (
              <Text style={styles.optionSubtitle}>Este cliente não tem pets registados.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 160 }}>
                {petOptions.map((pet) => (
                  <TouchableOpacity
                    key={pet.id}
                    style={styles.option}
                    onPress={() => {
                      setSelectedPet(pet.id);
                      setShowPetList(false);
                    }}
                  >
                    <Text style={styles.optionTitle}>{pet.name}</Text>
                    {pet.breed ? <Text style={styles.optionSubtitle}>{pet.breed}</Text> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Notas</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas para a equipa"
            placeholderTextColor="#64748b"
            multiline
            style={[styles.input, { borderColor: primarySoft, minHeight: 80, textAlignVertical: 'top' }]}
          />
        </View>

        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.label}>Enviar por WhatsApp</Text>
            {!canSendWhatsapp ? (
              <Text style={styles.helperText}>Seleciona um cliente com número válido.</Text>
            ) : null}
          </View>
          <Switch
            value={sendWhatsapp && canSendWhatsapp}
            onValueChange={setSendWhatsapp}
            disabled={!canSendWhatsapp}
            trackColor={{ false: '#475569', true: primary }}
            thumbColor="#0f172a"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.segment}>
            {STATUS_OPTIONS.map((entry) => {
              const active = status === entry.value;
              return (
                <TouchableOpacity
                  key={entry.value}
                  style={[
                    styles.segmentButton,
                    active && { backgroundColor: primarySoft, borderColor: primary },
                  ]}
                  onPress={() => setStatus(entry.value)}
                >
                  <Text style={[styles.segmentText, { color: active ? primary : '#e2e8f0' }]}>
                    {entry.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primary, opacity: canSubmit ? 1 : 0.5 }]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Criar marcação</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondary, { borderColor: primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
      {showDatePicker || showTimePicker ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closePickers}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closePickers}>
                  <Text style={styles.modalButton}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={closePickers}>
                  <Text style={[styles.modalButton, styles.modalButtonPrimary]}>OK</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalPickerContainer}>
                {showDatePicker ? (
                  <DateTimePicker
                    value={parsedDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    style={styles.modalPicker}
                  />
                ) : null}
                {showTimePicker ? (
                  <DateTimePicker
                    value={parsedTime}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    is24Hour
                    style={styles.modalPicker}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: '#cbd5e1',
    marginBottom: 6,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e2e8f0',
    backgroundColor: '#0f172a',
  },
  pickInput: {
    minHeight: 48,
    justifyContent: 'center',
  },
  select: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
  },
  selectText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  placeholder: {
    color: '#94a3b8',
    fontWeight: '400',
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#0f172a',
    marginBottom: 12,
  },
  option: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1e293b',
  },
  optionTitle: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  optionSubtitle: {
    color: '#94a3b8',
    marginTop: 2,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  segmentText: {
    fontWeight: '700',
    color: '#e2e8f0',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    paddingBottom: 16,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    width: '90%',
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  modalButton: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    color: '#22c55e',
  },
  modalPicker: {
    backgroundColor: '#0f172a',
    alignSelf: 'center',
  },
  modalPickerContainer: {
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    marginBottom: 12,
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  customerCard: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  customerDetail: {
    color: '#cbd5e1',
    marginBottom: 4,
    fontSize: 14,
  },
  customerDetailLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  inlineInput: {
    marginBottom: 4,
  },
});
