/** Verbindungs- und Gerätezustand der Antenne (Zustandsautomat von `AntennaPort`). */
export type AntennaState = 'disconnected' | 'unprovisioned' | 'locked' | 'unlocked';

/** Zustand des Geräts laut `sys.hello`/`sec.state` (ohne Verbindungszustand). */
export type DeviceState = 'unprovisioned' | 'locked' | 'unlocked';

/** Fehler der Antennen-Verbindung, die die Oberfläche anzeigt. */
export type AntennaErrorCode =
  | 'no-device'
  | 'permission-denied'
  | 'open-failed'
  | 'no-hello'
  | 'proto-mismatch'
  | 'lost'
  | 'unlock-failed'
  | 'rate-limited'
  | 'keystore-failed';

/** Grenzen, die das Gerät in `sys.hello` meldet. */
export interface DeviceLimits {
  /** Maximale Zeilenlänge in Bytes inklusive LF. */
  maxLine: number;
  maxContacts: number;
  /** Maximale Textgrösse einer Nachricht in UTF-8-Bytes. */
  maxTextBytes: number;
  /** Plätze in der Sendewarteschlange des Geräts. */
  pendingQueue: number;
}

/** Werte aus dem Vertrag, solange das Gerät noch keine Grenzen gemeldet hat. */
export const DEFAULT_LIMITS: DeviceLimits = {
  maxLine: 2048,
  maxContacts: 32,
  maxTextBytes: 83,
  pendingQueue: 8,
};

/** Gerätedaten aus `sys.hello`. */
export interface DeviceInfo {
  device: string;
  chip: string;
  /** 12 Hex-Zeichen (Basis-MAC), Grossbuchstaben. */
  deviceId: string;
  fwVersion: string;
  fwBuild: string;
  /** Protokollversion `major.minor`. */
  proto: string;
}
