import React, { ReactNode } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Text,
  ViewStyle,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBrandingTheme } from "../../theme/useBrandingTheme";

type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxHeight?: number | string;
  contentStyle?: ViewStyle;
};

export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  maxHeight = "90%",
  contentStyle,
}: BottomSheetModalProps) {
  const { colors } = useBrandingTheme();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 16,
      width: "100%",
      alignSelf: "center",
    },
    handle: {
      width: 48,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceBorder,
      alignSelf: "center",
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <View style={[styles.sheet, contentStyle]}>
            <View style={styles.handle} />
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
