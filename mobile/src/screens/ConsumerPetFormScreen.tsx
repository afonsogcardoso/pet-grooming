import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Input } from '../components/common';
import { ConsumerPet, createConsumerPet, updateConsumerPet, deleteConsumerPet } from '../api/consumerPets';
import { useBrandingTheme } from '../theme/useBrandingTheme';

type Props = NativeStackScreenProps<any>;

export default function ConsumerPetFormScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const pet = route.params?.pet as ConsumerPet | undefined;
  const isEditing = Boolean(pet?.id);

  const [name, setName] = useState(pet?.name || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [weight, setWeight] = useState(
    pet?.weight !== undefined && pet?.weight !== null ? String(pet.weight) : ''
  );

  const createMutation = useMutation({
    mutationFn: createConsumerPet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
      navigation.goBack();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || t('consumerPetsForm.saveError');
      Alert.alert(t('common.error'), message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: { name?: string; breed?: string | null; weight?: number | null } }) =>
      updateConsumerPet(payload.id, payload.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
      navigation.goBack();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || t('consumerPetsForm.saveError');
      Alert.alert(t('common.error'), message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConsumerPet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumerPets'] }).catch(() => null);
      navigation.goBack();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || t('consumerPetsForm.deleteError');
      Alert.alert(t('common.error'), message);
    },
  });

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedBreed = breed.trim();
    const weightValue = weight ? Number(weight.replace(',', '.')) : null;

    if (!trimmedName) {
      Alert.alert(t('consumerPetsForm.requiredTitle'), t('consumerPetsForm.requiredMessage'));
      return;
    }
    if (weight && Number.isNaN(weightValue)) {
      Alert.alert(t('common.error'), t('consumerPetsForm.weightInvalid'));
      return;
    }

    if (isEditing && pet?.id) {
      updateMutation.mutate({
        id: pet.id,
        updates: {
          name: trimmedName,
          breed: trimmedBreed || null,
          weight: Number.isNaN(weightValue) ? null : weightValue,
        },
      });
      return;
    }

    createMutation.mutate({
      name: trimmedName,
      breed: trimmedBreed || null,
      weight: Number.isNaN(weightValue) ? null : weightValue,
    });
  };

  const handleDelete = () => {
    if (!pet?.id) return;
    Alert.alert(t('consumerPetsForm.deleteTitle'), t('consumerPetsForm.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('consumerPetsForm.deleteConfirm'),
        style: 'destructive',
        onPress: () => deleteMutation.mutate(pet.id),
      },
    ]);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={isEditing ? t('consumerPetsForm.editTitle') : t('consumerPetsForm.createTitle')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Input
            label={t('consumerPetsForm.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('consumerPetsForm.namePlaceholder')}
          />
          <Input
            label={t('consumerPetsForm.breedLabel')}
            value={breed}
            onChangeText={setBreed}
            placeholder={t('consumerPetsForm.breedPlaceholder')}
          />
          <Input
            label={t('consumerPetsForm.weightLabel')}
            value={weight}
            onChangeText={setWeight}
            placeholder={t('consumerPetsForm.weightPlaceholder')}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
          />
        </View>

        <Button
          title={isEditing ? t('consumerPetsForm.saveAction') : t('consumerPetsForm.createAction')}
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />

        {isEditing ? (
          <Button
            title={t('consumerPetsForm.deleteAction')}
            onPress={handleDelete}
            loading={deleteMutation.isPending}
            variant="danger"
            style={styles.deleteButton}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 16,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 6,
    },
    saveButton: {
      marginTop: 8,
    },
    deleteButton: {
      marginTop: 4,
    },
  });
}
