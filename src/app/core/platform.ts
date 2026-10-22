import { Capacitor } from '@capacitor/core';

/** true, wenn die App nativ auf Android läuft, false im Browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Hintergrundfarbe der Statusleiste, identisch mit dem Token --og-bg. */
export const STATUS_BAR_COLOR = '#0F1115';
