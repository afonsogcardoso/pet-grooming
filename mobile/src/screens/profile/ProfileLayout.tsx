import React, { useMemo } from "react";
import { SafeAreaView } from "react-native";
import { ScrollView } from "react-native";
import { useBrandingTheme } from "../../theme/useBrandingTheme";
import createStyles from "../profileStyles";
import { ScreenHeader } from "../../components/ScreenHeader";

type Props = {
  children: React.ReactNode;
  rightElement?: React.ReactNode;
  title: string;
  scrollRef?: any;
};

export default function ProfileLayout({
  children,
  rightElement,
  title,
  scrollRef,
}: Props) {
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title={title} rightElement={rightElement} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
