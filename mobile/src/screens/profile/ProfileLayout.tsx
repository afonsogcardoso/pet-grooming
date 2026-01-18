import React, { useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import createStyles from "../profileStyles";
import { ScreenHeader } from "../../components/ScreenHeader";

type Props = {
  children: React.ReactNode;
  rightElement?: React.ReactNode;
  title: string;
  scrollRef?: any;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function ProfileLayout({
  children,
  rightElement,
  title,
  scrollRef,
  refreshing,
  onRefresh,
}: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScreenHeader title={title} rightElement={rightElement} />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
