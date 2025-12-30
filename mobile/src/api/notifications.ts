import api from './client';

export type NotificationPreferences = {
  push: {
    enabled: boolean;
    appointments: {
      created: boolean;
      confirmed: boolean;
      cancelled: boolean;
      reminder: boolean;
    };
    marketplace: {
      request: boolean;
    };
    payments: {
      updated: boolean;
    };
    marketing: boolean;
  };
};

export type NotificationPreferencesPayload = {
  push?: {
    enabled?: boolean;
    appointments?: {
      created?: boolean;
      confirmed?: boolean;
      cancelled?: boolean;
      reminder?: boolean;
    };
    marketplace?: {
      request?: boolean;
    };
    payments?: {
      updated?: boolean;
    };
    marketing?: boolean;
  };
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<{ preferences: NotificationPreferences }>('/notifications/preferences');
  return data.preferences;
}

export async function updateNotificationPreferences(
  preferences: NotificationPreferencesPayload
): Promise<NotificationPreferences> {
  const { data } = await api.put<{ preferences: NotificationPreferences }>(
    '/notifications/preferences',
    { preferences }
  );
  return data.preferences;
}

export async function registerPushToken(payload: {
  pushToken: string;
  deviceId?: string | null;
  platform?: string | null;
}): Promise<void> {
  await api.post('/notifications/push/register', payload);
}

export async function unregisterPushToken(payload: {
  pushToken?: string | null;
  deviceId?: string | null;
}): Promise<void> {
  await api.post('/notifications/push/unregister', payload);
}
