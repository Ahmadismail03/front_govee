import { Vibration } from 'react-native';

export function triggerTapHaptic() {
  Vibration.vibrate(10);
}

export function triggerSuccessHaptic() {
  Vibration.vibrate([0, 20, 35, 20]);
}

