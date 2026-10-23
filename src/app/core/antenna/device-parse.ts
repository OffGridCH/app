import type { DeviceInfo, DeviceState } from '../models/antenna';
import type { Contact } from '../models/contact';
import type {
  DeliveryState,
  DeviceEvent,
  FailureReason,
  HelloResult,
  JsonObject,
  JsonValue,
  PairBeginResult,
  ReactionTarget,
  ReceivedMessage,
  SecStateReason,
  SendResult,
} from '../models/device';
import { DeviceError } from './device-error';
import type { RawEvent } from './serial-client';

/** Ergebnisse und Ereignisse des Geräts kommen als JSON; diese Funktionen prüfen sie und geben Typen zurück. */

const DEVICE_STATES: readonly string[] = ['unprovisioned', 'locked', 'unlocked'];
const DELIVERY_STATES: readonly string[] = ['queued', 'sent', 'relayed', 'retrying', 'delivered', 'failed', 'cancelled'];
const FAILURE_REASONS: readonly string[] = ['timeout', 'locked', 'contact_deleted', 'radio_error'];
const SEC_REASONS: readonly string[] = ['unlock', 'provision', 'lock', 'heartbeat_timeout', 'factory_reset'];

function invalid(field: string): DeviceError {
  return new DeviceError('E_INVALID_RESPONSE', `Antwort des Geräts ist ungültig: ${field}`, field);
}

export function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(source: JsonObject, key: string): string {
  const value = source[key];
  if (typeof value !== 'string') {
    throw invalid(key);
  }
  return value;
}

function nullableText(source: JsonObject, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' ? value : null;
}

function numberOf(source: JsonObject, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(key);
  }
  return value;
}

function nullableNumber(source: JsonObject, key: string): number | null {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function flag(source: JsonObject, key: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') {
    throw invalid(key);
  }
  return value;
}

function child(source: JsonObject, key: string): JsonObject {
  const value = source[key];
  if (!isObject(value)) {
    throw invalid(key);
  }
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly string[], key: string): T {
  if (!allowed.includes(value)) {
    throw invalid(key);
  }
  return value as T;
}

/** Zustand des Geräts (`unprovisioned`, `locked`, `unlocked`). */
export function parseDeviceState(value: string): DeviceState {
  return oneOf<DeviceState>(value, DEVICE_STATES, 'state');
}

/** `sys.hello`. */
export function parseHello(result: JsonObject): HelloResult {
  const fw = child(result, 'fw');
  const session = child(result, 'session');
  const limits = child(result, 'limits');
  const info: DeviceInfo = {
    device: text(result, 'device'),
    chip: text(result, 'chip'),
    deviceId: text(result, 'device_id'),
    fwVersion: text(fw, 'version'),
    fwBuild: text(fw, 'build'),
    proto: text(result, 'proto'),
  };
  return {
    info,
    state: parseDeviceState(text(result, 'state')),
    session: { deviceEphPub: text(session, 'device_eph_pub'), nonce: text(session, 'nonce') },
    limits: {
      maxLine: numberOf(limits, 'max_line'),
      maxContacts: numberOf(limits, 'max_contacts'),
      maxTextBytes: numberOf(limits, 'max_text_bytes'),
      pendingQueue: numberOf(limits, 'pending_queue'),
    },
  };
}

/** Ein Kontakt-Objekt (`pair.complete`, `contact.get`, `contact.list`). */
export function parseContact(value: JsonValue | undefined): Contact {
  if (!isObject(value)) {
    throw invalid('contact');
  }
  return {
    contactId: numberOf(value, 'contact_id'),
    name: text(value, 'name'),
    nodeId: text(value, 'node_id'),
    publicKey: text(value, 'public_key'),
    state: oneOf<Contact['state']>(text(value, 'state'), ['pending', 'active'], 'state'),
    fingerprint: text(value, 'fingerprint'),
    lastRssi: nullableNumber(value, 'last_rssi'),
    lastSnr: nullableNumber(value, 'last_snr'),
    txCtr: numberOf(value, 'tx_ctr'),
    rxHighestCtr: nullableNumber(value, 'rx_highest_ctr'),
  };
}

