import React from 'react';
import { View, Text, TouchableOpacity, SectionList, Image, StyleSheet, Linking, Platform, TextInput } from 'react-native';
import SwipeableRow from '../common/SwipeableRow';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useBrandingTheme } from '../../theme/useBrandingTheme';
import { getCardStyle } from '../../theme/uiTokens';
import { getDateLocale } from '../../i18n';
import { matchesSearchQuery } from '../../utils/textHelpers';
import { formatCustomerAddress, formatCustomerName, getCustomerFirstName } from '../../utils/customer';
import {
  formatPetLabel,
  formatServiceLabels,
  getAppointmentPetNames,
  getAppointmentServiceEntries,
} from '../../utils/appointmentSummary';
import { Button } from '../common';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY || '';
import type { Appointment } from '../../api/appointments';
import { getStatusColor, getStatusLabel } from '../../utils/appointmentStatus';

type ListViewProps = {
  appointments: Appointment[];
  filterMode: 'upcoming' | 'past' | 'unpaid';
  onAppointmentPress: (appointment: Appointment) => void;
  onNewAppointment: (date?: string, time?: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  deletingId?: string | null;
};

const SEARCH_HEADER_HEIGHT = 44;

function formatTime(value?: string | null) {
  if (!value) return '—';
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hh, mm] = match;
    return `${hh.padStart(2, '0')}:${mm}`;
  }
  return value;
}

function formatDateLabel(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  try {
    return new Date(value + 'T00:00:00').toLocaleDateString(locale, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return value;
  }
}

function toDayKey(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('sv-SE');
}

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

type ThemeColors = ReturnType<typeof useBrandingTheme>['colors'];

function createStyles(colors: ThemeColors) {
  const cardBase = getCardStyle(colors);
  const listCardBase = {
    ...cardBase,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    shadowOpacity: 0.08,
    elevation: 3,
  };
  return StyleSheet.create({
    list: {
      flex: 1,
    },
    card: {
      ...listCardBase,
      flexDirection: 'row',
      gap: 14,
    },
    petThumb: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primarySoft,
      borderWidth: 2,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
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
      fontWeight: '700',
      color: colors.text,
    },
    service: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '600',
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
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
    },
    pillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 4,
    },
    actionButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    whatsappButton: {
      borderColor: '#25D366',
      backgroundColor: '#E7F8EE',
    },
    actionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    emptyAction: {
      marginTop: 16,
      minWidth: 180,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      marginBottom: 8,
      marginTop: 12,
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      gap: 8,
    },
    sectionHeaderText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    addButton: {
      height: 20,
      width: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    addButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 12,
      lineHeight: 14,
    },
    searchContainer: {
      height: SEARCH_HEADER_HEIGHT,
      justifyContent: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    clearButton: {
      padding: 2,
    },
  });
}

type AppointmentRowProps = {
  item: Appointment;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  t: (key: string, options?: any) => string;
  onAppointmentPress: (appointment: Appointment) => void;
  isDeleting: boolean;
};

