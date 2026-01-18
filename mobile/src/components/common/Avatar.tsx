import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import ImageWithDownload from "./ImageWithDownload";

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "small" | "medium" | "large";
  onPress?: () => void;
  onDelete?: () => void;
}

export function Avatar({
  name,
  imageUrl,
  size = "medium",
  onPress,
  onDelete,
}: AvatarProps) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const sizeStyle = styles[`container_${size}`];

  const content = imageUrl ? (
    <ImageWithDownload
      uri={imageUrl}
      style={styles.image}
      onPress={onPress}
      onDelete={onDelete}
    />
  ) : (
    <Text style={[styles.initial, styles[`initial_${size}`]]}>{initial}</Text>
  );

  return <View style={[styles.container, sizeStyle]}>{content}</View>;
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    container_small: {
      width: 32,
      height: 32,
    },
    container_medium: {
      width: 48,
      height: 48,
    },
    container_large: {
      width: 80,
      height: 80,
    },
    image: {
      width: "100%",
      height: "100%",
    },
    initial: {
      color: colors.primary,
      fontWeight: "700",
    },
    initial_small: {
      fontSize: 14,
    },
    initial_medium: {
      fontSize: 20,
    },
    initial_large: {
      fontSize: 32,
    },
  });
}
