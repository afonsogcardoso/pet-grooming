import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function resolveProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined
  );
}

export async function registerForPushNotifications(): Promise<{
  status: PushPermissionStatus;
  token: string | null;
}> {
  if (!Device.isDevice) {
    return { status: 'unavailable', token: null };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus: PushPermissionStatus = existingStatus as PushPermissionStatus;

  if (existingStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status as PushPermissionStatus;
  }

  if (finalStatus !== 'granted') {
    return { status: finalStatus, token: null };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const projectId = resolveProjectId();
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: finalStatus, token: tokenData.data };
}
