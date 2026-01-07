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
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/common/Avatar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { MiniMap } from "../components/common/MiniMap";
import { PetCard } from "../components/customers/PetCard";
import SwipeableRow from "../components/common/SwipeableRow";
import { deletePet } from "../api/customers";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess, hapticWarning } from "../utils/haptics";
import { useSwipeDeleteIndicator } from "../hooks/useSwipeDeleteIndicator";
import { UndoToast } from "../components/common/UndoToast";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";

type Props = NativeStackScreenProps<any, "CustomerDetail">;
type DeletePetPayload = {
  pet: Pet;
  index: number;
};
const UNDO_TIMEOUT_MS = 4000;

export default function CustomerDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params as { customerId: string };
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const undoBottomOffset = insets.bottom + 16;
  const [undoVisible, setUndoVisible] = useState(false);
  const {
    deletingId: deletingPetId,
    beginDelete,
    clearDeletingId,
  } = useSwipeDeleteIndicator();
  const pendingDeleteRef = useRef<DeletePetPayload | null>(null);

  const { data: customers = [], isLoading: isLoadingCustomer } = useQuery({
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

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("customerDetail.detailsTitle")}
        showBack={true}
        rightElement={
          <TouchableOpacity
            onPress={handleEditCustomer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.editIcon, { color: colors.primary }]}>✏️</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Customer Info Card */}
        <View style={styles.customerCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              name={displayName}
              size="large"
              imageUrl={customer.photo_url}
              onPress={handleAvatarPress}
            />
            {uploadingPhoto && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>

          <Text style={styles.customerName}>{displayName}</Text>

          <View style={styles.infoGrid}>
            {customer.phone && (
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t("common.phone")}</Text>
                  <Text style={styles.infoValue}>{customer.phone}</Text>
                </View>
              </View>
            )}

            {customer.email && (
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{t("common.email")}</Text>
                  <Text style={styles.infoValue}>{customer.email}</Text>
                </View>
              </View>
            )}

            {formatCustomerAddress(customer) && (
              <>
                <View style={styles.infoItem}>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>
                      {t("customerDetail.address")}
                    </Text>
                    <Text style={styles.infoValue}>
                      {formatCustomerAddress(customer, "\n")}
                    </Text>
                  </View>
                </View>
                <MiniMap address={formatCustomerAddress(customer)} />
              </>
            )}

            {customer.nif && (
              <View style={styles.infoItem}>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    {t("customerDetail.nif")}
                  </Text>
                  <Text style={styles.infoValue}>{customer.nif}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Pets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t("customerDetail.petsTitle", { count: pets.length })}
            </Text>
            <Button
              title={t("common.add")}
              onPress={handleAddPet}
              variant="ghost"
              size="small"
              icon="+"
            />
          </View>

          {isLoadingPets ? (
            <View style={styles.petsLoadingContainer}>
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
            <View style={styles.petsList}>
              {pets.map((pet) => (
                <SwipeableRow
                  key={pet.id}
                  isDeleting={pet.id === deletingPetId}
                  onDelete={() => {
                    Alert.alert(
                      t("customerDetail.deletePetTitle"),
                      t("customerDetail.deletePetMessage", { name: pet.name }),
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
                  <PetCard
                    key={pet.id}
                    pet={pet}
                    onPress={() => handlePetPress(pet)}
                  />
                </SwipeableRow>
              ))}
            </View>
          )}
        </View>

        {/* Delete Customer Button */}
        <View style={styles.dangerZone}>
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
      </ScrollView>
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
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    petsLoadingContainer: {
      paddingVertical: 40,
      alignItems: "center",
    },
    editIcon: {
      fontSize: 20,
    },
    customerCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      marginTop: 20,
      marginBottom: 24,
      alignItems: "center",
    },
    avatarContainer: {
      position: "relative",
    },
    avatarLoadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      borderRadius: 999,
      justifyContent: "center",
      alignItems: "center",
    },
    customerName: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginTop: 16,
      marginBottom: 24,
      textAlign: "center",
    },
    infoGrid: {
      width: "100%",
      gap: 16,
    },
    infoItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
    },
    infoIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    infoValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "500",
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    petsList: {
      gap: 12,
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
}
