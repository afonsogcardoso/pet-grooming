import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Linking,
  Alert,
  Image,
  Platform,
  ActionSheetIOS,
  PermissionsAndroid,
  KeyboardAvoidingView,
} from "react-native";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import saveImageToDevice from "../utils/saveImage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";
import { compressImage } from "../utils/imageCompression";
import { useTranslation } from "react-i18next";
import {
  getAppointment,
  updateAppointment,
  deleteAppointment,
  uploadAppointmentPhoto,
  deleteSeriesOccurrences,
} from "../api/appointments";
import useAppointmentPhotos from "../hooks/useAppointmentPhotos";
import { getPetsByCustomer, type Pet } from "../api/customers";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { ScreenHeader } from "../components/ScreenHeader";
import { MiniMap } from "../components/common/MiniMap";
import ImageWithDownload from "../components/common/ImageWithDownload";
import { getStatusColor, getStatusLabel } from "../utils/appointmentStatus";
import { getDateLocale } from "../i18n";
import {
  formatCustomerAddress,
  formatCustomerName,
  getCustomerFirstName,
} from "../utils/customer";
import {
  hapticError,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from "../utils/haptics";
import { getCardStyle } from "../theme/uiTokens";
import { getAppointmentServiceEntries } from "../utils/appointmentSummary";

type Props = NativeStackScreenProps<any>;

function formatDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
  locale: string,
  noDateLabel: string,
  atLabel: string
) {
  const safeDate = date ? new Date(`${date}T00:00:00`) : null;
  const dateLabel =
    safeDate && !Number.isNaN(safeDate.getTime())
      ? safeDate.toLocaleDateString(locale, {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })
      : date || noDateLabel;
  const timeLabel = time ? time.slice(0, 5) : "—";
  return `${dateLabel} ${atLabel} ${timeLabel}`;
}

function addDaysToDateString(value?: string | null, days = 0) {
  if (!value) return undefined;
  const parts = value.split("-");
  if (parts.length < 3) return value;
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day)
  ) {
    return value;
  }
  const result = new Date(year, monthIndex, day + days);
  const month = `${result.getMonth() + 1}`.padStart(2, "0");
  const dayOfMonth = `${result.getDate()}`.padStart(2, "0");
  return `${result.getFullYear()}-${month}-${dayOfMonth}`;
}