/** `contact.list`. */
export function parseContactList(result: JsonObject): { total: number; contacts: Contact[] } {
  const list = result['contacts'];
  if (!Array.isArray(list)) {
    throw invalid('contacts');
  }
  return { total: numberOf(result, 'total'), contacts: list.map((entry) => parseContact(entry)) };
}

/** `msg.send`. */
export function parseSendResult(result: JsonObject): SendResult {
  return {
    msgRef: numberOf(result, 'msg_ref'),
    ctr: numberOf(result, 'ctr'),
    ackRequested: flag(result, 'ack_requested'),
    hops: numberOf(result, 'hops'),
    state: oneOf<DeliveryState>(text(result, 'state'), DELIVERY_STATES, 'state'),
    bytesOnAir: numberOf(result, 'bytes_on_air'),
    estAirtimeMs: numberOf(result, 'est_airtime_ms'),
  };
}

/** `pair.begin`. */
export function parsePairBegin(result: JsonObject): PairBeginResult {
  return { qr: text(result, 'qr'), qrBytes: numberOf(result, 'qr_bytes'), expiresS: numberOf(result, 'expires_s') };
}

function parseTarget(source: JsonObject): ReactionTarget {
  const target = child(source, 'target');
  return {
    author: oneOf<ReactionTarget['author']>(text(target, 'author'), ['me', 'peer'], 'target.author'),
    ref: numberOf(target, 'ref'),
  };
}

function parseReceived(data: JsonObject): ReceivedMessage {
  const base = {
    from: numberOf(data, 'from'),
    ctr: numberOf(data, 'ctr'),
    hops: nullableNumber(data, 'hops') ?? 0,
    retry: nullableNumber(data, 'retry') ?? 0,
    rssi: numberOf(data, 'rssi'),
    snr: numberOf(data, 'snr'),
  };
  const type = text(data, 'type');
  switch (type) {
    case 'text':
      return { ...base, type: 'text', text: text(data, 'text') };
    case 'reaction':
      return { ...base, type: 'reaction', target: parseTarget(data), emoji: nullableText(data, 'emoji') };
    case 'geo':
      return {
        ...base,
        type: 'geo',
        lat: numberOf(data, 'lat'),
        lon: numberOf(data, 'lon'),
        altM: nullableNumber(data, 'alt_m'),
        ageS: nullableNumber(data, 'age_s'),
      };
    default:
      throw invalid('type');
  }
}

/**
 * Macht aus einem Ereignis des Geräts ein typisiertes Ereignis.
 *
 * Ereignisse, die die App nicht auswertet (`log`, `rf.tx`, `rf.rx`, `error`), und kaputte Ereignisse ergeben `null`.
 */
export function parseEvent(raw: RawEvent): DeviceEvent | null {
  const { evt, t, data } = raw;
  try {
    switch (evt) {
      case 'sys.boot':
        return {
          evt,
          t,
          deviceId: text(data, 'device_id'),
          state: parseDeviceState(text(data, 'state')),
          fw: text(data, 'fw'),
          proto: text(data, 'proto'),
          resetReason: nullableText(data, 'reset_reason') ?? '',
        };
      case 'sec.state':
        return {
          evt,
          t,
          state: parseDeviceState(text(data, 'state')),
          reason: oneOf<SecStateReason>(text(data, 'reason'), SEC_REASONS, 'reason'),
        };
      case 'msg.received':
        return { evt, t, message: parseReceived(data) };
      case 'msg.status': {
        const reason = nullableText(data, 'reason');
        return {
          evt,
          t,
          status: {
            msgRef: numberOf(data, 'msg_ref'),
            to: numberOf(data, 'to'),
            state: oneOf<DeliveryState>(text(data, 'state'), DELIVERY_STATES, 'state'),
            retry: nullableNumber(data, 'retry') ?? 0,
            reason: reason !== null && FAILURE_REASONS.includes(reason) ? (reason as FailureReason) : null,
          },
        };
      }
      case 'contact.state':
        return {
          evt,
          t,
          contactId: numberOf(data, 'contact_id'),
          state: oneOf<'pending' | 'active'>(text(data, 'state'), ['pending', 'active'], 'state'),
        };
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof DeviceError) {
      return null;
    }
    throw error;
  }
}
