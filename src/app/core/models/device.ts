import type { DeviceLimits, DeviceInfo, DeviceState } from './antenna';

/** Beliebiger JSON-Wert (Zeile der Host-API). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

/** Fehlercodes des Geräts (Offgrid Host Interface v1, §9). */
export type DeviceErrorCode =
  | 'E_PARSE'
  | 'E_LINE_TOO_LONG'
  | 'E_UNKNOWN_CMD'
  | 'E_INVALID_ARG'
  | 'E_PROTO_MISMATCH'
  | 'E_LOCKED'
  | 'E_NOT_PROVISIONED'
  | 'E_ALREADY_PROVISIONED'
  | 'E_ALREADY_UNLOCKED'
  | 'E_NO_SESSION'
  | 'E_UNLOCK_FAILED'
  | 'E_RATE_LIMITED'
  | 'E_CONFIRM_REQUIRED'
  | 'E_NO_PAIRING'
  | 'E_INVALID_QR'
  | 'E_SELF_PAIR'
  | 'E_CONTACT_EXISTS'
  | 'E_NO_SUCH_CONTACT'
  | 'E_STORAGE_FULL'
  | 'E_TOO_LONG'
  | 'E_QUEUE_FULL'
  | 'E_BUSY'
  | 'E_RADIO'
  | 'E_INTERNAL';

/** Fehler, die nur in der App entstehen (nie vom Gerät gemeldet). */
export type LocalErrorCode = 'E_TIMEOUT' | 'E_DISCONNECTED' | 'E_INVALID_RESPONSE';

/** Alle Codes, die `DeviceError.code` annehmen kann. */
export type AnyErrorCode = DeviceErrorCode | LocalErrorCode;

/** Eine Sitzung für `sec.provision`/`sec.unlock`. Sie ist einmalig. */
export interface DeviceSession {
  /** Base64, 32 Byte X25519-Public-Key des Geräts. */
  deviceEphPub: string;
  /** Base64, 16 Byte. */
  nonce: string;
}

/** Ergebnis von `sys.hello`. */
export interface HelloResult {
  info: DeviceInfo;
  state: DeviceState;
  session: DeviceSession;
  limits: DeviceLimits;
}

/** Status einer gesendeten Nachricht laut `msg.status`. */
export type DeliveryState = 'queued' | 'sent' | 'relayed' | 'retrying' | 'delivered' | 'failed' | 'cancelled';

/** Grund, warum eine Nachricht fehlschlug. */
export type FailureReason = 'timeout' | 'locked' | 'contact_deleted' | 'radio_error';

/** Ziel einer Reaktion aus Sicht der eigenen App. */
export interface ReactionTarget {
  /** `me`: die Nachricht habe ich geschrieben. `peer`: der Kontakt hat sie geschrieben. */
  author: 'me' | 'peer';
  /** `ctr & 0xFFFF` der Ziel-Nachricht. */
  ref: number;
}

/** Ergebnis von `msg.send`. */
export interface SendResult {
  msgRef: number;
  ctr: number;
  ackRequested: boolean;
  hops: number;
  state: DeliveryState;
  bytesOnAir: number;
  estAirtimeMs: number;
}

/** Felder, die jede eingehende Nachricht hat. */
interface ReceivedBase {
  /** `contact_id` des Absenders. */
  from: number;
  ctr: number;
  hops: number;
  retry: number;
  rssi: number;
  snr: number;
}

export type ReceivedMessage =
  | (ReceivedBase & { type: 'text'; text: string })
  | (ReceivedBase & { type: 'reaction'; target: ReactionTarget; emoji: string | null })
  | (ReceivedBase & { type: 'geo'; lat: number; lon: number; altM: number | null; ageS: number | null });

/** Ereignis `msg.status`. */
export interface MessageStatusEvent {
  msgRef: number;
  to: number;
  state: DeliveryState;
  retry: number;
  reason: FailureReason | null;
}

/** Gründe von `sec.state`. */
export type SecStateReason = 'unlock' | 'provision' | 'lock' | 'heartbeat_timeout' | 'factory_reset';

/** Ereignisse des Geräts, die die App auswertet. Alle anderen (`log`, `rf.*`, `error`) werden ignoriert. */
export type DeviceEvent =
  | { evt: 'sys.boot'; t: number; deviceId: string; state: DeviceState; fw: string; proto: string; resetReason: string }
  | { evt: 'sec.state'; t: number; state: DeviceState; reason: SecStateReason }
  | { evt: 'msg.received'; t: number; message: ReceivedMessage }
  | { evt: 'msg.status'; t: number; status: MessageStatusEvent }
  | { evt: 'contact.state'; t: number; contactId: number; state: 'pending' | 'active' };

/** Ergebnis von `pair.begin`. */
export interface PairBeginResult {
  qr: string;
  qrBytes: number;
  expiresS: number;
}
