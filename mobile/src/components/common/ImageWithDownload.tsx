import React, { useState } from "react";
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActionSheetIOS,
  Alert,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { useTranslation } from "react-i18next";
import saveImageToDevice from "../../utils/saveImage";

type Props = {
  uri?: string | null;
  style?: any;
  placeholder?: React.ReactNode;
  filename?: string;
  onReplace?: () => void;
  onDelete?: () => void;
  onPress?: () => void; // fallback press
  disableDefaultOptions?: boolean;
};

export default function ImageWithDownload({
  uri,
  style,
  placeholder,
  filename,
  onReplace,
  onDelete,
  onPress,
  disableDefaultOptions,
}: Props) {
  const { t } = useTranslation();
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const containerStyle = [styles.container, style];
  const imageStyle = [
    styles.image,
    flattenedStyle.borderRadius
      ? { borderRadius: flattenedStyle.borderRadius }
      : null,
  ];
  const [previewVisible, setPreviewVisible] = useState(false);
  const handleLongPress = () => {
    if (!uri) return;
    setPreviewVisible(true);
  };

  const handleSave = async () => {
    if (!uri) return;
    try {
      await saveImageToDevice(uri, filename);
      Alert.alert(
        t("appointmentDetail.photoSavedTitle"),
        t("appointmentDetail.photoSavedMessage")
      );
    } catch (err: any) {
      if (err?.code === "permission_denied") {
        Alert.alert(
          t("common.error"),
          t("appointmentDetail.photoSavePermission")
        );
        return;
      }
      console.error("save image error", err);
      Alert.alert(t("common.error"), t("appointmentDetail.photoSaveError"));
    }
  };

  const showOptions = () => {
    if (!uri) {
      // no uri: allow replace if provided, otherwise call onPress
      if (onReplace) {
        if (Platform.OS === "ios") {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              options: [t("common.cancel"), t("common.replace")],
              cancelButtonIndex: 0,
            },
            (i) => i === 1 && onReplace()
          );
        } else {
          Alert.alert(undefined, undefined, [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.replace"), onPress: onReplace },
          ]);
        }
        return;
      }
      if (onPress) onPress();
      return;
    }

    const options: Array<string> = [];
    const handlers: Array<() => void> = [];

    options.push(t("appointmentDetail.savePhoto"));
    handlers.push(handleSave);

    if (onReplace) {
      options.push(t("appointmentDetail.replacePhoto"));
      handlers.push(onReplace);
    }
    if (onDelete) {
      options.push(t("common.delete"));
      handlers.push(onDelete);
    }

    options.push(t("common.cancel"));

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: onDelete
            ? options.indexOf(t("common.delete"))
            : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex >= 0 && buttonIndex < handlers.length)
            handlers[buttonIndex]();
        }
      );
      return;
    }

    // Android: simple alert with buttons
    const buttons = [] as any[];
    handlers.forEach((h, idx) => {
      buttons.push({ text: options[idx], onPress: h });
    });
    buttons.push({ text: options[options.length - 1], style: "cancel" });
    Alert.alert(undefined, undefined, buttons);
  };

  const handlePress = () => {
    if (disableDefaultOptions) {
      onPress?.();
      return;
    }
    showOptions();
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
        style={containerStyle}
      >
        {uri ? (
          <Image source={{ uri }} style={imageStyle} />
        ) : (
          placeholder || <Text>?</Text>
        )}
      </TouchableOpacity>
      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setPreviewVisible(false)}
        >
          <Image
            source={{ uri: uri ?? "" }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});
