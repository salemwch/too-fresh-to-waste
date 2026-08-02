import { Platform } from 'react-native';
import { trigger, HapticFeedbackTypes } from 'react-native-haptic-feedback';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const PRESETS = {
  light: Platform.OS === 'ios' ? HapticFeedbackTypes.impactLight : HapticFeedbackTypes.effectClick,
  medium:
    Platform.OS === 'ios' ? HapticFeedbackTypes.impactMedium : HapticFeedbackTypes.effectHeavyClick,
  success:
    Platform.OS === 'ios'
      ? HapticFeedbackTypes.notificationSuccess
      : HapticFeedbackTypes.effectClick,
  warning:
    Platform.OS === 'ios'
      ? HapticFeedbackTypes.notificationWarning
      : HapticFeedbackTypes.effectDoubleClick,
  error:
    Platform.OS === 'ios'
      ? HapticFeedbackTypes.notificationError
      : HapticFeedbackTypes.effectHeavyClick,
  selection: Platform.OS === 'ios' ? HapticFeedbackTypes.selection : HapticFeedbackTypes.effectTick,
} as const;

export type HapticPreset = keyof typeof PRESETS;

export function haptic(preset: HapticPreset = 'light'): void {
  trigger(PRESETS[preset], HAPTIC_OPTIONS);
}
