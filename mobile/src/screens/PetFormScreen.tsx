import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
  ActionSheetIOS,
  PermissionsAndroid,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import {
  createPet,
  updatePet,
  uploadPetPhoto,
  deletePet,
  type Pet,
} from "../api/customers";
import { ScreenHeader } from "../components/ScreenHeader";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess, hapticWarning } from "../utils/haptics";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";

type Props = NativeStackScreenProps<any, "PetForm">;

export default function PetFormScreen({ navigation, route }: Props) {
  const params = route.params as {
    mode: "create" | "edit";
    customerId: string;
    petId?: string;
    pet?: Pet;
  };
  const { mode, customerId, petId, pet } = params;

  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [name, setName] = useState(pet?.name || "");
  const [breed, setBreed] = useState(pet?.breed || "");
  const [weight, setWeight] = useState(pet?.weight?.toString() || "");
  const [photoUri, setPhotoUri] = useState<string | null>(
    pet?.photo_url || null
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      breed?: string | null;
      weight?: number | null;
    }) => createPet(customerId, data),
    onSuccess: async (createdPet) => {
      // Se há uma foto selecionada, faz upload após criar o pet
      if (photoUri && !photoUri.startsWith("http")) {
        try {
          setUploadingPhoto(true);
          await uploadPetPhotoMutation.mutateAsync({
            petId: createdPet.id,
            uri: photoUri,
          });
        } catch (error) {
          hapticError();
          console.error("Erro ao fazer upload da foto:", error);
        } finally {
          setUploadingPhoto(false);
        }
      }

      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-pets", customerId],
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      hapticError();
      Alert.alert(
        t("common.error"),
        error?.response?.data?.message || t("petForm.createError")
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      name: string;
      breed?: string | null;
      weight?: number | null;
    }) => updatePet(customerId, petId!, data),
    onSuccess: async () => {
      // Se há uma foto nova selecionada, faz upload
      if (photoUri && !photoUri.startsWith("http")) {
        try {
          setUploadingPhoto(true);
          await uploadPetPhotoMutation.mutateAsync({
            petId: petId!,
            uri: photoUri,
          });
        } catch (error) {
          hapticError();
          console.error("Erro ao fazer upload da foto:", error);
        } finally {
          setUploadingPhoto(false);
        }
      }

      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-pets", customerId],
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      hapticError();
      Alert.alert(
        t("common.error"),
        error?.response?.data?.message || t("petForm.updateError")
      );
    },
  });

  const uploadPetPhotoMutation = useMutation({
    mutationFn: async ({ petId, uri }: { petId: string; uri: string }) => {
      const timestamp = Date.now();
      const extension = uri.split(".").pop() || "jpg";
      const filename = `pet-${petId}-${timestamp}.${extension}`;
      const fileType = `image/${extension === "jpg" ? "jpeg" : extension}`;

      return uploadPetPhoto(petId, {
        uri,
        name: filename,
        type: fileType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-pets", customerId],
      });
    },
    onError: () => {
      hapticError();
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

  const uploadPhoto = async (uri: string) => {
    // Se estamos editando, faz upload imediatamente
    if (mode === "edit" && petId) {
      try {
        setUploadingPhoto(true);
        await uploadPetPhotoMutation.mutateAsync({ petId, uri });
      } catch (error) {
        hapticError();
        Alert.alert(t("common.error"), t("petForm.photoUploadError"));
      } finally {
        setUploadingPhoto(false);
      }
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
        setPhotoUri(response.assets[0].uri!);
        await uploadPhoto(response.assets[0].uri!);
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
        setPhotoUri(response.assets[0].uri!);
        await uploadPhoto(response.assets[0].uri!);
      }
    });
  };

  const selectImage = () => {
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
    mutationFn: () => deletePet(petId!),
    onSuccess: () => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-pets", customerId],
      });
      navigation.goBack();
    },
    onError: (error: any) => {
      hapticError();
      const message =
        error?.response?.data?.error ||
        error.message ||
        t("petForm.deleteError");
      Alert.alert(t("common.error"), message);
    },
  });

  const handleDeletePet = () => {
    Alert.alert(
      t("petForm.deleteTitle"),
      t("petForm.deleteMessage", { name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("petForm.deleteAction"),
          style: "destructive",
          onPress: () => {
            hapticWarning();
            deleteMutation.mutate();
          },
        },
      ]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t("petForm.validationNameRequired");
    }

    if (weight && isNaN(Number(weight))) {
      newErrors.weight = t("petForm.validationWeightInvalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const petData = {
      name: name.trim(),
      breed: breed.trim() || null,
      weight: weight ? Number(weight) : null,
    };

    if (mode === "create") {
      createMutation.mutate(petData);
    } else {
      updateMutation.mutate(petData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={
          mode === "create" ? t("petForm.createTitle") : t("petForm.editTitle")
        }
        showBack={true}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Photo Picker */}
            <View style={styles.photoSection}>
              <Text style={styles.photoLabel}>{t("petForm.photoLabel")}</Text>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={selectImage}
                activeOpacity={0.7}
                disabled={uploadingPhoto}
              >
                {photoUri ? (
                  <>
                    <Image source={{ uri: photoUri }} style={styles.photo} />
                    {uploadingPhoto && (
                      <View style={styles.photoOverlay}>
                        <ActivityIndicator color="#fff" size="large" />
                        <Text style={styles.photoOverlayText}>
                          {t("common.loading")}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    {uploadingPhoto ? (
                      <ActivityIndicator color={colors.primary} size="large" />
                    ) : (
                      <Text style={styles.photoPlaceholderText}>
                        {t("petForm.addPhoto")}
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <Input
                label={t("petForm.nameLabel")}
                placeholder={t("petForm.namePlaceholder")}
                value={name}
                onChangeText={setName}
                error={errors.name}
              />

              <Input
                label={t("petForm.breedLabel")}
                placeholder={t("petForm.breedPlaceholder")}
                value={breed}
                onChangeText={setBreed}
                error={errors.breed}
              />

              <Input
                label={t("petForm.weightLabel")}
                placeholder={t("petForm.weightPlaceholder")}
                value={weight}
                onChangeText={setWeight}
                error={errors.weight}
                keyboardType="decimal-pad"
              />

              <View style={styles.hint}>
                <Text style={styles.hintText}>{t("petForm.requiredHint")}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={
              mode === "create"
                ? t("petForm.createAction")
                : t("petForm.saveAction")
            }
            onPress={handleSubmit}
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={isLoading}
          />

          {mode === "edit" && (
            <Button
              title={t("petForm.deleteAction")}
              onPress={handleDeletePet}
              variant="ghost"
              size="large"
              loading={deleteMutation.isPending}
              disabled={deleteMutation.isPending}
              style={styles.deleteButton}
              textStyle={styles.deleteButtonText}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    form: {
      paddingTop: 20,
      paddingBottom: 100,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 4,
    },
    photoSection: {
      marginBottom: 24,
      alignItems: "center",
    },
    photoLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
      alignSelf: "flex-start",
    },
    photoContainer: {
      width: 140,
      height: 140,
      borderRadius: 70,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: colors.surfaceBorder,
      borderStyle: "dashed",
    },
    photo: {
      width: "100%",
      height: "100%",
    },
    photoPlaceholder: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    photoPlaceholderIcon: {
      fontSize: 36,
      marginBottom: 8,
    },
    photoPlaceholderText: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "500",
    },
    photoOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      alignItems: "center",
      justifyContent: "center",
    },
    photoOverlayText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "600",
    },
    hint: {
      marginTop: 8,
    },
    hintText: {
      fontSize: 13,
      color: colors.muted,
      fontStyle: "italic",
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceBorder,
      gap: 12,
    },
    deleteButton: {
      borderColor: "#ef4444",
      borderWidth: 1,
      marginTop: 8,
    },
    deleteButtonText: {
      color: "#ef4444",
    },
  });
}
