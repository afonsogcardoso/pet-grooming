import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import type { RefObject } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Stepper from "../../components/appointments/Stepper";
import StepActions from "../../components/appointments/StepActions";
import { BlurView } from "expo-blur";
import { createStyles } from "./styles";
import Switch from "../../components/StyledSwitch";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRoute } from "@react-navigation/native";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAppointment, updateAppointment } from "../../api/appointments";
import { useAppointmentPhotos } from "../../hooks/useAppointmentPhotos";
import { getNotificationPreferences } from "../../api/notifications";
import type { Customer, Pet } from "../../api/customers";
import {
  createCustomer,
  createPet,
  getCustomers,
  getPetsByCustomer,
  updateCustomer,
} from "../../api/customers";
import {
  getServiceAddons,
  getServicePriceTiers,
  getServices,
} from "../../api/services";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import { getCardVariants } from "../../theme/uiTokens";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { NewCustomerForm } from "../../components/appointment/NewCustomerForm";
import { ExistingCustomerForm } from "../../components/appointment/ExistingCustomerForm";
import {
  PetServiceRow,
  type ServiceRow,
} from "../../components/appointment/PetServiceRow";
import { AutocompleteSelect } from "../../components/common/AutocompleteSelect";
import { DateTimePickerModal } from "../../components/appointment/DateTimePickerModal";
import { ScheduleSection } from "../../components/appointment/ScheduleSection";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess } from "../../utils/haptics";
import { getDateLocale } from "../../i18n";
import { buildPhone } from "../../utils/phone";
import {
  buildRecurrenceRule,
  currentLocalTime,
  formatHHMM,
  formatReminderOffsetLabel,
  normalizeReminderOffsets,
  parseAmountInput,
  todayLocalISO,
  type RecurrenceFrequency,
} from "../../utils/appointments";
import {
  formatCustomerAddress,
  formatCustomerName,
  getCustomerFirstName,
} from "../../utils/customer";
import { getPetBreeds, getPetSpecies } from "../../api/petAttributes";
import PetHeader from "./components/PetHeader";
import PetCard from "./components/PetCard";
import PetServices from "./components/PetServices";
import useAppointmentForm from "./hooks/useAppointmentForm";
import submitAppointment from "./hooks/useAppointmentSubmit";
import {
  isHexLight,
  normalizeBaseUrl,
  CONFIRMATION_BASE_URL,
  buildConfirmationUrl,
  parseRecurrenceFrequency,
  createLocalId,
  createServiceRow,
  buildRowsFromAppointment,
  type RowTotals,
} from "./lib/helpers";

type Props = NativeStackScreenProps<any>;

type DraftPet = {
  id: string;
  name: string;
  speciesId: string | null;
  speciesLabel: string;
  breedId: string | null;
  breed: string;
  weight?: string | number | null;
};

const REMINDER_PRESETS = [15, 30, 60, 120, 1440];
const MAX_REMINDER_OFFSETS = 5;

function pickPrimaryPetId(
  appointmentData: any,
  customerPets: Pet[]
): string | null {
  const fromServices = appointmentData?.appointment_services?.find(
    (entry: any) => entry?.pet_id || entry?.pets?.id
  );
  if (fromServices?.pet_id) return fromServices.pet_id;
  if (fromServices?.pets?.id) return fromServices.pets.id;
  if (appointmentData?.pets?.id) return appointmentData.pets.id;
  if (Array.isArray(customerPets) && customerPets.length > 0)
    return customerPets[0].id;
  return null;
}

function createDraftPet(initial?: Partial<DraftPet>): DraftPet {
  return {
    id: createLocalId("pet"),
    name: "",
    speciesId: initial?.speciesId ?? null,
    speciesLabel: initial?.speciesLabel ?? "",
    breedId: initial?.breedId ?? null,
    breed: initial?.breed ?? "",
    weight: initial?.weight ?? "",
  };
}

