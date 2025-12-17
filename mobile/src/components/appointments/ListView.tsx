import React from 'react';
import { View, Text, TouchableOpacity, SectionList, Image, StyleSheet, Linking, Platform } from 'react-native';
import SwipeableRow from '../common/SwipeableRow';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useBrandingTheme } from '../../theme/useBrandingTheme';

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
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hh, mm] = match;
    return `${hh.padStart(2, '0')}:${mm}`;
  }
  return value;
}

function formatDateLabel(value?: string | null) {
  if (!value) return 'Sem data';
  try {
    return new Date(value + 'T00:00:00').toLocaleDateString('pt-PT', {
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
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayLocalISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export function ListView({ 
  appointments, 
  filterMode,
  onAppointmentPress,
  onNewAppointment,
  onRefresh,
  isRefreshing,
}: ListViewProps) {
  const { colors } = useBrandingTheme();
  const today = todayLocalISO();

  // Group appointments by day
  const sections = React.useMemo(() => {
    const source =
      filterMode === 'unpaid'
        ? appointments.filter((a) => (a.payment_status || 'unpaid') !== 'paid')
        : appointments;

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
      const titleLabel = dayKey === todayKey ? 'Hoje' : formatDateLabel(dayKey);
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
  }, [appointments, filterMode, today]);

  const PaymentPill = ({ label }: { label: string }) => {
    const paid = label === 'paid';
    const color = paid ? colors.success : colors.warning;
    return (
      <View style={[styles.pill, { backgroundColor: color + '33', borderColor: color }]}>
        <Text style={[styles.pillText, { color }]}>{paid ? '✓ Pago' : '⏱ Por pagar'}</Text>
      </View>
    );
  };

  const StatusPill = ({ status }: { status?: string | null }) => {
    const color = getStatusColor(status);
    const label = getStatusLabel(status);
    return (
      <View style={[styles.pill, { backgroundColor: color + '20', borderColor: color }]}>
        <Text style={[styles.pillText, { color }]}>{label}</Text>
      </View>
    );
  };

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
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
  });

  const renderAppointmentItem = ({ item }: { item: Appointment }) => {
    const petInitial = item.pets?.name?.charAt(0)?.toUpperCase() || '🐾';
    const price = item.services?.price;
    const address = item.customers?.address;
    const phone = item.customers?.phone;

    return (
      <SwipeableRow onDelete={() => {
        // call a deletion handler passed via onRefresh convention: trigger delete through parent via global event
        // We'll emit a custom event on window for parent to handle if provided (parent should pass onDelete prop in future)
        // For now, attempt to call global function if present
        try {
          if ((global as any).onDeleteAppointment) {
            (global as any).onDeleteAppointment(item.id);
          }
        } catch (err) {
          // ignore
        }
      }}>
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
                {item.appointment_services && item.appointment_services.length > 0
                  ? item.appointment_services.map(as => as.services.name).join(', ')
                  : (item.services?.name || 'Serviço')}
              </Text>
              <Text style={styles.meta}>
                {item.customers?.name} • {item.pets?.name}
              </Text>
              {price !== undefined && price !== null ? (
                <Text style={styles.meta}>€ {Number(price).toFixed(2)}</Text>
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
                        const customerName = item.customers?.name || '';
                        const message = `Olá ${customerName}! Em relação ao agendamento...`;
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
          <StatusPill status={item.status} />
          {item.payment_status ? <PaymentPill label={item.payment_status} /> : null}
        </View>
      </TouchableOpacity>
    </SwipeableRow>
    );
  };

  const renderSectionHeader = ({ section }: { section: typeof sections[0] }) => {
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
  };

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderAppointmentItem}
      renderSectionHeader={renderSectionHeader}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
      SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Nenhuma marcação</Text>
          <Text style={styles.emptySubtext}>Não há agendamentos neste período</Text>
        </View>
      }
      onRefresh={onRefresh}
      refreshing={isRefreshing}
    />
  );
}
