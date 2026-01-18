import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ActionSheetIOS,
  PermissionsAndroid,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import { formatCustomerAddress, formatCustomerName } from "../utils/customer";
import {
  getCustomers,
  getPetsByCustomer,
  uploadCustomerPhoto,
  deleteCustomer,
  type Customer,
  type Pet,
} from "../api/customers";
import { getAppointments, type Appointment } from "../api/appointments";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/common/Avatar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { MiniMap } from "../components/common/MiniMap";
import { PetCard } from "../components/customers/PetCard";
import SwipeableRow from "../components/common/SwipeableRow";
import AppointmentCard from "../components/appointments/AppointmentCard";
import { deletePet } from "../api/customers";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess, hapticWarning } from "../utils/haptics";
import { useSwipeDeleteIndicator } from "../hooks/useSwipeDeleteIndicator";
import { UndoToast } from "../components/common/UndoToast";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";
import ProfileLayout from "./profile/ProfileLayout";
import createProfileStyles from "./profileStyles";

type Props = NativeStackScreenProps<any, "CustomerDetail">;
type DeletePetPayload = {
  pet: Pet;
  index: number;
};
type CustomerSection = "overview" | "pets" | "appointments";
const UNDO_TIMEOUT_MS = 4000;

function getAppointmentTimestamp(appointment: Appointment): number | null {
  if (!appointment.appointment_date) return null;
  const time =
    appointment.appointment_time?.padStart(5, "0")?.slice(0, 5) || "00:00";
  const iso = `${appointment.appointment_date}T${time}:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params as { customerId: string };
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const undoBottomOffset = insets.bottom + 16;
  const [undoVisible, setUndoVisible] = useState(false);
  const {
    deletingId: deletingPetId,
    beginDelete,
    clearDeletingId,
  } = useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePetPayload | null>(null);
  const layoutScrollRef = useRef<ScrollView | null>(null);

  const {
    data: customers = [],
    isLoading: isLoadingCustomer,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  const {
    data: pets = [],
    isLoading: isLoadingPets,
    refetch: refetchPets,
  } = useQuery({
    queryKey: ["customer-pets", customerId],
    queryFn: () => getPetsByCustomer(customerId),
    enabled: !!customerId,
  });

  const [activeSection, setActiveSection] =
    useState<CustomerSection>("overview");
  const {
    data: appointmentsResponse,
    isLoading: isLoadingAppointments,
    refetch: refetchAppointments,
  } = useQuery({
    queryKey: ["customer-appointments", customerId],
    queryFn: () => getAppointments({ customerId, limit: 40 }),
    enabled: !!customerId,
  });
  const appointments = appointmentsResponse?.items ?? [];
  const customerAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => appointment.customers?.id === customerId
      ),
    [appointments, customerId]
  );
  const refreshing =
    isLoadingCustomer || isLoadingPets || isLoadingAppointments;
  const handleRefresh = useCallback(() => {
    refetchCustomers();
    refetchPets();
    refetchAppointments();
  }, [refetchAppointments, refetchCustomers, refetchPets]);
  const nextAppointment = useMemo(() => {
    if (!customerAppointments.length) return null;
    const candidates = customerAppointments
      .map((appointment) => ({
        appointment,
        timestamp: getAppointmentTimestamp(appointment),
      }))
      .filter((entry) => entry.timestamp !== null)
      .sort((a, b) => a.timestamp! - b.timestamp!);
    if (!candidates.length) return null;
    const now = Date.now();
    const next = candidates.find((entry) => (entry.timestamp ?? 0) >= now);
    return next ? next.appointment : candidates[0].appointment;
  }, [customerAppointments]);

  const updateCustomerPetCount = useCallback(
    (delta: number) => {
      queryClient.setQueryData(["customers"], (old: Customer[] | undefined) => {
        if (!old) return old;
        return old.map((item) => {
          if (item.id !== customerId) return item;
          const baseCount = item.pet_count ?? item.pets?.length ?? 0;
          const nextCount = Math.max(0, baseCount + delta);
          return { ...item, pet_count: nextCount };
        });
      });
    },
    [customerId, queryClient]
  );

  const restorePet = useCallback(
    (payload: DeletePetPayload) => {
      let didInsert = false;
      queryClient.setQueryData(
        ["customer-pets", customerId],
        (old: Pet[] | undefined) => {
          if (!old) return old;
          if (old.some((item) => item.id === payload.pet.id)) return old;
          const nextItems = [...old];
          const insertIndex = Math.min(
            Math.max(payload.index, 0),
            nextItems.length
          );
          nextItems.splice(insertIndex, 0, payload.pet);
          didInsert = true;
          return nextItems;
        }
      );
      if (didInsert) {
        updateCustomerPetCount(1);
      }
    },
    [customerId, queryClient, updateCustomerPetCount]
  );

  const deletePetMutation = useMutation({
    mutationFn: ({ pet }: DeletePetPayload) => deletePet(customerId, pet.id),
    onSuccess: async () => {
      hapticSuccess();
      if (!pendingDeleteRef.current) {
        await queryClient.invalidateQueries({
          queryKey: ["customer-pets", customerId],
        });
        await queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
    },
    onError: (err: any, variables) => {
      hapticError();
      if (variables) {
        restorePet(variables);
      }
      if (!pendingDeleteRef.current) {
        queryClient.invalidateQueries({
          queryKey: ["customer-pets", customerId],
        });
        queryClient.invalidateQueries({ queryKey: ["customers"] });
      }
      const message =
        err?.response?.data?.error ||
        err.message ||
        t("customerDetail.deletePetError");
      Alert.alert(t("common.error"), message);
    },
  });

  const commitPendingDelete = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    deletePetMutation.mutate(pending);
  }, [clearDeletingId, deletePetMutation]);

  const startOptimisticDelete = useCallback(
    (pet: Pet) => {
      if (pendingDeleteRef.current) {
        commitPendingDelete();
      }

      const cached = queryClient.getQueryData<Pet[]>([
        "customer-pets",
        customerId,
      ]);
      const index = cached
        ? cached.findIndex((item) => item.id === pet.id)
        : -1;
      const shouldAdjustCount = index !== -1;

      queryClient.setQueryData(
        ["customer-pets", customerId],
        (old: Pet[] | undefined) => {
          if (!old) return old;
          if (!old.some((item) => item.id === pet.id)) return old;
          return old.filter((item) => item.id !== pet.id);
        }
      );
      if (shouldAdjustCount) {
        updateCustomerPetCount(-1);
      }

      pendingDeleteRef.current = { pet, index: Math.max(index, 0) };
      setUndoVisible(true);
    },
    [commitPendingDelete, customerId, queryClient, updateCustomerPetCount]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingDeleteRef.current;
    pendingDeleteRef.current = null;
    clearDeletingId();
    setUndoVisible(false);
    if (!pending) return;
    restorePet(pending);
  }, [clearDeletingId, restorePet]);

  useEffect(() => {
    return () => {
      const pending = pendingDeleteRef.current;
      if (!pending) return;
      pendingDeleteRef.current = null;
      deletePetMutation.mutate(pending);
    };
  }, [deletePetMutation]);

  const customer = customers.find((c) => c.id === customerId);

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) =>
      uploadCustomerPhoto(customerId, file),
    onSuccess: async (data) => {
      hapticSuccess();
      const photoUrl = data?.url;
      if (photoUrl && customer) {
        const updatedCustomers = customers.map((c) =>
          c.id === customerId ? { ...c, photo_url: photoUrl } : c
        );
        queryClient.setQueryData(["customers"], updatedCustomers);
      }
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: any) => {
      hapticError();
      const message =
        err?.response?.data?.error ||
        err.message ||
        t("customerDetail.photoUploadError");
      Alert.alert(t("common.error"), message);
    },
  });

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

  const uploadPhoto = async (uri: string, fileName?: string) => {
    try {
      setUploadingPhoto(true);
      const timestamp = Date.now();
      const extension =
        fileName?.split(".").pop() || uri.split(".").pop() || "jpg";
      const filename = `customer-${customerId}-${timestamp}.${extension}`;
      const fileType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      await uploadPhotoMutation.mutateAsync({
        uri,
        name: filename,
        type: fileType,
      });
    } catch (error) {
      console.error("Erro ao preparar upload:", error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openCamera = async () => {
    const hasPermission = await requestAndroidPermissions();
    if (!hasPermission) {
      Alert.alert(
        t("profile.cameraPermissionDeniedTitle"),
        t("profile.cameraPermissionDeniedMessage")
      );
      return;
    }

    launchCamera(cameraOptions, async (response) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error("Erro ao abrir câmara:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openCameraError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadPhoto(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const openGallery = async () => {
    launchImageLibrary(galleryOptions, async (response) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorCode) {
        console.error("Erro ao abrir galeria:", response.errorMessage);
        Alert.alert(t("common.error"), t("profile.openGalleryError"));
        return;
      }
      if (response.assets && response.assets[0]) {
        await uploadPhoto(response.assets[0].uri!, response.assets[0].fileName);
      }
    });
  };

  const handleAvatarPress = () => {
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
            openCamera();
          } else if (buttonIndex === 2) {
            openGallery();
          }
        }
      );
    } else {
      Alert.alert(
        t("profile.choosePhotoTitle"),
        t("profile.choosePhotoMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("profile.takePhoto"), onPress: openCamera },
          { text: t("profile.chooseFromGallery"), onPress: openGallery },
        ]
      );
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteCustomer(customerId),
    onSuccess: () => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigation.goBack();
    },
    onError: (error: any) => {
      hapticError();
      const message =
        error?.response?.data?.error ||
        error.message ||
        t("customerDetail.deleteCustomerError");
      Alert.alert(t("common.error"), message);
    },
  });

  const handleDeleteCustomer = () => {
    Alert.alert(
      t("customerDetail.deleteCustomerTitle"),
      t("customerDetail.deleteCustomerMessage", { name: displayName }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("customerDetail.deleteCustomerAction"),
          style: "destructive",
          onPress: () => {
            hapticWarning();
            deleteMutation.mutate();
          },
        },
      ]
    );
  };

  const handleEditCustomer = () => {
    navigation.navigate("CustomerForm", { mode: "edit", customerId, customer });
  };

  const handleAddPet = () => {
    navigation.navigate("PetForm", { mode: "create", customerId });
  };

  const handlePetPress = (pet: Pet) => {
    navigation.navigate("PetForm", {
      mode: "edit",
      customerId,
      petId: pet.id,
      pet,
    });
  };

  const handleAddAppointment = useCallback(() => {
    navigation.navigate("NewAppointment");
  }, [navigation]);

  const handleAppointmentPress = useCallback(
    (appointment: Appointment) => {
      navigation.navigate("AppointmentDetail", { id: appointment.id });
    },
    [navigation]
  );

  if (isLoadingCustomer) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScreenHeader title={t("customerDetail.title")} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScreenHeader title={t("customerDetail.title")} />
        <EmptyState
          icon="❌"
          title={t("customerDetail.notFoundTitle")}
          description={t("customerDetail.notFoundDescription")}
        />
      </SafeAreaView>
    );
  }

  const displayName = formatCustomerName(customer);
  const customerAddress = formatCustomerAddress(customer);
  const petCount = pets.length;
  const appointmentCount = customerAppointments.length;

  const formatDateLabel = (value?: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString(i18n.language, {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return value;
    }
  };

  const formatTimeLabel = (value?: string | null) => {
    if (!value) return "—";
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}`;
    }
    return value;
  };

  const hasNextAppointment = Boolean(nextAppointment);
  const nextAppointmentLabel = hasNextAppointment
    ? `${formatDateLabel(
        nextAppointment!.appointment_date
      )} • ${formatTimeLabel(nextAppointment!.appointment_time)}`
    : t("customerDetail.nextAppointmentEmpty");

  const headerRightElement = (
    <TouchableOpacity
      onPress={handleEditCustomer}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={[(styles as any).editIcon, { color: colors.primary }]}>
        ✏️
      </Text>
    </TouchableOpacity>
  );

  const sectionTabs: Array<{ key: CustomerSection; label: string }> = [
    { key: "overview", label: t("customerDetail.sectionOverview") },
    { key: "pets", label: t("customerDetail.segmentPets") },
    { key: "appointments", label: t("customerDetail.segmentAppointments") },
  ];

  return (
    <>
      <ProfileLayout
        title={t("customerDetail.detailsTitle")}
        rightElement={headerRightElement}
        scrollRef={layoutScrollRef}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Avatar
                name={displayName}
                size="large"
                imageUrl={customer.photo_url}
                onPress={handleAvatarPress}
              />
              {uploadingPhoto && (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.headerTopRow}>
                <Text style={styles.headerTitle}>{displayName}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {t("customerDetail.customerLabel")}
                  </Text>
                </View>
              </View>
              {customer.email ? (
                <Text style={styles.headerSubtitle}>{customer.email}</Text>
              ) : null}
              {customer.phone ? (
                <Text style={styles.headerMeta}>
                  {t("common.phone")}: {customer.phone}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionTabs}
        >
          {sectionTabs.map((section) => {
            const isActive = activeSection === section.key;
            return (
              <TouchableOpacity
                key={section.key}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                onPress={() => setActiveSection(section.key)}
              >
                <Text
                  style={[
                    styles.sectionTabText,
                    isActive && styles.sectionTabTextActive,
                  ]}
                >
                  {section.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeSection === "overview" && (
          <View style={styles.section}>
            <View style={(styles as any).sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("customerDetail.sectionOverview")}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t("customerDetail.segmentPets")}
                </Text>
                <Text style={styles.statValue}>{petCount}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {t("customerDetail.segmentAppointments")}
                </Text>
                <Text style={styles.statValue}>{appointmentCount}</Text>
              </View>
            </View>
            {customerAddress ? (
              <>
                <View style={styles.mapWrapper}>
                  <MiniMap address={customerAddress} height={150} borderless />
                </View>
                <Text style={styles.mapCaption}>{customerAddress}</Text>
              </>
            ) : null}
            <View style={styles.nextAppointmentCard}>
              <Text style={styles.nextAppointmentTitle}>
                {t("customerDetail.nextAppointmentTitle")}
              </Text>
              <Text style={styles.nextAppointmentValue}>
                {nextAppointmentLabel}
              </Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={handleAddPet}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    styles.actionButtonTextSecondary,
                  ]}
                >
                  {t("customerDetail.addPet")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={handleAddAppointment}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    styles.actionButtonTextPrimary,
                  ]}
                >
                  {t("customerDetail.addAppointment")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeSection === "pets" && (
          <View style={styles.section}>
            <View style={(styles as any).sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("customerDetail.petsTitle", { count: pets.length })}
              </Text>
            </View>
            {isLoadingPets ? (
              <View style={styles.listLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : pets.length === 0 ? (
              <EmptyState
                title={t("customerDetail.noPetsTitle")}
                description={t("customerDetail.noPetsDescription")}
                actionLabel={t("customerDetail.addPet")}
                onAction={handleAddPet}
              />
            ) : (
              <View style={styles.listStack}>
                {pets.map((pet) => (
                  <SwipeableRow
                    key={pet.id}
                    isDeleting={pet.id === deletingPetId}
                    onDelete={() => {
                      Alert.alert(
                        t("customerDetail.deletePetTitle"),
                        t("customerDetail.deletePetMessage", {
                          name: pet.name,
                        }),
                        [
                          { text: t("common.cancel"), style: "cancel" },
                          {
                            text: t("customerDetail.deletePetAction"),
                            style: "destructive",
                            onPress: () => {
                              hapticWarning();
                              beginDelete(pet.id, () =>
                                startOptimisticDelete(pet)
                              );
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <PetCard pet={pet} onPress={() => handlePetPress(pet)} />
                  </SwipeableRow>
                ))}
              </View>
            )}
          </View>
        )}

        {activeSection === "appointments" && (
          <View style={styles.section}>
            <View style={(styles as any).sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("customerDetail.sectionAppointments")}
                {appointmentCount ? ` (${appointmentCount})` : ""}
              </Text>
            </View>
            {isLoadingAppointments ? (
              <View style={styles.listLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : appointmentCount === 0 ? (
              <EmptyState
                icon="🗓️"
                title={t("customerDetail.noAppointmentsTitle")}
                description={t("customerDetail.noAppointmentsDescription")}
                actionLabel={t("customerDetail.addAppointment")}
                onAction={handleAddAppointment}
              />
            ) : (
              <View style={styles.listStack}>
                {customerAppointments.map((appointment) => (
                  <View key={appointment.id} style={styles.appointmentCard}>
                    <AppointmentCard
                      appointment={appointment}
                      onPress={() => handleAppointmentPress(appointment)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={[styles.section, styles.dangerZone]}>
          <Button
            title={t("customerDetail.deleteCustomerAction")}
            onPress={handleDeleteCustomer}
            variant="ghost"
            size="large"
            loading={deleteMutation.isPending}
            disabled={deleteMutation.isPending}
            style={styles.deleteButton}
            textStyle={styles.deleteButtonText}
          />
        </View>
      </ProfileLayout>
      <UndoToast
        visible={undoVisible}
        message={t("customerDetail.deletePetUndoMessage")}
        actionLabel={t("customerDetail.deletePetUndoAction")}
        onAction={handleUndo}
        onTimeout={commitPendingDelete}
        onDismiss={commitPendingDelete}
        durationMs={UNDO_TIMEOUT_MS}
        bottomOffset={undoBottomOffset}
      />
    </>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  const baseStyles = createProfileStyles(colors);
  const extraStyles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listLoading: {
      paddingVertical: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    listStack: {
      gap: 12,
    },
    appointmentCard: {
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 8,
    },
    statItem: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    mapWrapper: {
      width: "100%",
      marginTop: 16,
      borderRadius: 16,
      overflow: "hidden",
    },
    mapCaption: {
      width: "100%",
      marginTop: 8,
      color: colors.muted,
      fontSize: 13,
      textAlign: "center",
    },
    nextAppointmentCard: {
      width: "100%",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 16,
      marginTop: 16,
    },
    nextAppointmentTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    nextAppointmentValue: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginTop: 6,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 20,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    actionButtonPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionButtonSecondary: {
      backgroundColor: colors.surface,
      borderColor: colors.surfaceBorder,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: "600",
    },
    actionButtonTextPrimary: {
      color: colors.onPrimary,
    },
    actionButtonTextSecondary: {
      color: colors.primary,
    },
    dangerZone: {
      marginTop: 16,
      marginBottom: 32,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
    },
    deleteButton: {
      borderColor: "#ef4444",
      borderWidth: 1,
    },
    deleteButtonText: {
      color: "#ef4444",
    },
  });
  return { ...baseStyles, ...extraStyles };
}
