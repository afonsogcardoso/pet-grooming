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
  onTotalsChange: (id: string, totals: any) => void;
  servicesError?: unknown;
  refetchServices: () => Promise<unknown>;
  styles: any;
};

export default function PetCard({
  pet,
  rows,
  services,
  loadingServices,
  petWeight,
  onChangeRow,
  onTotalsChange,
  servicesError,
  refetchServices,
  styles,
}: PetCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.petCard}>
      <PetHeader pet={pet} styles={styles} />

      {rows[0] ? (
        <PetServiceRow
          key={rows[0].id}
          index={0}
          row={rows[0]}
          services={services}
          loadingServices={loadingServices}
          servicesError={servicesError}
          refetchServices={refetchServices}
          petWeight={petWeight}
          onChange={(updates: any) => onChangeRow(rows[0].id, updates)}
          onRemove={() => undefined}
          allowRemove={false}
          onTotalsChange={onTotalsChange}
        />
      ) : null}

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

    </View>
  );
}
