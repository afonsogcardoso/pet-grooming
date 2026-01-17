import { Alert } from "react-native";

export async function submitAppointment(ctx: any) {
  const {
    mode,
    newCustomerFirstName,
    newCustomerLastName,
    newCustomerPhone,
    newCustomerEmail,
    newCustomerAddress,
    newCustomerAddress2,
    newCustomerNif,
    selectedCustomer,
    selectedCustomerData,
    newPets,
    existingNewPets,
    selectedPetIds,
    serviceRowsByPet,
    amountValue,
    totalDuration,
    duration,
    useDefaultReminders,
    effectiveReminderOffsets,
    recurrenceEnabled,
    recurrenceRule,
    recurrenceCountNumber,
    recurrenceUntilValue,
    recurrenceTimezoneValue,
    isEditMode,
    editAppointmentId,
    editScope,
    sendWhatsapp,
    canSendWhatsapp,
    buildConfirmationUrl,
    openWhatsapp,
    navigation,
    queryClient,
    t,
    mutation,
    createCustomer,
    updateCustomer,
    createPet,
    parseAmountInput,
    formatHHMM,
    services,
    petOptions,
    hapticError,
  } = ctx;

  let customerId = selectedCustomer;
  let createdCustomer: any = null;

  if (mode === "new") {
    try {
      const trimmedFirstName = newCustomerFirstName.trim();
      const trimmedLastName = newCustomerLastName.trim();
      createdCustomer = await createCustomer({
        firstName: trimmedFirstName,
        lastName: trimmedLastName || undefined,
        phone: newCustomerPhone.trim() || null,
        email: newCustomerEmail.trim() || null,
        address: newCustomerAddress.trim() || null,
        address2: newCustomerAddress2.trim() || null,
        nif: newCustomerNif.trim() || null,
      });
      customerId = createdCustomer.id;
    } catch (err: any) {
      hapticError();
      const message = err?.response?.data?.error || err.message || t("appointmentForm.createCustomerPetError");
      Alert.alert(t("common.error"), message);
      return;
    }
  } else if (selectedCustomerData) {
    const hasChanges =
      ctx.customerPhone?.trim() !== (selectedCustomerData.phone || "") ||
      ctx.customerAddress?.trim() !== (selectedCustomerData.address || "") ||
      ctx.customerAddress2?.trim() !== (selectedCustomerData.address2 || "") ||
      ctx.customerNif?.trim() !== (selectedCustomerData.nif || "");
    if (hasChanges) {
      try {
        const updated = await updateCustomer(selectedCustomerData.id, {
          phone: ctx.customerPhone?.trim() || null,
          address: ctx.customerAddress?.trim() || "",
          address2: ctx.customerAddress2?.trim() || "",
          nif: ctx.customerNif?.trim() || null,
        });
        queryClient.setQueryData(["customers"], (prev: any[] | undefined) => {
          if (!prev) return prev;
          return prev.map((c) => (c.id === selectedCustomerData.id ? { ...c, ...(updated || {}) } : c));
        });
      } catch (err: any) {
        hapticError();
        const message = err?.response?.data?.error || err.message || t("appointmentForm.updateCustomerError");
        Alert.alert(t("common.error"), message);
        return;
      }
    }
  }

  const petIdMap = new Map<string, string>();
  let primaryPetId = "";

  if (mode === "new") {
    try {
      const createdPets: any[] = [];
      for (const pet of newPets) {
        const weightValue = parseAmountInput(pet.weight);
        const createdPet = await createPet(customerId, {
          name: pet.name.trim(),
          breed: pet.breed.trim() || null,
          speciesId: pet.speciesId || null,
          breedId: pet.breedId || null,
          weight: weightValue ?? null,
        });
        petIdMap.set(pet.id, createdPet.id);
        createdPets.push(createdPet);
      }
      if (createdPets[0]?.id) {
        primaryPetId = createdPets[0].id;
      }

      if (createdCustomer) {
        queryClient.setQueryData(["customers"], (prev: any[] | undefined) => {
          const next = prev ? [...prev] : [];
          next.push({ ...createdCustomer, pets: createdPets });
          return next;
        });
      }
    } catch (err: any) {
      hapticError();
      const message = err?.response?.data?.error || err.message || t("appointmentForm.createCustomerPetError");
      Alert.alert(t("common.error"), message);
      return;
    }
  } else {
    if (existingNewPets.length > 0) {
      try {
        const createdPets: any[] = [];
        for (const pet of existingNewPets) {
          const weightValue = parseAmountInput(pet.weight);
          const createdPet = await createPet(customerId, {
            name: pet.name.trim(),
            breed: pet.breed.trim() || null,
            speciesId: pet.speciesId || null,
            breedId: pet.breedId || null,
            weight: weightValue ?? null,
          });
          petIdMap.set(pet.id, createdPet.id);
          createdPets.push(createdPet);
        }
        if (createdPets.length > 0) {
          queryClient.setQueryData(["customers"], (prev: any[] | undefined) => {
            if (!prev) return prev;
            return prev.map((customer) => {
              if (customer.id !== customerId) return customer;
              const currentPets = customer.pets || [];
              const nextPets = [...currentPets, ...createdPets];
              const nextCount = typeof customer.pet_count === "number" ? customer.pet_count + createdPets.length : nextPets.length;
              return { ...customer, pets: nextPets, pet_count: nextCount };
            });
          });
        }
      } catch (err: any) {
        hapticError();
        const message = err?.response?.data?.error || err.message || t("appointmentForm.createCustomerPetError");
        Alert.alert(t("common.error"), message);
        return;
      }
    }
    primaryPetId = selectedPetIds[0] || petIdMap.get(existingNewPets[0]?.id) || "";
  }

  const serviceSelections = Object.entries(serviceRowsByPet).flatMap(([petKey, rows]: [string, unknown]) => {
    const rowsArr = rows as any[];
    const resolvedPetId = petIdMap.get(petKey) || petKey;
    if (!resolvedPetId) return [];
    return rowsArr
      .filter((row: any) => row.serviceId)
      .map((row: any) => ({
        pet_id: resolvedPetId,
        service_id: row.serviceId,
        price_tier_id: row.priceTierId || null,
        addon_ids: row.addonIds,
      }));
  });

  const serviceIds = Array.from(new Set(serviceSelections.map((selection) => selection.service_id)));
  const effectiveDuration = totalDuration > 0 ? totalDuration : duration || null;
  const reminderPayload = useDefaultReminders ? (isEditMode ? { reminder_offsets: null } : {}) : { reminder_offsets: effectiveReminderOffsets };

  const recurrencePayload = recurrenceEnabled
    ? {
        recurrence_rule: recurrenceRule || undefined,
        recurrence_count: ctx.recurrenceEndMode === "after" ? recurrenceCountNumber || null : null,
        recurrence_until: ctx.recurrenceEndMode === "on" ? recurrenceUntilValue || null : null,
        recurrence_timezone: recurrenceTimezoneValue ? recurrenceTimezoneValue : undefined,
      }
    : { recurrence_rule: null, recurrence_count: null, recurrence_until: null, recurrence_timezone: null };

  const scopePayload: Record<string, string | undefined> = isEditMode ? { update_scope: editScope ?? "future" } : {};

  const payload = {
    appointment_date: ctx.date,
    appointment_time: formatHHMM(ctx.time).trim(),
    status: "scheduled",
    duration: effectiveDuration,
    amount: amountValue ?? null,
    notes: (ctx.notes || "").trim() || null,
    customer_id: customerId,
    service_ids: serviceIds,
    service_selections: serviceSelections,
    ...reminderPayload,
    ...recurrencePayload,
    ...scopePayload,
  };

  await mutation.mutateAsync(payload);
}

export default submitAppointment;
