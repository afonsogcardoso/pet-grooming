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
  Modal,
  Linking,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { createAppointment } from '../api/appointments';
import type { Customer } from '../api/customers';
import { createCustomer, createPet, getCustomers, updateCustomer } from '../api/customers';
import { getServices } from '../api/services';
import { useBrandingTheme } from '../theme/useBrandingTheme';

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



  const AddressAutocomplete = ({
    value,
    onSelect,
    placeholder,
  }: {
    value: string;
    onSelect: (val: string) => void;
    placeholder: string;
  }) => {
    const autocompleteRef = useRef<any>(null);

    // Atualiza o texto quando o valor externo muda
    useEffect(() => {
      if (autocompleteRef.current && value) {
        autocompleteRef.current.setAddressText(value);
      }
    }, [value]);

    if (!placesKey) {
      return (
        <TextInput
          value={value}
          onChangeText={onSelect}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.surfaceBorder }]}
        />
      );
    }

    return (
      <View ref={addressFieldRef} style={{ zIndex: 1000, marginBottom: 8 }}>
        <GooglePlacesAutocomplete
          ref={autocompleteRef}
          placeholder={placeholder}
          fetchDetails={true}
          enablePoweredByContainer={false}
          minLength={2}
          listViewDisplayed="auto"
          debounce={300}
          disableScroll={true}
          renderRow={(data) => (
            <View style={{ padding: 12 }}>
              <Text style={{ color: colors.text, fontSize: 13 }}>
                {data.description}
              </Text>
            </View>
          )}
          flatListProps={{
            scrollEnabled: false,
            nestedScrollEnabled: true,
          }}
          textInputProps={{
            placeholderTextColor: colors.muted,
            autoCorrect: false,
            returnKeyType: 'done',
          }}
          query={{
            key: placesKey,
            language: 'pt',
            components: 'country:pt',
          }}
          onPress={(data, details = null) => {
            const address = details?.formatted_address || data.description || '';
            onSelect(address);
            // Atualiza o texto no input após seleção
            if (autocompleteRef.current) {
              autocompleteRef.current.setAddressText(address);
            }
          }}
          onFail={(error) => console.log('Places error:', error)}
          onNotFound={() => console.log('No results')}
          styles={{
            container: {
              flex: 0,
              width: '100%',
            },
            textInputContainer: {
              paddingHorizontal: 0,
              backgroundColor: 'transparent',
            },
            textInput: {
              backgroundColor: colors.surface,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              color: colors.text,
              fontWeight: '600',
              fontSize: 14,
              height: 44,
            },
            listView: {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primarySoft,
              borderRadius: 12,
              marginTop: 6,
              maxHeight: 200,
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
            },
            row: {
              padding: 12,
              minHeight: 44,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.surfaceBorder,
              backgroundColor: colors.surface,
            },
            description: {
              color: colors.text,
              fontSize: 13,
            },
            separator: {
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.surfaceBorder,
            },
            poweredContainer: {
              display: 'none',
            },
            powered: {
              display: 'none',
            },
          }}
        />
      </View>
    );
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
      <TouchableOpacity style={[styles.select, { borderColor: colors.surfaceBorder }]} onPress={onPress}>
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
        <View style={[styles.card, { borderColor: primarySoft, backgroundColor: surface }]}>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Data</Text>
              <TouchableOpacity
                style={[styles.input, styles.pickInput, { borderColor: colors.surfaceBorder }]}
                onPress={openDatePicker}
              >
                <Text style={styles.pickText}>{date}</Text>
              </TouchableOpacity>
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Hora</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickInput, { borderColor: colors.surfaceBorder }]}
              onPress={openTimePicker}
            >
              <Text style={[styles.pickText, !time && styles.placeholder]}>
                {time || 'Seleciona'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderSelect({
          label: 'Serviços',
          value: selectedServiceData?.name,
          placeholder: loadingServices ? 'A carregar serviços...' : 'Escolhe um serviço',
          onPress: () => setShowServiceList((prev) => !prev),
        })}
        {showServiceList ? (
          <View style={[styles.dropdown, { borderColor: colors.surfaceBorder }]}>
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
                  <Text style={[styles.segmentText, { color: active ? primary : colors.text }]}>
                    {value} min
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.segment}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              mode === 'new' && { backgroundColor: primarySoft, borderColor: primary },
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
            <Text style={[styles.segmentText, { color: mode === 'new' ? primary : colors.text }]}>Novo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              mode === 'existing' && { backgroundColor: primarySoft, borderColor: primary },
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
            <Text style={[styles.segmentText, { color: mode === 'existing' ? primary : colors.text }]}>Existente</Text>
          </TouchableOpacity>
        </View>

        {mode === 'existing' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Cliente</Text>
              <TouchableOpacity
                style={[styles.select, { borderColor: colors.surfaceBorder }]}
                onPress={() => setShowCustomerList((prev) => !prev)}
              >
                <Text style={[styles.selectText, !selectedCustomerData && styles.placeholder]}>
                  {selectedCustomerData?.name ||
                    (loadingCustomers ? 'A carregar clientes...' : 'Escolhe um cliente')}
                </Text>
              </TouchableOpacity>
            {selectedCustomerData ? (
              <View style={[styles.customerCard, { borderColor: primarySoft }]}>
                <Text style={styles.customerDetailLabel}>Telefone</Text>
                <TextInput
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  placeholder="Telefone"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, styles.inlineInput]}
                  keyboardType="phone-pad"
                />
                <Text style={styles.customerDetailLabel}>Morada</Text>
                <AddressAutocomplete
                  value={customerAddress}
                  onSelect={setCustomerAddress}
                  placeholder={addressPlaceholder}
                />
                <Text style={styles.customerDetailLabel}>NIF</Text>
                <TextInput
                  value={customerNif}
                  onChangeText={setCustomerNif}
                  placeholder="NIF"
                  placeholderTextColor={colors.muted}
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
                  placeholder="Pesquisar por cliente ou pet"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { borderColor: primarySoft, marginBottom: 10 }]}
                />
                <ScrollView style={{ maxHeight: 200 }}>
                  {searchResults.map((result) => {
                    const key =
                      result.type === 'customer'
                        ? `customer-${result.customer.id}`
                        : `pet-${result.pet.id}`;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={styles.option}
                        onPress={() => {
                          setSelectedCustomer(result.customer.id);
                          if (result.type === 'pet') {
                            setSelectedPet(result.pet.id);
                          }
                          setShowCustomerList(false);
                          setShowPetList(false);
                        }}
                      >
                        <Text style={styles.optionTitle}>
                          {result.label}
                          {result.type === 'pet' ? ' (pet)' : ''}
                        </Text>
                        {result.subtitle ? <Text style={styles.optionSubtitle}>{result.subtitle}</Text> : null}
                        {result.type === 'pet' && result.customer.phone ? (
                          <Text style={styles.optionSubtitle}>{result.customer.phone}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                  {!loadingCustomers && searchResults.length === 0 ? (
                    <Text style={styles.optionSubtitle}>Nenhum resultado</Text>
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
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Cliente novo</Text>
              <TextInput
                value={newCustomerName}
                onChangeText={setNewCustomerName}
                placeholder="Nome do cliente"
                placeholderTextColor={colors.muted}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                value={newCustomerPhone}
                onChangeText={setNewCustomerPhone}
                placeholder="Telefone"
                placeholderTextColor={colors.muted}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={newCustomerEmail}
                onChangeText={setNewCustomerEmail}
                placeholder="email@dominio.com"
                placeholderTextColor={colors.muted}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
                keyboardType="email-address"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Morada</Text>
              <AddressAutocomplete
                value={newCustomerAddress}
                onSelect={setNewCustomerAddress}
                placeholder={addressPlaceholder}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>NIF</Text>
              <TextInput
                value={newCustomerNif}
                onChangeText={setNewCustomerNif}
                placeholder="NIF"
                placeholderTextColor={colors.muted}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Animal</Text>
              <TextInput
                value={newPetName}
                onChangeText={setNewPetName}
                placeholder="Nome do animal"
                placeholderTextColor={colors.muted}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Raça (opcional)</Text>
              <TextInput
                value={newPetBreed}
                onChangeText={setNewPetBreed}
                placeholder="Raça"
                placeholderTextColor={colors.muted}
                style={[styles.input, { borderColor: colors.surfaceBorder }]}
              />
            </View>
          </>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Notas</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas para a equipa"
            placeholderTextColor={colors.muted}
            multiline
            style={[
              styles.input,
              { borderColor: colors.surfaceBorder, minHeight: 80, textAlignVertical: 'top' },
            ]}
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
            trackColor={{ false: colors.surfaceBorder, true: primary }}
            thumbColor={colors.onPrimary}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: primary, opacity: canSubmit ? 1 : 0.5 }]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Criar marcação</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondary, { borderColor: primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
                    themeVariant={pickerTheme}
                    textColor={colors.text}
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
                    themeVariant={pickerTheme}
                    textColor={colors.text}
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

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      color: colors.muted,
      marginBottom: 16,
    },
    card: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      borderColor: colors.primarySoft,
      backgroundColor: colors.surface,
    },
    scrollContent: {
      paddingBottom: 400,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    field: {
      marginBottom: 14,
    },
    label: {
      color: colors.text,
      marginBottom: 6,
      fontWeight: '700',
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
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
      backgroundColor: colors.surface,
      borderColor: colors.primarySoft,
    },
    pickText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
    },
    selectText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    placeholder: {
      color: colors.muted,
      fontWeight: '500',
    },
    dropdown: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
      backgroundColor: colors.surface,
      marginBottom: 12,
      borderColor: colors.primarySoft,
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
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    segmentText: {
      fontWeight: '700',
      color: colors.text,
    },
    button: {
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 6,
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    secondary: {
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    secondaryText: {
      color: colors.text,
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
      backgroundColor: colors.surface,
      paddingBottom: 16,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 12,
      width: '90%',
      maxWidth: 380,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    modalButton: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonPrimary: {
      color: colors.primary,
    },
    modalPicker: {
      backgroundColor: colors.surface,
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
      borderColor: colors.primarySoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    helperText: {
      color: colors.muted,
      fontSize: 12,
    },
    customerCard: {
      marginTop: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primarySoft,
    },
    customerDetail: {
      color: colors.text,
      marginBottom: 4,
      fontSize: 14,
    },
    customerDetailLabel: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 8,
      marginBottom: 4,
    },
    inlineInput: {
      marginBottom: 4,
    },
  });
}