export default function AppointmentDetailScreen({ route, navigation }: Props) {
  const appointmentId = route.params?.id as string;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const notesYRef = useRef(0);
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<{
    type: "before" | "after";
    appointmentServiceId?: string;
  } | null>(null);
  const [savingPhoto, setSavingPhoto] = useState<"before" | "after" | null>(
    null
  );

  // Use centralized hook to avoid duplicate GET /appointments/:id calls
  const {
    appointment: data,
    isLoading,
    photos: appointmentPhotosFromHook,
    uploadPhoto: hookUploadPhoto,
    removePhoto: hookRemovePhoto,
  } = useAppointmentPhotos(appointmentId);

  const error = null;
  const isRefetching = false;

  const appointmentPhotos = appointmentPhotosFromHook;

  const customerId = data?.customers?.id;
  const { data: customerPets = [] } = useQuery<Pet[]>({
    queryKey: ["customer-pets", customerId],
    queryFn: () => getPetsByCustomer(customerId as string),
    enabled: Boolean(customerId),
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      status?: string | null;
      payment_status?: string | null;
    }) => updateAppointment(appointmentId, payload),
    onMutate: async (payload) => {
      const prevAppointment = queryClient.getQueryData([
        "appointment",
        appointmentId,
      ]);
      const prevStatus = (prevAppointment as any)?.status ?? null;
      const prevLists = queryClient.getQueriesData({
        queryKey: ["appointments"],
      });

      // Optimistically update detail cache
      queryClient.setQueryData(["appointment", appointmentId], (old: any) =>
        old ? { ...old, ...payload } : old
      );

      // Optimistically update all appointment list queries
      prevLists.forEach(([key, data]) => {
        if (!data || !Array.isArray((data as any).items)) return;
        const nextItems = (data as any).items.map((item: any) =>
          item?.id === appointmentId ? { ...item, ...payload } : item
        );
        queryClient.setQueryData(key, { ...(data as any), items: nextItems });
      });

      return { prevAppointment, prevLists, prevStatus };
    },
    onSuccess: (updated) => {
      hapticSuccess();
      queryClient
        .invalidateQueries({ queryKey: ["appointments"] })
        .catch(() => null);
      queryClient
        .invalidateQueries({ queryKey: ["appointment", appointmentId] })
        .catch(() => null);
      if (updated) {
        const prev = queryClient.getQueryData([
          "appointment",
          appointmentId,
        ]) as any;
        const merged =
          prev && prev.photos
            ? { ...prev, ...updated, photos: prev.photos }
            : updated;
        queryClient.setQueryData(["appointment", appointmentId], merged);
      }
    },
    onError: (err: any, _payload, context) => {
      hapticError();
      if (context?.prevAppointment) {
        queryClient.setQueryData(
          ["appointment", appointmentId],
          context.prevAppointment
        );
      }
      if (context?.prevLists) {
        context.prevLists.forEach(([key, data]) =>
          queryClient.setQueryData(key, data)
        );
      }
      if (context?.prevStatus !== undefined && context.prevStatus !== null) {
        setStatus(context.prevStatus);
      }
      const message =
        err?.response?.data?.error ||
        err.message ||
        t("appointmentDetail.updateError");
      Alert.alert(t("common.error"), message);
    },
  });

  const seriesMutation = useMutation({
    mutationFn: (payload: { seriesId: string; fromDate?: string }) =>
      deleteSeriesOccurrences(payload.seriesId, payload.fromDate),
    onSuccess: () => {
      hapticSuccess();
      queryClient
        .invalidateQueries({ queryKey: ["appointments"] })
        .catch(() => null);
      queryClient
        .invalidateQueries({ queryKey: ["appointment", appointmentId] })
        .catch(() => null);
      Alert.alert(t("common.done"), t("appointmentDetail.deleteFutureSuccess"));
    },
    onError: (err: any) => {
      hapticError();
      const message =
        err?.response?.data?.error ||
        err?.message ||
        t("appointmentDetail.recurrenceActionError");
      Alert.alert(t("common.error"), message);
    },
  });

  const appointment = data;
  // debug logs removed
  const [notesDraft, setNotesDraft] = useState(appointment?.notes ?? "");
  const notesSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNoteChanges = useMemo(
    () => (notesDraft ?? "") !== (appointment?.notes ?? ""),
    [appointment?.notes, notesDraft]
  );

  const notesMutation = useMutation({
    mutationFn: (nextNotes: string | null) =>
      updateAppointment(appointmentId, { notes: nextNotes }),
    onMutate: async (nextNotes) => {
      const prevAppointment = queryClient.getQueryData([
        "appointment",
        appointmentId,
      ]);
      const prevLists = queryClient.getQueriesData({
        queryKey: ["appointments"],
      });

      queryClient.setQueryData(["appointment", appointmentId], (old: any) =>
        old ? { ...old, notes: nextNotes ?? null } : old
      );

      prevLists.forEach(([key, listData]) => {
        if (!listData || !Array.isArray((listData as any).items)) return;
        const nextItems = (listData as any).items.map((item: any) =>
          item?.id === appointmentId
            ? { ...item, notes: nextNotes ?? null }
            : item
        );
        queryClient.setQueryData(key, {
          ...(listData as any),
          items: nextItems,
        });
      });

      setNotesDraft(nextNotes ?? "");

      return { prevAppointment, prevLists };
    },
    onSuccess: (updated) => {
      hapticSuccess();
      if (updated) {
        queryClient.setQueryData(["appointment", appointmentId], updated);
        setNotesDraft(updated.notes ?? "");
      }
      queryClient
        .invalidateQueries({ queryKey: ["appointments"] })
        .catch(() => null);
      queryClient
        .invalidateQueries({ queryKey: ["appointment", appointmentId] })
        .catch(() => null);
    },
    onError: (err: any, _nextNotes, context) => {
      hapticError();
      if (context?.prevAppointment) {
        queryClient.setQueryData(
          ["appointment", appointmentId],
          context.prevAppointment
        );
        setNotesDraft((context.prevAppointment as any)?.notes ?? "");
      }
      if (context?.prevLists) {
        context.prevLists.forEach(([key, listData]) =>
          queryClient.setQueryData(key, listData)
        );
      }
      const message =
        err?.response?.data?.error ||
        err.message ||
        t("appointmentDetail.updateError");
      Alert.alert(t("common.error"), message);
    },
  });

  useEffect(() => {
    setNotesDraft(appointment?.notes ?? "");
  }, [appointment?.notes]);

  const focusNotes = useCallback(() => {
    // Scroll the notes card into view when focusing so the keyboard doesn't cover it
    requestAnimationFrame(() => {
      const targetY = Math.max(notesYRef.current - 8, 0);
      scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
    });
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (!appointment || notesMutation.isPending) return;
    const trimmed = notesDraft.trim();
    const nextNotes = trimmed.length > 0 ? trimmed : null;
    const currentNotes = appointment.notes ?? null;
    if (nextNotes === currentNotes) return;
    notesMutation.mutate(nextNotes);
  }, [appointment, notesDraft, notesMutation]);

  useEffect(() => {
    if (notesSaveTimeout.current) {
      clearTimeout(notesSaveTimeout.current);
    }

    if (!appointment || !hasNoteChanges || notesMutation.isPending) {
      return undefined;
    }

    notesSaveTimeout.current = setTimeout(() => {
      handleSaveNotes();
    }, 800);

    return () => {
      if (notesSaveTimeout.current) {
        clearTimeout(notesSaveTimeout.current);
      }
    };
  }, [
    appointment,
    hasNoteChanges,
    notesDraft,
    notesMutation.isPending,
    handleSaveNotes,
  ]);
  const displayStatus = status ?? appointment?.status ?? "scheduled";
  const statusColor = useMemo(
    () => getStatusColor(displayStatus),
    [displayStatus]
  );
  const statusLabel = useMemo(
    () => getStatusLabel(displayStatus),
    [displayStatus]
  );
  const customer = appointment?.customers;
  const customerName = formatCustomerName(customer);
  const appointmentServiceEntries = useMemo(
    () => (appointment ? getAppointmentServiceEntries(appointment) : []),
    [appointment]
  );
  const customerPetsById = useMemo(() => {
    const map = new Map<string, Pet>();
    customerPets.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [customerPets]);
  const appointmentPets = useMemo(() => {
    if (!appointment) return [];
    const collected: Array<any> = [];
    appointmentServiceEntries.forEach((entry: any) => {
      const petId = entry?.pet_id || entry?.pets?.id;
      const mappedPet = petId ? customerPetsById.get(petId) : null;

      if (mappedPet) {
        collected.push(mappedPet);
        return;
      }

      if (entry?.pets) {
        collected.push(entry.pets);
        return;
      }

      if (entry?.pet_id) {
        const match = customerPetsById.get(entry.pet_id);
        if (match) collected.push(match);
      }
    });
    const unique = new Map<string, any>();
    collected.forEach((entry, index) => {
      if (!entry) return;
      const key = entry.id
        ? String(entry.id)
        : `${entry.name || "pet"}-${entry.breed || ""}-${index}`;
      if (!unique.has(key)) unique.set(key, entry);
    });
    return Array.from(unique.values());
  }, [appointment, appointmentServiceEntries, customerPetsById]);
  const primaryPetName = useMemo(() => {
    if (appointmentPets.length > 0 && appointmentPets[0]?.name) {
      return appointmentPets[0].name as string;
    }
    return "Pet";
  }, [appointmentPets]);
  const paymentStatus = appointment?.payment_status || "unpaid";
  const paymentColor =
    paymentStatus === "paid" ? colors.success : colors.warning;
  const isRecurring = Boolean(appointment?.series_id);
  const statusOptions = [
    { value: "pending", emoji: "⏳" },
    { value: "scheduled", emoji: "📅" },
    { value: "in_progress", emoji: "⚡" },
    { value: "completed", emoji: "✅" },
  ];

  const appointmentServices = useMemo(() => {
    if (appointmentServiceEntries.length > 0) {
      return appointmentServiceEntries;
    }
    return [];
  }, [appointmentServiceEntries]);

  const serviceDetails = useMemo(() => {
    return appointmentServices.map((entry, index) => {
      const addons = Array.isArray(entry.appointment_service_addons)
        ? entry.appointment_service_addons
        : [];
      const basePrice = entry.price_tier_price ?? entry.services?.price ?? 0;
      const addonsTotal = addons.reduce(
        (sum, addon) => sum + (addon.price || 0),
        0
      );
      return {
        key: entry.id || `${entry.service_id}-${index}`,
        entry,
        service: entry.services,
        pet: entry.pets,
        basePrice,
        addons,
        addonsTotal,
        total: basePrice + addonsTotal,
        hasTier:
          entry.price_tier_id ||
          entry.price_tier_label ||
          entry.price_tier_price != null,
        hasAddons: addons.length > 0,
      };
    });
  }, [appointmentServices]);

  const services = useMemo(() => {
    return serviceDetails
      .map((detail) => detail.service)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }, [serviceDetails]);

  const servicesTotal = useMemo(() => {
    return serviceDetails.reduce((sum, detail) => sum + detail.total, 0);
  }, [serviceDetails]);
  const amount =
    appointment?.amount ?? (servicesTotal > 0 ? servicesTotal : null);
  const showServiceBreakdown =
    serviceDetails.length > 0 &&
    (serviceDetails.length > 1 ||
      serviceDetails.some((detail) => detail.hasTier || detail.hasAddons));

  const openMaps = async () => {
    const address = formatCustomerAddress(customer);
    if (!address) return;

    try {
      const GOOGLE_MAPS_API_KEY =
        process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || "";
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address
        )}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const url = Platform.select({
          ios: `maps:0,0?q=${location.lat},${location.lng}`,
          android: `geo:0,0?q=${location.lat},${location.lng}`,
          default: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
        });
        Linking.openURL(url).catch(() =>
          Alert.alert(t("common.error"), t("appointmentDetail.mapOpenError"))
        );
      } else {
        Alert.alert(t("common.error"), t("appointmentDetail.addressNotFound"));
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      Alert.alert(t("common.error"), t("appointmentDetail.geocodeError"));
    }
  };

  const callCustomer = () => {
    const phone = customer?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert(t("common.error"), t("appointmentDetail.callError"))
    );
  };

  const whatsappCustomer = () => {
    const phone = customer?.phone;
    if (!phone) return;
    // Remove espaços e caracteres especiais, mantém apenas números
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    // Se começar com 9, adiciona +351 (Portugal)
    const formattedPhone = cleanPhone.startsWith("9")
      ? `351${cleanPhone}`
      : cleanPhone;
    const message = t("appointmentDetail.whatsappMessage", {
      name: getCustomerFirstName(customer),
      dateTime: formatDateTime(
        appointment?.appointment_date,
        appointment?.appointment_time,
        dateLocale,
        t("common.noDate"),
        t("common.at")
      ),
    });
    const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(
      message
    )}`;
    Linking.openURL(url).catch(() =>
      Alert.alert(t("common.error"), t("appointmentDetail.whatsappError"))
    );
  };

  const saveStatus = (next: string) => {
    hapticSelection();
    setStatus(next);
    mutation.mutate({ status: next });
  };

  const togglePayment = () => {
    hapticSelection();
    const next = paymentStatus === "paid" ? "unpaid" : "paid";
    mutation.mutate({ payment_status: next });
  };

  const handleEditAppointment = () => {
    navigation.replace("NewAppointment", { editId: appointmentId });
  };

  const handleRecurrenceEdit = () => {
    hapticSelection();
    navigation.replace("NewAppointment", {
      editId: appointmentId,
      focusRecurrence: true,
    });
  };

  const triggerDeleteFuture = () => {
    if (!appointment?.series_id) return;
    const fromDate = addDaysToDateString(appointment.appointment_date, 1);
    seriesMutation.mutate({
      seriesId: appointment.series_id,
      fromDate,
    });
  };

  const confirmDeleteFuture = () => {
    Alert.alert(
      t("appointmentDetail.deleteFutureTitle"),
      t("appointmentDetail.deleteFutureMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("appointmentDetail.deleteFutureAction"),
          style: "destructive",
          onPress: triggerDeleteFuture,
        },
      ]
    );
  };

  const openRecurrenceActions = () => {
    if (!isRecurring || !appointment?.series_id) return;
    hapticSelection();
    const recurrenceOptions = [
      t("appointmentDetail.editRecurrence"),
      t("appointmentDetail.deleteFutureAction"),
      t("common.cancel"),
    ];
    const cancelButtonIndex = recurrenceOptions.length - 1;
    const destructiveButtonIndex = 1;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t("appointmentDetail.recurrenceActionsTitle"),
          message: t("appointmentDetail.recurrenceActionsMessage"),
          options: recurrenceOptions,
          cancelButtonIndex,
          destructiveButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleRecurrenceEdit();
          } else if (buttonIndex === 1) {
            confirmDeleteFuture();
          }
        }
      );
      return;
    }
    Alert.alert(
      t("appointmentDetail.recurrenceActionsTitle"),
      t("appointmentDetail.recurrenceActionsMessage"),
      [
        { text: recurrenceOptions[0], onPress: handleRecurrenceEdit },
        {
          text: recurrenceOptions[1],
          style: "destructive",
          onPress: confirmDeleteFuture,
        },
        { text: recurrenceOptions[2], style: "cancel" },
      ]
    );
  };

  const handleDuplicateAppointment = () => {
    if (!appointment) return;
    hapticSelection();
    navigation.replace("NewAppointment", {
      duplicateFromId: appointment.id,
      date: appointment.appointment_date || undefined,
      time: appointment.appointment_time || undefined,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      t("appointmentDetail.deleteTitle"),
      t("appointmentDetail.deleteMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("appointmentDetail.deleteAction"),
          style: "destructive",
          onPress: async () => {
            try {
              hapticWarning();
              await deleteAppointment(appointmentId);
              hapticSuccess();
              queryClient
                .invalidateQueries({ queryKey: ["appointments"] })
                .catch(() => null);
              navigation.goBack();
            } catch (error) {
              hapticError();
              console.error("Delete error:", error);
              const err = error as any;
              const errorMessage =
                err?.response?.data?.message ||
                err?.message ||
                t("appointmentDetail.deleteError");
              Alert.alert(t("common.error"), errorMessage);
            }
          },
        },
      ]
    );
  };

  const requestAndroidPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t("profile.cameraPermissionTitle"),
            message: t("profile.cameraPermissionMessage"),
            buttonNeutral: t("common.later"),
            buttonNegative: t("common.cancel"),
            buttonPositive: t("common.ok"),
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const uploadPhoto = async (
    type: "before" | "after",
    uri: string,
    fileName?: string,
    opts?: { appointmentServiceId?: string; serviceId?: string; petId?: string }
  ) => {
    setUploadingPhoto({
      type,
      appointmentServiceId: opts?.appointmentServiceId,
    });

    // Start the heavy work on the next tick so the UI can render the loading overlay
    return new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          await hookUploadPhoto(
            type,
            { uri, name: fileName || undefined, type: "image/jpeg" } as any,
            {
              appointmentServiceId: opts?.appointmentServiceId,
              serviceId: opts?.serviceId,
              petId: opts?.petId,
            }
          );
          hapticSuccess();
          resolve(true);
        } catch (error) {
          console.error("Erro ao preparar upload:", error);
          reject(error);
        } finally {
          setUploadingPhoto(null);
        }
      }, 0);
    });
  };

  const openCamera = async (
    type: "before" | "after",
    opts?: { appointmentServiceId?: string; serviceId?: string; petId?: string }
  ) => {
    const hasPermission = await requestAndroidPermissions();
    if (!hasPermission) {
      Alert.alert(
        t("profile.cameraPermissionDeniedTitle"),
        t("profile.cameraPermissionDeniedMessage")
      );
      return;
    }

    launchCamera(cameraOptions, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error("Erro ao abrir câmara:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openCameraError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadPhoto(
          type,
          response.assets[0].uri!,
          response.assets[0].fileName,
          opts
        );
      }
    });
  };

  const openGallery = async (
    type: "before" | "after",
    opts?: { appointmentServiceId?: string; serviceId?: string; petId?: string }
  ) => {
    launchImageLibrary(galleryOptions, async (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.error("Erro ao abrir galeria:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openGalleryError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadPhoto(
          type,
          response.assets[0].uri!,
          response.assets[0].fileName,
          opts
        );
      }
    });
  };

  const pickImage = (
    type: "before" | "after",
    opts?: { appointmentServiceId?: string; serviceId?: string; petId?: string }
  ) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t("common.cancel"),
            t("profile.takePhoto"),
            t("profile.chooseFromGallery"),
          ],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            openCamera(type, opts);
          } else if (buttonIndex === 2) {
            openGallery(type, opts);
          }
        }
      );
    } else {
      Alert.alert(
        t("profile.choosePhotoTitle"),
        t("profile.choosePhotoMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("profile.takePhoto"),
            onPress: () => openCamera(type, opts),
          },
          {
            text: t("profile.chooseFromGallery"),
            onPress: () => openGallery(type, opts),
          },
        ]
      );
    }
  };

  const getPhotoUrl = (type: "before" | "after") =>
    // Prefer photos from the new `photos` relation (most recent by created_at)
    (() => {
      try {
        const list = appointmentPhotos || [];
        const found = list.find((p: any) => p.type === type);
        if (found?.url) return found.url;
      } catch (e) {
        // ignore
      }
      return type === "before"
        ? appointment?.before_photo_url
        : appointment?.after_photo_url;
    })();

  const savePhotoToDevice = async (
    type: "before" | "after",
    opts?: { appointmentServiceId?: string }
  ) => {
    let photoUrl: string | undefined | null = undefined;
    if (opts?.appointmentServiceId) {
      photoUrl = getServicePhoto(opts.appointmentServiceId, type)?.url;
    }
    if (!photoUrl) photoUrl = getPhotoUrl(type) as string | undefined | null;
    if (!photoUrl) return;

    try {
      setSavingPhoto(type);
      const extFromUrl = photoUrl.split(".").pop()?.split("?")[0] || "jpg";
      const extension = extFromUrl.length <= 5 ? extFromUrl : "jpg";
      const filename = `appointment-${appointmentId}-${type}-${Date.now()}.${extension}`;
      await saveImageToDevice(photoUrl, filename);

      Alert.alert(
        t("appointmentDetail.photoSavedTitle"),
        t("appointmentDetail.photoSavedMessage")
      );
    } catch (error: any) {
      if (error?.code === "permission_denied") {
        Alert.alert(
          t("common.error"),
          t("appointmentDetail.photoSavePermission")
        );
      } else {
        console.error("Erro ao guardar foto:", error);
        Alert.alert(t("common.error"), t("appointmentDetail.photoSaveError"));
      }
    } finally {
      setSavingPhoto(null);
    }
  };

  const getServicePhoto = (
    appointmentServiceId?: string,
    type?: "before" | "after"
  ) => {
    if (!appointmentServiceId || !appointmentPhotos) return undefined;
    return appointmentPhotos.find(
      (p: any) =>
        p.type === type && p.appointment_service_id === appointmentServiceId
    );
  };

  const handlePhotoPress = (
    type: "before" | "after",
    opts?: { appointmentServiceId?: string; useLegacyFallback?: boolean }
  ) => {
    const photoObj = opts?.appointmentServiceId
      ? getServicePhoto(opts.appointmentServiceId, type)
      : (appointmentPhotos || []).find((p: any) => p.type === type);

    const hasPhoto = Boolean(
      photoObj || (opts?.useLegacyFallback ? getPhotoUrl(type) : false)
    );

    if (!hasPhoto) {
      // If an appointmentServiceId was provided, forward it so the upload is scoped
      if (opts?.appointmentServiceId) {
        pickImage(type, {
          appointmentServiceId: opts.appointmentServiceId,
        });
        return;
      }
      pickImage(type);
      return;
    }

    const onDelete = () => {
      if (!photoObj || !photoObj.id) {
        // nothing to delete
        return;
      }
      Alert.alert(
        t("appointmentDetail.deletePhotoTitle"),
        t("appointmentDetail.deletePhotoMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                hapticWarning();
                await hookRemovePhoto(photoObj.id);
                hapticSuccess();
              } catch (err) {
                console.error("delete appointment photo failed", {
                  photoId: photoObj.id,
                  appointmentId,
                  appointmentServiceId: opts?.appointmentServiceId,
                  error: err,
                });
                hapticError();
                Alert.alert(
                  t("common.error"),
                  t("appointmentDetail.deletePhotoError")
                );
              }
            },
          },
        ]
      );
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t("common.cancel"),
            t("appointmentDetail.savePhoto"),
            t("appointmentDetail.replacePhoto"),
            t("common.delete"),
          ],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) savePhotoToDevice(type, opts);
          if (buttonIndex === 2)
            pickImage(type, {
              appointmentServiceId: opts?.appointmentServiceId,
            });
          if (buttonIndex === 3) onDelete();
        }
      );
      return;
    }

    Alert.alert(t("appointmentDetail.photoOptionsTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("appointmentDetail.savePhoto"),
        onPress: () => savePhotoToDevice(type, opts),
      },
      {
        text: t("appointmentDetail.replacePhoto"),
        onPress: () =>
          pickImage(type, {
            appointmentServiceId: opts?.appointmentServiceId,
          }),
      },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => onDelete(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("appointmentDetail.title")}
        rightElement={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleDuplicateAppointment}
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="copy-outline" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEditAppointment}
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
        >
          {isLoading && !isRefetching ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: 20 }}
              size="large"
            />
          ) : null}
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                ⚠️ {t("appointmentDetail.loadError")}
              </Text>
            </View>
          ) : null}

          {appointment ? (
            <>
              {/* Hero Card - Serviço */}
              <View style={styles.heroCard}>
                <View style={styles.heroHeader}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColor + "20",
                        borderColor: statusColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: statusColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusColor },
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                  {isRecurring ? (
                    <TouchableOpacity
                      style={styles.heroRecurrenceBadge}
                      onPress={openRecurrenceActions}
                      activeOpacity={0.7}
                    >
                      {seriesMutation.isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="refresh"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.heroRecurrenceText}>
                            {t("appointmentCard.recurring")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.paymentBadge,
                      {
                        backgroundColor: `${paymentColor}14`,
                      },
                    ]}
                    onPress={togglePayment}
                  >
                    <Ionicons
                      name={
                        paymentStatus === "paid"
                          ? "checkmark-circle"
                          : "time-outline"
                      }
                      size={16}
                      color={paymentColor}
                    />
                    <Text
                      style={[styles.paymentBadgeText, { color: paymentColor }]}
                    >
                      {paymentStatus === "paid"
                        ? t("payment.paid")
                        : t("payment.unpaid")}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.heroTitle}>
                  {services.length === 1
                    ? services[0]?.name || t("common.service")
                    : t("appointmentDetail.servicesCount", {
                        count: services.length,
                      })}
                </Text>

                <View style={styles.dateTimeRow}>
                  <Text style={styles.heroSubtitle}>
                    {formatDateTime(
                      appointment.appointment_date,
                      appointment.appointment_time,
                      dateLocale,
                      t("common.noDate"),
                      t("common.at")
                    )}
                  </Text>
                </View>

                <View style={styles.heroDetails}>
                  {amount !== null && amount !== undefined ? (
                    <View style={styles.heroDetailItem}>
                      <Text style={styles.heroDetailLabel}>
                        {t("appointmentDetail.totalValue")}
                      </Text>
                      <Text style={styles.heroDetailValue}>
                        €{Number(amount).toFixed(2)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.heroDetailItem}>
                    <Text style={styles.heroDetailLabel}>
                      {t("appointmentDetail.duration")}
                    </Text>
                    <Text style={styles.heroDetailValue}>
                      {appointment.duration
                        ? `${appointment.duration} ${t("common.minutesShort")}`
                        : "—"}
                    </Text>
                  </View>
                </View>

                {showServiceBreakdown && (
                  <View style={styles.servicesDetailBox}>
                    <Text style={styles.servicesDetailTitle}>
                      {t("appointmentDetail.servicesIncluded")}
                    </Text>
                    {serviceDetails.map((detail, index) => {
                      const tierLabel =
                        detail.entry.price_tier_label ||
                        t("appointmentDetail.tierDefault");
                      const tierPrice = detail.entry.price_tier_price;
                      const addonsLabel = detail.addons
                        .map((addon) => {
                          const price =
                            addon.price != null
                              ? `€${Number(addon.price).toFixed(2)}`
                              : "";
                          return price
                            ? `${addon.name} (${price})`
                            : addon.name;
                        })
                        .filter(Boolean)
                        .join(", ");
                      const petName = detail.pet?.name;
                      const showPrice =
                        detail.total > 0 ||
                        detail.basePrice > 0 ||
                        detail.addonsTotal > 0;
                      const beforePhoto = getServicePhoto(
                        detail.entry.id,
                        "before"
                      )?.url;
                      const afterPhoto = getServicePhoto(
                        detail.entry.id,
                        "after"
                      )?.url;
                      return (
                        <View
                          key={detail.key}
                          style={[
                            styles.serviceDetailRow,
                            index === serviceDetails.length - 1 &&
                              styles.serviceDetailRowLast,
                          ]}
                        >
                          <View style={styles.serviceDetailLeft}>
                            <View style={styles.serviceBullet} />
                            <View style={styles.serviceDetailInfo}>
                              <Text style={styles.serviceDetailName}>
                                {detail.service?.name || t("common.service")}
                              </Text>
                              {petName ? (
                                <Text style={styles.serviceDetailPetName}>
                                  {petName}
                                </Text>
                              ) : null}
                              {detail.hasTier ? (
                                <Text style={styles.serviceDetailMeta}>
                                  {t("appointmentDetail.tierLabel")}:{" "}
                                  {tierLabel}
                                  {tierPrice != null
                                    ? ` · €${Number(tierPrice).toFixed(2)}`
                                    : ""}
                                </Text>
                              ) : null}
                              {detail.hasAddons ? (
                                <Text style={styles.serviceDetailMeta}>
                                  {t("appointmentDetail.addonsLabel")}:{" "}
                                  {addonsLabel}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {showPrice ? (
                            <View style={{ alignItems: "flex-end" }}>
                              <View style={styles.servicePhotoActionsRow}>
                                <View style={styles.servicePhotoThumbWrap}>
                                  {beforePhoto ? (
                                    <ImageWithDownload
                                      uri={beforePhoto}
                                      style={styles.servicePhotoThumb}
                                      disableDefaultOptions
                                      onPress={() =>
                                        handlePhotoPress("before", {
                                          appointmentServiceId: detail.entry.id,
                                          useLegacyFallback: false,
                                        })
                                      }
                                    />
                                  ) : (
                                    <TouchableOpacity
                                      style={
                                        styles.servicePhotoThumbPlaceholder
                                      }
                                      onPress={() =>
                                        handlePhotoPress("before", {
                                          appointmentServiceId: detail.entry.id,
                                          useLegacyFallback: false,
                                        })
                                      }
                                    >
                                      <Text
                                        style={styles.servicePhotoThumbPlus}
                                      >
                                        +
                                      </Text>
                                      <Text
                                        style={styles.servicePhotoThumbLabel}
                                      >
                                        {t("appointmentDetail.before")}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                  {uploadingPhoto?.type === "before" &&
                                    uploadingPhoto?.appointmentServiceId ===
                                      detail.entry.id && (
                                      <View
                                        style={
                                          styles.servicePhotoLoadingOverlay
                                        }
                                      >
                                        <ActivityIndicator color="#fff" />
                                      </View>
                                    )}
                                </View>

                                <View
                                  style={[
                                    styles.servicePhotoThumbWrap,
                                    { marginLeft: 8 },
                                  ]}
                                >
                                  {afterPhoto ? (
                                    <ImageWithDownload
                                      uri={afterPhoto}
                                      style={styles.servicePhotoThumb}
                                      disableDefaultOptions
                                      onPress={() =>
                                        handlePhotoPress("after", {
                                          appointmentServiceId: detail.entry.id,
                                          useLegacyFallback: false,
                                        })
                                      }
                                    />
                                  ) : (
                                    <TouchableOpacity
                                      style={
                                        styles.servicePhotoThumbPlaceholder
                                      }
                                      onPress={() =>
                                        handlePhotoPress("after", {
                                          appointmentServiceId: detail.entry.id,
                                          useLegacyFallback: false,
                                        })
                                      }
                                    >
                                      <Text
                                        style={styles.servicePhotoThumbPlus}
                                      >
                                        +
                                      </Text>
                                      <Text
                                        style={styles.servicePhotoThumbLabel}
                                      >
                                        {t("appointmentDetail.after")}
                                      </Text>
                                    </TouchableOpacity>
                                  )}
                                  {uploadingPhoto?.type === "after" &&
                                    uploadingPhoto?.appointmentServiceId ===
                                      detail.entry.id && (
                                      <View
                                        style={
                                          styles.servicePhotoLoadingOverlay
                                        }
                                      >
                                        <ActivityIndicator color="#fff" />
                                      </View>
                                    )}
                                </View>
                              </View>
                              <Text
                                style={[
                                  styles.serviceDetailPrice,
                                  { marginTop: 8 },
                                ]}
                              >
                                €{detail.total.toFixed(2)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Cliente & Pet em Grid */}
              <View style={styles.gridRow}>
                <TouchableOpacity
                  style={[styles.compactCard, styles.petCard, { flex: 1 }]}
                  onPress={() =>
                    customer?.id &&
                    navigation.navigate("CustomerDetail", {
                      customerId: customer.id,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.compactCardTitle}>
                    👤 {t("appointmentDetail.customer")}
                  </Text>
                  <Text style={styles.compactCardName}>
                    {customerName || t("appointmentDetail.noCustomer")}
                  </Text>
                  {customer?.phone ? (
                    <View style={styles.contactActions}>
                      <TouchableOpacity
                        style={styles.contactButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          callCustomer();
                        }}
                      >
                        <Ionicons name="call" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.contactButton, styles.whatsappButton]}
                        onPress={(e) => {
                          e.stopPropagation();
                          whatsappCustomer();
                        }}
                      >
                        <FontAwesome
                          name="whatsapp"
                          size={22}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>

                {appointmentPets.length > 0 ? (
                  <View
                    style={[styles.compactCard, styles.petCard, { flex: 1 }]}
                  >
                    <Text style={styles.compactCardTitle}>
                      🐾 {t("appointmentDetail.pet")}
                    </Text>
                    {appointmentPets.length === 1 ? (
                      <>
                        <TouchableOpacity
                          style={styles.singlePetRow}
                          activeOpacity={0.8}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            const pet = appointmentPets[0];
                            if (!pet) return;
                            if (pet.id) {
                              navigation.navigate("PetForm", {
                                mode: "edit",
                                customerId,
                                petId: pet.id,
                                pet,
                              });
                            }
                          }}
                        >
                          {appointmentPets[0].photo_url ? (
                            <Image
                              source={{ uri: appointmentPets[0].photo_url }}
                              style={[
                                styles.petThumbnail,
                                styles.singlePetAvatar,
                              ]}
                            />
                          ) : (
                            <View
                              style={[
                                styles.petThumbnailPlaceholder,
                                styles.singlePetAvatar,
                              ]}
                            >
                              <Text style={styles.petThumbnailInitials}>
                                {String(appointmentPets[0].name || "")
                                  .slice(0, 1)
                                  .toUpperCase() || "🐾"}
                              </Text>
                            </View>
                          )}
                          <View style={styles.singlePetInfo}>
                            <Text style={styles.singlePetName}>
                              {appointmentPets[0].name}
                            </Text>
                            {appointmentPets[0].breed ? (
                              <Text style={styles.singlePetBreed}>
                                {appointmentPets[0].breed}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.petList}>
                        {appointmentPets.map((entry, index) => {
                          const key = entry.id
                            ? String(entry.id)
                            : `${entry.name || "pet"}-${index}`;
                          return (
                            <TouchableOpacity
                              key={key}
                              activeOpacity={0.8}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                if (entry.id) {
                                  navigation.navigate("PetForm", {
                                    mode: "edit",
                                    customerId,
                                    petId: entry.id,
                                    pet: entry,
                                  });
                                }
                              }}
                              style={[
                                styles.petRow,
                                index === appointmentPets.length - 1 &&
                                  styles.petRowLast,
                              ]}
                            >
                              {entry.photo_url ? (
                                <Image
                                  source={{ uri: entry.photo_url }}
                                  style={styles.petRowImage}
                                />
                              ) : (
                                <View style={styles.petRowPlaceholder}>
                                  <Text style={styles.petRowInitials}>
                                    {String(entry.name || "")
                                      .slice(0, 1)
                                      .toUpperCase() || "🐾"}
                                  </Text>
                                </View>
                              )}
                              <View style={styles.petRowInfo}>
                                <Text
                                  style={styles.petRowName}
                                  numberOfLines={1}
                                >
                                  {entry.name}
                                </Text>
                                {entry.breed ? (
                                  <Text
                                    style={styles.petRowBreed}
                                    numberOfLines={1}
                                  >
                                    {entry.breed}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : null}
              </View>

              {formatCustomerAddress(customer) ? (
                <View style={styles.mapCardContainer}>
                  <View style={styles.mapCardHeader}>
                    <Text style={styles.mapIcon}>📍</Text>
                    <View style={styles.mapContent}>
                      <Text style={styles.mapTitle}>
                        {t("appointmentDetail.address")}
                      </Text>
                      <Text style={styles.mapAddress}>
                        {formatCustomerAddress(customer, "\n")}
                      </Text>
                    </View>
                  </View>
                  <MiniMap address={formatCustomerAddress(customer)} />
                </View>
              ) : null}

              {/* legacy top-level before/after photos removed (now per-service) */}

              {/* Estado - Buttons Modernos */}
              <View style={styles.statusCard}>
                <Text style={styles.statusCardTitle}>
                  {t("appointmentDetail.changeStatus")}
                </Text>
                <View style={styles.statusGrid}>
                  {statusOptions.map(({ value, emoji }) => {
                    const active = displayStatus === value;
                    const statusColor = getStatusColor(value);

                    return (
                      <TouchableOpacity
                        key={value}
                        style={[
                          styles.statusButton,
                          active && {
                            backgroundColor: statusColor,
                            borderColor: statusColor,
                          },
                        ]}
                        onPress={() => saveStatus(value)}
                      >
                        <Text style={styles.statusButtonEmoji}>{emoji}</Text>
                        <Text
                          style={[
                            styles.statusButtonText,
                            { color: active ? "#fff" : colors.text },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {getStatusLabel(value)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Botões Cancelar e Apagar */}
                <View style={styles.dangerActions}>
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      displayStatus === "cancelled" && {
                        backgroundColor: getStatusColor("cancelled"),
                        borderColor: getStatusColor("cancelled"),
                      },
                    ]}
                    onPress={() => {
                      Alert.alert(
                        t("appointmentDetail.cancelTitle"),
                        t("appointmentDetail.cancelMessage"),
                        [
                          {
                            text: t("appointmentDetail.cancelNo"),
                            style: "cancel",
                          },
                          {
                            text: t("appointmentDetail.cancelYes"),
                            style: "destructive",
                            onPress: () => {
                              hapticWarning();
                              saveStatus("cancelled");
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.cancelButtonText,
                        displayStatus === "cancelled" && { color: "#fff" },
                      ]}
                    >
                      {displayStatus === "cancelled"
                        ? t("status.cancelled")
                        : t("appointmentDetail.cancelAction")}
                    </Text>
                  </TouchableOpacity>

                  {displayStatus === "cancelled" && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDelete}
                    >
                      <Text style={styles.deleteButtonText}>
                        {t("appointmentDetail.deleteAction")}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Notas */}
              <View
                style={styles.notesCard}
                onLayout={(event) => {
                  notesYRef.current = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.notesHeader}>
                  <Text style={styles.notesTitle}>
                    {t("appointmentDetail.notes")}
                  </Text>
                  {notesMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                </View>
                <TextInput
                  style={styles.notesInput}
                  multiline
                  value={notesDraft}
                  onChangeText={setNotesDraft}
                  onBlur={handleSaveNotes}
                  onFocus={focusNotes}
                  placeholder={t("appointmentForm.notesPlaceholder")}
                  placeholderTextColor={colors.muted}
                  textAlignVertical="top"
                  returnKeyType="default"
                  blurOnSubmit={false}
                />
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  const cardBase = getCardStyle(colors);
  const placeholderBg =
    colors.primarySoft && colors.primarySoft !== colors.surface
      ? colors.primarySoft
      : colors.primary
      ? `${colors.primary}12`
      : colors.surfaceBorder || colors.surface;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerActions: {
      flexDirection: "row",
      gap: 10,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 8,
      gap: 16,
    },
    errorCard: {
      ...cardBase,
      backgroundColor: "#fee2e2",
      borderColor: "#fecaca",
      padding: 16,
      alignItems: "center",
    },
    errorText: {
      color: "#dc2626",
      fontWeight: "600",
      fontSize: 15,
    },
    // Hero Card - Destaque do Serviço
    heroCard: {
      ...cardBase,
      padding: 20,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    heroRecurrenceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}14`,
    },
    heroRecurrenceText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 13,
    },
    paymentBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    paymentBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: 16,
      color: colors.muted,
      fontWeight: "500",
    },
    dateTimeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    heroDetails: {
      flexDirection: "row",
      gap: 16,
    },
    heroDetailItem: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    heroDetailLabel: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 4,
      fontWeight: "500",
    },
    heroDetailValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.primary,
    },
    // Services Detail Box
    servicesDetailBox: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    servicesDetailTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    serviceDetailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    serviceDetailLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      flex: 1,
    },
    serviceDetailInfo: {
      flex: 1,
    },
    serviceBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    serviceDetailName: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
    },
    serviceDetailPetName: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
      marginTop: 2,
    },
    serviceDetailMeta: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    serviceDetailPrice: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.primary,
    },
    servicePhotoActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    servicePhotoThumbWrap: {
      width: 52,
      height: 52,
      borderRadius: 8,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: placeholderBg,
    },
    servicePhotoThumb: {
      width: 52,
      height: 52,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    servicePhotoThumbPlaceholder: {
      width: 52,
      height: 52,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: placeholderBg,
    },
    servicePhotoThumbPlus: {
      fontSize: 16,
      color: colors.muted,
      fontWeight: "700",
    },
    servicePhotoThumbLabel: {
      fontSize: 10,
      color: colors.muted,
      marginTop: 4,
      fontWeight: "600",
    },
    servicePhotoLoadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    serviceDetailRowLast: {
      borderBottomWidth: 0,
    },
    // Grid Row para Cliente/Pet
    gridRow: {
      flexDirection: "row",
      gap: 12,
    },
    compactCard: {
      ...cardBase,
      padding: 16,
    },
    petCard: {
      alignItems: "center",
      justifyContent: "center",
    },
    compactCardTitle: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 8,
      fontWeight: "600",
    },
    compactCardName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
      textAlign: "center",
    },
    compactCardBreed: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 8,
      textAlign: "center",
    },
    compactAction: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
      alignSelf: "flex-start",
    },
    compactActionText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    contactActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    contactButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    whatsappButton: {
      backgroundColor: "#25D366",
    },
    contactButtonIcon: {
      fontSize: 20,
    },
    petThumbnail: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.background,
    },
    singlePetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    singlePetAvatar: {
      marginBottom: 0,
    },
    singlePetInfo: {
      flex: 1,
      alignItems: "flex-start",
    },
    singlePetName: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 2,
      textAlign: "left",
    },
    singlePetBreed: {
      fontSize: 13,
      color: colors.muted,
      textAlign: "left",
    },
    petList: {
      width: "100%",
      gap: 10,
    },
    petRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceBorder,
    },
    petRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    petRowImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.background,
    },
    petRowPlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: placeholderBg,
      alignItems: "center",
      justifyContent: "center",
    },
    petRowInitials: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.text,
    },
    petThumbnailPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: placeholderBg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    petThumbnailInitials: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    petRowInfo: {
      flex: 1,
      alignItems: "flex-start",
    },
    petRowName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      textAlign: "left",
    },
    petRowBreed: {
      fontSize: 12,
      color: colors.muted,
      textAlign: "left",
      marginTop: 2,
    },
    // Map Card
    mapCardContainer: {
      ...cardBase,
      padding: 16,
    },
    mapCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    mapCard: {
      flexDirection: "row",
      alignItems: "center",
      ...cardBase,
      padding: 16,
      gap: 12,
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
      fontWeight: "600",
    },
    mapAddress: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
    },
    mapArrow: {
      fontSize: 24,
      color: colors.muted,
    },
    // (legacy photo styles removed)
    // Status Card
    statusCard: {
      ...cardBase,
      padding: 20,
    },
    statusCardTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 16,
    },
    statusGrid: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    statusButton: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: "center",
      gap: 4,
    },
    statusButtonEmoji: {
      fontSize: 20,
    },
    statusButtonText: {
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
    },
    dangerActions: {
      flexDirection: "row",
      gap: 8,
    },
    duplicateButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    duplicateButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.text,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: "#fee2e2",
      borderWidth: 2,
      borderColor: "#fca5a5",
      borderRadius: 14,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    cancelButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#dc2626",
    },
    deleteButton: {
      flex: 1,
      backgroundColor: "#fee2e2",
      borderWidth: 2,
      borderColor: "#fca5a5",
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#dc2626",
    },
    // Notas
    notesCard: {
      ...cardBase,
      padding: 20,
    },
    notesHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 10,
    },
    notesTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 0,
    },
    notesInput: {
      borderRadius: 12,
      padding: 12,
      minHeight: 120,
      fontSize: 15,
      color: colors.text,
    },
    notesText: {
      fontSize: 15,
      color: colors.muted,
      lineHeight: 22,
    },
  });
}