export default function NewAppointmentScreen({ navigation }: Props) {
  const route = useRoute<Props["route"]>();
  const initialDateParam = route.params?.date as string | undefined;
  const initialTimeParam = route.params?.time as string | undefined;
  const editAppointmentId = route.params?.editId as string | undefined;
  const duplicateFromId = route.params?.duplicateFromId as string | undefined;
  const isEditMode = !!editAppointmentId;
  const isDuplicateMode = !!duplicateFromId;
  const prefillAppointmentId = editAppointmentId || duplicateFromId;
  const isPrefillMode = isEditMode || isDuplicateMode;
  const editScope = route.params?.editScope as "single" | "future" | undefined;
  const focusRecurrence = route.params?.focusRecurrence === true;
  const [recurrenceFocusHandled, setRecurrenceFocusHandled] = useState(false);

  const [date, setDate] = useState(initialDateParam || todayLocalISO());
  const [time, setTime] = useState(
    formatHHMM(initialTimeParam) || currentLocalTime()
  );
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState("");
  const [useDefaultReminders, setUseDefaultReminders] = useState(true);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([]);
  const [customReminderInput, setCustomReminderInput] = useState("");
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] =
    useState<RecurrenceFrequency>("weekly");
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<"after" | "on">(
    "after"
  );
  const [recurrenceCount, setRecurrenceCount] = useState("6");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const {
    selectedCustomer,
    setSelectedCustomer,
    selectedPetIds,
    setSelectedPetIds,
    serviceRowsByPet,
    setServiceRowsByPet,
    rowTotals,
    setRowTotals,
    newPets,
    setNewPets,
    existingNewPets,
    setExistingNewPets,
    speciesOptions,
    setSpeciesOptions,
    defaultSpeciesId,
    setDefaultSpeciesId,
    defaultSpeciesLabel,
    setDefaultSpeciesLabel,
    loadingSpecies,
    setLoadingSpecies,
    breedOptionsBySpecies,
    setBreedOptionsBySpecies,
    loadingBreedSpeciesId,
    setLoadingBreedSpeciesId,
    showCustomerList,
    setShowCustomerList,
    showPetList,
    setShowPetList,
    handleSelectCustomer,
    handleSelectPet,
    togglePetSelection,
    handleAddServiceRow,
    handleRemoveServiceRow,
    handleUpdateServiceRow,
    handleRowTotalsChange,
    handleSelectExistingPetSpecies,
    handleSelectNewPetSpecies,
    handleAddExistingPet,
    handleRemoveExistingPet,
    handleUpdateExistingPet,
    handleAddNewPet,
    handleRemoveNewPet,
    handleUpdateNewPet,
  } = useAppointmentForm();
  const [amountInput, setAmountInput] = useState("");
  const [amountEdited, setAmountEdited] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [petSearch, setPetSearch] = useState("");
  const [mode, setMode] = useState<"existing" | "new">(
    isEditMode || isDuplicateMode ? "existing" : "new"
  );
  const [newCustomerFirstName, setNewCustomerFirstName] = useState("");
  const [newCustomerLastName, setNewCustomerLastName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerAddress2, setNewCustomerAddress2] = useState("");
  const [newCustomerNif, setNewCustomerNif] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const submitLockRef = useRef(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerAddress2, setCustomerAddress2] = useState("");
  const [customerNif, setCustomerNif] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollContentRef = useRef<View>(null);
  const amountInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const skipAutoInitRef = useRef(false);

  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const dateLocale = getDateLocale();

  const scrollToInput = useCallback((inputRef: RefObject<TextInput | null>) => {
    const input = inputRef.current;
    const content = scrollContentRef.current;
    const scrollView = scrollViewRef.current;
    if (!input || !content || !scrollView) return;

    setTimeout(
      () => {
        input.measureLayout(
          content,
          (_x, y) => {
            scrollView.scrollTo({ y: Math.max(0, y - 24), animated: true });
          },
          () => null
        );
      },
      Platform.OS === "android" ? 120 : 80
    );
  }, []);

  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const ensureBreedOptions = useCallback(
    async (speciesId?: string | null) => {
      if (!speciesId) return;
      if (breedOptionsBySpecies[speciesId]) return;
      setLoadingBreedSpeciesId(speciesId);
      try {
        const breeds = await getPetBreeds({ speciesId });
        setBreedOptionsBySpecies((prev) => ({
          ...prev,
          [speciesId]: (breeds || []).map((breed) => ({
            id: breed.id,
            label: breed.name,
          })),
        }));
      } catch (err) {
        console.warn("Failed to load breeds", err);
      } finally {
        setLoadingBreedSpeciesId((prev) => (prev === speciesId ? null : prev));
      }
    },
    [breedOptionsBySpecies]
  );

  const normalizeName = useCallback((value?: string | null) => {
    return (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSpecies = async () => {
      setLoadingSpecies(true);
      try {
        const species = await getPetSpecies();
        if (!isMounted) return;
        const options = (species || []).map((item) => ({
          id: item.id,
          label: item.name,
        }));
        setSpeciesOptions(options);

        const dog = (species || []).find(
          (item) => normalizeName(item.name) === "cao"
        );
        const fallback = species?.[0];
        const defaultId = dog?.id || fallback?.id || null;
        const defaultLabel = dog?.name || fallback?.name || "";
        setDefaultSpeciesId((prev) => prev || defaultId);
        setDefaultSpeciesLabel((prev) => prev || defaultLabel);

        if (defaultId) {
          setNewPets((prev) =>
            prev.map((pet) =>
              pet.speciesId
                ? pet
                : {
                    ...pet,
                    speciesId: defaultId,
                    speciesLabel: defaultLabel,
                  }
            )
          );
          setExistingNewPets((prev) =>
            prev.map((pet) =>
              pet.speciesId
                ? pet
                : {
                    ...pet,
                    speciesId: defaultId,
                    speciesLabel: defaultLabel,
                  }
            )
          );
          await ensureBreedOptions(defaultId);
        }
      } finally {
        if (isMounted) setLoadingSpecies(false);
      }
    };

    loadSpecies();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load appointment data if in edit mode (centralized hook)
  const {
    appointment: appointmentData,
    isLoading: loadingAppointment,
    photos: appointmentPhotos,
    uploadPhoto: appointmentUploadPhoto,
    uploadState: appointmentUploadState,
    removePhoto: appointmentRemovePhoto,
  } = useAppointmentPhotos(prefillAppointmentId);
  const { data: selectedCustomerPets = [] } = useQuery({
    queryKey: ["customer-pets", selectedCustomer],
    queryFn: () => getPetsByCustomer(selectedCustomer),
    enabled: Boolean(selectedCustomer),
  });
  const { data: notificationPreferences } = useQuery({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });

  // Load appointment data into form when available
  const appointmentDataRef = useRef(appointmentData);

  useEffect(() => {
    appointmentDataRef.current = appointmentData;
  }, [appointmentData]);

  useEffect(() => {
    if (!appointmentData || !isPrefillMode) return;

    setDate(appointmentData.appointment_date || todayLocalISO());
    setTime(formatHHMM(appointmentData.appointment_time) || currentLocalTime());
    setDuration(appointmentData.duration || 60);
    setNotes(appointmentData.notes || "");
    const appointmentOffsets = normalizeReminderOffsets(
      appointmentData.reminder_offsets,
      []
    );
    if (appointmentOffsets.length) {
      setUseDefaultReminders(false);
      setReminderOffsets(appointmentOffsets);
    } else {
      setUseDefaultReminders(true);
      setReminderOffsets([]);
    }

    const customerId = appointmentData.customers?.id || "";
    setSelectedCustomer(customerId);
    setMode("existing");

    const fallbackPetId =
      (appointmentData.customers as any)?.pets?.[0]?.id ||
      appointmentData.pets?.id ||
      selectedCustomerPets[0]?.id ||
      null;
    const { rowsByPet, petIds, totalsByRowId } = buildRowsFromAppointment(
      appointmentData,
      fallbackPetId
    );

    skipAutoInitRef.current = true;
    setSelectedPetIds(petIds);
    setServiceRowsByPet(rowsByPet);
    setRowTotals((prev) => ({ ...prev, ...totalsByRowId }));

    setCustomerSearch(formatCustomerName(appointmentData.customers));
    setCustomerPhone(
      appointmentData.customers?.phone ||
        buildPhone(
          appointmentData.customers?.phoneCountryCode || null,
          appointmentData.customers?.phoneNumber || null
        )
    );
    setCustomerAddress(appointmentData.customers?.address || "");
    setCustomerAddress2(appointmentData.customers?.address2 || "");
    setCustomerNif(appointmentData.customers?.nif || "");
  }, [appointmentData, isPrefillMode, selectedCustomerPets]);

  useEffect(() => {
    if (!appointmentData || !isPrefillMode) return;
    if (amountEdited) return;
    if (appointmentData.amount != null) {
      setAmountInput(appointmentData.amount.toFixed(2));
      setAmountEdited(true);
    }
  }, [appointmentData, isPrefillMode, amountEdited]);

  useEffect(() => {
    if (!appointmentData || !isPrefillMode) return;
    const recurrenceRule = appointmentData.recurrence_rule || null;
    const frequency = parseRecurrenceFrequency(recurrenceRule);
    setRecurrenceEnabled(Boolean(appointmentData.series_id || recurrenceRule));
    setRecurrenceFrequency(frequency || "weekly");
    if (appointmentData.recurrence_until) {
      setRecurrenceEndMode("on");
      setRecurrenceUntil(appointmentData.recurrence_until.slice(0, 10));
    } else if (
      typeof appointmentData.recurrence_count === "number" &&
      appointmentData.recurrence_count > 0
    ) {
      setRecurrenceEndMode("after");
      setRecurrenceCount(String(appointmentData.recurrence_count));
    } else {
      setRecurrenceEndMode("after");
      setRecurrenceCount("6");
      setRecurrenceUntil("");
    }
  }, [appointmentData, isPrefillMode]);

  // Se ainda não houver pet selecionado após carregar pets do cliente, preenche com o primeiro disponível
  useEffect(() => {
    if (!isPrefillMode) return;
    if (selectedPetIds.length > 0) return;
    const primaryPetId = pickPrimaryPetId(
      appointmentDataRef.current,
      selectedCustomerPets as any
    );
    if (!primaryPetId) return;

    const { rowsByPet, petIds, totalsByRowId } = buildRowsFromAppointment(
      appointmentDataRef.current,
      primaryPetId
    );
    setSelectedPetIds(petIds.length > 0 ? petIds : [primaryPetId]);
    setServiceRowsByPet((prev) =>
      Object.keys(prev).length > 0
        ? prev
        : rowsByPet[primaryPetId]
        ? rowsByPet
        : { [primaryPetId]: [createServiceRow()] }
    );
    setRowTotals((prev) =>
      Object.keys(prev).length > 0 ? prev : { ...prev, ...totalsByRowId }
    );
  }, [isPrefillMode, selectedPetIds.length, selectedCustomerPets]);

  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ["services"],
    queryFn: getServices,
  });

  const customers = customersData || [];
  const services = servicesData || [];
  const primary = colors.primary;
  const primarySoft = colors.primarySoft;
  const background = colors.background;
  const pickerTheme = isHexLight(colors.background) ? "light" : "dark";
  const addressPlaceholder = t("appointmentForm.addressPlaceholder");
  const address2Placeholder = t("appointmentForm.address2Placeholder");
  const displayTime = formatHHMM(time);
  const reviewDateDisplay = useMemo(() => {
    if (!date) return t("common.noDate");
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(dateLocale, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }, [date, dateLocale, t]);
  const recurrenceLabel = useMemo(() => {
    const map: Record<RecurrenceFrequency, string> = {
      weekly: t("appointmentForm.recurrenceWeekly"),
      biweekly: t("appointmentForm.recurrenceBiweekly"),
      monthly: t("appointmentForm.recurrenceMonthly"),
    };
    return recurrenceEnabled
      ? t("appointmentForm.reviewRecurrenceYes", {
          frequency:
            map[recurrenceFrequency] ?? t("appointmentForm.recurrenceWeekly"),
        })
      : t("appointmentForm.reviewRecurrenceNo");
  }, [recurrenceEnabled, recurrenceFrequency, t]);
  const defaultReminderOffsets = useMemo(
    () =>
      normalizeReminderOffsets(
        notificationPreferences?.push?.appointments?.reminder_offsets
      ),
    [notificationPreferences]
  );
  const effectiveReminderOffsets = useMemo(() => {
    return useDefaultReminders
      ? defaultReminderOffsets
      : normalizeReminderOffsets(reminderOffsets, []);
  }, [defaultReminderOffsets, reminderOffsets, useDefaultReminders]);
  const reminderChipOptions = useMemo(() => {
    const combined = new Set([...REMINDER_PRESETS, ...reminderOffsets]);
    return Array.from(combined).sort((a, b) => a - b);
  }, [reminderOffsets]);

  useEffect(() => {
    if (!useDefaultReminders && reminderOffsets.length === 0) {
      setReminderOffsets(defaultReminderOffsets);
    }
  }, [defaultReminderOffsets, reminderOffsets.length, useDefaultReminders]);

  const newCustomerFullName = useMemo(() => {
    const first = newCustomerFirstName.trim();
    const last = newCustomerLastName.trim();
    return [first, last].filter(Boolean).join(" ");
  }, [newCustomerFirstName, newCustomerLastName]);

  const selectedCustomerData = useMemo(() => {
    const found = customers.find((c) => c.id === selectedCustomer);

    // Fallback: se não encontrar na lista mas estamos em modo de edição,
    // usar os dados do appointment que já foram carregados
    if (!found && isPrefillMode && appointmentDataRef.current?.customers) {
      return appointmentDataRef.current.customers as any;
    }

    return found;
  }, [
    customers,
    selectedCustomer,
    isPrefillMode,
    appointmentData?.customers?.id,
  ]);

  const petOptions = useMemo(() => {
    const pets = selectedCustomerData?.pets || [];
    const fallbackPets: Pet[] = [];

    if (isPrefillMode && appointmentDataRef.current) {
      const fromServices = (
        appointmentDataRef.current.appointment_services || []
      )
        .map((entry: any) => entry.pets)
        .filter(Boolean);
      if (appointmentDataRef.current.pets) {
        fromServices.push(appointmentDataRef.current.pets as any);
      }
      fallbackPets.push(...fromServices);
    }

    const merged = new Map<string, Pet>();
    [...pets, ...selectedCustomerPets, ...fallbackPets].forEach((pet) => {
      if (pet?.id) merged.set(pet.id, pet);
    });

    return Array.from(merged.values());
  }, [
    selectedCustomerData,
    selectedCustomerPets,
    isPrefillMode,
    appointmentData?.appointment_services,
    appointmentData?.pets?.id,
  ]);

  const activeRowIds = useMemo(() => {
    return Object.values(serviceRowsByPet)
      .flat()
      .map((row) => row.id);
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
      setAmountInput("");
    }
  }, [servicesTotal, amountEdited]);

  const amountValue = useMemo(
    () => parseAmountInput(amountInput),
    [amountInput]
  );

  useEffect(() => {
    if (mode !== "existing") return;
    if (skipAutoInitRef.current) {
      skipAutoInitRef.current = false;
      return;
    }
    setServiceRowsByPet((prev) => {
      const next: Record<string, ServiceRow[]> = {};
      const petKeys = [
        ...selectedPetIds,
        ...existingNewPets.map((pet) => pet.id),
      ];
      petKeys.forEach((petId) => {
        const rows = prev[petId];
        next[petId] = rows && rows.length > 0 ? rows : [createServiceRow()];
      });
      return next;
    });
  }, [selectedPetIds, existingNewPets, mode]);

  useEffect(() => {
    if (mode !== "new") return;
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
    mode === "new"
      ? newCustomerPhone
      : customerPhone || selectedCustomerData?.phone || "";
  const phoneDigits = effectivePhone.replace(/\D/g, "");
  const canSendWhatsapp = phoneDigits.length > 0;

  type SearchResult =
    | { type: "customer"; customer: Customer; label: string; subtitle?: string }
    | {
        type: "pet";
        customer: Customer;
        pet: Pet;
        label: string;
        subtitle?: string;
      };

  const searchResults: SearchResult[] = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    const results: SearchResult[] = [];
    customers.forEach((customer) => {
      const baseSubtitle = customer.phone || customer.email || "";
      const customerName = formatCustomerName(customer);
      const customerMatch = !term
        ? true
        : `${customerName} ${customer.phone ?? ""}`
            .toLowerCase()
            .includes(term);
      if (customerMatch) {
        results.push({
          type: "customer",
          customer,
          label: customerName,
          subtitle: baseSubtitle,
        });
      }
      (customer.pets || []).forEach((pet) => {
        const haystack = `${pet.name} ${customerName} ${
          customer.phone ?? ""
        }`.toLowerCase();
        if (!term || haystack.includes(term)) {
          results.push({
            type: "pet",
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
      const haystack = `${pet.name} ${pet.breed ?? ""}`.toLowerCase();
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
    const newNames = existingNewPets
      .map((pet) => pet.name.trim())
      .filter(Boolean);
    const names = [...existingNames, ...newNames];
    if (names.length === 0) return "";
    return names.join(", ");
  }, [existingNewPets, selectedPetsData]);

  const parsedDate = useMemo(() => {
    const safe = date ? new Date(`${date}T00:00:00`) : new Date();
    return Number.isNaN(safe.getTime()) ? new Date() : safe;
  }, [date]);

  const parsedTime = useMemo(() => {
    const [hh, mm] = time.split(":");
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
            selectedCustomerData.phoneNumber || null
          )
      );
      setCustomerAddress(selectedCustomerData.address || "");
      setCustomerAddress2(selectedCustomerData.address2 || "");
      setCustomerNif(selectedCustomerData.nif || "");
    } else {
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerAddress2("");
      setCustomerNif("");
    }
  }, [selectedCustomer, selectedCustomerData, mode]);

  // Reset customer/pet when toggling to new appointment mode
  useEffect(() => {
    if (mode === "new") {
      setSelectedCustomer("");
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
      queryClient
        .invalidateQueries({ queryKey: ["appointments"] })
        .catch(() => null);
      if (isEditMode && editAppointmentId) {
        try {
          const prev = queryClient.getQueryData([
            "appointment",
            editAppointmentId,
          ]) as any;
          const merged =
            prev && prev.photos
              ? { ...(savedAppointment || {}), photos: prev.photos }
              : savedAppointment;
          queryClient.setQueryData(["appointment", editAppointmentId], merged);
        } catch (e) {
          // fallback: just invalidate if anything goes wrong
          queryClient
            .invalidateQueries({ queryKey: ["appointment", editAppointmentId] })
            .catch(() => null);
        }
      }
      if (sendWhatsapp && canSendWhatsapp && !isEditMode) {
        const confirmationUrl = buildConfirmationUrl(savedAppointment);
        await openWhatsapp(confirmationUrl);
      }
      // Navega para os detalhes da marcação
      if (savedAppointment?.id) {
        navigation.replace("AppointmentDetail", { id: savedAppointment.id });
      } else {
        navigation.goBack();
      }
    },
    onError: (err: any) => {
      hapticError();
      const message =
        err?.response?.data?.error ||
        err.message ||
        (isEditMode
          ? t("appointmentForm.updateError")
          : t("appointmentForm.createError"));
      Alert.alert(t("common.error"), message);
    },
  });

  const timeIsValid = /^\d{2}:\d{2}$/.test(formatHHMM(time).trim());
  const newCustomerPhoneDigits = newCustomerPhone.replace(/\D/g, "");
  const hasNewCustomerPhone = newCustomerPhoneDigits.length > 0;
  const existingCustomerPhoneDigits = customerPhone.replace(/\D/g, "");
  const hasExistingCustomerPhone = existingCustomerPhoneDigits.length > 0;
  const existingDraftPetsValid =
    existingNewPets.length === 0 ||
    existingNewPets.every((pet) => pet.name.trim() && pet.speciesId);
  const hasExistingPets =
    selectedPetIds.length > 0 || existingNewPets.length > 0;
  const hasExistingSelection = Boolean(
    selectedCustomer &&
      hasExistingPets &&
      existingDraftPetsValid &&
      hasExistingCustomerPhone
  );
  const allServiceRows = Object.values(serviceRowsByPet).flat();
  const hasServiceSelection =
    allServiceRows.length > 0 && allServiceRows.every((row) => row.serviceId);
  const newPetsValid =
    newPets.length > 0 &&
    newPets.every((pet) => pet.name.trim() && pet.speciesId);
  const hasNewCustomerName = Boolean(newCustomerFirstName.trim());
  const hasNewSelection = Boolean(
    hasNewCustomerName && hasNewCustomerPhone && newPetsValid
  );
  const isSubmitting = mutation.isPending || isSubmittingRequest;
  const canSubmit =
    Boolean(
      date &&
        timeIsValid &&
        hasServiceSelection &&
        (mode === "existing" ? hasExistingSelection : hasNewSelection) &&
        !requiresTierSelection
    ) && !isSubmitting;

  const steps = useMemo(
    () => [
      { id: "schedule", label: t("appointmentForm.steps.schedule") },
      { id: "customer", label: t("appointmentForm.steps.customer") },
      { id: "services", label: t("appointmentForm.steps.services") },
      { id: "review", label: t("appointmentForm.steps.review") },
    ],
    [t]
  );

  const canAdvanceFromStep1 = Boolean(date && timeIsValid);
  const canAdvanceFromStep2 =
    mode === "existing"
      ? Boolean(selectedCustomer && hasExistingCustomerPhone)
      : Boolean(hasNewCustomerName && hasNewCustomerPhone);
  const hasPetsForStep =
    mode === "existing"
      ? hasExistingPets && existingDraftPetsValid
      : newPetsValid;
  const canAdvanceFromStep3 = Boolean(
    hasPetsForStep && hasServiceSelection && !requiresTierSelection
  );
  const stepAccess = [
    true,
    canAdvanceFromStep1,
    canAdvanceFromStep1 && canAdvanceFromStep2,
    canAdvanceFromStep1 && canAdvanceFromStep2 && canAdvanceFromStep3,
  ];
  const canGoNext =
    activeStep === 0
      ? canAdvanceFromStep1
      : activeStep === 1
      ? canAdvanceFromStep2
      : canAdvanceFromStep3;

  const goToStep = (nextStep: number) => {
    const clamped = Math.max(0, Math.min(nextStep, steps.length - 1));
    if (!stepAccess[clamped]) return;
    setActiveStep(clamped);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  useEffect(() => {
    if (focusRecurrence && !recurrenceFocusHandled) {
      setActiveStep(0);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      });
      setRecurrenceFocusHandled(true);
    }
  }, [focusRecurrence, recurrenceFocusHandled]);

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate.toLocaleDateString("sv-SE"));
    }
  };

  const handleTimeChange = (_event: any, selectedDate?: Date) => {
    if (selectedDate) {
      const hh = `${selectedDate.getHours()}`.padStart(2, "0");
      const mm = `${selectedDate.getMinutes()}`.padStart(2, "0");
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
    setAmountInput(value.replace(/[^0-9.,]/g, ""));
  };

  const handleUseServicesAmount = () => {
    setAmountEdited(false);
    setAmountInput(servicesTotal > 0 ? servicesTotal.toFixed(2) : "");
  };

  // pet/service state and handlers moved to `useAppointmentForm` hook

  const handleSubmit = async () => {
    if (isSubmitting || isSubmittingRequest || submitLockRef.current) {
      return; // Previne múltiplos cliques
    }

    const missingPhone =
      mode === "existing" ? !hasExistingCustomerPhone : !hasNewCustomerPhone;
    if (missingPhone) {
      hapticError();
      Alert.alert(t("common.error"), t("appointmentForm.phoneRequired"));
      return;
    }

    if (!canSubmit) {
      hapticError();
      Alert.alert(
        t("appointmentForm.requiredTitle"),
        t("appointmentForm.requiredMessage")
      );
      return;
    }

    if (amountInput.trim() && amountValue === null) {
      hapticError();
      Alert.alert(t("common.error"), t("appointmentForm.amountInvalid"));
      return;
    }

    if (requiresTierSelection) {
      hapticError();
      Alert.alert(
        t("appointmentForm.requiredTitle"),
        t("appointmentForm.tierRequiredMessage")
      );
      return;
    }

    let recurrenceRule: string | null = null;
    let recurrenceCountNumber: number | null = null;
    let recurrenceUntilValue = "";
    let recurrenceTimezoneValue: string | null = null;
    if (recurrenceEnabled) {
      recurrenceRule = buildRecurrenceRule({
        frequency: recurrenceFrequency,
        date,
      });
      if (!recurrenceRule) {
        hapticError();
        Alert.alert(
          t("common.error"),
          t("appointmentForm.recurrenceMissingDate")
        );
        return;
      }
      if (recurrenceEndMode === "after") {
        recurrenceCountNumber = Math.max(
          1,
          Math.round(Number(recurrenceCount))
        );
        if (!Number.isFinite(recurrenceCountNumber)) {
          hapticError();
          Alert.alert(
            t("common.error"),
            t("appointmentForm.recurrenceCountInvalid")
          );
          return;
        }
      } else {
        recurrenceUntilValue = recurrenceUntil.trim().slice(0, 10);
        if (!/\d{4}-\d{2}-\d{2}/.test(recurrenceUntilValue)) {
          hapticError();
          Alert.alert(
            t("common.error"),
            t("appointmentForm.recurrenceUntilInvalid")
          );
          return;
        }
      }
      recurrenceTimezoneValue =
        Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    }

    submitLockRef.current = true;
    setIsSubmittingRequest(true);
    try {
      await submitAppointment({
        mode,
        newCustomerFirstName,
        newCustomerLastName,
        newCustomerPhone,
        newCustomerEmail,
        newCustomerAddress,
        newCustomerAddress2,
        newCustomerNif,
        selectedCustomer,
        selectedCustomerData,
        newPets,
        existingNewPets,
        selectedPetIds,
        serviceRowsByPet,
        amountValue,
        totalDuration,
        duration,
        useDefaultReminders,
        effectiveReminderOffsets,
        recurrenceEnabled,
        recurrenceRule,
        recurrenceCountNumber,
        recurrenceUntilValue,
        recurrenceTimezoneValue,
        isEditMode,
        editAppointmentId,
        editScope,
        sendWhatsapp,
        canSendWhatsapp,
        buildConfirmationUrl,
        openWhatsapp,
        navigation,
        queryClient,
        t,
        mutation,
        createCustomer,
        updateCustomer,
        createPet,
        parseAmountInput,
        formatHHMM,
        services,
        petOptions,
        hapticError,
        customerPhone,
        customerAddress,
        customerAddress2,
        customerNif,
        notes,
        date,
        time,
      });
    } finally {
      submitLockRef.current = false;
      setIsSubmittingRequest(false);
    }
  };

  const handleToggleReminderOffset = (offset: number) => {
    if (useDefaultReminders) return;
    if (reminderOffsets.includes(offset)) {
      setReminderOffsets(reminderOffsets.filter((entry) => entry !== offset));
      return;
    }
    if (reminderOffsets.length >= MAX_REMINDER_OFFSETS) {
      Alert.alert(t("common.warning"), t("appointmentForm.remindersLimit"));
      return;
    }
    setReminderOffsets([...reminderOffsets, offset]);
  };

  const handleAddCustomReminder = () => {
    if (useDefaultReminders) return;
    const parsed = Math.round(Number(customReminderInput.replace(",", ".")));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1440) {
      Alert.alert(t("common.error"), t("appointmentForm.remindersInvalid"));
      return;
    }
    if (reminderOffsets.includes(parsed)) {
      setCustomReminderInput("");
      return;
    }
    if (reminderOffsets.length >= MAX_REMINDER_OFFSETS) {
      Alert.alert(t("common.warning"), t("appointmentForm.remindersLimit"));
      return;
    }
    setReminderOffsets([...reminderOffsets, parsed]);
    setCustomReminderInput("");
  };

  const buildWhatsappMessage = (confirmationUrl?: string) => {
    const dateObj = date ? new Date(`${date}T00:00:00`) : null;
    const dateLabel =
      dateObj && !Number.isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString(dateLocale, {
            weekday: "short",
            day: "2-digit",
            month: "short",
          })
        : date;
    const timeLabel = time || "—";
    const customerFirstName =
      mode === "new"
        ? newCustomerFirstName.trim()
        : getCustomerFirstName(selectedCustomerData);
    const address =
      mode === "new"
        ? formatCustomerAddress({
            address: newCustomerAddress,
            address2: newCustomerAddress2,
          })
        : formatCustomerAddress({
            address: customerAddress || selectedCustomerData?.address,
            address2: customerAddress2 || selectedCustomerData?.address2,
          });

    const serviceNameById = new Map(
      services.map((service) => [service.id, service.name])
    );
    const existingEntries = selectedPetIds
      .map((petId) => {
        const pet = petOptions.find((item) => item.id === petId);
        return pet
          ? { id: pet.id, name: pet.name, breed: pet.breed || "" }
          : null;
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;

    const petEntries =
      mode === "new"
        ? newPets.map((pet) => ({
            id: pet.id,
            name: pet.name,
            breed: pet.breed,
          }))
        : [
            ...existingEntries,
            ...existingNewPets.map((pet) => ({
              id: pet.id,
              name: pet.name,
              breed: pet.breed,
            })),
          ];

    const petLines = petEntries.map((pet) => {
      const rows = serviceRowsByPet[pet.id] || [];
      const serviceNames =
        rows
          .map((row: any) => serviceNameById.get(row.serviceId))
          .filter(Boolean)
          .join(", ") || t("common.noData");
      const petLabel = pet.breed ? `${pet.name} (${pet.breed})` : pet.name;
      return t("appointmentForm.whatsappPetServices", {
        pet: petLabel,
        services: serviceNames,
      });
    });

    const intro = customerFirstName
      ? t("appointmentForm.whatsappIntroWithName", {
          name: customerFirstName,
          date: dateLabel,
          time: timeLabel,
        })
      : t("appointmentForm.whatsappIntro", {
          date: dateLabel,
          time: timeLabel,
        });
    const lines = [
      ...petLines,
      address && t("appointmentForm.whatsappAddress", { address }),
      confirmationUrl &&
        t("appointmentForm.whatsappLink", { url: confirmationUrl }),
    ].filter(Boolean);

    return [intro, "", ...lines].join("\n");
  };

  const openWhatsapp = async (confirmationUrl?: string) => {
    if (!canSendWhatsapp) {
      Alert.alert(
        t("appointmentForm.whatsappTitle"),
        t("appointmentForm.whatsappNoNumber")
      );
      return;
    }
    const message = buildWhatsappMessage(confirmationUrl);
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
      message
    )}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(
        t("appointmentForm.whatsappTitle"),
        t("appointmentForm.whatsappOpenError")
      );
      return;
    }
    await Linking.openURL(url);
  };

  const serviceNameById = useMemo(
    () => new Map(services.map((service) => [service.id, service.name])),
    [services]
  );
  const activeServiceIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(serviceRowsByPet).forEach((rows: any[]) => {
      rows.forEach((row: any) => {
        if (row.serviceId) ids.add(row.serviceId);
      });
    });
    return Array.from(ids);
  }, [serviceRowsByPet]);

  const tierQueries = useQueries({
    queries: activeServiceIds.map((serviceId) => ({
      queryKey: ["service-tiers", serviceId],
      queryFn: () => getServicePriceTiers(serviceId),
      enabled: Boolean(serviceId),
    })),
  });

  const addonQueries = useQueries({
    queries: activeServiceIds.map((serviceId) => ({
      queryKey: ["service-addons", serviceId],
      queryFn: () => getServiceAddons(serviceId),
      enabled: Boolean(serviceId),
    })),
  });

  const tiersByServiceId = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; label?: string | null; price: number }>
    >();
    activeServiceIds.forEach((serviceId, index) => {
      const tiers = (tierQueries[index]?.data || []) as Array<{
        id: string;
        label?: string | null;
        price: number;
      }>;
      map.set(serviceId, tiers);
    });
    return map;
  }, [activeServiceIds, tierQueries]);

  const addonsByServiceId = useMemo(() => {
    const map = new Map<
      string,
      Array<{ id: string; name: string; price: number }>
    >();
    activeServiceIds.forEach((serviceId, index) => {
      const addons = (addonQueries[index]?.data || []) as Array<{
        id: string;
        name: string;
        price: number;
      }>;
      map.set(serviceId, addons);
    });
    return map;
  }, [activeServiceIds, addonQueries]);
  const serviceSummary = useMemo(() => {
    const existingEntries = selectedPetIds
      .map((petId) => {
        const pet = petOptions.find((item) => item.id === petId);
        return pet
          ? { id: pet.id, name: pet.name, breed: pet.breed || "" }
          : null;
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      breed?: string | null;
    }>;

    const petEntries =
      mode === "new"
        ? newPets.map((pet) => ({
            id: pet.id,
            name: pet.name,
            breed: pet.breed,
          }))
        : [
            ...existingEntries,
            ...existingNewPets.map((pet) => ({
              id: pet.id,
              name: pet.name,
              breed: pet.breed,
            })),
          ];

    return petEntries.map((pet) => {
      const rows = (serviceRowsByPet[pet.id] || []).filter(
        (row: any) => row.serviceId
      );
      const servicesForPet = rows.map((row: any) => {
        const serviceName =
          serviceNameById.get(row.serviceId) || t("common.noData");
        const tiers = tiersByServiceId.get(row.serviceId) || [];
        const addons = addonsByServiceId.get(row.serviceId) || [];
        const selectedTier = row.priceTierId
          ? tiers.find((tier) => tier.id === row.priceTierId) || null
          : null;
        const selectedAddons = addons.filter((addon) =>
          row.addonIds.includes(addon.id)
        );
        return {
          id: row.id,
          name: serviceName,
          tier: selectedTier
            ? {
                label: selectedTier.label || t("appointmentForm.tierDefault"),
                price: selectedTier.price,
              }
            : null,
          addons: selectedAddons.map((addon) => ({
            name: addon.name,
            price: addon.price,
          })),
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
    <SafeAreaView
      style={[styles.container, { backgroundColor: background }]}
      edges={["top", "left", "right"]}
    >
      <ScreenHeader
        title={
          isEditMode
            ? t("appointmentForm.editTitle")
            : t("appointmentForm.createTitle")
        }
        rightElement={
          (canSubmit || isSubmitting) && (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isSubmitting ? colors.surface : colors.primary,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 8,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="save-outline"
                    size={20}
                    color={
                      isHexLight(colors.primary) ? "#000" : colors.onPrimary
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
          )
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
              {/* Stepper extracted to component */}
              <Stepper
                steps={steps}
                activeStep={activeStep}
                stepAccess={stepAccess}
                goToStep={goToStep}
                styles={styles}
              />
            </View>
            {/* Seção: Data e Hora */}
            {activeStep === 0 ? (
              <ScheduleSection
                date={date}
                displayTime={displayTime}
                recurrenceEnabled={recurrenceEnabled}
                recurrenceFrequency={recurrenceFrequency}
                recurrenceEndMode={recurrenceEndMode}
                recurrenceCount={recurrenceCount}
                recurrenceUntil={recurrenceUntil}
                onPressDate={openDatePicker}
                onPressTime={openTimePicker}
                onToggleRecurrence={setRecurrenceEnabled}
                onChangeFrequency={setRecurrenceFrequency}
                onChangeEndMode={setRecurrenceEndMode}
                onChangeCount={setRecurrenceCount}
                onChangeUntil={setRecurrenceUntil}
                colors={colors}
                t={t}
              />
            ) : null}

            {/* Seção: Cliente */}
            {activeStep === 1 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("appointmentForm.customerPetSection")}
                </Text>

                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      mode === "new" && {
                        backgroundColor: primarySoft,
                        borderColor: primary,
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => {
                      setMode("new");
                      setSelectedCustomer("");
                      setSelectedPetIds([]);
                      setCustomerSearch("");
                      setCustomerPhone("");
                      setCustomerAddress("");
                      setCustomerAddress2("");
                      setCustomerNif("");
                      setShowPetList(false);
                      setNewPets([
                        createDraftPet({
                          speciesId: defaultSpeciesId,
                          speciesLabel: defaultSpeciesLabel,
                        }),
                      ]);
                      setExistingNewPets([]);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: mode === "new" ? primary : colors.text },
                      ]}
                    >
                      {t("appointmentForm.newCustomer")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      mode === "existing" && {
                        backgroundColor: primarySoft,
                        borderColor: primary,
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => {
                      setMode("existing");
                      setNewCustomerFirstName("");
                      setNewCustomerLastName("");
                      setNewCustomerPhone("");
                      setNewCustomerEmail("");
                      setNewCustomerAddress("");
                      setNewCustomerAddress2("");
                      setNewCustomerNif("");
                      setNewPets([
                        createDraftPet({
                          speciesId: defaultSpeciesId,
                          speciesLabel: defaultSpeciesLabel,
                        }),
                      ]);
                      setExistingNewPets([]);
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        { color: mode === "existing" ? primary : colors.text },
                      ]}
                    >
                      {t("appointmentForm.existingCustomer")}
                    </Text>
                  </TouchableOpacity>
                </View>

                {mode === "existing" ? (
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
                <Text style={styles.sectionTitle}>
                  {t("appointmentForm.petsServicesSection")}
                </Text>

                {mode === "existing" ? (
                  <>
                    {!selectedCustomer ? (
                      <Text style={styles.helperText}>
                        {t("appointmentForm.selectCustomerFirst")}
                      </Text>
                    ) : (
                      <View style={styles.field}>
                        <TouchableOpacity
                          style={styles.select}
                          onPress={() => setShowPetList(!showPetList)}
                        >
                          <Text
                            style={[
                              styles.selectText,
                              !selectedPetSummary && styles.placeholder,
                            ]}
                          >
                            {selectedPetSummary ||
                              t("appointmentForm.selectPets")}
                          </Text>
                        </TouchableOpacity>
                        {showPetList ? (
                          <View style={styles.dropdown}>
                            <View style={styles.searchBar}>
                              <FontAwesome
                                name="search"
                                size={16}
                                color={colors.muted}
                              />
                              <TextInput
                                value={petSearch}
                                onChangeText={setPetSearch}
                                placeholder={t(
                                  "appointmentForm.petSearchPlaceholder"
                                )}
                                placeholderTextColor={colors.muted}
                                style={styles.searchInput}
                              />
                              {petSearch.length > 0 && (
                                <TouchableOpacity
                                  onPress={() => setPetSearch("")}
                                >
                                  <FontAwesome
                                    name="times"
                                    size={16}
                                    color={colors.muted}
                                  />
                                </TouchableOpacity>
                              )}
                            </View>
                            <ScrollView
                              style={{ maxHeight: 220 }}
                              keyboardShouldPersistTaps="handled"
                            >
                              {filteredPetOptions.length === 0 ? (
                                <Text style={styles.optionSubtitle}>
                                  {t("appointmentForm.noPets")}
                                </Text>
                              ) : (
                                filteredPetOptions.map((pet) => {
                                  const active = selectedPetIds.includes(
                                    pet.id
                                  );
                                  return (
                                    <TouchableOpacity
                                      key={pet.id}
                                      style={styles.option}
                                      onPress={() => togglePetSelection(pet.id)}
                                    >
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 12,
                                        }}
                                      >
                                        <View
                                          style={[
                                            styles.checkbox,
                                            active && {
                                              borderColor: primary,
                                              backgroundColor: primary,
                                            },
                                          ]}
                                        >
                                          {active ? (
                                            <Text
                                              style={{
                                                color: colors.onPrimary,
                                                fontWeight: "700",
                                              }}
                                            >
                                              ✓
                                            </Text>
                                          ) : null}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                          <Text style={styles.optionTitle}>
                                            {pet.name}
                                          </Text>
                                          {pet.breed ? (
                                            <Text style={styles.optionSubtitle}>
                                              {pet.breed}
                                            </Text>
                                          ) : null}
                                          {pet.weight != null ? (
                                            <Text style={styles.optionSubtitle}>
                                              {t(
                                                "appointmentForm.petWeightInline",
                                                { value: pet.weight }
                                              )}
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

                    {selectedCustomer &&
                    selectedPetsData.length === 0 &&
                    existingNewPets.length === 0 ? (
                      <Text style={styles.helperText}>
                        {t("appointmentForm.selectPetsHint")}
                      </Text>
                    ) : null}

                    {selectedPetsData.map((pet) => {
                      const rows = serviceRowsByPet[pet.id] || [];
                      const petTotals = rows.reduce(
                        (acc: any, row: any) => {
                          const totals = rowTotals[row.id];
                          if (totals) {
                            acc.price += totals.price || 0;
                            acc.duration += totals.duration || 0;
                          }
                          return acc;
                        },
                        { price: 0, duration: 0 }
                      );
                      return (
                        <PetCard
                          key={pet.id}
                          pet={pet}
                          rows={rows}
                          services={services}
                          loadingServices={loadingServices}
                          petWeight={pet.weight ?? null}
                          onChangeRow={(rowId, updates) =>
                            handleUpdateServiceRow(pet.id, rowId, updates)
                          }
                          onRemoveRow={(rowId) =>
                            handleRemoveServiceRow(pet.id, rowId)
                          }
                          onAddService={() => handleAddServiceRow(pet.id)}
                          onTotalsChange={handleRowTotalsChange}
                          styles={styles}
                        />
                      );
                    })}

                    {selectedCustomer
                      ? existingNewPets.map((pet, index) => {
                          const rows = serviceRowsByPet[pet.id] || [];
                          const weightValue = parseAmountInput(pet.weight);
                          const petTotals = rows.reduce(
                            (acc: any, row: any) => {
                              const totals = rowTotals[row.id];
                              if (totals) {
                                acc.price += totals.price || 0;
                                acc.duration += totals.duration || 0;
                              }
                              return acc;
                            },
                            { price: 0, duration: 0 }
                          );
                          return (
                            <View key={pet.id} style={styles.petCard}>
                              <PetHeader
                                pet={pet}
                                index={index}
                                canRemove
                                onRemove={() => handleRemoveExistingPet(pet.id)}
                                titleOverride={t(
                                  "appointmentForm.petCardTitle",
                                  {
                                    index: index + 1,
                                  }
                                )}
                                styles={styles}
                              />

                              <View style={styles.row}>
                                <View style={[styles.field, { flex: 1 }]}>
                                  <Text style={styles.label}>
                                    {t("newCustomerForm.petNameLabel")}
                                  </Text>
                                  <TextInput
                                    value={pet.name}
                                    onChangeText={(value) =>
                                      handleUpdateExistingPet(pet.id, {
                                        name: value,
                                      })
                                    }
                                    placeholder={t(
                                      "newCustomerForm.petNamePlaceholder"
                                    )}
                                    placeholderTextColor={colors.muted}
                                    style={styles.input}
                                  />
                                </View>
                                <AutocompleteSelect
                                  label={t("petForm.speciesLabel")}
                                  value={pet.speciesLabel}
                                  onChangeText={(value) =>
                                    handleUpdateExistingPet(pet.id, {
                                      speciesLabel: value,
                                      speciesId: null,
                                      breedId: null,
                                      breed: "",
                                    })
                                  }
                                  onSelectOption={(option) => {
                                    if (!option) return;
                                    handleSelectExistingPetSpecies(
                                      pet.id,
                                      option
                                    );
                                  }}
                                  options={speciesOptions}
                                  selectedId={pet.speciesId}
                                  placeholder={t("petForm.speciesPlaceholder")}
                                  emptyLabel={t("petForm.speciesEmpty")}
                                  loading={loadingSpecies}
                                  loadingLabel={t("common.loading")}
                                  containerStyle={[styles.field]}
                                />
                              </View>

                              <AutocompleteSelect
                                label={t("petForm.breedLabel")}
                                value={pet.breed}
                                onChangeText={(value) =>
                                  handleUpdateExistingPet(pet.id, {
                                    breed: value,
                                    breedId: null,
                                  })
                                }
                                onSelectOption={(option) => {
                                  if (!option) return;
                                  handleUpdateExistingPet(pet.id, {
                                    breedId: option.id,
                                    breed: option.label,
                                  });
                                }}
                                options={
                                  pet.speciesId
                                    ? breedOptionsBySpecies[pet.speciesId] || []
                                    : []
                                }
                                selectedId={pet.breedId}
                                placeholder={
                                  pet.speciesId
                                    ? t("petForm.breedPlaceholder")
                                    : t("petForm.breedSelectSpecies")
                                }
                                emptyLabel={
                                  pet.speciesId
                                    ? t("petForm.breedEmptyForSpecies")
                                    : t("petForm.breedSelectSpecies")
                                }
                                disabled={!pet.speciesId}
                                loading={
                                  loadingBreedSpeciesId === pet.speciesId
                                }
                                containerStyle={styles.field}
                              />

                              <View style={styles.field}>
                                <Text style={styles.label}>
                                  {t("appointmentForm.petWeightLabel")}
                                </Text>
                                <TextInput
                                  value={pet.weight}
                                  onChangeText={(value) =>
                                    handleUpdateExistingPet(pet.id, {
                                      weight: value.replace(/[^0-9.,]/g, ""),
                                    })
                                  }
                                  placeholder={t(
                                    "appointmentForm.petWeightPlaceholder"
                                  )}
                                  placeholderTextColor={colors.muted}
                                  keyboardType="decimal-pad"
                                  style={styles.input}
                                />
                              </View>

                              {rows.map((row: any, rowIndex: number) => (
                                <PetServiceRow
                                  key={row.id}
                                  index={rowIndex}
                                  row={row}
                                  services={services}
                                  loadingServices={loadingServices}
                                  petWeight={weightValue ?? null}
                                  onChange={(updates: any) =>
                                    handleUpdateServiceRow(
                                      pet.id,
                                      row.id,
                                      updates
                                    )
                                  }
                                  onRemove={() =>
                                    handleRemoveServiceRow(pet.id, row.id)
                                  }
                                  allowRemove={rows.length > 1}
                                  onTotalsChange={handleRowTotalsChange}
                                />
                              ))}

                              {rows.length > 0 ? (
                                <Text style={styles.petSummary}>
                                  {t("appointmentForm.petTotalsLabel", {
                                    price: petTotals.price.toFixed(2),
                                    duration: petTotals.duration,
                                  })}
                                </Text>
                              ) : null}

                              <TouchableOpacity
                                style={styles.addServiceButton}
                                onPress={() => handleAddServiceRow(pet.id)}
                                accessibilityLabel={t(
                                  "appointmentForm.addService"
                                )}
                              >
                                <Text style={styles.addServiceText}>
                                  + {t("appointmentForm.addService")}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      : null}

                    {selectedCustomer ? (
                      <TouchableOpacity
                        style={styles.addPetButton}
                        onPress={handleAddExistingPet}
                        accessibilityLabel={t("appointmentForm.addPet")}
                      >
                        <Text style={styles.addPetText}>
                          + {t("appointmentForm.addPet")}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : (
                  <>
                    {newPets.map((pet, index) => {
                      const rows = serviceRowsByPet[pet.id] || [];
                      const weightValue = parseAmountInput(pet.weight);
                      const petTotals = rows.reduce(
                        (acc: any, row: any) => {
                          const totals = rowTotals[row.id];
                          if (totals) {
                            acc.price += totals.price || 0;
                            acc.duration += totals.duration || 0;
                          }
                          return acc;
                        },
                        { price: 0, duration: 0 }
                      );
                      return (
                        <View key={pet.id} style={styles.petCard}>
                          <PetHeader
                            pet={pet}
                            index={index}
                            styles={styles}
                            titleOverride={t("appointmentForm.petCardTitle", {
                              index: index + 1,
                            })}
                            canRemove={newPets.length > 1}
                            onRemove={() => handleRemoveNewPet(pet.id)}
                          />

                          <PetServices
                            pet={pet}
                            index={index}
                            rows={rows}
                            services={services}
                            loadingServices={loadingServices}
                            weightValue={weightValue}
                            speciesOptions={speciesOptions}
                            loadingSpecies={loadingSpecies}
                            breedOptionsBySpecies={breedOptionsBySpecies}
                            loadingBreedSpeciesId={loadingBreedSpeciesId}
                            styles={styles}
                            colors={colors}
                            handleUpdateNewPet={handleUpdateNewPet}
                            handleSelectNewPetSpecies={
                              handleSelectNewPetSpecies
                            }
                            handleUpdateServiceRow={handleUpdateServiceRow}
                            handleRemoveServiceRow={handleRemoveServiceRow}
                            handleRowTotalsChange={handleRowTotalsChange}
                            handleAddServiceRow={handleAddServiceRow}
                          />
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.addPetButton}
                      onPress={handleAddNewPet}
                      accessibilityLabel={t("appointmentForm.addPet")}
                    >
                      <Text style={styles.addPetText}>
                        + {t("appointmentForm.addPet")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : null}

            {/* Seção: Totais */}
            {activeStep === 3 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("appointmentForm.summarySection")}
                </Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t("appointmentForm.reviewDateLabel")}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {reviewDateDisplay}
                    {displayTime ? ` · ${displayTime}` : ""}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t("appointmentForm.reviewRecurrenceLabel")}
                  </Text>
                  <Text style={styles.summaryValue}>{recurrenceLabel}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    {t("appointmentForm.totalDurationLabel")}
                  </Text>
                  <Text style={styles.summaryValue}>
                    {totalDuration > 0
                      ? `${totalDuration} ${t("common.minutesShort")}`
                      : "—"}
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>
                    {t("appointmentForm.servicesSummaryTitle")}
                  </Text>
                  {serviceSummary.length > 0 &&
                    serviceSummary.map((entry, index) => {
                      return (
                        <View
                          key={`${entry.petLabel}-${index}`}
                          style={styles.summaryLine}
                        >
                          <Text style={styles.summaryPet}>
                            {entry.petLabel}
                          </Text>
                          {entry.services.length === 0 ? (
                            <Text style={styles.summaryServices}>
                              {t("common.noData")}
                            </Text>
                          ) : (
                            entry.services.map((service: any) => {
                              const addonLabel = service.addons
                                .map(
                                  (addon: any) =>
                                    `${addon.name} (€${addon.price})`
                                )
                                .join(", ");
                              return (
                                <View
                                  key={service.id}
                                  style={styles.summaryServiceRow}
                                >
                                  <Text style={styles.summaryServiceName}>
                                    {service.name}
                                  </Text>
                                  {service.tier ? (
                                    <Text style={styles.summaryServiceMeta}>
                                      {t("appointmentForm.tierLabel")}:{" "}
                                      {service.tier.label} · €
                                      {service.tier.price}
                                    </Text>
                                  ) : null}
                                  {service.addons.length > 0 ? (
                                    <Text style={styles.summaryServiceMeta}>
                                      {t("appointmentForm.addonsLabel")}:{" "}
                                      {addonLabel}
                                    </Text>
                                  ) : null}
                                </View>
                              );
                            })
                          )}
                        </View>
                      );
                    })}
                </View>

                <View style={styles.field}>
                  <View style={styles.amountHeader}>
                    <Text style={styles.label}>
                      {t("appointmentForm.amountLabel")}
                    </Text>
                    {amountEdited && servicesTotal > 0 ? (
                      <TouchableOpacity onPress={handleUseServicesAmount}>
                        <Text style={styles.amountReset}>
                          {t("appointmentForm.useServicesAmount")}
                        </Text>
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
                    placeholder={t("appointmentForm.amountPlaceholder")}
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    ref={amountInputRef}
                    onFocus={() => scrollToInput(amountInputRef)}
                    style={[styles.input, styles.amountInput]}
                  />
                  {servicesTotal > 0 ? (
                    <Text style={styles.amountHint}>
                      {t("appointmentForm.servicesTotalLabel", {
                        value: servicesTotal.toFixed(2),
                      })}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Seção: Notas */}
            {activeStep === 3 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  {t("appointmentForm.additionalInfo")}
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>
                    {t("appointmentForm.remindersTitle")}
                  </Text>
                  <View style={styles.toggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderToggleLabel}>
                        {t("appointmentForm.remindersUseDefault")}
                      </Text>
                      <Text style={styles.reminderDefaultInline}>
                        {t("appointmentForm.remindersDefaultLabel", {
                          value: "",
                        }).trim() || t("appointmentForm.remindersTitle")}
                        :{" "}
                        {defaultReminderOffsets
                          .map((offset) => formatReminderOffsetLabel(offset, t))
                          .join(", ")}
                      </Text>
                    </View>
                    <Switch
                      value={useDefaultReminders}
                      onValueChange={setUseDefaultReminders}
                      trackColor={{
                        false: colors.surfaceBorder,
                        true: primary,
                      }}
                      thumbColor={colors.onPrimary}
                    />
                  </View>
                  {!useDefaultReminders ? (
                    <>
                      <View style={styles.reminderChipsRow}>
                        {reminderChipOptions.map((offset) => {
                          const isActive = reminderOffsets.includes(offset);
                          return (
                            <TouchableOpacity
                              key={`appointment-reminder-${offset}`}
                              style={[
                                styles.reminderChip,
                                isActive && styles.reminderChipActive,
                              ]}
                              onPress={() => handleToggleReminderOffset(offset)}
                            >
                              <Text
                                style={[
                                  styles.reminderChipText,
                                  isActive && styles.reminderChipTextActive,
                                ]}
                              >
                                {formatReminderOffsetLabel(offset, t)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <View style={styles.reminderCustomRow}>
                        <TextInput
                          value={customReminderInput}
                          onChangeText={setCustomReminderInput}
                          placeholder={t(
                            "appointmentForm.remindersCustomPlaceholder"
                          )}
                          placeholderTextColor={colors.muted}
                          keyboardType="number-pad"
                          style={styles.reminderInput}
                        />
                        <TouchableOpacity
                          style={styles.reminderAddButton}
                          onPress={handleAddCustomReminder}
                        >
                          <Text style={styles.reminderAddButtonText}>
                            {t("appointmentForm.remindersAdd")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : null}
                </View>

                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text style={styles.reminderToggleLabel}>
                        {t("appointmentForm.sendWhatsapp")}
                      </Text>
                      <FontAwesome name="whatsapp" size={16} color="#25D366" />
                    </View>
                    {!canSendWhatsapp ? (
                      <Text style={styles.helperText}>
                        {t("appointmentForm.addPhoneHint")}
                      </Text>
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

                <View style={styles.field}>
                  <Text style={styles.label}>
                    {t("appointmentForm.notesLabel")}
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={t("appointmentForm.notesPlaceholder")}
                    placeholderTextColor={colors.muted}
                    multiline
                    ref={notesInputRef}
                    onFocus={() => scrollToInput(notesInputRef)}
                    style={[
                      styles.input,
                      {
                        minHeight: 100,
                        textAlignVertical: "top",
                        paddingTop: 12,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            {/* Step actions moved to fixed footer (rendered below) */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed footer actions so buttons stay in the same place across steps */}
      <View style={styles.fixedActions} pointerEvents="box-none">
        <BlurView
          intensity={25}
          tint="light"
          style={styles.fixedActionsBackground}
        >
          <StepActions
            activeStep={activeStep}
            stepsLength={steps.length}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            canGoNext={canGoNext}
            goToStep={goToStep}
            handleSubmit={handleSubmit}
            isEditMode={isEditMode}
            styles={styles}
            t={t}
            colors={colors}
          />
        </BlurView>
      </View>

      {isSubmitting && (
        <View pointerEvents="auto" style={styles.submitBlocker} />
      )}

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
