import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import PetHeader from "./PetHeader";
import { useTranslation } from "react-i18next";
import { PetServiceRow } from "../../../components/appointment/PetServiceRow";

type PetCardProps = {
  pet: any;
  rows: any[];
  services: any[];
  loadingServices: boolean;
  petWeight: number | null;
  onChangeRow: (rowId: string, updates: any) => void;
  onRemoveRow: (rowId: string) => void;
  onAddService: () => void;
  onTotalsChange: (id: string, totals: any) => void;
  styles: any;
};

export default function PetCard({
  pet,
  rows,
  services,
  loadingServices,
  petWeight,
  onChangeRow,
  onRemoveRow,
  onAddService,
  onTotalsChange,
  styles,
}: PetCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.petCard}>
      <PetHeader pet={pet} styles={styles} />

      {rows.map((row, index) => (
        <PetServiceRow
          key={row.id}
          index={index}
          row={row}
          services={services}
          loadingServices={loadingServices}
          petWeight={petWeight}
          onChange={(updates: any) => onChangeRow(row.id, updates)}
          onRemove={() => onRemoveRow(row.id)}
          allowRemove={rows.length > 1}
          onTotalsChange={onTotalsChange}
        />
      ))}

      {rows.length > 0 ? (
        <Text style={styles.petSummary}>
          {t("appointmentForm.petTotalsLabel", {
            price: (
              rows.reduce((acc, r) => acc + (r.totals?.price || 0), 0) || 0
            ).toFixed(2),
            duration:
              rows.reduce((acc, r) => acc + (r.totals?.duration || 0), 0) || 0,
          })}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.addServiceButton}
        onPress={onAddService}
        accessibilityLabel={t("appointmentForm.addService")}
      >
        <Text style={styles.addServiceText}>
          + {t("appointmentForm.addService")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
