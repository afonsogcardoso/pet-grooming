import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
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
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createAppointment, updateAppointment, getAppointment } from '../api/appointments';
import type { Customer, Pet } from '../api/customers';
import { createCustomer, createPet, getCustomers, updateCustomer } from '../api/customers';
import { getServiceAddons, getServicePriceTiers, getServices } from '../api/services';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { FontAwesome } from '@expo/vector-icons';
import { NewCustomerForm } from '../components/appointment/NewCustomerForm';
import { ExistingCustomerForm } from '../components/appointment/ExistingCustomerForm';
import { PetServiceRow, type ServiceRow } from '../components/appointment/PetServiceRow';
import { DateTimePickerModal } from '../components/appointment/DateTimePickerModal';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { hapticError, hapticSuccess } from '../utils/haptics';
import { getDateLocale } from '../i18n';
import { buildPhone } from '../utils/phone';
import { formatCustomerAddress, formatCustomerName, getCustomerFirstName } from '../utils/customer';

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

function normalizeBaseUrl(value?: string | null) {
  if (!value) return '';
  return value.replace(/\/$/, '');
}

const CONFIRMATION_BASE_URL = (() => {
  const candidates = [
    process.env.EXPO_PUBLIC_SITE_URL,
    process.env.EXPO_PUBLIC_WEB_URL,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (apiBase) {
    try {
      const parsed = new URL(apiBase);
      return parsed.origin;
    } catch {
      return normalizeBaseUrl(apiBase);
    }
  }
  return '';
})();

function buildConfirmationUrl(appointment?: { id?: string; public_token?: string | null }) {
  if (!appointment?.id || !appointment?.public_token || !CONFIRMATION_BASE_URL) return '';
  const query = `id=${encodeURIComponent(appointment.id)}&token=${encodeURIComponent(
    appointment.public_token
  )}`;
  return `${CONFIRMATION_BASE_URL}/appointments/confirm?${query}`;
}

function parseAmountInput(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const sanitized = normalized.replace(/[^0-9.]/g, '');
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isNaN(parsed) ? null : parsed;
}

type DraftPet = {
  id: string;
  name: string;
  breed: string;
  weight: string;
};

type RowTotals = {
  price: number;
  duration: number;
  requiresTier: boolean;
};

function createLocalId(prefix = 'tmp') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createServiceRow(overrides?: Partial<ServiceRow>): ServiceRow {
  return {
    id: createLocalId('row'),
    serviceId: '',
    priceTierId: '',
    tierSelectionSource: null,
    addonIds: [],
    ...overrides,
  };
}

function createDraftPet(): DraftPet {
  return {
    id: createLocalId('pet'),
    name: '',
    breed: '',
    weight: '',
  };
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
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [serviceRowsByPet, setServiceRowsByPet] = useState<Record<string, ServiceRow[]>>({});
  const [rowTotals, setRowTotals] = useState<Record<string, RowTotals>>({});
  const [amountInput, setAmountInput] = useState('');
  const [amountEdited, setAmountEdited] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [petSearch, setPetSearch] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>(isEditMode ? 'existing' : 'new');
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('');
  const [newCustomerLastName, setNewCustomerLastName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerAddress2, setNewCustomerAddress2] = useState('');
  const [newCustomerNif, setNewCustomerNif] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const submitLockRef = useRef(false);
  const [newPets, setNewPets] = useState<DraftPet[]>([createDraftPet()]);
  const [existingNewPets, setExistingNewPets] = useState<DraftPet[]>([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showPetList, setShowPetList] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerAddress2, setCustomerAddress2] = useState('');
  const [customerNif, setCustomerNif] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const amountInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const skipAutoInitRef = useRef(false);

  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const dateLocale = getDateLocale();

  const scrollToInput = useCallback((inputRef: React.RefObject<TextInput>) => {
    const input = inputRef.current;
    const content = scrollContentRef.current;
    const scrollView = scrollViewRef.current;
    if (!input || !content || !scrollView) return;

    setTimeout(() => {
      input.measureLayout(
        content,
        (_x, y) => {
          scrollView.scrollTo({ y: Math.max(0, y - 24), animated: true });
        },
        () => null,
      );
    }, Platform.OS === 'android' ? 120 : 80);
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

      const customerId = appointmentData.customers?.id || '';
      setSelectedCustomer(customerId);
      setMode('existing');

      const rowsByPet: Record<string, ServiceRow[]> = {};
      const petIds = new Set<string>();
      const appointmentServices = appointmentData.appointment_services || [];

      if (appointmentServices.length > 0) {
        appointmentServices.forEach((entry: any, index: number) => {
          const petId = entry.pet_id || entry.pets?.id || appointmentData.pets?.id;
          if (!petId) return;
          petIds.add(petId);
          if (!rowsByPet[petId]) rowsByPet[petId] = [];
          rowsByPet[petId].push(
            createServiceRow({
              id: entry.id || `${petId}-${entry.service_id}-${index}`,
              serviceId: entry.service_id || entry.services?.id || '',
              priceTierId: entry.price_tier_id || '',
              tierSelectionSource: entry.price_tier_id ? 'stored' : null,
              addonIds: entry.appointment_service_addons
                ? entry.appointment_service_addons
                    .map((addon: any) => addon.service_addon_id || addon.id)
                    .filter(Boolean)
                : [],
            }),
          );
        });
      } else if (appointmentData.services?.id) {
        const petId = appointmentData.pets?.id;
        if (petId) {
          petIds.add(petId);
          rowsByPet[petId] = [
            createServiceRow({
              id: `${petId}-${appointmentData.services.id}`,
              serviceId: appointmentData.services.id,
              priceTierId: '',
              tierSelectionSource: null,
              addonIds: [],
            }),
          ];
        }
      }

      skipAutoInitRef.current = true;
      setSelectedPetIds(Array.from(petIds));
      setServiceRowsByPet(rowsByPet);

      setCustomerSearch(formatCustomerName(appointmentData.customers));
      setCustomerPhone(
        appointmentData.customers?.phone ||
          buildPhone(
            appointmentData.customers?.phoneCountryCode || null,
            appointmentData.customers?.phoneNumber || null,
          ),
      );
      setCustomerAddress(appointmentData.customers?.address || '');
      setCustomerAddress2(appointmentData.customers?.address2 || '');
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
  const pickerTheme = isHexLight(colors.background) ? 'light' : 'dark';
  const addressPlaceholder = t('appointmentForm.addressPlaceholder');
  const address2Placeholder = t('appointmentForm.address2Placeholder');
  const displayTime = formatHHMM(time);
  const newCustomerFullName = useMemo(() => {
    const first = newCustomerFirstName.trim();
    const last = newCustomerLastName.trim();
    return [first, last].filter(Boolean).join(' ');
  }, [newCustomerFirstName, newCustomerLastName]);

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
    const fallbackPets: Pet[] = [];

    if (isEditMode && appointmentDataRef.current) {
      const fromServices = (appointmentDataRef.current.appointment_services || [])
        .map((entry: any) => entry.pets)
        .filter(Boolean);
      if (appointmentDataRef.current.pets) {
        fromServices.push(appointmentDataRef.current.pets as any);
      }
      fallbackPets.push(...fromServices);
    }

    const merged = new Map<string, Pet>();
    [...pets, ...fallbackPets].forEach((pet) => {
      if (pet?.id) merged.set(pet.id, pet);
    });

    return Array.from(merged.values());
  }, [selectedCustomerData, isEditMode, appointmentData?.appointment_services, appointmentData?.pets?.id]);

  const activeRowIds = useMemo(() => {
    return Object.values(serviceRowsByPet).flat().map((row) => row.id);
  }, [serviceRowsByPet]);

  const totals = useMemo(() => {
    let totalPrice = 0;
    let totalDuration = 0;
    let requiresTier = false;
    activeRowIds.forEach((rowId) => {
      const rowTotal = rowTotals[rowId];
      if (!rowTotal) return;
      totalPrice += rowTotal.price || 0;
      totalDuration += rowTotal.duration || 0;
      if (rowTotal.requiresTier) requiresTier = true;
    });
    return { totalPrice, totalDuration, requiresTier };
  }, [activeRowIds, rowTotals]);

  const servicesTotal = totals.totalPrice;
  const totalDuration = totals.totalDuration;
  const requiresTierSelection = totals.requiresTier;

  useEffect(() => {
    if (amountEdited) return;
    if (servicesTotal > 0) {
      setAmountInput(servicesTotal.toFixed(2));
    } else {
      setAmountInput('');
    }
  }, [servicesTotal, amountEdited]);

  const amountValue = useMemo(() => parseAmountInput(amountInput), [amountInput]);

  useEffect(() => {
    if (mode !== 'existing') return;
    if (skipAutoInitRef.current) {
      skipAutoInitRef.current = false;
      return;
    }
    setServiceRowsByPet((prev) => {
      const next: Record<string, ServiceRow[]> = {};
      const petKeys = [...selectedPetIds, ...existingNewPets.map((pet) => pet.id)];
      petKeys.forEach((petId) => {
        const rows = prev[petId];
        next[petId] = rows && rows.length > 0 ? rows : [createServiceRow()];
      });
      return next;
    });
  }, [selectedPetIds, existingNewPets, mode]);

  useEffect(() => {
    if (mode !== 'new') return;
    setServiceRowsByPet((prev) => {
      const next: Record<string, ServiceRow[]> = {};
      newPets.forEach((pet) => {
        const rows = prev[pet.id];
        next[pet.id] = rows && rows.length > 0 ? rows : [createServiceRow()];
      });
      return next;
    });
  }, [newPets, mode]);

  useEffect(() => {
    const activeIds = new Set(activeRowIds);
    setRowTotals((prev) => {
      const next: Record<string, RowTotals> = {};
      Object.entries(prev).forEach(([id, totals]) => {
        if (activeIds.has(id)) next[id] = totals;
      });
      return next;
    });
  }, [activeRowIds]);

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
      const customerName = formatCustomerName(customer);
      const customerMatch = !term
        ? true
        : `${customerName} ${customer.phone ?? ''}`.toLowerCase().includes(term);
      if (customerMatch) {
        results.push({
          type: 'customer',
          customer,
          label: customerName,
          subtitle: baseSubtitle,
        });
      }
      (customer.pets || []).forEach((pet) => {
        const haystack = `${pet.name} ${customerName} ${customer.phone ?? ''}`.toLowerCase();
        if (!term || haystack.includes(term)) {
          results.push({
            type: 'pet',
            customer,
            pet,
            label: pet.name,
            subtitle: customerName,
          });
        }
      });
    });
    return results;
  }, [customerSearch, customers]);

  const filteredPetOptions = useMemo(() => {
    const term = petSearch.trim().toLowerCase();
    if (!term) return petOptions;
    return petOptions.filter((pet) => {
      const haystack = `${pet.name} ${pet.breed ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [petOptions, petSearch]);

  const selectedPetsData = useMemo(() => {
    return selectedPetIds
      .map((petId) => petOptions.find((pet) => pet.id === petId))
      .filter(Boolean) as Pet[];
  }, [selectedPetIds, petOptions]);

  const selectedPetSummary = useMemo(() => {
    const existingNames = selectedPetsData.map((pet) => pet.name);
    const newNames = existingNewPets.map((pet) => pet.name.trim()).filter(Boolean);
    const names = [...existingNames, ...newNames];
    if (names.length === 0) return '';
    return names.join(', ');
  }, [existingNewPets, selectedPetsData]);

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

    if (selectedCustomerData) {
      setCustomerPhone(
        selectedCustomerData.phone ||
          buildPhone(
            selectedCustomerData.phoneCountryCode || null,
            selectedCustomerData.phoneNumber || null,
          ),
      );
      setCustomerAddress(selectedCustomerData.address || '');
      setCustomerAddress2(selectedCustomerData.address2 || '');
      setCustomerNif(selectedCustomerData.nif || '');
    } else {
      setCustomerPhone('');
      setCustomerAddress('');
      setCustomerAddress2('');
      setCustomerNif('');
    }
  }, [selectedCustomer, selectedCustomerData, mode]);

  // Reset customer/pet when toggling to new appointment mode
  useEffect(() => {
    if (mode === 'new') {
      setSelectedCustomer('');
      setSelectedPetIds([]);
      setServiceRowsByPet({});
      setRowTotals({});
      setExistingNewPets([]);
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
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['appointments'] }).catch(() => null);
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['appointment', editAppointmentId] }).catch(() => null);
      }
      if (sendWhatsapp && canSendWhatsapp && !isEditMode) {
        const confirmationUrl = buildConfirmationUrl(savedAppointment);
        await openWhatsapp(confirmationUrl);
      }
      // Navega para os detalhes da marcação
      if (savedAppointment?.id) {
        navigation.replace('AppointmentDetail', { id: savedAppointment.id });
      } else {
        navigation.goBack();
      }
    },
    onError: (err: any) => {
      hapticError();
      const message =
        err?.response?.data?.error ||
        err.message ||
        (isEditMode ? t('appointmentForm.updateError') : t('appointmentForm.createError'));
      Alert.alert(t('common.error'), message);
    },
  });

  const timeIsValid = /^\d{2}:\d{2}$/.test(formatHHMM(time).trim());
  const existingDraftPetsValid =
    existingNewPets.length === 0 || existingNewPets.every((pet) => pet.name.trim());
  const hasExistingPets = selectedPetIds.length > 0 || existingNewPets.length > 0;
  const hasExistingSelection = Boolean(selectedCustomer && hasExistingPets && existingDraftPetsValid);
  const allServiceRows = Object.values(serviceRowsByPet).flat();
  const hasServiceSelection = allServiceRows.length > 0 && allServiceRows.every((row) => row.serviceId);
  const newPetsValid = newPets.length > 0 && newPets.every((pet) => pet.name.trim());
  const hasNewCustomerName = Boolean(newCustomerFirstName.trim());
  const hasNewSelection = Boolean(hasNewCustomerName && newPetsValid);
  const isSubmitting = mutation.isPending || isSubmittingRequest;
  const canSubmit =
    Boolean(
      date &&
        timeIsValid &&
        hasServiceSelection &&
        (mode === 'existing' ? hasExistingSelection : hasNewSelection) &&
        !requiresTierSelection,
    ) && !isSubmitting;

  const steps = useMemo(
    () => [
      { id: 'schedule', label: t('appointmentForm.steps.schedule') },
      { id: 'customer', label: t('appointmentForm.steps.customer') },
      { id: 'services', label: t('appointmentForm.steps.services') },
      { id: 'review', label: t('appointmentForm.steps.review') },
    ],
    [t],
  );

  const canAdvanceFromStep1 = Boolean(date && timeIsValid);
  const canAdvanceFromStep2 = mode === 'existing' ? Boolean(selectedCustomer) : Boolean(hasNewCustomerName);
  const hasPetsForStep = mode === 'existing' ? hasExistingPets && existingDraftPetsValid : newPetsValid;
  const canAdvanceFromStep3 = Boolean(hasPetsForStep && hasServiceSelection && !requiresTierSelection);
  const stepAccess = [
    true,
    canAdvanceFromStep1,
    canAdvanceFromStep1 && canAdvanceFromStep2,
    canAdvanceFromStep1 && canAdvanceFromStep2 && canAdvanceFromStep3,
  ];
  const canGoNext =
    activeStep === 0 ? canAdvanceFromStep1 : activeStep === 1 ? canAdvanceFromStep2 : canAdvanceFromStep3;

  const goToStep = (nextStep: number) => {
    const clamped = Math.max(0, Math.min(nextStep, steps.length - 1));
    if (!stepAccess[clamped]) return;
    setActiveStep(clamped);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

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

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomer(customerId);
    setSelectedPetIds([]);
    setServiceRowsByPet({});
    setRowTotals({});
    setExistingNewPets([]);
    setShowPetList(false);
    setPetSearch('');
  };

  const handleSelectPet = (petId: string) => {
    setSelectedPetIds((prev) => (prev.includes(petId) ? prev : [...prev, petId]));
  };

  const togglePetSelection = (petId: string) => {
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  };

  const handleAddServiceRow = (petKey: string) => {
    setServiceRowsByPet((prev) => ({
      ...prev,
      [petKey]: [...(prev[petKey] || []), createServiceRow()],
    }));
  };

  const handleRemoveServiceRow = (petKey: string, rowId: string) => {
    setServiceRowsByPet((prev) => {
      const rows = (prev[petKey] || []).filter((row) => row.id !== rowId);
      return {
        ...prev,
        [petKey]: rows.length > 0 ? rows : [createServiceRow()],
      };
    });
    setRowTotals((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const handleUpdateServiceRow = (petKey: string, rowId: string, updates: Partial<ServiceRow>) => {
    setServiceRowsByPet((prev) => {
      const rows = prev[petKey] || [];
      return {
        ...prev,
        [petKey]: rows.map((row) => {
          if (row.id !== rowId) return row;
          const nextRow = { ...row, ...updates };
          if (Object.prototype.hasOwnProperty.call(updates, 'serviceId') && updates.serviceId !== row.serviceId) {
            nextRow.priceTierId = '';
            nextRow.tierSelectionSource = null;
            nextRow.addonIds = [];
          }
          return nextRow;
        }),
      };
    });
  };

  const handleRowTotalsChange = useCallback((rowId: string, totals: RowTotals) => {
    setRowTotals((prev) => {
      const existing = prev[rowId];
      if (
        existing &&
        existing.price === totals.price &&
        existing.duration === totals.duration &&
        existing.requiresTier === totals.requiresTier
      ) {
        return prev;
      }
      return { ...prev, [rowId]: totals };
    });
  }, []);

  const handleAddExistingPet = () => {
    setExistingNewPets((prev) => [...prev, createDraftPet()]);
  };

  const handleRemoveExistingPet = (petId: string) => {
    setExistingNewPets((prev) => prev.filter((pet) => pet.id !== petId));
  };

  const handleUpdateExistingPet = (petId: string, updates: Partial<DraftPet>) => {
    setExistingNewPets((prev) =>
      prev.map((pet) => (pet.id === petId ? { ...pet, ...updates } : pet)),
    );
  };

  const handleAddNewPet = () => {
    setNewPets((prev) => [...prev, createDraftPet()]);
  };

  const handleRemoveNewPet = (petId: string) => {
    setNewPets((prev) => prev.filter((pet) => pet.id !== petId));
  };

  const handleUpdateNewPet = (petId: string, updates: Partial<DraftPet>) => {
    setNewPets((prev) =>
      prev.map((pet) => (pet.id === petId ? { ...pet, ...updates } : pet)),
    );
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSubmittingRequest || submitLockRef.current) {
      return; // Previne múltiplos cliques
    }

    if (!canSubmit) {
      hapticError();
      Alert.alert(t('appointmentForm.requiredTitle'), t('appointmentForm.requiredMessage'));
      return;
    }

    if (amountInput.trim() && amountValue === null) {
      hapticError();
      Alert.alert(t('common.error'), t('appointmentForm.amountInvalid'));
      return;
    }

    if (requiresTierSelection) {
      hapticError();
      Alert.alert(t('appointmentForm.requiredTitle'), t('appointmentForm.tierRequiredMessage'));
      return;
    }

    submitLockRef.current = true;
    setIsSubmittingRequest(true);
    try {
      let customerId = selectedCustomer;
      let createdCustomer: Customer | null = null;

      if (mode === 'new') {
        try {
          const trimmedFirstName = newCustomerFirstName.trim();
          const trimmedLastName = newCustomerLastName.trim();
          createdCustomer = await createCustomer({
            firstName: trimmedFirstName,
            lastName: trimmedLastName || undefined,
            phone: newCustomerPhone.trim() || null,
            email: newCustomerEmail.trim() || null,
            address: newCustomerAddress.trim() || null,
            address2: newCustomerAddress2.trim() || null,
            nif: newCustomerNif.trim() || null,
          });
          customerId = createdCustomer.id;
        } catch (err: any) {
          hapticError();
          const message = err?.response?.data?.error || err.message || t('appointmentForm.createCustomerPetError');
          Alert.alert(t('common.error'), message);
          return;
        }
      } else if (selectedCustomerData) {
        const hasChanges =
          customerPhone.trim() !== (selectedCustomerData.phone || '') ||
          customerAddress.trim() !== (selectedCustomerData.address || '') ||
          customerAddress2.trim() !== (selectedCustomerData.address2 || '') ||
          customerNif.trim() !== (selectedCustomerData.nif || '');
        if (hasChanges) {
          try {
            const updated = await updateCustomer(selectedCustomerData.id, {
              phone: customerPhone.trim() || null,
              address: customerAddress.trim() || '',
              address2: customerAddress2.trim() || '',
              nif: customerNif.trim() || null,
            });
            queryClient.setQueryData(['customers'], (prev: Customer[] | undefined) => {
              if (!prev) return prev;
              return prev.map((c) => (c.id === selectedCustomerData.id ? { ...c, ...(updated || {}) } : c));
            });
          } catch (err: any) {
            hapticError();
            const message = err?.response?.data?.error || err.message || t('appointmentForm.updateCustomerError');
            Alert.alert(t('common.error'), message);
            return;
          }
        }
      }

      const petIdMap = new Map<string, string>();
      let primaryPetId = '';

      if (mode === 'new') {
        try {
          const createdPets: Pet[] = [];
          for (const pet of newPets) {
            const weightValue = parseAmountInput(pet.weight);
            const createdPet = await createPet(customerId, {
              name: pet.name.trim(),
              breed: pet.breed.trim() || null,
              weight: weightValue ?? null,
            });
            petIdMap.set(pet.id, createdPet.id);
            createdPets.push(createdPet);
          }
          if (createdPets[0]?.id) {
            primaryPetId = createdPets[0].id;
          }

          if (createdCustomer) {
            queryClient.setQueryData(['customers'], (prev: Customer[] | undefined) => {
              const next = prev ? [...prev] : [];
              next.push({ ...createdCustomer, pets: createdPets });
              return next;
            });
          }
        } catch (err: any) {
          hapticError();
          const message = err?.response?.data?.error || err.message || t('appointmentForm.createCustomerPetError');
          Alert.alert(t('common.error'), message);
          return;
        }
      } else {
        if (existingNewPets.length > 0) {
          try {
            const createdPets: Pet[] = [];
            for (const pet of existingNewPets) {
              const weightValue = parseAmountInput(pet.weight);
              const createdPet = await createPet(customerId, {
                name: pet.name.trim(),
                breed: pet.breed.trim() || null,
                weight: weightValue ?? null,
              });
              petIdMap.set(pet.id, createdPet.id);
              createdPets.push(createdPet);
            }
            if (createdPets.length > 0) {
              queryClient.setQueryData(['customers'], (prev: Customer[] | undefined) => {
                if (!prev) return prev;
                return prev.map((customer) => {
                  if (customer.id !== customerId) return customer;
                  const currentPets = customer.pets || [];
                  const nextPets = [...currentPets, ...createdPets];
                  const nextCount =
                    typeof customer.pet_count === 'number' ? customer.pet_count + createdPets.length : nextPets.length;
                  return { ...customer, pets: nextPets, pet_count: nextCount };
                });
              });
            }
          } catch (err: any) {
            hapticError();
            const message = err?.response?.data?.error || err.message || t('appointmentForm.createCustomerPetError');
            Alert.alert(t('common.error'), message);
            return;
          }
        }
        primaryPetId = selectedPetIds[0] || petIdMap.get(existingNewPets[0]?.id) || '';
      }

      const serviceSelections = Object.entries(serviceRowsByPet).flatMap(([petKey, rows]) => {
        const resolvedPetId = petIdMap.get(petKey) || petKey;
        if (!resolvedPetId) return [];
        return rows
          .filter((row) => row.serviceId)
          .map((row) => ({
            pet_id: resolvedPetId,
            service_id: row.serviceId,
            price_tier_id: row.priceTierId || null,
            addon_ids: row.addonIds,
          }));
      });

      const serviceIds = Array.from(new Set(serviceSelections.map((selection) => selection.service_id)));
      const effectiveDuration = totalDuration > 0 ? totalDuration : duration || null;

      const payload = {
        appointment_date: date,
        appointment_time: formatHHMM(time).trim(),
        status: 'scheduled',
        duration: effectiveDuration,
        amount: amountValue ?? null,
        notes: notes.trim() || null,
        customer_id: customerId,
        service_ids: serviceIds,
        service_selections: serviceSelections,
      };

      console.log('[appointment:create] payload', payload);

      await mutation.mutateAsync(payload);
    } finally {
      submitLockRef.current = false;
      setIsSubmittingRequest(false);
    }
  };

  const buildWhatsappMessage = (confirmationUrl?: string) => {
    const dateObj = date ? new Date(`${date}T00:00:00`) : null;
    const dateLabel = dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })
      : date;
    const timeLabel = time || '—';
    const customerFirstName =
      mode === 'new' ? newCustomerFirstName.trim() : getCustomerFirstName(selectedCustomerData);
    const address =
      mode === 'new'
        ? formatCustomerAddress({ address: newCustomerAddress, address2: newCustomerAddress2 })
        : formatCustomerAddress({
            address: customerAddress || selectedCustomerData?.address,
            address2: customerAddress2 || selectedCustomerData?.address2,
          });

    const serviceNameById = new Map(services.map((service) => [service.id, service.name]));
    const existingEntries = selectedPetIds
      .map((petId) => {
        const pet = petOptions.find((item) => item.id === petId);
        return pet ? { id: pet.id, name: pet.name, breed: pet.breed || '' } : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string; breed?: string | null }>;

    const petEntries =
      mode === 'new'
        ? newPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed }))
        : [...existingEntries, ...existingNewPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed }))];

    const petLines = petEntries.map((pet) => {
      const rows = serviceRowsByPet[pet.id] || [];
      const serviceNames = rows
        .map((row) => serviceNameById.get(row.serviceId))
        .filter(Boolean)
        .join(', ') || t('common.noData');
      const petLabel = pet.breed ? `${pet.name} (${pet.breed})` : pet.name;
      return t('appointmentForm.whatsappPetServices', { pet: petLabel, services: serviceNames });
    });

    const intro = customerFirstName
      ? t('appointmentForm.whatsappIntroWithName', { name: customerFirstName, date: dateLabel, time: timeLabel })
      : t('appointmentForm.whatsappIntro', { date: dateLabel, time: timeLabel });
    const lines = [
      ...petLines,
      address && t('appointmentForm.whatsappAddress', { address }),
      confirmationUrl && t('appointmentForm.whatsappLink', { url: confirmationUrl }),
    ].filter(Boolean);

    return [intro, '', ...lines].join('\n');
  };

  const openWhatsapp = async (confirmationUrl?: string) => {
    if (!canSendWhatsapp) {
      Alert.alert(t('appointmentForm.whatsappTitle'), t('appointmentForm.whatsappNoNumber'));
      return;
    }
    const message = buildWhatsappMessage(confirmationUrl);
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(t('appointmentForm.whatsappTitle'), t('appointmentForm.whatsappOpenError'));
      return;
    }
    await Linking.openURL(url);
  };

  const serviceNameById = useMemo(() => new Map(services.map((service) => [service.id, service.name])), [services]);
  const activeServiceIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(serviceRowsByPet).forEach((rows) => {
      rows.forEach((row) => {
        if (row.serviceId) ids.add(row.serviceId);
      });
    });
    return Array.from(ids);
  }, [serviceRowsByPet]);

  const tierQueries = useQueries({
    queries: activeServiceIds.map((serviceId) => ({
      queryKey: ['service-tiers', serviceId],
      queryFn: () => getServicePriceTiers(serviceId),
      enabled: Boolean(serviceId),
    })),
  });

  const addonQueries = useQueries({
    queries: activeServiceIds.map((serviceId) => ({
      queryKey: ['service-addons', serviceId],
      queryFn: () => getServiceAddons(serviceId),
      enabled: Boolean(serviceId),
    })),
  });

  const tiersByServiceId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; label?: string | null; price: number }>>();
    activeServiceIds.forEach((serviceId, index) => {
      const tiers = (tierQueries[index]?.data || []) as Array<{ id: string; label?: string | null; price: number }>;
      map.set(serviceId, tiers);
    });
    return map;
  }, [activeServiceIds, tierQueries]);

  const addonsByServiceId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; price: number }>>();
    activeServiceIds.forEach((serviceId, index) => {
      const addons = (addonQueries[index]?.data || []) as Array<{ id: string; name: string; price: number }>;
      map.set(serviceId, addons);
    });
    return map;
  }, [activeServiceIds, addonQueries]);
  const serviceSummary = useMemo(() => {
    const existingEntries = selectedPetIds
      .map((petId) => {
        const pet = petOptions.find((item) => item.id === petId);
        return pet ? { id: pet.id, name: pet.name, breed: pet.breed || '' } : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string; breed?: string | null }>;

    const petEntries =
      mode === 'new'
        ? newPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed }))
        : [...existingEntries, ...existingNewPets.map((pet) => ({ id: pet.id, name: pet.name, breed: pet.breed }))];

    return petEntries.map((pet) => {
      const rows = (serviceRowsByPet[pet.id] || []).filter((row) => row.serviceId);
      const servicesForPet = rows.map((row) => {
        const serviceName = serviceNameById.get(row.serviceId) || t('common.noData');
        const tiers = tiersByServiceId.get(row.serviceId) || [];
        const addons = addonsByServiceId.get(row.serviceId) || [];
        const selectedTier = row.priceTierId
          ? tiers.find((tier) => tier.id === row.priceTierId) || null
          : null;
        const selectedAddons = addons.filter((addon) => row.addonIds.includes(addon.id));
        return {
          id: row.id,
          name: serviceName,
          tier: selectedTier
            ? {
                label: selectedTier.label || t('appointmentForm.tierDefault'),
                price: selectedTier.price,
              }
            : null,
          addons: selectedAddons.map((addon) => ({ name: addon.name, price: addon.price })),
        };
      });
      const petLabel = pet.breed ? `${pet.name} (${pet.breed})` : pet.name;
      return {
        petLabel,
        services: servicesForPet,
      };
    });
  }, [
    addonsByServiceId,
    existingNewPets,
    mode,
    newPets,
    petOptions,
    selectedPetIds,
    serviceNameById,
    serviceRowsByPet,
    t,
    tiersByServiceId,
  ]);

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
        <View ref={scrollContentRef} style={styles.content}>
          <View style={styles.stepper}>
            {steps.map((step, index) => {
              const isActive = index === activeStep;
              const canAccess = stepAccess[index];
              return (
                <TouchableOpacity
                  key={step.id}
                  style={[
                    styles.stepButton,
                    isActive && styles.stepButtonActive,
                    !canAccess && styles.stepButtonDisabled,
                  ]}
                  onPress={() => goToStep(index)}
                  disabled={!canAccess}
                >
                  <Text style={[styles.stepIndex, isActive && styles.stepIndexActive]}>{index + 1}</Text>
                  <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Seção: Data e Hora */}
          {activeStep === 0 ? (
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
                    <Text style={[styles.pickText, !displayTime && styles.placeholder]}>
                      {displayTime || t('appointmentForm.timePlaceholder')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {/* Seção: Cliente */}
          {activeStep === 1 ? (
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
                    setSelectedPetIds([]);
                    setCustomerSearch('');
                    setCustomerPhone('');
                    setCustomerAddress('');
                    setCustomerAddress2('');
                    setCustomerNif('');
                    setShowPetList(false);
                    setNewPets([createDraftPet()]);
                    setExistingNewPets([]);
                  }}
                >
                  <Text style={[styles.segmentText, { color: mode === 'new' ? primary : colors.text }]}>
                    {t('appointmentForm.newCustomer')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentButton,
                    mode === 'existing' && { backgroundColor: primarySoft, borderColor: primary, borderWidth: 1.5 },
                  ]}
                  onPress={() => {
                    setMode('existing');
                    setNewCustomerFirstName('');
                    setNewCustomerLastName('');
                    setNewCustomerPhone('');
                    setNewCustomerEmail('');
                    setNewCustomerAddress('');
                    setNewCustomerAddress2('');
                    setNewCustomerNif('');
                    setNewPets([createDraftPet()]);
                    setExistingNewPets([]);
                  }}
                >
                  <Text style={[styles.segmentText, { color: mode === 'existing' ? primary : colors.text }]}>
                    {t('appointmentForm.existingCustomer')}
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
                  selectedCustomerId={selectedCustomer}
                  setSelectedCustomer={handleSelectCustomer}
                  onSelectPet={handleSelectPet}
                  selectedCustomerData={selectedCustomerData}
                  customerPhone={customerPhone}
                  setCustomerPhone={setCustomerPhone}
                  customerAddress={customerAddress}
                  setCustomerAddress={setCustomerAddress}
                  customerAddress2={customerAddress2}
                  setCustomerAddress2={setCustomerAddress2}
                  customerNif={customerNif}
                  setCustomerNif={setCustomerNif}
                  addressPlaceholder={addressPlaceholder}
                  address2Placeholder={address2Placeholder}
                  primarySoft={primarySoft}
                />
              ) : (
                <NewCustomerForm
                  customerFirstName={newCustomerFirstName}
                  setCustomerFirstName={setNewCustomerFirstName}
                  customerLastName={newCustomerLastName}
                  setCustomerLastName={setNewCustomerLastName}
                  customerPhone={newCustomerPhone}
                  setCustomerPhone={setNewCustomerPhone}
                  customerEmail={newCustomerEmail}
                  setCustomerEmail={setNewCustomerEmail}
                  customerAddress={newCustomerAddress}
                  setCustomerAddress={setNewCustomerAddress}
                  customerAddress2={newCustomerAddress2}
                  setCustomerAddress2={setNewCustomerAddress2}
                  customerNif={newCustomerNif}
                  setCustomerNif={setNewCustomerNif}
                  addressPlaceholder={addressPlaceholder}
                  address2Placeholder={address2Placeholder}
                />
              )}
            </View>
          ) : null}

          {/* Seção: Pets e Serviços */}
          {activeStep === 2 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('appointmentForm.petsServicesSection')}</Text>

              {mode === 'existing' ? (
                <>
                  {!selectedCustomer ? (
                    <Text style={styles.helperText}>{t('appointmentForm.selectCustomerFirst')}</Text>
                  ) : (
                    <View style={styles.field}>
                      <Text style={styles.label}>{t('appointmentForm.petLabel')}</Text>
                      <TouchableOpacity
                        style={styles.select}
                        onPress={() => setShowPetList(!showPetList)}
                      >
                        <Text style={[styles.selectText, !selectedPetSummary && styles.placeholder]}>
                          {selectedPetSummary || t('appointmentForm.selectPets')}
                        </Text>
                      </TouchableOpacity>
                      {showPetList ? (
                        <View style={styles.dropdown}>
                          <View style={styles.searchBar}>
                            <FontAwesome name="search" size={16} color={colors.muted} />
                            <TextInput
                              value={petSearch}
                              onChangeText={setPetSearch}
                              placeholder={t('appointmentForm.petSearchPlaceholder')}
                              placeholderTextColor={colors.muted}
                              style={styles.searchInput}
                            />
                            {petSearch.length > 0 && (
                              <TouchableOpacity onPress={() => setPetSearch('')}>
                                <FontAwesome name="times" size={16} color={colors.muted} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <ScrollView style={{ maxHeight: 220 }}>
                            {filteredPetOptions.length === 0 ? (
                              <Text style={styles.optionSubtitle}>{t('appointmentForm.noPets')}</Text>
                            ) : (
                              filteredPetOptions.map((pet) => {
                                const active = selectedPetIds.includes(pet.id);
                                return (
                                  <TouchableOpacity
                                    key={pet.id}
                                    style={[styles.option, active && { backgroundColor: colors.primarySoft }]}
                                    onPress={() => togglePetSelection(pet.id)}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                      <View style={[
                                        styles.checkbox,
                                        active && { borderColor: primary, backgroundColor: primary },
                                      ]}>
                                        {active ? (
                                          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>✓</Text>
                                        ) : null}
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.optionTitle}>{pet.name}</Text>
                                        {pet.breed ? (
                                          <Text style={styles.optionSubtitle}>{pet.breed}</Text>
                                        ) : null}
                                        {pet.weight != null ? (
                                          <Text style={styles.optionSubtitle}>
                                            {t('appointmentForm.petWeightInline', { value: pet.weight })}
                                          </Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </ScrollView>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {selectedCustomer && selectedPetsData.length === 0 && existingNewPets.length === 0 ? (
                    <Text style={styles.helperText}>{t('appointmentForm.selectPetsHint')}</Text>
                  ) : null}

                  {selectedPetsData.map((pet) => {
                    const rows = serviceRowsByPet[pet.id] || [];
                    const petTotals = rows.reduce(
                      (acc, row) => {
                        const totals = rowTotals[row.id];
                        if (totals) {
                          acc.price += totals.price || 0;
                          acc.duration += totals.duration || 0;
                        }
                        return acc;
                      },
                      { price: 0, duration: 0 },
                    );
                    return (
                      <View key={pet.id} style={styles.petCard}>
                        <View style={styles.petHeader}>
                          <View style={styles.petHeaderLeft}>
                            {pet.photo_url ? (
                              <Image source={{ uri: pet.photo_url }} style={styles.petAvatar} />
                            ) : (
                              <View style={styles.petAvatarPlaceholder}>
                                <Text style={styles.petAvatarText}>
                                  {(pet.name || '?').trim().charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View>
                              <Text style={styles.petTitle}>{pet.name}</Text>
                              {pet.breed ? <Text style={styles.petMeta}>{pet.breed}</Text> : null}
                              {pet.weight != null ? (
                                <Text style={styles.petMeta}>
                                  {t('appointmentForm.petWeightInline', { value: pet.weight })}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>

                        {rows.map((row, index) => (
                          <PetServiceRow
                            key={row.id}
                            index={index}
                            row={row}
                            services={services}
                            loadingServices={loadingServices}
                            petWeight={pet.weight ?? null}
                            onChange={(updates) => handleUpdateServiceRow(pet.id, row.id, updates)}
                            onRemove={() => handleRemoveServiceRow(pet.id, row.id)}
                            allowRemove={rows.length > 1}
                            onTotalsChange={handleRowTotalsChange}
                          />
                        ))}

                        {rows.length > 0 ? (
                          <Text style={styles.petSummary}>
                            {t('appointmentForm.petTotalsLabel', {
                              price: petTotals.price.toFixed(2),
                              duration: petTotals.duration,
                            })}
                          </Text>
                        ) : null}

                        <TouchableOpacity
                          style={styles.addServiceButton}
                          onPress={() => handleAddServiceRow(pet.id)}
                          accessibilityLabel={t('appointmentForm.addService')}
                        >
                          <Text style={styles.addServiceText}>+ {t('appointmentForm.addService')}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {selectedCustomer
                    ? existingNewPets.map((pet, index) => {
                        const rows = serviceRowsByPet[pet.id] || [];
                        const weightValue = parseAmountInput(pet.weight);
                        const petTotals = rows.reduce(
                          (acc, row) => {
                            const totals = rowTotals[row.id];
                            if (totals) {
                              acc.price += totals.price || 0;
                              acc.duration += totals.duration || 0;
                            }
                            return acc;
                          },
                          { price: 0, duration: 0 },
                        );
                        return (
                          <View key={pet.id} style={styles.petCard}>
                            <View style={styles.petHeader}>
                              <View style={styles.petHeaderLeft}>
                                <View style={styles.petAvatarPlaceholder}>
                                  <Text style={styles.petAvatarText}>
                                    {(pet.name || `${index + 1}`).trim().charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <Text style={styles.petTitle}>
                                  {t('appointmentForm.petCardTitle', { index: index + 1 })}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.removePetButton}
                                onPress={() => handleRemoveExistingPet(pet.id)}
                              >
                                <Text style={styles.removePetText}>{t('appointmentForm.removePet')}</Text>
                              </TouchableOpacity>
                            </View>

                            <View style={styles.row}>
                              <View style={[styles.field, { flex: 1 }]}>
                                <Text style={styles.label}>{t('newCustomerForm.petNameLabel')}</Text>
                                <TextInput
                                  value={pet.name}
                                  onChangeText={(value) => handleUpdateExistingPet(pet.id, { name: value })}
                                  placeholder={t('newCustomerForm.petNamePlaceholder')}
                                  placeholderTextColor={colors.muted}
                                  style={styles.input}
                                />
                              </View>
                              <View style={[styles.field, { flex: 1 }]}>
                                <Text style={styles.label}>{t('newCustomerForm.petBreedLabel')}</Text>
                                <TextInput
                                  value={pet.breed}
                                  onChangeText={(value) => handleUpdateExistingPet(pet.id, { breed: value })}
                                  placeholder={t('newCustomerForm.petBreedPlaceholder')}
                                  placeholderTextColor={colors.muted}
                                  style={styles.input}
                                />
                              </View>
                            </View>

                            <View style={styles.field}>
                              <Text style={styles.label}>{t('appointmentForm.petWeightLabel')}</Text>
                              <TextInput
                                value={pet.weight}
                                onChangeText={(value) =>
                                  handleUpdateExistingPet(pet.id, { weight: value.replace(/[^0-9.,]/g, '') })
                                }
                                placeholder={t('appointmentForm.petWeightPlaceholder')}
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                style={styles.input}
                              />
                            </View>

                            {rows.map((row, rowIndex) => (
                              <PetServiceRow
                                key={row.id}
                                index={rowIndex}
                                row={row}
                                services={services}
                                loadingServices={loadingServices}
                                petWeight={weightValue ?? null}
                                onChange={(updates) => handleUpdateServiceRow(pet.id, row.id, updates)}
                                onRemove={() => handleRemoveServiceRow(pet.id, row.id)}
                                allowRemove={rows.length > 1}
                                onTotalsChange={handleRowTotalsChange}
                              />
                            ))}

                            {rows.length > 0 ? (
                              <Text style={styles.petSummary}>
                                {t('appointmentForm.petTotalsLabel', {
                                  price: petTotals.price.toFixed(2),
                                  duration: petTotals.duration,
                                })}
                              </Text>
                            ) : null}

                            <TouchableOpacity
                              style={styles.addServiceButton}
                              onPress={() => handleAddServiceRow(pet.id)}
                              accessibilityLabel={t('appointmentForm.addService')}
                            >
                              <Text style={styles.addServiceText}>+ {t('appointmentForm.addService')}</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    : null}

                  {selectedCustomer ? (
                    <TouchableOpacity
                      style={styles.addPetButton}
                      onPress={handleAddExistingPet}
                      accessibilityLabel={t('appointmentForm.addPet')}
                    >
                      <Text style={styles.addPetText}>+ {t('appointmentForm.addPet')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <>
                  {newPets.map((pet, index) => {
                    const rows = serviceRowsByPet[pet.id] || [];
                    const weightValue = parseAmountInput(pet.weight);
                    const petTotals = rows.reduce(
                      (acc, row) => {
                        const totals = rowTotals[row.id];
                        if (totals) {
                          acc.price += totals.price || 0;
                          acc.duration += totals.duration || 0;
                        }
                        return acc;
                      },
                      { price: 0, duration: 0 },
                    );
                    return (
                      <View key={pet.id} style={styles.petCard}>
                        <View style={styles.petHeader}>
                          <View style={styles.petHeaderLeft}>
                            <View style={styles.petAvatarPlaceholder}>
                              <Text style={styles.petAvatarText}>
                                {(pet.name || `${index + 1}`).trim().charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.petTitle}>{t('appointmentForm.petCardTitle', { index: index + 1 })}</Text>
                          </View>
                          {newPets.length > 1 ? (
                            <TouchableOpacity style={styles.removePetButton} onPress={() => handleRemoveNewPet(pet.id)}>
                              <Text style={styles.removePetText}>{t('appointmentForm.removePet')}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        <View style={styles.row}>
                          <View style={[styles.field, { flex: 1 }]}>
                            <Text style={styles.label}>{t('newCustomerForm.petNameLabel')}</Text>
                            <TextInput
                              value={pet.name}
                              onChangeText={(value) => handleUpdateNewPet(pet.id, { name: value })}
                              placeholder={t('newCustomerForm.petNamePlaceholder')}
                              placeholderTextColor={colors.muted}
                              style={styles.input}
                            />
                          </View>
                          <View style={[styles.field, { flex: 1 }]}>
                            <Text style={styles.label}>{t('newCustomerForm.petBreedLabel')}</Text>
                            <TextInput
                              value={pet.breed}
                              onChangeText={(value) => handleUpdateNewPet(pet.id, { breed: value })}
                              placeholder={t('newCustomerForm.petBreedPlaceholder')}
                              placeholderTextColor={colors.muted}
                              style={styles.input}
                            />
                          </View>
                        </View>

                        <View style={styles.field}>
                          <Text style={styles.label}>{t('appointmentForm.petWeightLabel')}</Text>
                          <TextInput
                            value={pet.weight}
                            onChangeText={(value) =>
                              handleUpdateNewPet(pet.id, { weight: value.replace(/[^0-9.,]/g, '') })
                            }
                            placeholder={t('appointmentForm.petWeightPlaceholder')}
                            placeholderTextColor={colors.muted}
                            keyboardType="decimal-pad"
                            style={styles.input}
                          />
                        </View>

                        {rows.map((row, rowIndex) => (
                          <PetServiceRow
                            key={row.id}
                            index={rowIndex}
                            row={row}
                            services={services}
                            loadingServices={loadingServices}
                            petWeight={weightValue ?? null}
                            onChange={(updates) => handleUpdateServiceRow(pet.id, row.id, updates)}
                            onRemove={() => handleRemoveServiceRow(pet.id, row.id)}
                            allowRemove={rows.length > 1}
                            onTotalsChange={handleRowTotalsChange}
                          />
                        ))}

                        {rows.length > 0 ? (
                          <Text style={styles.petSummary}>
                            {t('appointmentForm.petTotalsLabel', {
                              price: petTotals.price.toFixed(2),
                              duration: petTotals.duration,
                            })}
                          </Text>
                        ) : null}

                        <TouchableOpacity
                          style={styles.addServiceButton}
                          onPress={() => handleAddServiceRow(pet.id)}
                          accessibilityLabel={t('appointmentForm.addService')}
                        >
                          <Text style={styles.addServiceText}>+ {t('appointmentForm.addService')}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  <TouchableOpacity
                    style={styles.addPetButton}
                    onPress={handleAddNewPet}
                    accessibilityLabel={t('appointmentForm.addPet')}
                  >
                    <Text style={styles.addPetText}>+ {t('appointmentForm.addPet')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          {/* Seção: Totais */}
          {activeStep === 3 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('appointmentForm.summarySection')}</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('appointmentForm.totalDurationLabel')}</Text>
                <Text style={styles.summaryValue}>
                  {totalDuration > 0 ? `${totalDuration} ${t('common.minutesShort')}` : '—'}
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>{t('appointmentForm.servicesSummaryTitle')}</Text>
                {serviceSummary.length === 0 ? (
                  <Text style={styles.summaryEmpty}>{t('appointmentForm.servicesSummaryEmpty')}</Text>
                ) : (
                  serviceSummary.map((entry, index) => {
                    return (
                      <View key={`${entry.petLabel}-${index}`} style={styles.summaryLine}>
                        <Text style={styles.summaryPet}>{entry.petLabel}</Text>
                        {entry.services.length === 0 ? (
                          <Text style={styles.summaryServices}>{t('common.noData')}</Text>
                        ) : (
                          entry.services.map((service) => {
                            const addonLabel = service.addons
                              .map((addon) => `${addon.name} (€${addon.price})`)
                              .join(', ');
                            return (
                              <View key={service.id} style={styles.summaryServiceRow}>
                                <Text style={styles.summaryServiceName}>{service.name}</Text>
                                {service.tier ? (
                                  <Text style={styles.summaryServiceMeta}>
                                    {t('appointmentForm.tierLabel')}: {service.tier.label} · €{service.tier.price}
                                  </Text>
                                ) : null}
                                {service.addons.length > 0 ? (
                                  <Text style={styles.summaryServiceMeta}>
                                    {t('appointmentForm.addonsLabel')}: {addonLabel}
                                  </Text>
                                ) : null}
                              </View>
                            );
                          })
                        )}
                      </View>
                    );
                  })
                )}
              </View>

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
                  ref={amountInputRef}
                  onFocus={() => scrollToInput(amountInputRef)}
                  style={[styles.input, styles.amountInput]}
                />
                {servicesTotal > 0 ? (
                  <Text style={styles.amountHint}>
                    {t('appointmentForm.servicesTotalLabel', { value: servicesTotal.toFixed(2) })}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Seção: Notas */}
          {activeStep === 3 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('appointmentForm.additionalInfo')}</Text>
              
              <View style={styles.field}>
                <Text style={styles.label}>{t('appointmentForm.notesLabel')}</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('appointmentForm.notesPlaceholder')}
                  placeholderTextColor={colors.muted}
                  multiline
                  ref={notesInputRef}
                  onFocus={() => scrollToInput(notesInputRef)}
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
          ) : null}

          <View style={styles.stepActions}>
            {activeStep > 0 ? (
              <TouchableOpacity
                style={styles.stepSecondary}
                onPress={() => goToStep(activeStep - 1)}
                accessibilityLabel={t('appointmentForm.previousStep')}
              >
                <Text style={styles.stepSecondaryText}>{t('appointmentForm.previousStep')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {activeStep < steps.length - 1 ? (
              <TouchableOpacity
                style={[styles.stepPrimary, !canGoNext && styles.stepPrimaryDisabled]}
                onPress={() => goToStep(activeStep + 1)}
                disabled={!canGoNext}
                accessibilityLabel={t('appointmentForm.nextStep')}
              >
                <Text style={styles.stepPrimaryText}>{t('appointmentForm.nextStep')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {activeStep === steps.length - 1 ? (
            <>
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
            </>
          ) : null}
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
    section: {
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
    },
    stepper: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    stepButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      gap: 4,
    },
    stepButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    stepButtonDisabled: {
      opacity: 0.5,
    },
    stepIndex: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
    },
    stepIndexActive: {
      color: colors.primary,
    },
    stepLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    stepLabelActive: {
      color: colors.primary,
    },
    stepActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
      marginBottom: 8,
    },
    stepPrimary: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    stepPrimaryDisabled: {
      opacity: 0.5,
    },
    stepPrimaryText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    stepSecondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    stepSecondaryText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 15,
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
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primarySoft,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    petCard: {
      borderWidth: 1,
      borderRadius: 16,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 14,
      marginBottom: 16,
    },
    petHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    petHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    petAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
    },
    petAvatarPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    petAvatarText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 16,
    },
    petTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    petMeta: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 4,
    },
    petSummary: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 10,
    },
    addServiceButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },
    addServiceText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    addPetButton: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    addPetText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 14,
    },
    removePetButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
    },
    removePetText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    summaryCard: {
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    summaryLine: {
      marginBottom: 8,
    },
    summaryPet: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    summaryServices: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    summaryServiceRow: {
      marginTop: 6,
    },
    summaryServiceName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    summaryServiceMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    summaryEmpty: {
      fontSize: 13,
      color: colors.muted,
    },
    summaryLabel: {
      color: colors.muted,
      fontWeight: '600',
    },
    summaryValue: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 16,
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
    },
    helperText: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 4,
    },
    serviceMeta: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 6,
      fontWeight: '600',
    },
    pricingCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      padding: 14,
      marginTop: 12,
      marginBottom: 8,
    },
    pricingTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    optionGroup: {
      gap: 8,
      marginBottom: 12,
    },
    optionCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      padding: 12,
    },
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    optionPrice: {
      fontWeight: '700',
      color: colors.text,
    },
  });
}
