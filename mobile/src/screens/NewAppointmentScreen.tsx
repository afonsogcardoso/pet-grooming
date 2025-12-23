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
import { createAppointment, updateAppointment, getAppointment } from '../api/appointments';
import type { Customer, Pet } from '../api/customers';
import { createCustomer, createPet, getCustomers, updateCustomer } from '../api/customers';
import { getServices } from '../api/services';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { FontAwesome } from '@expo/vector-icons';
import { AddressAutocomplete } from '../components/appointment/AddressAutocomplete';
import { NewCustomerForm } from '../components/appointment/NewCustomerForm';
import { ExistingCustomerForm } from '../components/appointment/ExistingCustomerForm';
import { ServiceSelector } from '../components/appointment/ServiceSelector';
import { DateTimePickerModal } from '../components/appointment/DateTimePickerModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { getDateLocale } from '../i18n';

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

function formatHHMM(value?: string | null) {
  if (!value) return '';
  const safe = value.trim();
  // Handles formats like "10:00" or "10:00:00"
  const parts = safe.split(':');
  if (parts.length >= 2) {
    const hh = `${parts[0]}`.padStart(2, '0');
    const mm = `${parts[1]}`.padStart(2, '0');
    return `${hh}:${mm}`;
  }
  return safe.slice(0, 5);
}

