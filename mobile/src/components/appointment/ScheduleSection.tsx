import { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import Switch from "../StyledSwitch";
import { getCardVariants } from "../../theme/uiTokens";
import type { RecurrenceFrequency } from "../../utils/appointments";
import type { useBrandingTheme } from "../../theme/useBrandingTheme";

type Colors = ReturnType<typeof useBrandingTheme>["colors"];

type Props = {
  date: string;
  displayTime: string;
  recurrenceEnabled: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceEndMode: "after" | "on";
  recurrenceCount: string;
  recurrenceUntil: string;
  onPressDate: () => void;
  onPressTime: () => void;
  onToggleRecurrence: (value: boolean) => void;
  onChangeFrequency: (value: RecurrenceFrequency) => void;
  onChangeEndMode: (value: "after" | "on") => void;
  onChangeCount: (value: string) => void;
  onChangeUntil: (value: string) => void;
  colors: Colors;
  t: (key: string, options?: any) => string;
};

export function ScheduleSection({
  date,
  displayTime,
  recurrenceEnabled,
  recurrenceFrequency,
  recurrenceEndMode,
  recurrenceCount,
  recurrenceUntil,
  onPressDate,
  onPressTime,
  onToggleRecurrence,
  onChangeFrequency,
  onChangeEndMode,
  onChangeCount,
  onChangeUntil,
  colors,
  t,
}: Props) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const primary = colors.primary;

  const recurrenceOptions: { id: RecurrenceFrequency; label: string }[] = [
    { id: "weekly", label: t("appointmentForm.recurrenceWeekly") },
    { id: "biweekly", label: t("appointmentForm.recurrenceBiweekly") },
    { id: "monthly", label: t("appointmentForm.recurrenceMonthly") },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {t("appointmentForm.dateServiceSection")}
      </Text>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>{t("appointmentForm.dateLabel")}</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickInput]}
            onPress={onPressDate}
          >
            <Text style={styles.pickText}>{date}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>{t("appointmentForm.timeLabel")}</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickInput]}
            onPress={onPressTime}
          >
            <Text style={[styles.pickText, !displayTime && styles.placeholder]}>
              {displayTime || t("appointmentForm.timePlaceholder")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.recurrenceContainer}>
        <View style={styles.recurrenceHeader}>
          <Text style={styles.label}>
            {t("appointmentForm.recurrenceTitle")}
          </Text>
          <Switch
            value={recurrenceEnabled}
            onValueChange={onToggleRecurrence}
            trackColor={{ false: colors.surfaceBorder, true: primary }}
            thumbColor={colors.onPrimary}
          />
        </View>

        {recurrenceEnabled ? (
          <>
            <Text style={styles.helperText}>
              {t("appointmentForm.recurrenceHint")}
            </Text>

            <Text style={styles.label}>
              {t("appointmentForm.recurrenceFrequencyLabel")}
            </Text>
            <View style={styles.recurrenceOptions}>
              {recurrenceOptions.map((option) => {
                const isActive = recurrenceFrequency === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => onChangeFrequency(option.id)}
                    style={[
                      styles.recurrenceChip,
                      isActive && styles.recurrenceChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.recurrenceChipText,
                        isActive && styles.recurrenceChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>
              {t("appointmentForm.recurrenceEndsLabel")}
            </Text>
            <View style={styles.recurrenceOptions}>
              {(
                [
                  {
                    id: "after",
                    label: t("appointmentForm.recurrenceEndsAfter"),
                  },
                  { id: "on", label: t("appointmentForm.recurrenceEndsOn") },
                ] as const
              ).map((option) => {
                const isActive = recurrenceEndMode === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => onChangeEndMode(option.id)}
                    style={[
                      styles.recurrenceChip,
                      isActive && styles.recurrenceChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.recurrenceChipText,
                        isActive && styles.recurrenceChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {recurrenceEndMode === "after" ? (
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("appointmentForm.recurrenceCountLabel")}
                </Text>
                <TextInput
                  value={recurrenceCount}
                  onChangeText={onChangeCount}
                  keyboardType="number-pad"
                  placeholder={t("appointmentForm.recurrenceCountPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
            ) : (
              <View style={styles.field}>
                <Text style={styles.label}>
                  {t("appointmentForm.recurrenceUntilLabel")}
                </Text>
                <TextInput
                  value={recurrenceUntil}
                  onChangeText={onChangeUntil}
                  placeholder={t("appointmentForm.recurrenceUntilPlaceholder")}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: Colors) {
  const { listItem } = getCardVariants(colors);
  return StyleSheet.create({
    section: {
      ...listItem,
      marginBottom: 16,
      padding: 16,
    },
    recurrenceContainer: {
      // keep layout inline with parent section: transparent background and consistent spacing
      paddingTop: 8,
      paddingBottom: 8,
      marginBottom: 8,
      backgroundColor: "transparent",
      borderWidth: 0,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 14,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    field: {
      marginTop: 8,
      marginBottom: 8,
    },
    label: {
      color: colors.text,
      marginBottom: 8,
      fontWeight: "600",
      fontSize: 15,
    },
    input: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.text,
      backgroundColor: colors.background,
      borderColor: colors.surfaceBorder,
      fontSize: 15,
      fontWeight: "500",
    },
    pickInput: {
      justifyContent: "center",
      height: 52,
    },
    pickText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    placeholder: {
      color: colors.muted,
    },
    recurrenceHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    recurrenceOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 8,
    },
    recurrenceChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    recurrenceChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    recurrenceChipText: {
      color: colors.text,
      fontWeight: "600",
    },
    recurrenceChipTextActive: {
      color: colors.primary,
    },
    helperText: {
      color: colors.muted,
      marginBottom: 8,
    },
  });
}
