import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";

type PetHeaderProps = {
  pet: any;
  index?: number;
  canRemove?: boolean;
  onRemove?: () => void;
  titleOverride?: string;
  styles: any;
};

export default function PetHeader({
  pet,
  index,
  canRemove,
  onRemove,
  titleOverride,
  styles,
}: PetHeaderProps) {
  const { t } = useTranslation();
  const title =
    titleOverride ??
    pet.name ??
    (index != null
      ? t("appointmentForm.petCardTitle", { index: index + 1 })
      : "");

  return (
    <View style={styles.petHeader}>
      <View style={styles.petHeaderLeft}>
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={styles.petAvatar} />
        ) : (
          <View style={styles.petAvatarPlaceholder}>
            <Text style={styles.petAvatarText}>
              {(pet.name || (index != null ? String(index + 1) : "?"))
                .trim()
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
        )}
        <View>
          <Text style={styles.petTitle}>{title}</Text>
          {pet.breed ? <Text style={styles.petMeta}>{pet.breed}</Text> : null}
          {pet.weight != null ? (
            <Text style={styles.petMeta}>
              {t("appointmentForm.petWeightInline", { value: pet.weight })}
            </Text>
          ) : null}
        </View>
      </View>
      {canRemove && onRemove ? (
        <TouchableOpacity style={styles.removePetButton} onPress={onRemove}>
          <Text style={styles.removePetText}>
            {t("appointmentForm.removePet")}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
