import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  PermissionsAndroid,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBrandingTheme } from "../theme/useBrandingTheme";
import {
  createCustomer,
  updateCustomer,
  uploadCustomerPhoto,
  deleteCustomerPhoto,
  type Customer,
} from "../api/customers";
import { ScreenHeader } from "../components/ScreenHeader";
import { Input } from "../components/common/Input";
import { PhoneInput } from "../components/common/PhoneInput";
import { Button } from "../components/common/Button";
import { Avatar } from "../components/common/Avatar";
import { AddressAutocomplete } from "../components/appointment/AddressAutocomplete";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { useTranslation } from "react-i18next";
import { buildPhone, splitPhone } from "../utils/phone";
import { formatCustomerName } from "../utils/customer";
import { hapticError, hapticSuccess } from "../utils/haptics";
import { cameraOptions, galleryOptions } from "../utils/imageOptions";
import { compressImage } from "../utils/imageCompression";

type Props = NativeStackScreenProps<any, "CustomerForm">;

export default function CustomerFormScreen({ navigation, route }: Props) {
  const params = route.params as {
    mode: "create" | "edit";
    customerId?: string;
    customer?: Customer;
  };
  const { mode, customerId, customer } = params;

  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const initialFirstName = customer?.firstName || "";
  const initialLastName = customer?.lastName || "";
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const initialPhone =
    customer?.phone ||
    buildPhone(
      customer?.phoneCountryCode || null,
      customer?.phoneNumber || null
    );
  const [phone, setPhone] = useState(initialPhone || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [address2, setAddress2] = useState(customer?.address2 || "");
  const [nif, setNif] = useState(customer?.nif || "");
  const [photoUrl, setPhotoUrl] = useState(customer?.photo_url || "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      navigation.goBack();
    },
    onError: (error: any) => {
      hapticError();
      Alert.alert(
        t("common.error"),
        error?.response?.data?.message || t("customerForm.createError")
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      address?: string | null;
      address2?: string | null;
      nif?: string | null;
    }) => updateCustomer(customerId!, data),
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
      Alert.alert(
        t("common.error"),
        error?.response?.data?.message || t("customerForm.updateError")
      );
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = t("customerForm.validationNameRequired");
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t("customerForm.validationEmailInvalid");
    }

    const phoneDigits = splitPhone(phone).phoneNumber;
    if (!phoneDigits || phoneDigits.length < 6) {
      newErrors.phone = t("customerForm.validationPhoneInvalid");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      hapticError();
      return;
    }

    if (mode === "create") {
      createMutation.mutate({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        address2: address2.trim() || null,
        nif: nif.trim() || null,
      });
    } else {
      updateMutation.mutate({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        address2: address2.trim() || null,
        nif: nif.trim() || null,
      });
    }
  };

  const requestAndroidPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const cameraGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        const storageGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        return (
          cameraGranted === PermissionsAndroid.RESULTS.GRANTED &&
          storageGranted === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const uploadPhoto = async (uri: string, fileName?: string | null) => {
    if (mode === "create" || !customerId) {
      Alert.alert(t("common.warning"), t("customerForm.saveFirstWarning"));
      return;
    }

    try {
      setUploadingPhoto(true);
      const compressedUri = await compressImage(uri);
      const timestamp = Date.now();
      const filename = `customer-${customerId}-${timestamp}.jpg`;
      const fileType = "image/jpeg";

      const result = await uploadCustomerPhoto(customerId, {
        uri: compressedUri,
        name: filename,
        type: fileType,
      });
      setPhotoUrl(result.url);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-pets", customerId],
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      Alert.alert(t("common.error"), t("customerForm.photoUploadError"));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (mode === "create" || !customerId) {
      Alert.alert(t("common.warning"), t("customerForm.saveFirstWarning"));
      return;
    }
    try {
      setUploadingPhoto(true);
      // attempt to nullify photo via updateCustomer; API may accept photo_url null
      // call server endpoint to remove storage objects and clear DB field
      await deleteCustomerPhoto(customerId!);
      setPhotoUrl("");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-pets", customerId],
      });
      hapticSuccess();
    } catch (err) {
      console.error("Erro ao apagar avatar:", err);
      Alert.alert(t("common.error"), t("customerForm.photoUploadError"));
      hapticError();
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
      if (response.didCancel) return;
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
      if (response.didCancel) return;
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
    if (mode === "create") {
      Alert.alert(t("common.warning"), t("customerForm.saveFirstWarning"));
      return;
    }

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

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const displayName =
    formatCustomerName({
      firstName,
      lastName,
    }) || t("customerForm.customerFallback");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={
          mode === "create"
            ? t("customerForm.createTitle")
            : t("customerForm.editTitle")
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
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Avatar
                  name={displayName}
                  imageUrl={photoUrl}
                  size="large"
                  onPress={mode === "edit" ? handleAvatarPress : undefined}
                  // allow deletion via avatar component
                  // Avatar -> ImageWithDownload will forward onDelete to show delete option
                  // pass handler only when editing
                  {...(mode === "edit" ? { onDelete: handleDeleteAvatar } : {})}
                />
                {uploadingPhoto && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator color={colors.onPrimary} size="large" />
                  </View>
                )}
              </View>
              {mode === "edit" && (
                <Text style={styles.avatarHint}>
                  {t("customerForm.avatarHint")}
                </Text>
              )}
            </View>

            <View style={styles.formCard}>
              <View style={styles.row}>
                <View style={[styles.column, { flex: 1 }]}>
                  <Input
                    label={t("customerForm.firstNameLabel")}
                    placeholder={t("customerForm.firstNamePlaceholder")}
                    value={firstName}
                    onChangeText={setFirstName}
                    error={errors.firstName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.column, { flex: 1 }]}>
                  <Input
                    label={t("customerForm.lastNameLabel")}
                    placeholder={t("customerForm.lastNamePlaceholder")}
                    value={lastName}
                    onChangeText={setLastName}
                    error={errors.lastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <PhoneInput
                label={t("common.phone")}
                placeholder={t("customerForm.phonePlaceholder")}
                value={phone}
                onChange={setPhone}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
              {errors.phone ? (
                <Text style={styles.errorText}>{errors.phone}</Text>
              ) : null}

              <Input
                label={t("common.email")}
                placeholder={t("customerForm.emailPlaceholder")}
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                showEmailSuggestions
              />

              <Input
                label={t("customerDetail.nif")}
                placeholder={t("customerForm.nifPlaceholder")}
                value={nif}
                onChangeText={setNif}
                error={errors.nif}
                keyboardType="number-pad"
              />

              <View style={styles.addressField}>
                <Text style={styles.inputLabel}>
                  {t("customerDetail.address")}
                </Text>
                <AddressAutocomplete
                  value={address}
                  onSelect={setAddress}
                  placeholder={t("customerForm.addressPlaceholder")}
                />
                {errors.address ? (
                  <Text style={styles.errorText}>{errors.address}</Text>
                ) : null}
              </View>

              <Input
                label={t("customerDetail.address2")}
                placeholder={t("customerForm.address2Placeholder")}
                value={address2}
                onChangeText={setAddress2}
                error={errors.address2}
                autoCapitalize="words"
              />

              {mode === "create" && (
                <View style={styles.hint}>
                  <Text style={styles.hintText}>
                    {t("customerForm.requiredHint")}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={
              mode === "create"
                ? t("customerForm.createAction")
                : t("customerForm.saveAction")
            }
            onPress={handleSubmit}
            variant="primary"
            size="large"
            loading={isLoading}
            disabled={isLoading}
          />
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
    row: {
      flexDirection: "row",
      gap: 12,
    },
    column: {
      flex: 1,
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
    avatarSection: {
      alignItems: "center",
      marginBottom: 24,
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
      alignItems: "center",
      justifyContent: "center",
    },
    avatarHint: {
      marginTop: 8,
      fontSize: 13,
      color: colors.muted,
      fontStyle: "italic",
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    addressField: {
      marginBottom: 16,
    },
    hint: {
      marginTop: 8,
    },
    hintText: {
      fontSize: 13,
      color: colors.muted,
      fontStyle: "italic",
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      marginTop: 6,
      marginBottom: 4,
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
    },
  });
}
