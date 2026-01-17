import { useCallback, useState } from "react";

type Step = { id: string; label: string };

export function useAppointmentForm(initial?: any) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const steps: Step[] = [
    { id: "date", label: "Date & Time" },
    { id: "customer", label: "Customer & Pet" },
    { id: "services", label: "Pets & Services" },
    { id: "summary", label: "Summary" },
  ];

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    setActiveStep(index);
  }, []);

  const canSubmit = true; // placeholder, wire real validation here

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // TODO: implement submit logic (API calls, validation, navigation)
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    activeStep,
    steps,
    goToStep,
    canSubmit,
    isSubmitting,
    handleSubmit,
  } as const;
}

export type UseAppointmentForm = ReturnType<typeof useAppointmentForm>;