function parseAmountInput(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const sanitized = normalized.replace(/[^0-9.]/g, '');
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function NewAppointmentScreen({ navigation }: Props) {
  const route = useRoute<Props['route']>();
  const initialDateParam = route.params?.date as string | undefined;
  const initialTimeParam = route.params?.time as string | undefined;
  const editAppointmentId = route.params?.editId as string | undefined;
  const isEditMode = !!editAppointmentId;
  
  const [date, setDate] = useState(initialDateParam || todayLocalISO());
  const [time, setTime] = useState(formatHHMM(initialTimeParam) || currentLocalTime());
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedPet, setSelectedPetState] = useState('');
  
  const setSelectedPet = (value: string) => {
    setSelectedPetState(value);
  };
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [amountInput, setAmountInput] = useState('');
  const [amountEdited, setAmountEdited] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>(isEditMode ? 'existing' : 'new');
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
  const { t } = useTranslation();
  const dateLocale = getDateLocale();

  // Debug: verificar se a chave está carregada
  useEffect(() => {
    console.log('Google Places Key:', placesKey ? 'Configurada ✓' : 'NÃO CONFIGURADA ✗');
  }, []);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Load appointment data if in edit mode
  const { data: appointmentData, isLoading: loadingAppointment } = useQuery({
    queryKey: ['appointment', editAppointmentId],
    queryFn: () => getAppointment(editAppointmentId!),
    enabled: isEditMode,
  });

  // Load appointment data into form when available
  const appointmentDataRef = useRef(appointmentData);
  
  useEffect(() => {
    appointmentDataRef.current = appointmentData;
  }, [appointmentData]);

  useEffect(() => {
    if (appointmentData && isEditMode) {
      setDate(appointmentData.appointment_date || todayLocalISO());
      setTime(formatHHMM(appointmentData.appointment_time) || currentLocalTime());
      setDuration(appointmentData.duration || 60);
      setNotes(appointmentData.notes || '');
      
      // Load services from appointment_services or fallback to single service
      const serviceIds: string[] = [];
      if (appointmentData.appointment_services && appointmentData.appointment_services.length > 0) {
        serviceIds.push(...appointmentData.appointment_services.map((as: any) => as.service_id));
      } else if (appointmentData.services?.id) {
        serviceIds.push(appointmentData.services.id);
      }
      setSelectedServices(serviceIds);
      
      // Set customer and pet IDs
      const customerId = appointmentData.customers?.id || '';
      const petId = appointmentData.pets?.id || '';
      
      setSelectedCustomer(customerId);
      setSelectedPet(petId);
      setMode('existing');
      
      // Set customer details
      setCustomerSearch(appointmentData.customers?.name || '');
      setCustomerPhone(appointmentData.customers?.phone || '');
      setCustomerAddress(appointmentData.customers?.address || '');
      setCustomerNif(appointmentData.customers?.nif || '');
    }
  }, [appointmentData, isEditMode]);

  useEffect(() => {
    if (!appointmentData || !isEditMode) return;
    if (amountEdited) return;
    if (appointmentData.amount != null) {
      setAmountInput(appointmentData.amount.toFixed(2));
      setAmountEdited(true);
    }
  }, [appointmentData, isEditMode, amountEdited]);

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
  const addressPlaceholder = t('appointmentForm.addressPlaceholder');

  const selectedCustomerData = useMemo(
    () => {
      const found = customers.find((c) => c.id === selectedCustomer);
      
      // Fallback: se não encontrar na lista mas estamos em modo de edição,
      // usar os dados do appointment que já foram carregados
      if (!found && isEditMode && appointmentDataRef.current?.customers) {
        return appointmentDataRef.current.customers as any;
      }
      
      return found;
    },
    [customers, selectedCustomer, isEditMode, appointmentData?.customers?.id],
  );

  const petOptions = useMemo(() => {
    const pets = selectedCustomerData?.pets || [];
    
    // Fallback: se estamos em modo de edição e não temos pets mas temos dados da marcação,
    // usar os pets da marcação
    if (pets.length === 0 && isEditMode && appointmentDataRef.current?.pets && selectedPet) {
      return [appointmentDataRef.current.pets];
    }
    
    return pets;
  }, [selectedCustomerData, isEditMode, selectedPet, appointmentData?.pets?.id]);

  const selectedServicesData = useMemo(() => {
    return services.filter((s) => selectedServices.includes(s.id));
  }, [services, selectedServices]);

  const servicesTotal = useMemo(() => {
    return selectedServicesData.reduce((sum, service) => {
      return sum + (service.price || 0);
    }, 0);
  }, [selectedServicesData]);

  useEffect(() => {
    if (amountEdited) return;
    if (servicesTotal > 0) {
      setAmountInput(servicesTotal.toFixed(2));
    } else {
      setAmountInput('');
    }
  }, [servicesTotal, amountEdited]);

  const amountValue = useMemo(() => parseAmountInput(amountInput), [amountInput]);

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
    // Set duration to sum of all selected services default durations
    if (selectedServicesData.length > 0) {
      const totalDuration = selectedServicesData.reduce((sum, service) => {
        return sum + (service.default_duration || 0);
      }, 0);
      if (totalDuration > 0) {
        setDuration(totalDuration);
      }
    }
  }, [selectedServicesData]);

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
    
    // Only reset pet if changing customer and pet doesn't belong to new customer (new appointments only)
    if (mode === 'new') {
      const belongs =
        selectedPet && selectedCustomerData?.pets?.some((pet: Pet) => pet.id === selectedPet);
      if (!belongs) {
        setSelectedPet('');
      }
    }
    
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
  }, [selectedCustomer, selectedCustomerData, selectedPet, canSendWhatsapp, mode]);

  // Reset customer/pet when toggling to new appointment mode
  useEffect(() => {
    if (mode === 'new') {
      setSelectedCustomer('');
      setSelectedPet('');
    }
  }, [mode]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditMode && editAppointmentId) {
        return updateAppointment(editAppointmentId, payload);
      }
      return createAppointment(payload);
    },
    onSuccess: async (savedAppointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['appointment', editAppointmentId] }).catch(() => null);
      }
      if (sendWhatsapp && canSendWhatsapp && !isEditMode) {
        await openWhatsapp();
      }
      // Navega para os detalhes da marcação
      if (savedAppointment?.id) {
        navigation.replace('AppointmentDetail', { id: savedAppointment.id });
      } else {
        navigation.goBack();
      }
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error ||
        err.message ||
        (isEditMode ? t('appointmentForm.updateError') : t('appointmentForm.createError'));
      Alert.alert(t('common.error'), message);
    },
  });

  const timeIsValid = /^\d{2}:\d{2}$/.test(formatHHMM(time).trim());
  const hasExistingSelection = Boolean(selectedCustomer && selectedPet);
  const hasNewSelection = Boolean(
    newCustomerName.trim() && newPetName.trim(),
  );
  const isSubmitting = mutation.isPending;
  const canSubmit =
    Boolean(
      date &&
        timeIsValid &&
        selectedServices.length > 0 &&
        (mode === 'existing' ? hasExistingSelection : hasNewSelection),
    ) && !isSubmitting;

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

  const handleAmountChange = (value: string) => {
    setAmountEdited(true);
    setAmountInput(value.replace(/[^0-9.,]/g, ''));
  };

  const handleUseServicesAmount = () => {
    setAmountEdited(false);
    setAmountInput(servicesTotal > 0 ? servicesTotal.toFixed(2) : '');
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return; // Previne múltiplos cliques
    }

    if (!canSubmit) {
      Alert.alert(t('appointmentForm.requiredTitle'), t('appointmentForm.requiredMessage'));
      return;
    }

    if (amountInput.trim() && amountValue === null) {
      Alert.alert(t('common.error'), t('appointmentForm.amountInvalid'));
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
        const message = err?.response?.data?.error || err.message || t('appointmentForm.createCustomerPetError');
        Alert.alert(t('common.error'), message);
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
          const message = err?.response?.data?.error || err.message || t('appointmentForm.updateCustomerError');
          Alert.alert(t('common.error'), message);
          return;
        }
      }
    }

    await mutation.mutateAsync({
      appointment_date: date,
      appointment_time: formatHHMM(time).trim(),
      status: 'scheduled',
      duration,
      amount: amountValue ?? null,
      notes: notes.trim() || null,
      customer_id: customerId,
      pet_id: petId,
      service_id: selectedServices[0] || null, // Keep for backward compatibility
      service_ids: selectedServices, // New field for multiple services
    });
  };

  const buildWhatsappMessage = () => {
    const dateObj = date ? new Date(`${date}T00:00:00`) : null;
    const dateLabel = dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })
      : date;
    const timeLabel = time || '—';
    const serviceNames = selectedServicesData.map(s => s.name).join(', ') || t('common.noData');
    const customerName = mode === 'new' ? newCustomerName : selectedCustomerData?.name;
    const pet =
      mode === 'new'
        ? { name: newPetName, breed: newPetBreed || '' }
        : petOptions.find((p: Pet) => p.id === selectedPet);
    const address = mode === 'new' ? newCustomerAddress : customerAddress || selectedCustomerData?.address;

    const intro = customerName
      ? t('appointmentForm.whatsappIntroWithName', { name: customerName, date: dateLabel, time: timeLabel })
      : t('appointmentForm.whatsappIntro', { date: dateLabel, time: timeLabel });
    const petLabel = pet ? `${pet.name}${pet.breed ? ` (${pet.breed})` : ''}` : null;

    const lines = [
      serviceNames && t('appointmentForm.whatsappServices', { services: serviceNames }),
      petLabel ? t('appointmentForm.whatsappPet', { pet: petLabel }) : null,
      address && t('appointmentForm.whatsappAddress', { address }),
    ].filter(Boolean);

    return [intro, '', ...lines].join('\n');
  };

  const openWhatsapp = async () => {
    if (!canSendWhatsapp) {
      Alert.alert(t('appointmentForm.whatsappTitle'), t('appointmentForm.whatsappNoNumber'));
      return;
    }
    const message = buildWhatsappMessage();
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(t('appointmentForm.whatsappTitle'), t('appointmentForm.whatsappOpenError'));
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={isEditMode ? t('appointmentForm.editTitle') : t('appointmentForm.createTitle')} />
      <View style={styles.headerInfo}>
        <Text style={styles.subtitle}>
          {isEditMode ? t('appointmentForm.editSubtitle') : t('appointmentForm.createSubtitle')}
        </Text>
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
          {/* Seção: Data e Serviço */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('appointmentForm.dateServiceSection')}</Text>
            
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>{t('appointmentForm.dateLabel')}</Text>
                <TouchableOpacity
                  style={[styles.input, styles.pickInput]}
                  onPress={openDatePicker}
                >
                  <Text style={styles.pickText}>{date}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>{t('appointmentForm.timeLabel')}</Text>
                <TouchableOpacity
                  style={[styles.input, styles.pickInput]}
                  onPress={openTimePicker}
                >
                  <Text style={[styles.pickText, !time && styles.placeholder]}>
                    {time || t('appointmentForm.timePlaceholder')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ServiceSelector
              selectedServices={selectedServices}
              selectedServicesData={selectedServicesData}
              services={services}
              loadingServices={loadingServices}
              showServiceList={showServiceList}
              setShowServiceList={setShowServiceList}
              setSelectedServices={setSelectedServices}
              setDuration={setDuration}
            />

            <View style={styles.field}>
              <View style={styles.amountHeader}>
                <Text style={styles.label}>{t('appointmentForm.amountLabel')}</Text>
                {amountEdited && servicesTotal > 0 ? (
                  <TouchableOpacity onPress={handleUseServicesAmount}>
                    <Text style={styles.amountReset}>{t('appointmentForm.useServicesAmount')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                value={amountInput}
                onChangeText={handleAmountChange}
                onBlur={() => {
                  const parsed = parseAmountInput(amountInput);
                  if (parsed !== null) {
                    setAmountInput(parsed.toFixed(2));
                  }
                }}
                placeholder={t('appointmentForm.amountPlaceholder')}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amountInput]}
              />
              {servicesTotal > 0 ? (
                <Text style={styles.amountHint}>
                  {t('appointmentForm.servicesTotalLabel', { value: servicesTotal.toFixed(2) })}
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('appointmentForm.durationLabel')}</Text>
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
                        {value} {t('common.minutesShort')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Seção: Cliente e Animal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('appointmentForm.customerPetSection')}</Text>

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
                <Text style={[styles.segmentText, { color: mode === 'new' ? primary : colors.text }]}>
                  ➕ {t('appointmentForm.newCustomer')}
                </Text>
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
                <Text style={[styles.segmentText, { color: mode === 'existing' ? primary : colors.text }]}>
                  📋 {t('appointmentForm.existingCustomer')}
                </Text>
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
            <Text style={styles.sectionTitle}>📝 {t('appointmentForm.additionalInfo')}</Text>
            
            <View style={styles.field}>
              <Text style={styles.label}>{t('appointmentForm.notesLabel')}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('appointmentForm.notesPlaceholder')}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FontAwesome name="whatsapp" size={20} color="#25D366" />
                  <Text style={styles.label}>{t('appointmentForm.sendWhatsapp')}</Text>
                </View>
                {!canSendWhatsapp ? (
                  <Text style={styles.helperText}>{t('appointmentForm.addPhoneHint')}</Text>
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
            style={[styles.button, { 
              backgroundColor: primary, 
              opacity: (canSubmit && !isSubmitting) ? 1 : 0.5 
            }]}
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={colors.onPrimary} size="small" />
                <Text style={styles.buttonText}>{t('appointmentForm.processing')}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>
                {isEditMode ? t('appointmentForm.saveAction') : t('appointmentForm.createAction')}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondary} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
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
    headerInfo: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
    },
    keyboardAvoid: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    scrollContent: {
      paddingBottom: 40,
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
    amountHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    amountInput: {
      fontSize: 18,
      fontWeight: '700',
    },
    amountReset: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 13,
    },
    amountHint: {
      marginTop: 6,
      color: colors.muted,
      fontSize: 13,
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
