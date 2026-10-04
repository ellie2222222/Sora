import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Android uses the haptics engine, not the vibrator, so the system touch-feedback setting applies and
 * no VIBRATE permission is needed. Best-effort: no haptics, or the web build, just feels nothing.
 */
function perform(android: Haptics.AndroidHaptics, ios: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  const run = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(android) : ios();
  run.catch(() => undefined);
}

/** A row's actions snapped open. */
export function hapticReveal(): void {
  perform(Haptics.AndroidHaptics.Gesture_End, () => Haptics.selectionAsync());
}

/** A non-destructive action was chosen. */
export function hapticTap(): void {
  perform(Haptics.AndroidHaptics.Context_Click, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A destructive action was chosen; its own confirmation still follows. */
export function hapticWarning(): void {
  perform(Haptics.AndroidHaptics.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
