import { Capacitor } from '@capacitor/core';

// Statusleistenfarbe entspricht dem dunklen Seitenhintergrund.
export const STATUS_BAR_COLOR = '#0F1115';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
