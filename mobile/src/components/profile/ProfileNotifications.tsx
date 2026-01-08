import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Switch from "../StyledSwitch";

type Props = {
  styles: any;
  colors: any;
  t: any;
  loadingNotifications: boolean;
  pushEnabled: boolean;
  notificationsDisabled: boolean;
  resolvedNotificationPreferences: any;
  reminderChipOptions: number[];
  reminderOffsets: number[];
  remindersDisabled: boolean;
  updatePreferences: (p: any) => void;
  handleToggleReminderOffset: (offset: number) => void;
  customReminderInput: string;
  setCustomReminderInput: (s: string) => void;
  handleAddCustomReminder: () => void;
  formatReminderOffsetLabel: (n: number) => string;
};

export default function ProfileNotifications({
  styles,
  colors,
  t,
  loadingNotifications,
  pushEnabled,
  notificationsDisabled,
  resolvedNotificationPreferences,
  reminderChipOptions,
  reminderOffsets,
  remindersDisabled,
  updatePreferences,
  handleToggleReminderOffset,
  customReminderInput,
  setCustomReminderInput,
  handleAddCustomReminder,
  formatReminderOffsetLabel,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("profile.notificationsTitle")}</Text>
      {loadingNotifications ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsPush")}
          </Text>
          <Text style={styles.toggleHelper}>
            {t("profile.notificationsPushHelper")}
          </Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={(v) => updatePreferences({ push: { enabled: v } })}
          disabled={notificationsDisabled}
          ios_backgroundColor={colors.surface}
        />
      </View>

      <View style={styles.toggleGroup}>
        <Text style={styles.toggleGroupLabel}>
          {t("profile.notificationsAppointments")}
        </Text>
        {/* Created */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsAppointmentsCreated")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.appointments.created}
            onValueChange={(value) =>
              updatePreferences({ push: { appointments: { created: value } } })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>
        {/* Confirmed */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsAppointmentsConfirmed")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.appointments.confirmed}
            onValueChange={(value) =>
              updatePreferences({
                push: { appointments: { confirmed: value } },
              })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>
        {/* Cancelled */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsAppointmentsCancelled")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.appointments.cancelled}
            onValueChange={(value) =>
              updatePreferences({
                push: { appointments: { cancelled: value } },
              })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>
        {/* Reminder */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsAppointmentsReminder")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.appointments.reminder}
            onValueChange={(value) =>
              updatePreferences({ push: { appointments: { reminder: value } } })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>

        <View style={styles.reminderGroup}>
          <Text style={styles.reminderTitle}>
            {t("profile.notificationsRemindersTitle")}
          </Text>
          <Text style={styles.reminderHelper}>
            {t("profile.notificationsRemindersHelper")}
          </Text>
          <View style={styles.reminderChipsRow}>
            {reminderChipOptions.map((offset) => {
              const isActive = reminderOffsets.includes(offset);
              return (
                <TouchableOpacity
                  key={`preset-${offset}`}
                  style={[
                    styles.reminderChip,
                    isActive && styles.reminderChipActive,
                    remindersDisabled && styles.reminderChipDisabled,
                  ]}
                  onPress={() => handleToggleReminderOffset(offset)}
                  disabled={remindersDisabled}
                >
                  <Text
                    style={[
                      styles.reminderChipText,
                      isActive && styles.reminderChipTextActive,
                      remindersDisabled && styles.reminderChipTextDisabled,
                    ]}
                  >
                    {formatReminderOffsetLabel(offset)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.reminderCustomRow}>
            <TextInput
              value={customReminderInput}
              onChangeText={setCustomReminderInput}
              placeholder={t("profile.notificationsRemindersCustomPlaceholder")}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              editable={!remindersDisabled}
              style={[
                styles.reminderInput,
                remindersDisabled && styles.reminderInputDisabled,
              ]}
            />
            <TouchableOpacity
              style={[
                styles.reminderAddButton,
                remindersDisabled && styles.reminderAddButtonDisabled,
              ]}
              onPress={handleAddCustomReminder}
              disabled={remindersDisabled}
            >
              <Text style={styles.reminderAddButtonText}>
                {t("profile.notificationsRemindersAdd")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.toggleGroup}>
        <Text style={styles.toggleGroupLabel}>
          {t("profile.notificationsMarketplace")}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsMarketplaceRequests")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.marketplace.request}
            onValueChange={(value) =>
              updatePreferences({ push: { marketplace: { request: value } } })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>
      </View>

      <View style={styles.toggleGroup}>
        <Text style={styles.toggleGroupLabel}>
          {t("profile.notificationsPayments")}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsPaymentsUpdated")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.payments.updated}
            onValueChange={(value) =>
              updatePreferences({ push: { payments: { updated: value } } })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>
      </View>

      <View style={styles.toggleGroup}>
        <Text style={styles.toggleGroupLabel}>
          {t("profile.notificationsMarketing")}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            {t("profile.notificationsMarketing")}
          </Text>
          <Switch
            value={resolvedNotificationPreferences.push.marketing}
            onValueChange={(value) =>
              updatePreferences({ push: { marketing: value } })
            }
            disabled={!pushEnabled || notificationsDisabled}
            ios_backgroundColor={colors.surface}
          />
        </View>
      </View>
    </View>
  );
}
