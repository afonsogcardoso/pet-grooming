import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isIos = Platform.OS === 'ios';

export async function hapticSelection() {
  if (!isIos) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore if haptics are unavailable.
  }
}

export async function hapticLight() {
  if (!isIos) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore if haptics are unavailable.
  }
}

export async function hapticMedium() {
  if (!isIos) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Ignore if haptics are unavailable.
  }
}

export async function hapticSuccess() {
  if (!isIos) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore if haptics are unavailable.
  }
}

export async function hapticWarning() {
  if (!isIos) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore if haptics are unavailable.
  }
}

export async function hapticError() {
  if (!isIos) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore if haptics are unavailable.
  }
}