const AppointmentRow = React.memo(function AppointmentRow({
  item,
  colors,
  styles,
  t,
  onAppointmentPress,
  isDeleting,
}: AppointmentRowProps) {
  const appointmentServices = getAppointmentServiceEntries(item);
  const petNames = getAppointmentPetNames(item, appointmentServices);
  const petLabel = formatPetLabel(petNames);
  const primaryPetName = petNames[0] || item.pets?.name || '';
  const petInitial = primaryPetName ? primaryPetName.charAt(0).toUpperCase() : '🐾';
  const servicesTotal =
    appointmentServices.length > 0
      ? appointmentServices.reduce((sum, entry) => {
          const basePrice = entry.price_tier_price ?? entry.services?.price ?? 0;
          const addonsTotal = Array.isArray(entry.appointment_service_addons)
            ? entry.appointment_service_addons.reduce((addonSum, addon) => addonSum + (addon.price || 0), 0)
            : 0;
          return sum + basePrice + addonsTotal;
        }, 0)
      : item.services?.price ?? null;
  const amount = item.amount ?? servicesTotal;
  const serviceNames = formatServiceLabels(appointmentServices);
  const address = formatCustomerAddress(item.customers);
  const phone = item.customers?.phone;
  const statusColor = getStatusColor(item.status);
  const statusLabel = getStatusLabel(item.status);
  const paymentStatus = item.payment_status ?? null;
  const paymentColor = paymentStatus === 'paid' ? colors.success : colors.warning;
  const paymentLabel = paymentStatus === 'paid' ? t('listView.paid') : t('listView.unpaid');

  return (
    <SwipeableRow
      isDeleting={isDeleting}
      onDelete={() => {
        try {
          if ((global as any).onDeleteAppointment) {
            (global as any).onDeleteAppointment(item);
          }
        } catch {
          // ignore
        }
      }}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => onAppointmentPress(item)}
      >
        <View style={styles.petThumb}>
          {item.pets?.photo_url ? (
            <Image source={{ uri: item.pets.photo_url }} style={styles.petImage} />
          ) : (
            <Text style={styles.petInitial}>{petInitial}</Text>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.time}>{formatTime(item.appointment_time)}</Text>
          <Text style={styles.service}>
            {serviceNames.length > 0
              ? serviceNames.join(', ')
              : (item.services?.name || t('listView.serviceFallback'))}
          </Text>
          <Text style={styles.meta}>
            {formatCustomerName(item.customers)}
            {petLabel ? ` • ${petLabel}` : ''}
          </Text>
          {amount !== undefined && amount !== null ? (
            <Text style={styles.meta}>€ {Number(amount).toFixed(2)}</Text>
          ) : null}
          <View style={styles.actions}>
            {address ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  try {
                    const response = await fetch(
                      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
                    );
                    const data = await response.json();

                    if (data.results && data.results.length > 0) {
                      const location = data.results[0].geometry.location;
                      const url = Platform.select({
                        ios: `maps:0,0?q=${location.lat},${location.lng}`,
                        android: `geo:0,0?q=${location.lat},${location.lng}`,
                        default: `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`,
                      });
                      Linking.openURL(url).catch(() => null);
                    }
                  } catch (error) {
                    console.error('Geocoding error:', error);
                  }
                }}
              >
                <Ionicons name="location" size={14} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            {phone ? (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Linking.openURL(`tel:${phone}`).catch(() => null)}
                >
                  <Ionicons name="call" size={14} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.whatsappButton]}
                  onPress={() => {
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    const formattedPhone = cleanPhone.startsWith('9') ? `351${cleanPhone}` : cleanPhone;
                    const customerFirstName = getCustomerFirstName(item.customers);
                    const message = t('listView.whatsappMessage', { name: customerFirstName });
                    Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`).catch(() => null);
                  }}
                >
                  <FontAwesome name="whatsapp" size={16} color="#25D366" />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.badges}>
          <View style={[styles.pill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {paymentStatus ? (
            <View style={[styles.pill, { backgroundColor: paymentColor + '33', borderColor: paymentColor }]}>
              <Text style={[styles.pillText, { color: paymentColor }]}>{paymentLabel}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    </SwipeableRow>
  );
});

export function ListView({ 
  appointments, 
  filterMode,
  onAppointmentPress,
  onNewAppointment,
  onRefresh,
  isRefreshing,
  deletingId,
}: ListViewProps) {
  const listRef = React.useRef<SectionList<Appointment>>(null);
  const searchInputRef = React.useRef<TextInput>(null);
  const hasSetInitialOffset = React.useRef(false);
  const { colors } = useBrandingTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const dateLocale = getDateLocale();
  const today = todayLocalISO();
  const [searchQuery, setSearchQuery] = React.useState('');
  const searchTerm = searchQuery.trim();

  const filteredAppointments = React.useMemo(() => {
    if (!searchTerm) return appointments;

    return appointments.filter((appointment) => {
      const appointmentServices = getAppointmentServiceEntries(appointment);
      const serviceNames = formatServiceLabels(appointmentServices);
      const petNames = getAppointmentPetNames(appointment, appointmentServices);

      const values = [
        formatCustomerName(appointment.customers),
        appointment.customers?.phone,
        formatCustomerAddress(appointment.customers),
        ...petNames,
        appointment.pets?.breed,
        appointment.services?.name,
        appointment.appointment_date,
        appointment.appointment_time,
        appointment.notes,
        ...serviceNames,
      ].filter((value): value is string => Boolean(value));

      return values.some((value) => matchesSearchQuery(value, searchTerm));
    });
  }, [appointments, searchTerm]);

  // Group appointments by day
  const sections = React.useMemo(() => {
    const source =
      filterMode === 'unpaid'
        ? filteredAppointments.filter((a) => (a.payment_status || 'unpaid') !== 'paid')
        : filteredAppointments;

    const grouped: Record<string, Appointment[]> = {};
    for (const item of source) {
      // Normalize date to YYYY-MM-DD format
      const dayKey = toDayKey(item.appointment_date);
      if (dayKey) {
        grouped[dayKey] = grouped[dayKey] ? [...grouped[dayKey], item] : [item];
      }
    }
    
    const todayKey = today;
    const entries = Object.entries(grouped).map(([dayKey, items]) => {
      const titleLabel = dayKey === todayKey ? t('common.today') : formatDateLabel(dayKey, dateLocale, t('common.noDate'));
      return {
        dayKey,
        title: titleLabel,
        data: items.sort((x, y) => (x.appointment_time || '').localeCompare(y.appointment_time || '')),
      };
    });

    // Filter and sort based on mode
    let filtered: typeof entries;
    
    if (filterMode === 'upcoming') {
      // Show today and future dates, sorted ascending
      filtered = entries
        .filter((entry) => entry.dayKey >= todayKey)
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    } else if (filterMode === 'past') {
      // Show past dates only, sorted descending (most recent first)
      filtered = entries
        .filter((entry) => entry.dayKey < todayKey)
        .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    } else {
      // Unpaid: show all sorted ascending
      filtered = entries.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    }

    return filtered;
  }, [filteredAppointments, filterMode, t, dateLocale, today]);


  const renderAppointmentItem = React.useCallback(
    ({ item }: { item: Appointment }) => (
      <AppointmentRow
        item={item}
        colors={colors}
        styles={styles}
        t={t}
        onAppointmentPress={onAppointmentPress}
        isDeleting={item.id === deletingId}
      />
    ),
    [colors, styles, t, onAppointmentPress, deletingId]
  );

  const renderSectionHeader = React.useCallback(
    ({ section }: { section: typeof sections[0] }) => {
      const isPast = filterMode === 'past';
      const sectionIsPast = section.dayKey && section.dayKey < today;
      const canCreate = !isPast && !sectionIsPast;

      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
          {canCreate ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onNewAppointment(section.dayKey)}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    },
    [filterMode, onNewAppointment, styles, today]
  );

  const listHeader = (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          ref={searchInputRef}
          placeholder={t('listView.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const listEmptyTitle = searchTerm ? t('listView.noSearchResults') : t('listView.noAppointments');
  const listEmptySubtitle = searchTerm
    ? t('listView.noSearchResultsSubtitle')
    : t('listView.noAppointmentsSubtitle');
  const canCreateOnEmpty = !searchTerm && filterMode !== 'past';

  const applyInitialOffset = React.useCallback(() => {
    if (Platform.OS !== 'ios' || hasSetInitialOffset.current) return;
    const list = listRef.current as any;
    if (!list) return;

    if (typeof list.scrollToOffset === 'function') {
      list.scrollToOffset({ offset: SEARCH_HEADER_HEIGHT, animated: false });
      hasSetInitialOffset.current = true;
      return;
    }

    if (typeof list.scrollToLocation === 'function') {
      if (sections.length > 0 && sections[0].data.length > 0) {
        list.scrollToLocation({
          sectionIndex: 0,
          itemIndex: 0,
          viewOffset: SEARCH_HEADER_HEIGHT,
          animated: false,
        });
        hasSetInitialOffset.current = true;
      }
      return;
    }

    const responder = typeof list.getScrollResponder === 'function'
      ? list.getScrollResponder()
      : null;
    if (responder && typeof responder.scrollResponderScrollTo === 'function') {
      responder.scrollResponderScrollTo({ y: SEARCH_HEADER_HEIGHT, animated: false });
      hasSetInitialOffset.current = true;
    }
  }, [sections]);

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    searchInputRef.current?.blur();
    hasSetInitialOffset.current = false;
    requestAnimationFrame(applyInitialOffset);
  }, [filterMode]);

  return (
    <SectionList
      ref={listRef}
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderAppointmentItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}
      SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      onContentSizeChange={applyInitialOffset}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{searchTerm ? '🔍' : '📭'}</Text>
          <Text style={styles.emptyText}>{listEmptyTitle}</Text>
          <Text style={styles.emptySubtext}>{listEmptySubtitle}</Text>
          {canCreateOnEmpty ? (
            <Button
              title={t('appointments.newAppointment')}
              onPress={() => onNewAppointment()}
              style={styles.emptyAction}
            />
          ) : null}
        </View>
      }
      onRefresh={onRefresh}
      refreshing={isRefreshing}
    />
  );
}
