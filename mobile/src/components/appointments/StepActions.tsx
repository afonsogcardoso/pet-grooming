import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";

type Props = {
  activeStep: number;
  stepsLength: number;
  canSubmit: boolean;
  isSubmitting: boolean;
  canGoNext: boolean;
  goToStep: (index: number) => void;
  handleSubmit: () => void;
  isEditMode: boolean;
  styles: any;
  t: (key: string) => string;
  colors: any;
};

export default function StepActions({
  activeStep,
  stepsLength,
  canSubmit,
  isSubmitting,
  canGoNext,
  goToStep,
  handleSubmit,
  isEditMode,
  styles,
  t,
  colors,
}: Props) {
  return (
    <View style={styles.stepActions}>
      {activeStep > 0 ? (
        <TouchableOpacity
          style={styles.stepSecondary}
          onPress={() => goToStep(activeStep - 1)}
          accessibilityLabel={t("appointmentForm.previousStep")}
        >
          <Text style={styles.stepSecondaryText}>
            {t("appointmentForm.previousStep")}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {activeStep === stepsLength - 1 ? (
        <TouchableOpacity
          style={[
            styles.stepPrimary,
            (!canSubmit || isSubmitting) && styles.stepPrimaryDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          accessibilityLabel={
            isEditMode
              ? t("appointmentForm.saveAction")
              : t("appointmentForm.createAction")
          }
        >
          {isSubmitting ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <ActivityIndicator color={colors.onPrimary} size="small" />
              <Text style={styles.stepPrimaryText}>
                {t("appointmentForm.processing")}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.stepPrimaryText,
                (!canSubmit || isSubmitting) && styles.stepPrimaryTextDisabled,
              ]}
            >
              {isEditMode
                ? t("appointmentForm.saveAction")
                : t("appointmentForm.createAction")}
            </Text>
          )}
        </TouchableOpacity>
      ) : activeStep < stepsLength - 1 ? (
        <TouchableOpacity
          style={[styles.stepPrimary, !canGoNext && styles.stepPrimaryDisabled]}
          onPress={() => goToStep(activeStep + 1)}
          disabled={!canGoNext}
          accessibilityLabel={t("appointmentForm.nextStep")}
        >
          <Text
            style={[
              styles.stepPrimaryText,
              !canGoNext && styles.stepPrimaryTextDisabled,
            ]}
          >
            {t("appointmentForm.nextStep")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
