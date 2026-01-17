import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import {
  AutocompleteSelect,
  AutocompleteOption,
} from "../../../components/common/AutocompleteSelect";
import { PetServiceRow } from "../../../components/appointment/PetServiceRow";

type Props = {
  pet: any;
  index?: number;
  rows: any[];
  services: any[];
  loadingServices: boolean;
  weightValue?: number | null;
  speciesOptions: any[];
  loadingSpecies: boolean;
  breedOptionsBySpecies: Record<string, any[]>;
  loadingBreedSpeciesId: string | null | undefined;
  styles: any;
  colors: any;
  handleUpdateNewPet: (petId: string, updates: any) => void;
  handleSelectNewPetSpecies: (petId: string, option: any) => void;
  handleUpdateServiceRow: (petId: string, rowId: string, updates: any) => void;
  handleRemoveServiceRow: (petId: string, rowId: string) => void;
  handleRowTotalsChange: (id: string, totals: any) => void;
  handleAddServiceRow: (petId: string) => void;
};

export default function PetServices({
  pet,
  index,
  rows,
  services,
  loadingServices,
  weightValue,
  speciesOptions,
  loadingSpecies,
  breedOptionsBySpecies,
  loadingBreedSpeciesId,
  styles,
  colors,
  handleUpdateNewPet,
  handleSelectNewPetSpecies,
  handleUpdateServiceRow,
  handleRemoveServiceRow,
  handleRowTotalsChange,
  handleAddServiceRow,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>{t("newCustomerForm.petNameLabel")}</Text>
          <TextInput
            value={pet.name}
            onChangeText={(value: string) =>
              handleUpdateNewPet(pet.id, { name: value })
            }
            placeholder={t("newCustomerForm.petNamePlaceholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>
        <AutocompleteSelect
          label={t("petForm.speciesLabel")}
          value={pet.speciesLabel}
          onChangeText={(value: string) =>
            handleUpdateNewPet(pet.id, {
              speciesLabel: value,
              speciesId: null,
              breedId: null,
              breed: "",
            })
          }
          onSelectOption={(option: AutocompleteOption | null) => {
            if (!option) return;
            handleSelectNewPetSpecies(pet.id, option);
          }}
          options={speciesOptions}
          selectedId={pet.speciesId}
          placeholder={t("petForm.speciesPlaceholder")}
          emptyLabel={t("petForm.speciesEmpty")}
          loading={loadingSpecies}
          loadingLabel={t("common.loading")}
          containerStyle={[styles.field, { flex: 1 }]}
        />
      </View>

      <AutocompleteSelect
        label={t("petForm.breedLabel")}
        value={pet.breed}
        onChangeText={(value: string) =>
          handleUpdateNewPet(pet.id, { breed: value, breedId: null })
        }
        onSelectOption={(option: AutocompleteOption | null) => {
          if (!option) return;
          handleUpdateNewPet(pet.id, {
            breedId: option.id,
            breed: option.label,
          });
        }}
        options={
          pet.speciesId ? breedOptionsBySpecies[pet.speciesId] || [] : []
        }
        selectedId={pet.breedId}
        placeholder={
          pet.speciesId
            ? t("petForm.breedPlaceholder")
            : t("petForm.breedSelectSpecies")
        }
        emptyLabel={
          pet.speciesId
            ? t("petForm.breedEmptyForSpecies")
            : t("petForm.breedSelectSpecies")
        }
        disabled={!pet.speciesId}
        loading={loadingBreedSpeciesId === pet.speciesId}
        containerStyle={styles.field}
      />

      <View style={styles.field}>
        <Text style={styles.label}>{t("appointmentForm.petWeightLabel")}</Text>
        <TextInput
          value={pet.weight}
          onChangeText={(value: string) =>
            handleUpdateNewPet(pet.id, {
              weight: value.replace(/[^0-9.,]/g, ""),
            })
          }
          placeholder={t("appointmentForm.petWeightPlaceholder")}
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />
      </View>

      {rows.map((row: any, rowIndex: number) => (
        <PetServiceRow
          key={row.id}
          index={rowIndex}
          row={row}
          services={services}
          loadingServices={loadingServices}
          petWeight={weightValue ?? null}
          onChange={(updates: any) =>
            handleUpdateServiceRow(pet.id, row.id, updates)
          }
          onRemove={() => handleRemoveServiceRow(pet.id, row.id)}
          allowRemove={rows.length > 1}
          onTotalsChange={handleRowTotalsChange}
        />
      ))}

      {rows.length > 0 ? (
        <Text style={styles.petSummary}>
          {t("appointmentForm.petTotalsLabel", {
            price: rows
              .reduce((acc, r) => acc + (r.totals?.price || 0), 0)
              .toFixed(2),
            duration: rows.reduce(
              (acc, r) => acc + (r.totals?.duration || 0),
              0
            ),
          })}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.addServiceButton}
        onPress={() => handleAddServiceRow(pet.id)}
        accessibilityLabel={t("appointmentForm.addService")}
      >
        <Text style={styles.addServiceText}>
          + {t("appointmentForm.addService")}
        </Text>
      </TouchableOpacity>
    </>
  );
}
