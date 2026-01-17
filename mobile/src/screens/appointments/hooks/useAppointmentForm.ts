import { useCallback, useState } from "react";
import { createLocalId, createServiceRow } from "../lib/helpers";

function createDraftPet(initial?: any) {
  return {
    id: createLocalId("pet"),
    name: "",
    speciesId: initial?.speciesId ?? null,
    speciesLabel: initial?.speciesLabel ?? "",
    breedId: initial?.breedId ?? null,
    breed: initial?.breed ?? "",
    weight: initial?.weight ?? "",
  };
}

// use `createServiceRow` from helpers

export default function useAppointmentForm() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [serviceRowsByPet, setServiceRowsByPet] = useState<Record<string, any>>({});
  const [rowTotals, setRowTotals] = useState<Record<string, any>>({});

  const [newPets, setNewPets] = useState<any[]>([createDraftPet(undefined)]);
  const [existingNewPets, setExistingNewPets] = useState<any[]>([]);

  const [speciesOptions, setSpeciesOptions] = useState<any[]>([]);
  const [defaultSpeciesId, setDefaultSpeciesId] = useState<string | null>(null);
  const [defaultSpeciesLabel, setDefaultSpeciesLabel] = useState<string>("");
  const [loadingSpecies, setLoadingSpecies] = useState<boolean>(false);
  const [breedOptionsBySpecies, setBreedOptionsBySpecies] = useState<Record<string, any[]>>({});
  const [loadingBreedSpeciesId, setLoadingBreedSpeciesId] = useState<string | null>(null);

  const [showCustomerList, setShowCustomerList] = useState<boolean>(false);
  const [showPetList, setShowPetList] = useState<boolean>(false);

  const handleSelectCustomer = useCallback((customerId: any) => {
    setSelectedCustomer(customerId);
    setSelectedPetIds([]);
    setServiceRowsByPet({});
    setRowTotals({});
    setExistingNewPets([]);
    setShowPetList(false);
  }, []);

  const handleSelectPet = useCallback((petId: any) => {
    setSelectedPetIds((prev) => (prev.includes(petId) ? prev : [...prev, petId]));
  }, []);

  const togglePetSelection = useCallback((petId: any) => {
    setSelectedPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  }, []);

  const handleAddServiceRow = useCallback((petKey: any) => {
    setServiceRowsByPet((prev) => ({ ...prev, [petKey]: [...(prev[petKey] || []), createServiceRow()] }));
  }, []);

  const handleRemoveServiceRow = useCallback((petKey: any, rowId: any) => {
    setServiceRowsByPet((prev) => {
      const rows = (prev[petKey] || []).filter((row: any) => row.id !== rowId);
      return { ...prev, [petKey]: rows.length > 0 ? rows : [createServiceRow()] };
    });
    setRowTotals((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  const handleUpdateServiceRow = useCallback((petKey: any, rowId: any, updates: any) => {
    setServiceRowsByPet((prev) => {
      const rows = prev[petKey] || [];
      return {
        ...prev,
        [petKey]: rows.map((row: any) => (row.id !== rowId ? row : { ...row, ...updates })),
      };
    });
  }, []);

  const handleRowTotalsChange = useCallback((rowId: any, totals: any) => {
    setRowTotals((prev) => {
      const existing = prev[rowId];
      if (existing && existing.price === totals.price && existing.duration === totals.duration && existing.requiresTier === totals.requiresTier) {
        return prev;
      }
      return { ...prev, [rowId]: totals };
    });
  }, []);

  const handleSelectExistingPetSpecies = useCallback((petId: any, option: any) => {
    setExistingNewPets((prev) => prev.map((pet: any) => (pet.id === petId ? { ...pet, speciesId: option?.id || null, speciesLabel: option?.label || "", breedId: null, breed: "" } : pet)));
  }, []);

  const handleSelectNewPetSpecies = useCallback((petId: any, option: any) => {
    setNewPets((prev) => prev.map((pet: any) => (pet.id === petId ? { ...pet, speciesId: option?.id || null, speciesLabel: option?.label || "", breedId: null, breed: "" } : pet)));
  }, []);

  const handleAddExistingPet = useCallback(() => {
    setExistingNewPets((prev) => [...prev, createDraftPet({ speciesId: defaultSpeciesId, speciesLabel: defaultSpeciesLabel })]);
  }, [defaultSpeciesId, defaultSpeciesLabel]);

  const handleRemoveExistingPet = useCallback((petId: any) => {
    setExistingNewPets((prev) => prev.filter((pet: any) => pet.id !== petId));
  }, []);

  const handleUpdateExistingPet = useCallback((petId: any, updates: any) => {
    setExistingNewPets((prev) => prev.map((pet: any) => (pet.id === petId ? { ...pet, ...updates } : pet)));
  }, []);

  const handleAddNewPet = useCallback(() => {
    setNewPets((prev) => [...prev, createDraftPet({ speciesId: defaultSpeciesId, speciesLabel: defaultSpeciesLabel })]);
  }, [defaultSpeciesId, defaultSpeciesLabel]);

  const handleRemoveNewPet = useCallback((petId: any) => {
    setNewPets((prev) => prev.filter((pet: any) => pet.id !== petId));
  }, []);

  const handleUpdateNewPet = useCallback((petId: any, updates: any) => {
    setNewPets((prev) => prev.map((pet: any) => (pet.id === petId ? { ...pet, ...updates } : pet)));
  }, []);

  return {
    selectedCustomer,
    setSelectedCustomer,
    selectedPetIds,
    setSelectedPetIds,
    serviceRowsByPet,
    setServiceRowsByPet,
    rowTotals,
    setRowTotals,
    newPets,
    setNewPets,
    existingNewPets,
    setExistingNewPets,
    speciesOptions,
    setSpeciesOptions,
    defaultSpeciesId,
    setDefaultSpeciesId,
    defaultSpeciesLabel,
    setDefaultSpeciesLabel,
    loadingSpecies,
    setLoadingSpecies,
    breedOptionsBySpecies,
    setBreedOptionsBySpecies,
    loadingBreedSpeciesId,
    setLoadingBreedSpeciesId,
    showCustomerList,
    setShowCustomerList,
    showPetList,
    setShowPetList,
    handleSelectCustomer,
    handleSelectPet,
    togglePetSelection,
    handleAddServiceRow,
    handleRemoveServiceRow,
    handleUpdateServiceRow,
    handleRowTotalsChange,
    handleSelectExistingPetSpecies,
    handleSelectNewPetSpecies,
    handleAddExistingPet,
    handleRemoveExistingPet,
    handleUpdateExistingPet,
    handleAddNewPet,
    handleRemoveNewPet,
    handleUpdateNewPet,
  };
}
