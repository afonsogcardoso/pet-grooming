import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

type Step = { id: string; label: string };

type Props = {
  steps: Step[];
  activeStep: number;
  stepAccess?: boolean[];
  goToStep: (index: number) => void;
  styles: any;
};

export default function Stepper({
  steps,
  activeStep,
  stepAccess = [],
  goToStep,
  styles,
}: Props) {
  return (
    <>
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const canAccess = stepAccess[index];
        return (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.stepButton,
              isActive && styles.stepButtonActive,
              !canAccess && styles.stepButtonDisabled,
            ]}
            onPress={() => goToStep(index)}
            disabled={!canAccess}
          >
            <View
              style={[
                styles.stepIndexWrap,
                isActive && styles.stepIndexWrapActive,
              ]}
            >
              <Text
                style={[styles.stepIndex, isActive && styles.stepIndexActive]}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              style={[styles.stepLabel, isActive && styles.stepLabelActive]}
            >
              {step.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
}
