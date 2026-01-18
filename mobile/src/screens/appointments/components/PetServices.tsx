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
  handleRowTotalsChange: (id: string, totals: any) => void;
  servicesError?: unknown;
  refetchServices: () => Promise<unknown>;
};

export default function PetServices({
  pet,
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
  handleRowTotalsChange,
  servicesError,
  refetchServices,
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

      {rows[0] ? (
        <PetServiceRow
          key={rows[0].id}
          index={0}
          row={rows[0]}
          services={services}
          loadingServices={loadingServices}
          servicesError={servicesError}
          refetchServices={refetchServices}
          petWeight={weightValue ?? null}
          onChange={(updates: any) =>
            handleUpdateServiceRow(pet.id, rows[0].id, updates)
          }
          onRemove={() => undefined}
          allowRemove={false}
          onTotalsChange={handleRowTotalsChange}
        />
      ) : null}

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

    </>
  );
}
