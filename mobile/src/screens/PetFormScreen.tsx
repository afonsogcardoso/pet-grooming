import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActionSheetIOS,
  PermissionsAndroid,
  ActivityIndicator,
} from "react-native";
import ImageWithDownload from "../components/common/ImageWithDownload";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import {
  createPet,
  updatePet,
  uploadPetPhoto,
  deletePet,
  type Pet,
} from "../api/customers";
import { deleteCustomerPetPhoto } from "../api/customers";
import { ScreenHeader } from "../components/ScreenHeader";
import { AutocompleteSelect, Input } from "../components/common";
import { Button } from "../components/common/Button";
import { useTranslation } from "react-i18next";
import { hapticError, hapticSuccess, hapticWarning } from "../utils/haptics";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";
import { compressImage } from "../utils/imageCompression";
import { getPetBreeds, getPetSpecies } from "../api/petAttributes";

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
  const [breedId, setBreedId] = useState<string | null>(pet?.breed_id || null);
  const [speciesId, setSpeciesId] = useState<string | null>(
    pet?.species_id || null
  );
  const [speciesLabel, setSpeciesLabel] = useState<string>("");
  const [weight, setWeight] = useState(pet?.weight?.toString() || "");
  const [photoUri, setPhotoUri] = useState<string | null>(
    pet?.photo_url || null
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: speciesOptions = [], isLoading: isLoadingSpecies } = useQuery({
    queryKey: ["pet-species"],
    queryFn: getPetSpecies,
  });

  const { data: breedOptions = [], isLoading: isLoadingBreeds } = useQuery({
    queryKey: ["pet-breeds", speciesId],
    queryFn: () => getPetBreeds({ speciesId }),
    enabled: Boolean(speciesId),
  });

  useEffect(() => {
    if (speciesId || speciesLabel) return;
    const dog = speciesOptions.find((item) => {
      const n = item.name.trim().toLowerCase();
      return n === "cão" || n === "cao" || n.includes("dog");
    });
    if (dog) {
      setSpeciesId(dog.id);
      setSpeciesLabel(dog.name);
    }
  }, [speciesId, speciesLabel, speciesOptions]);

  useEffect(() => {
    if (!speciesId || speciesLabel) return;
    const match = speciesOptions.find((item) => item.id === speciesId);
    if (match) {
      setSpeciesLabel(match.name);
    }
  }, [speciesId, speciesLabel, speciesOptions]);

  useEffect(() => {
    if (!breedId || breed) return;
    const match = breedOptions.find((item) => item.id === breedId);
    if (match) {
      setBreed(match.name);
    }
  }, [breed, breedId, breedOptions]);

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      breed?: string | null;
      weight?: number | null;
    }) => createPet(customerId, data),
    onSuccess: async (createdPet) => {
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
    onSuccess: async (updatedPet) => {
      queryClient.setQueryData<Pet[] | undefined>(
        ["customer-pets", customerId],
        (old) =>
          old?.map((item) =>
            item.id === updatedPet.id ? { ...item, ...updatedPet } : item
          ) || old
      );

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({
          queryKey: ["customer-pets", customerId],
        }),
      ]);
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
      const compressedUri = await compressImage(uri);
      const timestamp = Date.now();
      const filename = `pet-${petId}-${timestamp}.jpg`;
      const fileType = "image/jpeg";

      return uploadPetPhoto(petId, {
        uri: compressedUri,
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
    mutationFn: () => deletePet(customerId, petId!),
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

    if (!speciesId) {
      newErrors.species = t("petForm.validationSpeciesRequired");
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
      speciesId,
      breedId: breedId || null,
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
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {/* Photo Picker */}
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={selectImage}
                activeOpacity={0.7}
                disabled={uploadingPhoto}
              >
                {photoUri ? (
                  <>
                    <ImageWithDownload
                      uri={photoUri}
                      style={styles.photo}
                      onReplace={uploadingPhoto ? undefined : selectImage}
                      onDelete={async () => {
                        if (mode !== "edit" || !petId) {
                          Alert.alert(
                            t("common.warning"),
                            t("petForm.saveFirstWarning")
                          );
                          return;
                        }
                        try {
                          setUploadingPhoto(true);
                          await deleteCustomerPetPhoto(petId);
                          setPhotoUri(null);
                          queryClient.invalidateQueries({
                            queryKey: ["customers"],
                          });
                          queryClient.invalidateQueries({
                            queryKey: ["customer-pets", customerId],
                          });
                          hapticSuccess();
                        } catch (err) {
                          console.error("Error deleting pet photo:", err);
                          Alert.alert(
                            t("common.error"),
                            t("petForm.photoDeleteError")
                          );
                          hapticError();
                        } finally {
                          setUploadingPhoto(false);
                        }
                      }}
                    />
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

              <AutocompleteSelect
                label={t("petForm.speciesLabel")}
                placeholder={t("petForm.speciesPlaceholder")}
                value={speciesLabel}
                onChangeText={(value) => {
                  setSpeciesLabel(value);
                  setSpeciesId(null);
                  setBreed("");
                  setBreedId(null);
                }}
                onSelectOption={(option) => {
                  if (!option) {
                    setSpeciesId(null);
                    setSpeciesLabel("");
                    setBreed("");
                    setBreedId(null);
                    return;
                  }
                  setSpeciesId(option.id);
                  setSpeciesLabel(option.label);
                  setBreed("");
                  setBreedId(null);
                }}
                options={speciesOptions.map((item) => ({
                  id: item.id,
                  label: item.name,
                }))}
                selectedId={speciesId || undefined}
                loading={isLoadingSpecies}
                emptyLabel={t("petForm.speciesEmpty")}
                loadingLabel={t("common.loading")}
                error={errors.species}
              />

              <AutocompleteSelect
                label={t("petForm.breedLabel")}
                placeholder={
                  speciesId
                    ? t("petForm.breedPlaceholder")
                    : t("petForm.breedSelectSpecies")
                }
                value={breed}
                onChangeText={(value) => {
                  setBreed(value);
                  setBreedId(null);
                }}
                onSelectOption={(option) => {
                  if (!option) {
                    setBreedId(null);
                    return;
                  }
                  setBreed(option.label);
                  setBreedId(option.id);
                }}
                options={breedOptions.map((item) => ({
                  id: item.id,
                  label: item.name,
                }))}
                selectedId={breedId || undefined}
                loading={isLoadingBreeds}
                loadingLabel={t("common.loading")}
                disabled={!speciesId}
                emptyLabel={
                  speciesId
                    ? t("petForm.breedEmptyForSpecies")
                    : t("petForm.breedSelectSpecies")
                }
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

            <View style={styles.actions}>
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
          </View>
        </ScrollView>
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
      borderWidth: 0,
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
      backgroundColor: colors.surface,
      position: "relative",
    },
    photo: {
      ...StyleSheet.absoluteFillObject,
    },
    photoPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 70,
      backgroundColor: colors.primarySoft,
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
    actions: {
      marginTop: 16,
      paddingHorizontal: 0,
      paddingBottom: 28,
      gap: 12,
    },
    deleteButton: {
      marginTop: 8,
      backgroundColor: "transparent",
      borderWidth: 0,
    },
    deleteButtonText: {
      color: "#ef4444",
    },
  });
}
