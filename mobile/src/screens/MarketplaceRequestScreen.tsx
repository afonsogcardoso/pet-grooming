import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Input, PhoneInput } from '../components/common';
import { AddressAutocomplete } from '../components/appointment/AddressAutocomplete';
import { DateTimePickerModal } from '../components/appointment/DateTimePickerModal';
import { createMarketplaceBooking, MarketplaceBookingPayload } from '../api/marketplace';
import { getConsumerPets } from '../api/consumerPets';
import { getProfile } from '../api/profile';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';
import { buildPhone } from '../utils/phone';
import { hapticError, hapticSuccess } from '../utils/haptics';

type Props = NativeStackScreenProps<any>;

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

function currentLocalTime() {
  const now = new Date();
  const hh = `${now.getHours()}`.padStart(2, '0');
  const mm = `${now.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

function isHexLight(color?: string) {
  if (!color || typeof color !== 'string' || !color.startsWith('#')) return false;
  const hex = color.replace('#', '');
  const expanded = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (expanded.length !== 6) return false;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65;
}

export default function MarketplaceRequestScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthStore((s) => s.user);

  const {
    accountSlug,
    accountName,
    serviceId,
    serviceName,
  } = route.params as {
    accountSlug: string;
    accountName: string;
    serviceId: string;
    serviceName: string;
  };

  const [date, setDate] = useState(todayLocalISO());
  const [time, setTime] = useState(currentLocalTime());
  const [showPicker, setShowPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [contactFirstName, setContactFirstName] = useState(user?.firstName || '');
  const [contactLastName, setContactLastName] = useState(user?.lastName || '');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [useProfilePet, setUseProfilePet] = useState(true);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [savePetProfile, setSavePetProfile] = useState(true);

  const { data: profilePets = [], isLoading: loadingProfilePets } = useQuery({
    queryKey: ['consumerPets'],
    queryFn: getConsumerPets,
  });
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 1000 * 60 * 2,
  });
  const hasProfilePets = profilePets.length > 0;

  useEffect(() => {
    if (!hasProfilePets) {
      if (!loadingProfilePets) {
        setUseProfilePet(false);
        setSelectedPetId(null);
      }
      return;
    }
    if (useProfilePet && !selectedPetId) {
      setSelectedPetId(profilePets[0]?.id || null);
    }
  }, [hasProfilePets, loadingProfilePets, profilePets, selectedPetId, useProfilePet]);

  useEffect(() => {
    if (!profile) return;
    setContactFirstName((prev) => (prev.trim() ? prev : profile.firstName || prev));
    setContactLastName((prev) => (prev.trim() ? prev : profile.lastName || prev));
    setContactEmail((prev) => (prev.trim() ? prev : profile.email || prev));
    setContactPhone((prev) => {
      if (prev.trim()) return prev;
      const resolvedPhone =
        profile.phone || buildPhone(profile.phoneCountryCode, profile.phoneNumber);
      return resolvedPhone || prev;
    });
    setContactAddress((prev) => (prev.trim() ? prev : profile.address || prev));
  }, [profile]);

  const parsedDate = useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const parsedTime = useMemo(() => new Date(`1970-01-01T${time}:00`), [time]);
  const pickerTheme = isHexLight(colors.background) ? 'light' : 'dark';

  const mutation = useMutation({
    mutationFn: createMarketplaceBooking,
    onSuccess: () => {
      hapticSuccess();
      Alert.alert(t('marketplaceRequest.successTitle'), t('marketplaceRequest.successMessage'));
      navigation.goBack();
    },
    onError: (err: any) => {
      hapticError();
      const code = err?.response?.data?.error || err?.message;
      let message = t('marketplaceRequest.errorMessage');
      if (code === 'phone_verification_required') {
        message = t('marketplaceRequest.phoneRequired');
      } else if (code === 'email_verification_required') {
        message = t('marketplaceRequest.emailRequired');
      }
      Alert.alert(t('marketplaceRequest.errorTitle'), message);
    },
  });

  const openDatePicker = () => {
    setShowPicker(true);
    setShowDatePicker(true);
    setShowTimePicker(false);
  };

  const openTimePicker = () => {
    setShowPicker(true);
    setShowDatePicker(false);
    setShowTimePicker(true);
  };

  const handleDateChange = (_event: any, nextDate?: Date) => {
    if (nextDate) {
      setDate(nextDate.toLocaleDateString('sv-SE'));
    }
  };

  const handleTimeChange = (_event: any, nextTime?: Date) => {
    if (nextTime) {
      const hh = `${nextTime.getHours()}`.padStart(2, '0');
      const mm = `${nextTime.getMinutes()}`.padStart(2, '0');
      setTime(`${hh}:${mm}`);
    }
  };

  const handleSubmit = () => {
    const trimmedFirstName = contactFirstName.trim();
    const trimmedLastName = contactLastName.trim();
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim();
    const trimmedAddress = contactAddress.trim();
    const trimmedPetName = petName.trim();
    const trimmedBreed = petBreed.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedPhone) {
      hapticError();
      Alert.alert(t('marketplaceRequest.errorTitle'), t('marketplaceRequest.missingFields'));
      return;
    }

    if (useProfilePet && !selectedPetId) {
      hapticError();
      Alert.alert(t('marketplaceRequest.errorTitle'), t('marketplaceRequest.selectPet'));
      return;
    }

    if (!useProfilePet && !trimmedPetName) {
      hapticError();
      Alert.alert(t('marketplaceRequest.errorTitle'), t('marketplaceRequest.missingFields'));
      return;
    }

    const weightValue = petWeight ? Number(petWeight.replace(',', '.')) : null;

    const payload: MarketplaceBookingPayload = {
      account_slug: accountSlug,
      service_id: serviceId,
      appointment_date: date,
      appointment_time: time,
      notes: trimmedNotes || null,
      customer: {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phone: trimmedPhone,
        address: trimmedAddress || null,
      },
    };

    if (useProfilePet) {
      payload.pet_id = selectedPetId;
    } else {
      payload.pet = {
        name: trimmedPetName,
        breed: trimmedBreed || null,
        weight: Number.isNaN(weightValue) ? null : weightValue,
      };
      payload.save_pet = savePetProfile;
    }

    mutation.mutate(payload);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title={t('marketplaceRequest.title')} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{accountName}</Text>
          <Text style={styles.summarySubtitle}>{serviceName}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('marketplaceRequest.scheduleTitle')}</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateButton} onPress={openDatePicker}>
              <Text style={styles.dateButtonLabel}>{t('marketplaceRequest.date')}</Text>
              <Text style={styles.dateButtonValue}>{date}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateButton} onPress={openTimePicker}>
              <Text style={styles.dateButtonLabel}>{t('marketplaceRequest.time')}</Text>
              <Text style={styles.dateButtonValue}>{time}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('marketplaceRequest.contactTitle')}</Text>
          <View style={styles.nameRow}>
            <View style={styles.nameColumn}>
              <Input
                label={t('marketplaceRequest.firstNameLabel')}
                value={contactFirstName}
                onChangeText={setContactFirstName}
                placeholder={t('marketplaceRequest.firstNamePlaceholder')}
              />
            </View>
            <View style={styles.nameColumn}>
              <Input
                label={t('marketplaceRequest.lastNameLabel')}
                value={contactLastName}
                onChangeText={setContactLastName}
                placeholder={t('marketplaceRequest.lastNamePlaceholder')}
              />
            </View>
          </View>
          <Input
            label={t('common.email')}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder={t('common.email')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <PhoneInput
            label={t('common.phone')}
            value={contactPhone}
            onChange={setContactPhone}
            placeholder={t('common.phone')}
          />
          <View style={styles.addressField}>
            <Text style={styles.inputLabel}>{t('marketplaceRequest.addressLabel')}</Text>
            <AddressAutocomplete
              value={contactAddress}
              onSelect={setContactAddress}
              placeholder={t('marketplaceRequest.addressPlaceholder')}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('marketplaceRequest.petTitle')}</Text>
          {hasProfilePets ? (
            <View style={styles.petToggleRow}>
              <TouchableOpacity
                style={[
                  styles.petToggleButton,
                  useProfilePet && styles.petToggleButtonActive,
                ]}
                onPress={() => setUseProfilePet(true)}
              >
                <Text
                  style={[
                    styles.petToggleText,
                    useProfilePet && styles.petToggleTextActive,
                  ]}
                >
                  {t('marketplaceRequest.useProfilePet')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.petToggleButton,
                  !useProfilePet && styles.petToggleButtonActive,
                ]}
                onPress={() => setUseProfilePet(false)}
              >
                <Text
                  style={[
                    styles.petToggleText,
                    !useProfilePet && styles.petToggleTextActive,
                  ]}
                >
                  {t('marketplaceRequest.addNewPet')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {useProfilePet && hasProfilePets ? (
            <View style={styles.petOptions}>
              {profilePets.map((pet) => {
                const isSelected = pet.id === selectedPetId;
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[
                      styles.petOptionCard,
                      isSelected && styles.petOptionCardActive,
                    ]}
                    onPress={() => setSelectedPetId(pet.id)}
                  >
                    <Text style={styles.petOptionName}>{pet.name}</Text>
                    {pet.breed ? (
                      <Text style={styles.petOptionMeta}>{pet.breed}</Text>
                    ) : null}
                    {pet.weight !== undefined && pet.weight !== null ? (
                      <Text style={styles.petOptionMeta}>
                        {pet.weight} {t('marketplaceRequest.weightUnit')}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <>
              <Input
                label={t('marketplaceRequest.petName')}
                value={petName}
                onChangeText={setPetName}
                placeholder={t('marketplaceRequest.petName')}
              />
              <Input
                label={t('marketplaceRequest.petBreed')}
                value={petBreed}
                onChangeText={setPetBreed}
                placeholder={t('marketplaceRequest.petBreed')}
              />
              <Input
                label={t('marketplaceRequest.petWeight')}
                value={petWeight}
                onChangeText={setPetWeight}
                placeholder={t('marketplaceRequest.petWeight')}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              />
              <View style={styles.savePetRow}>
                <Text style={styles.savePetLabel}>{t('marketplaceRequest.savePet')}</Text>
                <Switch
                  value={savePetProfile}
                  onValueChange={setSavePetProfile}
                  trackColor={{ false: colors.surfaceBorder, true: colors.switchTrack }}
                  thumbColor={savePetProfile ? colors.primary : colors.surface}
                  ios_backgroundColor={colors.surface}
                />
              </View>
              <Text style={styles.savePetHint}>{t('marketplaceRequest.savePetHint')}</Text>
            </>
          )}
          <Input
            label={t('marketplaceRequest.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('marketplaceRequest.notes')}
            multiline
            style={styles.notesInput}
          />
        </View>

        <Button
          title={t('marketplaceRequest.submit')}
          onPress={handleSubmit}
          loading={mutation.isPending}
          size="large"
          style={styles.submitButton}
        />
      </ScrollView>

      <DateTimePickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        showDatePicker={showDatePicker}
        showTimePicker={showTimePicker}
        parsedDate={parsedDate}
        parsedTime={parsedTime}
        onDateChange={handleDateChange}
        onTimeChange={handleTimeChange}
        pickerTheme={pickerTheme}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 16,
    },
    summaryCard: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.onPrimary,
    },
    summarySubtitle: {
      marginTop: 6,
      fontSize: 14,
      color: colors.onPrimary,
      opacity: 0.85,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    addressField: {
      marginBottom: 16,
    },
    nameRow: {
      flexDirection: 'row',
      gap: 12,
    },
    nameColumn: {
      flex: 1,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
    },
    dateButton: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
    },
    dateButtonLabel: {
      fontSize: 11,
      color: colors.muted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dateButtonValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    notesInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    petToggleRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    petToggleButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    petToggleButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    petToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    petToggleTextActive: {
      color: colors.primary,
    },
    petOptions: {
      gap: 10,
      marginBottom: 12,
    },
    petOptionCard: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1.2,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    petOptionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    petOptionName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    petOptionMeta: {
      fontSize: 12,
      color: colors.muted,
    },
    savePetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      marginBottom: 4,
    },
    savePetLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    savePetHint: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 8,
    },
    submitButton: {
      marginTop: 4,
    },
  });
}
