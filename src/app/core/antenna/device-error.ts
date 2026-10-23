import type { AnyErrorCode, DeviceErrorCode } from '../models/device';

const DEVICE_ERROR_CODES: readonly DeviceErrorCode[] = [
  'E_PARSE',
  'E_LINE_TOO_LONG',
  'E_UNKNOWN_CMD',
  'E_INVALID_ARG',
  'E_PROTO_MISMATCH',
  'E_LOCKED',
  'E_NOT_PROVISIONED',
  'E_ALREADY_PROVISIONED',
  'E_ALREADY_UNLOCKED',
  'E_NO_SESSION',
  'E_UNLOCK_FAILED',
  'E_RATE_LIMITED',
  'E_CONFIRM_REQUIRED',
  'E_NO_PAIRING',
  'E_INVALID_QR',
  'E_SELF_PAIR',
  'E_CONTACT_EXISTS',
  'E_NO_SUCH_CONTACT',
  'E_STORAGE_FULL',
  'E_TOO_LONG',
  'E_QUEUE_FULL',
  'E_BUSY',
  'E_RADIO',
  'E_INTERNAL',
];

/** Ist der Text ein Fehlercode aus dem Vertrag? */
export function isDeviceErrorCode(value: unknown): value is DeviceErrorCode {
  return typeof value === 'string' && (DEVICE_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Fehler einer Anfrage an das Gerät.
 *
 * `code` ist stabil und maschinenlesbar. `message` ist nur für Logs gedacht und wird nie ausgewertet.
 */
export class DeviceError extends Error {
  constructor(
    readonly code: AnyErrorCode,
    message: string,
    /** Das fehlerhafte Argument, falls das Gerät eines nennt. */
    readonly field: string | null = null,
  ) {
    super(message);
    this.name = 'DeviceError';
  }
}
