import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isIos = Platform.OS === 'ios';

export async function hapticSelection() {
  if (!isIos) return;
  try {
    await Haptics.selectionAsync();
  } catch {
  }
}

export async function hapticLight() {
  if (!isIos) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
  }
}

export async function hapticMedium() {
  if (!isIos) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
  }
}

export async function hapticSuccess() {
  if (!isIos) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
  }
}

export async function hapticWarning() {
  if (!isIos) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
  }
}

export async function hapticError() {
  if (!isIos) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
  }
}
