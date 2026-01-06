import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { getCardStyle } from '../../theme/uiTokens';
import { formatCustomerAddress, formatCustomerName, getCustomerFirstName } from '../../utils/customer';
import type { Appointment } from '../../api/appointments';
import { getStatusColor, getStatusLabel } from '../../utils/appointmentStatus';
import {
  formatPetLabel,
  formatServiceLabels,
  getAppointmentPetNames,
  getAppointmentServiceEntries,
} from '../../utils/appointmentSummary';

type Props = {
  appointment: Appointment;
  onPress?: (appointment: Appointment) => void;
};

export default function AppointmentCard({ appointment, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useBrandingTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [multiHeight, setMultiHeight] = React.useState<number | null>(null);

  const appointmentServices = getAppointmentServiceEntries(appointment);
  const petNames = getAppointmentPetNames(appointment, appointmentServices);
  const petLabel = formatPetLabel(petNames);
  const primaryPetName = petNames[0] || '';
  const petInitial = primaryPetName ? primaryPetName.charAt(0).toUpperCase() : '🐾';
  const appointmentPets =
    (Array.isArray(appointment.appointment_services)
      ? appointment.appointment_services.map((e: any) => e.pets).filter(Boolean)
      : []) || (appointment.pets ? [appointment.pets] : []);
  const serviceNames = formatServiceLabels(appointmentServices);
  const address = formatCustomerAddress(appointment.customers);
  const statusColor = getStatusColor(appointment.status);
  const statusLabel = getStatusLabel(appointment.status);
  const servicesTotal =
    appointmentServices.length > 0
      ? appointmentServices.reduce((sum, entry) => {
          const basePrice = entry.price_tier_price ?? entry.services?.price ?? 0;
          const addonsTotal = Array.isArray(entry.appointment_service_addons)
            ? entry.appointment_service_addons.reduce((addonSum, addon) => addonSum + (addon.price || 0), 0)
            : 0;
          return sum + basePrice + addonsTotal;
        }, 0)
      : appointment.services?.price ?? null;
  const amount = appointment.amount ?? servicesTotal;
  const paymentStatus = appointment.payment_status ?? null;
  const paymentColor = paymentStatus === 'paid' ? colors.success : colors.warning;
  const paymentLabel = paymentStatus === 'paid' ? t('listView.paid') : t('listView.unpaid');

  function handlePress() {
    if (onPress) onPress(appointment);
  }

  function formatTime(value?: string | null) {
    if (!value) return '—';
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const [, hh, mm] = match;
      return `${hh.padStart(2, '0')}:${mm}`;
    }
    return value;
  }

  const hasMultiplePets = appointmentPets && appointmentPets.length > 1;
  const hasSinglePhoto = Boolean(appointment.pets?.photo_url);
  const isSinglePlaceholder = !hasMultiplePets && !hasSinglePhoto;

  const petCount = appointmentPets ? appointmentPets.slice(0, 3).length : 0;
  const overlapRatio = 0.25; // overlap as proportion of avatar size
  let computedItemSize = 24;
  let computedOverlap = Math.round(computedItemSize * overlapRatio);
  if (multiHeight && petCount > 0) {
    const denom = petCount - (petCount - 1) * overlapRatio;
    computedItemSize = Math.floor(multiHeight / denom);
    const maxByWidth = Math.floor((54 - 4) * 0.9); // keep some padding in 54px column
    computedItemSize = Math.min(computedItemSize, maxByWidth, 40);
    computedItemSize = Math.max(computedItemSize, 16);
    computedOverlap = Math.round(computedItemSize * overlapRatio);
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View
        style={[
          styles.petThumb,
          hasMultiplePets ? styles.petThumbMultiContainer : null,
          isSinglePlaceholder ? styles.petThumbPlaceholder : null,
        ]}
      >
        {hasMultiplePets ? (
          <View
            style={styles.petThumbMultiple}
            onLayout={(e) => setMultiHeight(e.nativeEvent.layout.height)}
          >
            {appointmentPets.slice(0, 3).map((p: any, i: number) => (
              <View
                key={i}
                style={[
                  // base styles
                  styles.petMultiItem,
                  // dynamic sizing
                  {
                    width: computedItemSize,
                    height: computedItemSize,
                    borderRadius: Math.round(computedItemSize / 2),
                  },
                  // stacking overlap
                  i === 0 ? null : { marginTop: -computedOverlap },
                  { zIndex: 10 - i },
                ]}
              >
                {p?.photo_url ? (
                  <Image source={{ uri: p.photo_url }} style={styles.petMultiImage} resizeMode="cover" />
                ) : (
                  <Text style={[styles.petMultiInitial, { fontSize: Math.max(10, Math.round(computedItemSize * 0.45)) }]}>
                    {String(p?.name || '').slice(0, 1).toUpperCase() || '🐾'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          appointment.pets?.photo_url ? (
            <Image source={{ uri: appointment.pets.photo_url }} style={styles.petImage} resizeMode="cover" />
          ) : (
            <Text style={styles.petInitial}>{petInitial}</Text>
          )
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.time}>{formatTime(appointment.appointment_time)}</Text>
        <Text style={styles.service} numberOfLines={1}>
          {serviceNames.length > 0 ? serviceNames.join(', ') : t('listView.serviceFallback')}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatCustomerName(appointment.customers)}
        </Text>
        {petNames.length > 0 && (
          <View style={{ marginTop: 4 }}>
            {petNames.map((pn, idx) => (
              <Text key={idx} style={[styles.meta, { marginTop: idx === 0 ? 2 : 0 }]} numberOfLines={1}>
                {pn}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
        <View style={styles.badges}>
          <View style={[styles.pill, { backgroundColor: `${statusColor}14` }]}> 
            <View style={[ { backgroundColor: statusColor }]} />
            <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {paymentStatus ? (
            <>
              <View style={[styles.pill, { backgroundColor: `${paymentColor}14` }]}> 
                <View style={[ { backgroundColor: paymentColor }]} />
                <Text style={[styles.pillText, { color: paymentColor }]}>{paymentLabel}</Text>
              </View>
              {amount !== undefined && amount !== null ? (
                <Text style={styles.paymentAmount}>{`€ ${Number(amount).toFixed(2)}`}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ReturnType<typeof useBrandingTheme>['colors']) {
  const cardBase = getCardStyle(colors);
  const listCardBase = {
    ...cardBase,
    backgroundColor: colors.surface,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    shadowOpacity: 0.05,
    elevation: 8,
  };

  const screenWidth = Dimensions.get('window').width;

  const placeholderBg =
    colors.primarySoft && colors.primarySoft !== colors.surface
      ? colors.primarySoft
      : colors.primary
      ? `${colors.primary}12`
      : colors.surfaceBorder;

  const placeholderBgSolid =
    colors.primarySoft && colors.primarySoft !== colors.surface
      ? colors.primarySoft
      : colors.surfaceBorder;

  return StyleSheet.create({
    card: {
      ...listCardBase,
      width: screenWidth - 32,
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 18,
    },
    petThumb: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: 'transparent',
      borderWidth: 0,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      paddingVertical: 0,
    },
    petThumbMultiContainer: {
      // allow multi container to stretch to card height so stacked avatars don't get clipped
      width: 54,
      height: undefined,
      alignSelf: 'stretch',
      borderRadius: 20,
      paddingVertical: 6,
      justifyContent: 'flex-start',
    },
    petThumbPlaceholder: {
      backgroundColor: placeholderBg,
    },
    petThumbMultiple: {
      width: 54,
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 0,
    },
    petMultiItem: {
      position: 'relative',
      width: 30,
      height: 30,
      borderRadius: 15,
      overflow: 'hidden',
      borderWidth: 0,
      backgroundColor: placeholderBg,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
    },
    petMultiImage: {
      width: '100%',
      height: '100%',
    },
    petMultiInitial: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    petImage: {
      width: '100%',
      height: '100%',
    },
    petInitial: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    content: {
      flex: 1,
      gap: 4,
    },
    time: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    service: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '700',
    },
    meta: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: '500',
    },
    badges: {
      gap: 8,
      alignItems: 'flex-end',
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',

    },
    pillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    paymentAmount: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      marginRight: 4,
      alignSelf: 'flex-end',
      color: colors.muted,
    },
    nextMeta: {
      marginTop: 10,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
