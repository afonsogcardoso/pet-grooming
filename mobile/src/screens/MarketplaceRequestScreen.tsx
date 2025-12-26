import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Input, PhoneInput } from '../components/common';
import { DateTimePickerModal } from '../components/appointment/DateTimePickerModal';
import { createMarketplaceBooking } from '../api/marketplace';
import { useAuthStore } from '../state/authStore';
import { useBrandingTheme } from '../theme/useBrandingTheme';

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
  const [contactName, setContactName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.displayName || ''
  );
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [notes, setNotes] = useState('');

  const parsedDate = useMemo(() => new Date(`${date}T00:00:00`), [date]);
  const parsedTime = useMemo(() => new Date(`1970-01-01T${time}:00`), [time]);
  const pickerTheme = isHexLight(colors.background) ? 'light' : 'dark';

  const mutation = useMutation({
    mutationFn: createMarketplaceBooking,
    onSuccess: () => {
      Alert.alert(t('marketplaceRequest.successTitle'), t('marketplaceRequest.successMessage'));
      navigation.goBack();
    },
    onError: (err: any) => {
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
    const trimmedName = contactName.trim();
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim();
    const trimmedPetName = petName.trim();
    const trimmedBreed = petBreed.trim();
    const trimmedNotes = notes.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedPetName) {
      Alert.alert(t('marketplaceRequest.errorTitle'), t('marketplaceRequest.missingFields'));
      return;
    }

    const weightValue = petWeight ? Number(petWeight.replace(',', '.')) : null;

    mutation.mutate({
      account_slug: accountSlug,
      service_id: serviceId,
      appointment_date: date,
      appointment_time: time,
      notes: trimmedNotes || null,
      customer: {
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
      },
      pet: {
        name: trimmedPetName,
        breed: trimmedBreed || null,
        weight: Number.isNaN(weightValue) ? null : weightValue,
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t('marketplaceRequest.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{accountName}</Text>
          <Text style={styles.summarySubtitle}>{serviceName}</Text>
        </View>

        <View style={styles.section}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('marketplaceRequest.contactTitle')}</Text>
          <Input
            label={t('common.name')}
            value={contactName}
            onChangeText={setContactName}
            placeholder={t('common.name')}
          />
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('marketplaceRequest.petTitle')}</Text>
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
    </View>
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
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      marginBottom: 16,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    summarySubtitle: {
      marginTop: 6,
      fontSize: 14,
      color: colors.muted,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 12,
    },
    dateButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1.5,
      borderColor: colors.surfaceBorder,
    },
    dateButtonLabel: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 6,
    },
    dateButtonValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    notesInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    submitButton: {
      marginTop: 8,
    },
  });
}
