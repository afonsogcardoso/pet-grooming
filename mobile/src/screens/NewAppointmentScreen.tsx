import { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAppointment } from '../api/appointments';
import type { Customer, Pet } from '../api/customers';
import { createCustomer, createPet, getCustomers, updateCustomer } from '../api/customers';
import { getServices } from '../api/services';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { AddressAutocomplete } from '../components/appointment/AddressAutocomplete';
import { NewCustomerForm } from '../components/appointment/NewCustomerForm';
import { ExistingCustomerForm } from '../components/appointment/ExistingCustomerForm';
import { ServiceSelector } from '../components/appointment/ServiceSelector';
import { DateTimePickerModal } from '../components/appointment/DateTimePickerModal';

type Props = NativeStackScreenProps<any>;

function isHexLight(color?: string) {
  if (!color || typeof color !== 'string' || !color.startsWith('#')) return false;
  const hex = color.replace('#', '');
  const expanded = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (expanded.length !== 6) return false;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

function currentLocalTime() {
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function NewAppointmentScreen({ navigation }: Props) {
  const route = useRoute<Props['route']>();
  const initialDateParam = route.params?.date as string | undefined;
  const [date, setDate] = useState(initialDateParam || todayLocalISO());
  const [time, setTime] = useState(currentLocalTime());
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPet, setSelectedPet] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerNif, setNewCustomerNif] = useState('');
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showServiceList, setShowServiceList] = useState(false);
  const [showPetList, setShowPetList] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNif, setCustomerNif] = useState('');
  const placesKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY;
  const scrollViewRef = useRef<ScrollView>(null);
  const addressFieldRef = useRef<View>(null);

  const queryClient = useQueryClient();

  // Debug: verificar se a chave está carregada
  useEffect(() => {
    console.log('Google Places Key:', placesKey ? 'Configurada ✓' : 'NÃO CONFIGURADA ✗');
  }, []);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const primary = colors.primary;
  const primarySoft = colors.primarySoft;
  const background = colors.background;
  const surface = colors.surface;
  const pickerTheme = isHexLight(colors.background) ? 'light' : 'dark';
  const addressPlaceholder = 'Comece a digitar uma morada';

  const selectedCustomerData = useMemo(
    () => customers.find((c) => c.id === selectedCustomer),
    [customers, selectedCustomer],
  );

  const petOptions = useMemo(() => selectedCustomerData?.pets || [], [selectedCustomerData]);

  const selectedServiceData = useMemo(
    () => services.find((s) => s.id === selectedService),
    [services, selectedService],
  );

  const effectivePhone =
    mode === 'new'
      ? newCustomerPhone
      : customerPhone || selectedCustomerData?.phone || '';
  const phoneDigits = effectivePhone.replace(/\D/g, '');
  const canSendWhatsapp = phoneDigits.length > 0;

  type SearchResult =
    | { type: 'customer'; customer: Customer; label: string; subtitle?: string }
    | { type: 'pet'; customer: Customer; pet: Pet; label: string; subtitle?: string };

  const searchResults: SearchResult[] = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    const results: SearchResult[] = [];
    customers.forEach((customer) => {
      const baseSubtitle = customer.phone || customer.email || '';
      const customerMatch = !term
        ? true
        : `${customer.name} ${customer.phone ?? ''}`.toLowerCase().includes(term);
      if (customerMatch) {
        results.push({
          type: 'customer',
          customer,
          label: customer.name,
          subtitle: baseSubtitle,
        });
      }
      (customer.pets || []).forEach((pet) => {
        const haystack = `${pet.name} ${customer.name} ${customer.phone ?? ''}`.toLowerCase();
        if (!term || haystack.includes(term)) {
          results.push({
            type: 'pet',
            customer,
            pet,
            label: pet.name,
            subtitle: customer.name,
          });
        }
      });
    });
    return results;
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
    if (initialDateParam) {
      setDate(initialDateParam);
    }
    const belongs =
      selectedPet && selectedCustomerData?.pets?.some((pet) => pet.id === selectedPet);
    if (!belongs) {
      setSelectedPet('');
    }
    setSendWhatsapp((prev) => prev || canSendWhatsapp);
    if (mode === 'new') {
      setSelectedCustomer('');
      setSelectedPet('');
    }

    if (selectedCustomerData) {
      setCustomerPhone(selectedCustomerData.phone || '');
      setCustomerAddress(selectedCustomerData.address || '');
      setCustomerNif(selectedCustomerData.nif || '');
    } else {
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerNif('');
    }
  }, [selectedCustomer, selectedCustomerData, selectedPet, canSendWhatsapp]);

  const mutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: async (createdAppointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      if (sendWhatsapp && canSendWhatsapp) {
        await openWhatsapp();
      }
      // Navega para os detalhes da marcação criada
      if (createdAppointment?.id) {
        navigation.replace('AppointmentDetail', { id: createdAppointment.id });
      } else {
        Alert.alert('Sucesso', 'Marcação criada.');
        navigation.goBack();
      }
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err.message || 'Erro ao criar marcação';
      Alert.alert('Erro', message);
    },
  });

  const timeIsValid = /^\d{2}:\d{2}$/.test(time.trim());
  const hasExistingSelection = Boolean(selectedCustomer && selectedPet);
  const hasNewSelection = Boolean(
    newCustomerName.trim() && newPetName.trim(),
  );
  const canSubmit =
    Boolean(
      date &&
        timeIsValid &&
        selectedService &&
        (mode === 'existing' ? hasExistingSelection : hasNewSelection),
    ) && !mutation.isPending;

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

    let customerId = selectedCustomer;
    let petId = selectedPet;

    if (mode === 'new') {
      try {
        const createdCustomer = await createCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          email: newCustomerEmail.trim() || null,
          address: newCustomerAddress.trim() || null,
          nif: newCustomerNif.trim() || null,
        });
        customerId = createdCustomer.id;

        const createdPet = await createPet(customerId, {
          name: newPetName.trim(),
          breed: newPetBreed.trim() || null,
        });
        petId = createdPet.id;

        // Atualiza cache local para futuras buscas
        queryClient.setQueryData(['customers'], (prev: Customer[] | undefined) => {
          const next = prev ? [...prev] : [];
          next.push({ ...createdCustomer, pets: [createdPet] });
          return next;
        });
      } catch (err: any) {
        const message = err?.response?.data?.error || err.message || 'Erro ao criar cliente/pet';
        Alert.alert('Erro', message);
        return;
      }
    } else if (selectedCustomerData) {
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
      status: 'scheduled',
      duration,
      notes: notes.trim() || null,
      customer_id: customerId,
      pet_id: petId,
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
    const customerName = mode === 'new' ? newCustomerName : selectedCustomerData?.name;
    const pet =
      mode === 'new'
        ? { name: newPetName, breed: newPetBreed || '' }
        : petOptions.find((p) => p.id === selectedPet);
    const address = mode === 'new' ? newCustomerAddress : customerAddress || selectedCustomerData?.address;

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>✨ Nova Marcação</Text>
          <Text style={styles.subtitle}>Cria rapidamente uma nova marcação</Text>
        </View>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
        >
        <View style={styles.content}>
          {/* Seção: Quando e O Quê */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📅 Quando e O Quê</Text>
            
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Data</Text>
                <TouchableOpacity
                  style={[styles.input, styles.pickInput]}
                  onPress={openDatePicker}
                >
                  <Text style={styles.pickText}>{date}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Hora</Text>
                <TouchableOpacity
                  style={[styles.input, styles.pickInput]}
                  onPress={openTimePicker}
                >
                  <Text style={[styles.pickText, !time && styles.placeholder]}>
                    {time || 'Hora'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ServiceSelector
              selectedService={selectedService}
              selectedServiceData={selectedServiceData}
              services={services}
              loadingServices={loadingServices}
              showServiceList={showServiceList}
              setShowServiceList={setShowServiceList}
              setSelectedService={setSelectedService}
              setDuration={setDuration}
            />

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
                        active && { backgroundColor: primarySoft, borderColor: primary, borderWidth: 1.5 },
                      ]}
                      onPress={() => setDuration(value)}
                    >
                      <Text style={[styles.segmentText, { color: active ? primary : colors.text }]}>
                        {value} min
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Seção: Para Quem */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🐾 Para Quem</Text>
            
            <View style={styles.segment}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  mode === 'new' && { backgroundColor: primarySoft, borderColor: primary, borderWidth: 1.5 },
                ]}
                onPress={() => {
                  setMode('new');
                  setSelectedCustomer('');
                  setSelectedPet('');
                  setCustomerSearch('');
                  setCustomerPhone('');
                  setCustomerAddress('');
                  setCustomerNif('');
                }}
              >
                <Text style={[styles.segmentText, { color: mode === 'new' ? primary : colors.text }]}>➕ Novo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  mode === 'existing' && { backgroundColor: primarySoft, borderColor: primary, borderWidth: 1.5 },
                ]}
                onPress={() => {
                  setMode('existing');
                  setNewCustomerName('');
                  setNewCustomerPhone('');
                  setNewCustomerEmail('');
                  setNewCustomerAddress('');
                  setNewCustomerNif('');
                  setNewPetName('');
                  setNewPetBreed('');
                }}
              >
                <Text style={[styles.segmentText, { color: mode === 'existing' ? primary : colors.text }]}>📋 Existente</Text>
              </TouchableOpacity>
            </View>

        {mode === 'existing' ? (
          <ExistingCustomerForm
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            showCustomerList={showCustomerList}
            setShowCustomerList={setShowCustomerList}
            searchResults={searchResults}
            loadingCustomers={loadingCustomers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            setSelectedPet={setSelectedPet}
            setShowPetList={setShowPetList}
            selectedCustomerData={selectedCustomerData}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            customerAddress={customerAddress}
            setCustomerAddress={setCustomerAddress}
            customerNif={customerNif}
            setCustomerNif={setCustomerNif}
            addressPlaceholder={addressPlaceholder}
            showPetList={showPetList}
            selectedPet={selectedPet}
            petOptions={petOptions}
            primarySoft={primarySoft}
          />
        ) : (
          <NewCustomerForm
            customerName={newCustomerName}
            setCustomerName={setNewCustomerName}
            customerPhone={newCustomerPhone}
            setCustomerPhone={setNewCustomerPhone}
            customerEmail={newCustomerEmail}
            setCustomerEmail={setNewCustomerEmail}
            customerAddress={newCustomerAddress}
            setCustomerAddress={setNewCustomerAddress}
            customerNif={newCustomerNif}
            setCustomerNif={setNewCustomerNif}
            petName={newPetName}
            setPetName={setNewPetName}
            petBreed={newPetBreed}
            setPetBreed={setNewPetBreed}
            addressPlaceholder={addressPlaceholder}
          />
        )}
          </View>

          {/* Seção: Notas */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📝 Informações Adicionais</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>Notas</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Adiciona notas para a equipa (opcional)"
                placeholderTextColor={colors.muted}
                multiline
                style={[
                  styles.input,
                  { minHeight: 100, textAlignVertical: 'top' },
                ]}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>💬 Enviar por WhatsApp</Text>
                {!canSendWhatsapp ? (
                  <Text style={styles.helperText}>Adiciona um número de telefone</Text>
                ) : null}
              </View>
              <Switch
            value={sendWhatsapp && canSendWhatsapp}
            onValueChange={setSendWhatsapp}
            disabled={!canSendWhatsapp}
            trackColor={{ false: colors.surfaceBorder, true: primary }}
            thumbColor={colors.onPrimary}
              />
            </View>
          </View>

          {/* Botões de Ação */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: primary, opacity: canSubmit ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {mutation.isPending ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>✨ Criar Marcação</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      <DateTimePickerModal
        visible={showDatePicker || showTimePicker}
        onClose={closePickers}
        showDatePicker={showDatePicker}
        showTimePicker={showTimePicker}
        parsedDate={parsedDate}
        parsedTime={parsedTime}
        onDateChange={handleDateChange}
        onTimeChange={handleTimeChange}
        pickerTheme={pickerTheme}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 15,
      color: colors.muted,
      fontWeight: '500',
    },
    keyboardAvoid: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    scrollContent: {
      paddingBottom: 400,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    field: {
      marginBottom: 16,
    },
    label: {
      color: colors.text,
      marginBottom: 8,
      fontWeight: '600',
      fontSize: 15,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
      fontSize: 15,
      fontWeight: '500',
    },
    pickInput: {
      minHeight: 52,
      justifyContent: 'center',
    },
    select: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    pickText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 16,
    },
    selectText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: 15,
    },
    placeholder: {
      color: colors.muted,
      fontWeight: '500',
    },
    dropdown: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
      marginBottom: 12,
      borderColor: colors.primarySoft,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    option: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    optionTitle: {
      color: colors.text,
      fontWeight: '700',
    },
    optionSubtitle: {
      color: colors.muted,
      marginTop: 2,
    },
    segment: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 20,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    segmentText: {
      fontWeight: '700',
      fontSize: 15,
      color: colors.text,
    },
    button: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 17,
    },
    secondary: {
      borderWidth: 1.5,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    secondaryText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 17,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    helperText: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 4,
    },
  });
}
