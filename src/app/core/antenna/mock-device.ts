import { fromBase64, toBase64 } from '../crypto/base64';
import { toHex } from '../crypto/hex';
import { bufferOf, concat, randomBytes, utf8 } from '../keystore/bytes';
import { unwrapToken } from '../keystore/unlock-wrap';
import { x25519PublicKey } from '../keystore/x25519';
import { splitText } from '../messaging/limits';
import type { DeviceState } from '../models/antenna';
import type { DeviceErrorCode, FailureReason, JsonObject, JsonValue } from '../models/device';
import { isObject } from './device-parse';
import { REACTION_EMOJIS } from '../messaging/reactions';

/**
 * Simuliertes Gerät (Heltec V3) für den Browser und für Tests.
 *
 * Es spricht dieselbe Host-API v1 wie das echte Gerät (Offgrid Host Interface v1): JSON Lines, Anfragen mit `id`,
 * genau eine Antwort pro Anfrage und Ereignisse ohne Antwort. Es prüft das Entsperr-Token wirklich
 * (X25519, HKDF und AES-GCM wie auf dem Gerät), kennt die Zustände `unprovisioned`, `locked` und `unlocked`
 * und sperrt sich nach 15 s ohne Heartbeat selbst.
 *
 * Es ist **kein** sicherer Tresor und funkt nicht: Nachrichten bekommen nach kurzer Zeit den Status
 * `sent`, `relayed` und `delivered`; das Gegenüber ist erfunden.
 */

/** Ein Kontakt in der Form der Host-API. */
export interface MockContact {
  contact_id: number;
  name: string;
  node_id: string;
  public_key: string;
  state: 'pending' | 'active';
  fingerprint: string;
  tx_ctr: number;
  rx_highest_ctr: number | null;
  last_rssi: number | null;
  last_snr: number | null;
}

/** Zeiten der Simulation in Millisekunden. */
export interface MockTiming {
  /** Von `queued` bis `sent`. */
  sent: number;
  /** Von `queued` bis `relayed`. */
  relayed: number;
  /** Von `queued` bis `delivered` (oder `failed`). */
  delivered: number;
  /** Von `pair.complete` bis der Kontakt `active` wird (das Gegenüber „antwortet“). */
  contactActive: number;
  /** Auto-Lock ohne gültige Zeile von der App. 0 schaltet ihn aus. */
  lockTimeout: number;
}

export interface MockDeviceOptions {
  deviceId: string;
  /** Anfangszustand nach dem Start. `locked` und `unlocked` brauchen `identityName`. */
  state: DeviceState;
  /** Name der Identität eines schon eingerichteten Geräts. */
  identityName: string | null;
  /** Kontakte eines schon eingerichteten Geräts. */
  contacts: MockContact[];
  /**
   * Demo: Das gesperrte Gerät nimmt das erste Token an, das es sieht, und behält es.
   * So lässt sich der Browser-Demo-Zustand entsperren, ohne dass der Schlüssel dem Mock bekannt ist.
   */
  adoptFirstToken: boolean;
  timing: MockTiming;
}

export const DEFAULT_MOCK_TIMING: MockTiming = {
  sent: 300,
  relayed: 700,
  delivered: 1500,
  contactActive: 3000,
  lockTimeout: 15000,
};

const DEFAULT_OPTIONS: MockDeviceOptions = {
  deviceId: '7CDFA100ABCD',
  state: 'unprovisioned',
  identityName: null,
  contacts: [],
  adoptFirstToken: false,
  timing: DEFAULT_MOCK_TIMING,
};

const MAX_LINE = 2048;
const MAX_CONTACTS = 32;
const MAX_TEXT_BYTES = 83;
const PENDING_QUEUE = 8;
const MAX_NAME_BYTES = 24;
const PAIRING_EXPIRES_S = 300;
const LIST_PAGE = 10;
const QR_MAGIC = 'OG1';

type RadioConfig = {
  freq_mhz: number;
  bw_khz: number;
  sf: number;
  cr: number;
  tx_power_dbm: number;
  preamble: number;
  sync_word: number;
};

type MeshConfig = {
  hop_default: number;
  relay_enabled: boolean;
  relay_when_locked: boolean;
  cad_enabled: boolean;
  backoff_slots: number;
  retries: number;
  retry_base_ms: number;
  rate_limit_per_src: number;
  ack_default: { text: boolean; reaction: boolean; geo: boolean };
};

const RADIO_PRESETS: Record<string, Partial<RadioConfig>> = {
  lab_default: { freq_mhz: 869.525, bw_khz: 125, sf: 9, cr: 5, tx_power_dbm: 14 },
  fast: { sf: 7, bw_khz: 250 },
  long_range: { sf: 11, bw_khz: 125 },
};

const BUILTIN_PATTERNS = ['off', 'on', 'flash', 'blink_slow', 'blink_fast', 'double', 'heartbeat', 'pulse'];
const LED_STATES = ['unprovisioned', 'locked', 'unlocked'];
const LED_EVENTS = ['tx', 'rx', 'msg_received', 'delivered', 'failed', 'error', 'pairing'];

/** Airtime in Millisekunden nach der LoRa-Formel (explizite Kopfzeile, CRC an). Für 23 Byte bei SF9/BW125: 206 ms. */
export function loraAirtimeMs(bytes: number, radio: Pick<RadioConfig, 'sf' | 'bw_khz' | 'cr' | 'preamble'>): number {
  const symbolMs = 2 ** radio.sf / (radio.bw_khz * 1000) * 1000;
  const lowDataRate = symbolMs > 16 ? 1 : 0;
  const payloadSymbols =
    8 +
    Math.max(
      Math.ceil((8 * bytes - 4 * radio.sf + 28 + 16) / (4 * (radio.sf - 2 * lowDataRate))) * radio.cr,
      0,
    );
  return Math.round((radio.preamble + 4.25 + payloadSymbols) * symbolMs);
}

/** Fehler, den das Gerät als `{"ok":false,"error":…}` meldet. */
class MockFailure extends Error {
  constructor(
    readonly code: DeviceErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

interface MockSession {
  secret: Uint8Array;
  nonce: Uint8Array;
  publicKey: Uint8Array;
}

interface MockIdentity {
  name: string;
  publicKey: Uint8Array;
  nodeId: string;
}

interface MockPending {
  msgRef: number;
  to: number;
  type: string;
  ctr: number;
  ack: boolean;
  timers: ReturnType<typeof setTimeout>[];
}

/** Fingerabdruck zweier öffentlicher Schlüssel: `SHA256("og1-fp" || pub_low || pub_high)`, drei Vierergruppen. */
export async function fingerprintOf(first: Uint8Array, second: Uint8Array): Promise<string> {
  const [low, high] = compareBytes(first, second) <= 0 ? [first, second] : [second, first];
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bufferOf(concat(utf8('og1-fp'), low, high))));
  let value = 0n;
  for (const byte of digest.slice(0, 8)) {
    value = (value << 8n) | BigInt(byte);
  }
  const digits = (value % 1_000_000_000_000n).toString().padStart(12, '0');
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
}

/** `node_id = SHA256(public_key)[0:2]` als 4 Hex-Zeichen in Grossbuchstaben. */
export async function nodeIdOf(publicKey: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bufferOf(publicKey)));
  return toHex(digest.slice(0, 2)).toUpperCase();
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && compareBytes(a, b) === 0;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byteLength(text: string): number {
  return utf8(text).length;
}

/** Zahl aus einem Argument; `required` entscheidet, ob es fehlen darf. */
function numberArg(
  args: JsonObject,
  key: string,
  limits: { min: number; max: number; integer?: boolean },
): number | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < limits.min || value > limits.max) {
    throw new MockFailure('E_INVALID_ARG', `${key} is out of range`, key);
  }
  if (limits.integer === true && !Number.isInteger(value)) {
    throw new MockFailure('E_INVALID_ARG', `${key} must be an integer`, key);
  }
  return value;
}

function requiredInteger(args: JsonObject, key: string, min: number, max: number): number {
  const value = numberArg(args, key, { min, max, integer: true });
  if (value === undefined) {
    throw new MockFailure('E_INVALID_ARG', `${key} is required`, key);
  }
  return value;
}

function booleanArg(args: JsonObject, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new MockFailure('E_INVALID_ARG', `${key} must be a boolean`, key);
  }
  return value;
}

function nameArg(args: JsonObject, key: string, required: boolean): string | undefined {
  const value = args[key];
  if (value === undefined && !required) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0 || byteLength(value) > MAX_NAME_BYTES) {
    throw new MockFailure('E_INVALID_ARG', `${key} must be 1 to ${MAX_NAME_BYTES} bytes`, key);
  }
  return value;
}

function base64Arg(args: JsonObject, key: string, bytes: number): Uint8Array {
  const value = args[key];
  if (typeof value !== 'string') {
    throw new MockFailure('E_INVALID_ARG', `${key} is required`, key);
  }
  try {
    const decoded = fromBase64(value);
    if (decoded.length === bytes) {
      return decoded;
    }
  } catch {
    // fällt unten in denselben Fehler
  }
  throw new MockFailure('E_INVALID_ARG', `${key} must be ${bytes} bytes of Base64`, key);
}

export class MockDevice {
  private readonly options: MockDeviceOptions;
  private readonly startedAt = Date.now();
  private readonly contacts = new Map<number, MockContact>();
  private readonly pending = new Map<number, MockPending>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private queue: Promise<void> = Promise.resolve();
  /** Ereignisse, die erst nach der Antwort auf die laufende Anfrage gesendet werden dürfen. */
  private readonly afterResponse: (() => void)[] = [];

  private state: DeviceState;
  private identity: MockIdentity | null = null;
  private vaultToken: Uint8Array | null = null;
  private session: MockSession | null = null;
  private failures = 0;
  private blockedUntil = 0;
  private nextMsgRef = 1;
  private pairing: { salt: Uint8Array; expiresAt: number } | null = null;
  private failNextReason: FailureReason | null = null;
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** Nur ein Gerät mit offener Leitung spricht. */
  private online = false;

  private radio: RadioConfig = {
    freq_mhz: 869.525,
    bw_khz: 125,
    sf: 9,
    cr: 5,
    tx_power_dbm: 14,
    preamble: 8,
    sync_word: 79,
  };
  private mesh: MeshConfig = {
    hop_default: 3,
    relay_enabled: true,
    relay_when_locked: false,
    cad_enabled: true,
    backoff_slots: 8,
    retries: 3,
    retry_base_ms: 0,
    rate_limit_per_src: 20,
    ack_default: { text: true, reaction: false, geo: false },
  };
  private led: JsonObject = {
    enabled: true,
    quiet: false,
    brightness: 128,
    state_patterns: { unprovisioned: 'pulse', locked: 'blink_slow', unlocked: 'off' },
    event_patterns: {
      tx: 'flash',
      rx: 'flash',
      msg_received: 'double',
      delivered: 'off',
      failed: { steps: [100, 100], repeat: 3 },
      error: 'blink_fast',
      pairing: 'heartbeat',
    },
  };

  /**
   * @param emit nimmt jede Zeile des Geräts entgegen (inklusive abschliessendem LF)
   */
  constructor(
    private readonly emit: (line: string) => void,
    options: Partial<MockDeviceOptions> = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options, timing: { ...DEFAULT_MOCK_TIMING, ...options.timing } };
    this.state = this.options.state;
    for (const contact of this.options.contacts) {
      this.contacts.set(contact.contact_id, { ...contact });
    }
  }

  /** Das Gerät „bootet“: ein leeres LF (halbe Zeile beim Anschliessen) und `sys.boot`. */
  start(): void {
    this.online = true;
    this.write('\n');
    this.emitBoot('power_on');
  }

  /** Nimmt eine Zeile der App entgegen. Anfragen werden strikt in der Reihenfolge des Eingangs bearbeitet. */
  receiveLine(line: string): void {
    this.queue = this.queue.then(() => this.processLine(line)).catch(() => undefined);
  }

  /** Stoppt alle Zeitgeber. Danach antwortet das Gerät nicht mehr. */
  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    if (this.lockTimer !== null) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  /**
   * Die Leitung wird getrennt (Kabel gezogen). Das Gerät verliert den Strom: Zeitgeber, Warteschlange
   * und Sitzung sind weg, Tresor und Kontakte bleiben. Der nächste `start()` bootet gesperrt.
   */
  detach(): void {
    this.online = false;
    this.resetRuntime();
  }

  /** Neustart: die Warteschlange ist weg, das Gerät ist wieder gesperrt (oder unprovisioniert). */
  reboot(reason = 'software'): void {
    this.resetRuntime();
    this.emitBoot(reason);
  }

  private resetRuntime(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pending.clear();
    this.session = null;
    this.pairing = null;
    this.queue = Promise.resolve();
    if (this.lockTimer !== null) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    this.state = this.identity === null && this.options.identityName === null ? 'unprovisioned' : 'locked';
  }

  /** Hook: der nächste `msg.send` schlägt mit diesem Grund fehl. */
  failNext(reason: FailureReason = 'timeout'): void {
    this.failNextReason = reason;
  }

  /** Hook: sperrt das Gerät, als hätte die App zu lange nichts gesagt. */
  lockNow(reason: 'heartbeat_timeout' | 'lock' = 'heartbeat_timeout'): void {
    this.lock(reason);
  }

  /** Hook: ein Kontakt schreibt einen Text. Mit `ctr` lässt sich eine Wiederholung nachstellen. */
  injectText(from: number, text: string, ctr?: number): void {
    this.inject(from, { type: 'text', text }, ctr);
  }

  /** Hook: ein Kontakt reagiert. `emoji = null` nimmt die Reaktion zurück. */
  injectReaction(from: number, target: { author: 'me' | 'peer'; ref: number }, emoji: string | null): void {
    this.inject(from, { type: 'reaction', target, emoji });
  }

  /** Hook: ein Kontakt teilt seinen Standort. */
  injectGeo(from: number, lat: number, lon: number): void {
    this.inject(from, { type: 'geo', lat, lon, alt_m: null, age_s: null });
  }

  private inject(from: number, body: JsonObject, forcedCtr?: number): void {
    const contact = this.contacts.get(from);
    if (this.disposed || this.state !== 'unlocked' || !contact) {
      return;
    }
    const ctr = forcedCtr ?? ((contact.rx_highest_ctr ?? 0) + 1) % 0x1000000;
    contact.rx_highest_ctr = Math.max(contact.rx_highest_ctr ?? 0, ctr);
    contact.last_rssi = -92;
    contact.last_snr = 7.5;
    this.event('msg.received', { from, ctr, ...body, hops: 1, retry: 0, rssi: -92, snr: 7.5 });
    this.activate(contact);
  }

  private activate(contact: MockContact): void {
    if (contact.state === 'pending') {
      contact.state = 'active';
      this.event('contact.state', { contact_id: contact.contact_id, state: 'active' });
    }
  }

  private async processLine(rawLine: string): Promise<void> {
    if (this.disposed || !this.online) {
      return;
    }
    const line = rawLine.endsWith('\n') ? rawLine.slice(0, -1) : rawLine;
    const text = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (byteLength(text) + 1 > MAX_LINE) {
      this.event('error', { code: 'E_LINE_TOO_LONG', message: `line exceeded ${MAX_LINE} bytes and was dropped` });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.respondFailure(undefined, new MockFailure('E_PARSE', 'line is not valid JSON'));
      return;
    }
    if (!isJsonObject(parsed) || typeof parsed['cmd'] !== 'string') {
      this.respondFailure(undefined, new MockFailure('E_PARSE', 'request needs id and cmd'));
      return;
    }
    const body = parsed;
    const id = body['id'];
    if (typeof id !== 'number') {
      this.respondFailure(undefined, new MockFailure('E_INVALID_ARG', 'id must be an integer', 'id'));
      return;
    }
    const args = isObject(body['args']) ? body['args'] : {};
    this.touch();
    try {
      const result = await this.execute(String(body['cmd']), args);
      this.write(`${JSON.stringify({ id, ok: true, result })}\n`);
      this.flushAfterResponse();
      this.afterCommand(String(body['cmd']));
    } catch (error) {
      this.afterResponse.length = 0;
      if (error instanceof MockFailure) {
        this.respondFailure(id, error);
      } else {
        this.respondFailure(id, new MockFailure('E_INTERNAL', 'unexpected firmware error'));
      }
    }
  }

  /** Aktionen, die nach der Antwort passieren (Ereignisse, Neustart). */
  private afterCommand(cmd: string): void {
    if (cmd === 'sys.reboot') {
      this.setTimer(() => this.reboot('software'), 50);
    }
  }

  private flushAfterResponse(): void {
    for (const action of this.afterResponse.splice(0)) {
      action();
    }
  }

  private respondFailure(id: number | undefined, failure: MockFailure): void {
    const error: JsonObject = { code: failure.code, message: failure.message };
    if (failure.field !== undefined) {
      error['field'] = failure.field;
    }
    this.write(`${JSON.stringify(id === undefined ? { ok: false, error } : { id, ok: false, error })}\n`);
  }

  private write(line: string): void {
    if (this.online && !this.disposed) {
      this.emit(line);
    }
  }

  private uptime(): number {
    return Date.now() - this.startedAt;
  }

  private event(evt: string, data: JsonObject): void {
    this.write(`${JSON.stringify({ evt, t: this.uptime(), data })}\n`);
  }

  private emitBoot(resetReason: string): void {
    this.event('sys.boot', {
      device_id: this.options.deviceId,
      fw: '0.1.0',
      proto: '1.0',
      state: this.state,
      reset_reason: resetReason,
    });
  }

  private setTimer(action: () => void, delay: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.disposed) {
        action();
      }
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  /** Jede gültige Zeile der App zählt als Lebenszeichen (Auto-Lock nach `lockTimeout`). */
  private touch(): void {
    if (this.lockTimer !== null) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    if (this.state === 'unlocked' && this.options.timing.lockTimeout > 0 && !this.disposed) {
      this.lockTimer = setTimeout(() => this.lock('heartbeat_timeout'), this.options.timing.lockTimeout);
    }
  }

  private lock(reason: 'heartbeat_timeout' | 'lock'): void {
    if (this.state !== 'unlocked' || this.disposed) {
      return;
    }
    if (this.lockTimer !== null) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    this.state = 'locked';
    this.session = null;
    this.pairing = null;
    this.event('sec.state', { state: 'locked', reason });
    for (const message of [...this.pending.values()]) {
      this.finish(message, 'failed', 'locked');
    }
  }

  private requireState(allowed: DeviceState[]): void {
    if (allowed.includes(this.state)) {
      return;
    }
    if (this.state === 'unprovisioned') {
      throw new MockFailure('E_NOT_PROVISIONED', 'device has no vault yet');
    }
    if (this.state === 'locked') {
      throw new MockFailure('E_LOCKED', 'device is locked, call sec.unlock');
    }
    throw new MockFailure('E_ALREADY_UNLOCKED', 'already unlocked');
  }

  private async execute(cmd: string, args: JsonObject): Promise<JsonObject> {
    switch (cmd) {
      case 'sys.hello':
        return this.hello(args);
      case 'sys.status':
        return this.status();
      case 'sys.ping':
        return { uptime_ms: this.uptime() };
      case 'sys.reboot':
        return {};
      case 'sec.provision':
        return this.authenticate(args, true);
      case 'sec.unlock':
        return this.authenticate(args, false);
      case 'sec.lock':
        this.requireState(['unlocked']);
        this.lock('lock');
        return { state: 'locked' };
      case 'id.get':
        this.requireState(['unlocked']);
        return this.identityResult();
      case 'id.set_name':
        this.requireState(['unlocked']);
        return this.setName(args);
      case 'pair.begin':
        this.requireState(['unlocked']);
        return this.pairBegin();
      case 'pair.cancel':
        this.requireState(['unlocked']);
        this.pairing = null;
        return { cancelled: true };
      case 'pair.complete':
        this.requireState(['unlocked']);
        return this.pairComplete(args);
      case 'contact.list':
        this.requireState(['unlocked']);
        return this.contactList(args);
      case 'contact.get':
        this.requireState(['unlocked']);
        return { contact: this.contactJson(this.contactArg(args)) };
      case 'contact.rename':
        this.requireState(['unlocked']);
        return this.contactRename(args);
      case 'contact.delete':
        this.requireState(['unlocked']);
        return this.contactDelete(args);
      case 'msg.send':
        this.requireState(['unlocked']);
        return this.messageSend(args);
      case 'msg.cancel':
        this.requireState(['unlocked']);
        return this.messageCancel(args);
      case 'msg.pending':
        this.requireState(['unlocked']);
        return this.messagePending();
      case 'radio.get':
        return this.radioResult([]);
      case 'radio.set':
        this.requireState(['unlocked']);
        return this.radioSet(args);
      case 'mesh.get':
        return { ...this.mesh };
      case 'mesh.set':
        this.requireState(['unlocked']);
        return this.meshSet(args);
      case 'led.get':
        return { ...this.led, builtin_patterns: [...BUILTIN_PATTERNS] };
      case 'led.set':
        this.requireState(['unlocked']);
        return this.ledSet(args);
      default:
        throw new MockFailure('E_UNKNOWN_CMD', `unknown command ${cmd}`);
    }
  }

  // ---- sys ----

  private hello(args: JsonObject): JsonObject {
    const appProto = args['app_proto'];
    if (typeof appProto === 'string' && appProto.split('.')[0] !== '1') {
      throw new MockFailure('E_PROTO_MISMATCH', `app speaks protocol ${appProto}`, 'app_proto');
    }
    const secret = randomBytes(32);
    this.session = { secret, nonce: randomBytes(16), publicKey: x25519PublicKey(secret) };
    return {
      device: 'heltec_wifi_lora_32_v3',
      chip: 'ESP32-S3',
      device_id: this.options.deviceId,
      fw: { version: '0.1.0', build: '2026-10-22' },
      proto: '1.0',
      state: this.state,
      session: { device_eph_pub: toBase64(this.session.publicKey), nonce: toBase64(this.session.nonce) },
      limits: { max_line: MAX_LINE, max_contacts: MAX_CONTACTS, max_text_bytes: MAX_TEXT_BYTES, pending_queue: PENDING_QUEUE },
    };
  }

  private status(): JsonObject {
    const unlocked = this.state === 'unlocked';
    const result: JsonObject = {
      state: this.state,
      uptime_ms: this.uptime(),
      reset_reason: 'power_on',
      heap_free: 172304,
      battery_mv: 4012,
      radio: { running: unlocked, relay_only: false },
      security: { secure_boot: false, flash_encryption: false },
    };
    if (unlocked) {
      result['queue'] = { pending: this.pending.size, capacity: PENDING_QUEUE };
      result['contacts'] = { used: this.contacts.size, capacity: MAX_CONTACTS };
    }
    return result;
  }

  // ---- sec ----

  private async authenticate(args: JsonObject, provisioning: boolean): Promise<JsonObject> {
    if (provisioning && this.state !== 'unprovisioned') {
      throw new MockFailure('E_ALREADY_PROVISIONED', 'device already has a vault');
    }
    if (!provisioning && this.state !== 'locked') {
      throw new MockFailure(
        this.state === 'unlocked' ? 'E_ALREADY_UNLOCKED' : 'E_NOT_PROVISIONED',
        this.state === 'unlocked' ? 'already unlocked' : 'device has no vault yet',
      );
    }
    const appEphPub = base64Arg(args, 'app_eph_pub', 32);
    const wrapped = base64Arg(args, 'wrapped_token', 60);
    const name = provisioning ? nameArg(args, 'name', false) : undefined;
    if (Date.now() < this.blockedUntil) {
      throw new MockFailure('E_RATE_LIMITED', 'too many failed unlocks, wait and retry');
    }
    const session = this.session;
    if (session === null) {
      throw new MockFailure('E_NO_SESSION', 'call sys.hello first');
    }
    // Die Sitzung ist einmalig: ein Versuch verbraucht sie, ob er gelingt oder nicht.
    this.session = null;

    let token: Uint8Array;
    try {
      token = await unwrapToken({
        deviceEphPrivate: session.secret,
        appEphPublic: appEphPub,
        nonce: session.nonce,
        deviceId: this.options.deviceId,
        wrapped,
      });
    } catch {
      throw this.unlockFailed();
    }

    if (!provisioning) {
      if (this.vaultToken === null && this.options.adoptFirstToken) {
        this.vaultToken = token;
      } else if (this.vaultToken === null || !equalBytes(this.vaultToken, token)) {
        throw this.unlockFailed();
      }
    } else {
      this.vaultToken = token;
    }

    this.failures = 0;
    this.blockedUntil = 0;
    await this.ensureIdentity(name);
    this.state = 'unlocked';
    this.touch();
    const identity = this.identity;
    if (identity === null) {
      throw new MockFailure('E_INTERNAL', 'identity missing');
    }
    this.afterResponse.push(() =>
      this.event('sec.state', { state: 'unlocked', reason: provisioning ? 'provision' : 'unlock' }),
    );
    if (provisioning) {
      return { node_id: identity.nodeId, public_key: toBase64(identity.publicKey), name: identity.name, state: 'unlocked' };
    }
    return {
      state: 'unlocked',
      node_id: identity.nodeId,
      name: identity.name,
      contacts: this.contacts.size,
      radio: { running: true, relay_only: false },
    };
  }

  private unlockFailed(): MockFailure {
    this.failures += 1;
    if (this.failures >= 3) {
      this.blockedUntil = Date.now() + Math.min(60_000, 2000 * 2 ** (this.failures - 3));
    }
    return new MockFailure('E_UNLOCK_FAILED', 'unlock failed');
  }

  private async ensureIdentity(name: string | undefined): Promise<void> {
    if (this.identity !== null) {
      return;
    }
    const publicKey = x25519PublicKey(randomBytes(32));
    const nodeId = await nodeIdOf(publicKey);
    this.identity = { name: name ?? this.options.identityName ?? `Offgrid-${nodeId}`, publicKey, nodeId };
  }

  // ---- id ----

  private identityResult(): JsonObject {
    const identity = this.requireIdentity();
    return { node_id: identity.nodeId, public_key: toBase64(identity.publicKey), name: identity.name };
  }

  private requireIdentity(): MockIdentity {
    if (this.identity === null) {
      throw new MockFailure('E_INTERNAL', 'identity missing');
    }
    return this.identity;
  }

  private setName(args: JsonObject): JsonObject {
    const name = nameArg(args, 'name', true);
    const identity = this.requireIdentity();
    if (name !== undefined) {
      identity.name = name;
    }
    return { name: identity.name };
  }

  // ---- pair / contact ----

  private pairBegin(): JsonObject {
    const identity = this.requireIdentity();
    const salt = randomBytes(16);
    this.pairing = { salt, expiresAt: Date.now() + PAIRING_EXPIRES_S * 1000 };
    const payload = concat(utf8(QR_MAGIC), identity.publicKey, salt, utf8(identity.name));
    return { qr: toBase64(payload), qr_bytes: payload.length, expires_s: PAIRING_EXPIRES_S };
  }

  private async pairComplete(args: JsonObject): Promise<JsonObject> {
    const identity = this.requireIdentity();
    const qr = args['qr'];
    if (typeof qr !== 'string') {
      throw new MockFailure('E_INVALID_ARG', 'qr is required', 'qr');
    }
    const replace = booleanArg(args, 'replace') === true;
    const nameOverride = nameArg(args, 'name', false);
    if (this.pairing === null || Date.now() > this.pairing.expiresAt) {
      throw new MockFailure('E_NO_PAIRING', 'call pair.begin first');
    }
    let payload: Uint8Array;
    try {
      payload = fromBase64(qr);
    } catch {
      throw new MockFailure('E_INVALID_QR', 'bad Base64');
    }
    const prefix = utf8(QR_MAGIC).length;
    if (payload.length < prefix + 32 + 16 || !equalBytes(payload.slice(0, prefix), utf8(QR_MAGIC))) {
      throw new MockFailure('E_INVALID_QR', 'wrong magic or length');
    }
    const publicKey = payload.slice(prefix, prefix + 32);
    if (equalBytes(publicKey, identity.publicKey)) {
      throw new MockFailure('E_SELF_PAIR', 'the QR contains my own public key');
    }
    const publicKeyText = toBase64(publicKey);
    const existing = [...this.contacts.values()].find((contact) => contact.public_key === publicKeyText);
    if (existing && !replace) {
      throw new MockFailure('E_CONTACT_EXISTS', 'public key already paired, use replace: true');
    }
    let slot = existing?.contact_id;
    if (slot === undefined) {
      for (let candidate = 1; candidate <= MAX_CONTACTS && slot === undefined; candidate++) {
        if (!this.contacts.has(candidate)) {
          slot = candidate;
        }
      }
    }
    if (slot === undefined) {
      throw new MockFailure('E_STORAGE_FULL', 'no free contact slot');
    }
    const nodeId = await nodeIdOf(publicKey);
    const qrName = new TextDecoder().decode(payload.slice(prefix + 48));
    const qrNamePart = qrName.length > 0 ? (splitText(qrName, MAX_NAME_BYTES)[0] ?? '') : '';
    const name = nameOverride ?? qrNamePart;
    const contact: MockContact = {
      contact_id: slot,
      name: name.length > 0 ? name : `Offgrid-${nodeId}`,
      node_id: nodeId,
      public_key: publicKeyText,
      state: 'pending',
      fingerprint: await fingerprintOf(identity.publicKey, publicKey),
      tx_ctr: 0,
      rx_highest_ctr: null,
      last_rssi: null,
      last_snr: null,
    };
    const collision = [...this.contacts.values()].some(
      (other) => other.contact_id !== slot && other.node_id === nodeId,
    );
    this.contacts.set(slot, contact);
    this.pairing = null;
    const contactId = slot;
    // Das Gegenüber „antwortet“: das erste gültige Paket macht den Kontakt aktiv.
    this.setTimer(() => {
      const current = this.contacts.get(contactId);
      if (current && this.state === 'unlocked') {
        this.activate(current);
      }
    }, this.options.timing.contactActive);
    return { contact: this.contactJson(contact), warnings: collision ? ['node_id_collision'] : [] };
  }

  private contactJson(contact: MockContact): JsonObject {
    return { ...contact };
  }

  private contactArg(args: JsonObject): MockContact {
    const id = requiredInteger(args, 'contact_id', 1, MAX_CONTACTS);
    const contact = this.contacts.get(id);
    if (!contact) {
      throw new MockFailure('E_NO_SUCH_CONTACT', `no contact ${id}`, 'contact_id');
    }
    return contact;
  }

  private contactList(args: JsonObject): JsonObject {
    const offset = numberArg(args, 'offset', { min: 0, max: MAX_CONTACTS, integer: true }) ?? 0;
    const limit = numberArg(args, 'limit', { min: 1, max: LIST_PAGE, integer: true }) ?? LIST_PAGE;
    const all = [...this.contacts.values()].sort((a, b) => a.contact_id - b.contact_id);
    const page = all.slice(offset, offset + limit).map((contact) => this.contactJson(contact));
    // Eine Antwort muss in eine Zeile passen (2048 Bytes inklusive Rahmen): lange Namen verkürzen die Seite.
    while (page.length > 1 && byteLength(JSON.stringify({ id: 999999, ok: true, result: { total: all.length, offset, contacts: page } })) >= MAX_LINE) {
      page.pop();
    }
    return { total: all.length, offset, contacts: page };
  }

  private contactRename(args: JsonObject): JsonObject {
    const contact = this.contactArg(args);
    const name = nameArg(args, 'name', true);
    if (name !== undefined) {
      contact.name = name;
    }
    return { contact: this.contactJson(contact) };
  }

  private contactDelete(args: JsonObject): JsonObject {
    const contact = this.contactArg(args);
    if (args['confirm'] !== true) {
      throw new MockFailure('E_CONFIRM_REQUIRED', 'confirm must be true', 'confirm');
    }
    for (const message of [...this.pending.values()]) {
      if (message.to === contact.contact_id) {
        this.finish(message, 'failed', 'contact_deleted');
      }
    }
    this.contacts.delete(contact.contact_id);
    return { deleted: true, contact_id: contact.contact_id };
  }

  // ---- msg ----

  private messageSend(args: JsonObject): JsonObject {
    const to = requiredInteger(args, 'to', 1, MAX_CONTACTS);
    const contact = this.contacts.get(to);
    if (!contact) {
      throw new MockFailure('E_NO_SUCH_CONTACT', `no contact ${to}`, 'to');
    }
    const type = args['type'];
    if (type !== 'text' && type !== 'reaction' && type !== 'geo') {
      throw new MockFailure('E_INVALID_ARG', 'type must be text, reaction or geo', 'type');
    }
    const ack = booleanArg(args, 'ack') ?? this.mesh.ack_default[type];
    const hops = numberArg(args, 'hops', { min: 0, max: 7, integer: true }) ?? this.mesh.hop_default;
    let bytesOnAir = 0;
    if (type === 'text') {
      const text = args['text'];
      if (typeof text !== 'string' || text.length === 0) {
        throw new MockFailure('E_INVALID_ARG', 'text is required', 'text');
      }
      const bytes = byteLength(text);
      if (bytes > MAX_TEXT_BYTES) {
        throw new MockFailure('E_TOO_LONG', `text is ${bytes} bytes, max is ${MAX_TEXT_BYTES}`, 'text');
      }
      bytesOnAir = 17 + bytes;
    } else if (type === 'reaction') {
      this.checkReaction(args);
      bytesOnAir = 19;
    } else {
      this.checkGeo(args);
      bytesOnAir = 23;
    }
    if (this.pending.size >= PENDING_QUEUE) {
      throw new MockFailure('E_QUEUE_FULL', 'pending queue is full');
    }

    const ctr = contact.tx_ctr === 0 ? 1 : contact.tx_ctr;
    contact.tx_ctr = (ctr + 1) % 0x1000000;
    const message: MockPending = { msgRef: this.nextMsgRef++, to, type, ctr, ack, timers: [] };
    this.pending.set(message.msgRef, message);
    this.scheduleStatus(message, contact);
    return {
      msg_ref: message.msgRef,
      ctr,
      ack_requested: ack,
      hops,
      state: 'queued',
      bytes_on_air: bytesOnAir,
      est_airtime_ms: loraAirtimeMs(bytesOnAir, this.radio),
    };
  }

  private checkReaction(args: JsonObject): void {
    const target = args['target'];
    if (!isObject(target) || (target['author'] !== 'me' && target['author'] !== 'peer')) {
      throw new MockFailure('E_INVALID_ARG', 'target.author must be me or peer', 'target');
    }
    requiredInteger(target, 'ref', 0, 0xffff);
    const emoji = args['emoji'];
    if (emoji !== null && (typeof emoji !== 'string' || !REACTION_EMOJIS.includes(emoji))) {
      throw new MockFailure('E_INVALID_ARG', 'emoji is not in the table', 'emoji');
    }
  }

  private checkGeo(args: JsonObject): void {
    const lat = numberArg(args, 'lat', { min: -90, max: 90 });
    const lon = numberArg(args, 'lon', { min: -180, max: 180 });
    if (lat === undefined || lon === undefined) {
      throw new MockFailure('E_INVALID_ARG', 'lat and lon are required', lat === undefined ? 'lat' : 'lon');
    }
    numberArg(args, 'alt_m', { min: -1000, max: 100000 });
    numberArg(args, 'age_s', { min: 0, max: 2550 });
  }

  /** Status-Ereignisse: `sent`, `relayed`, dann `delivered` (oder `failed`). */
  private scheduleStatus(message: MockPending, contact: MockContact): void {
    const { sent, relayed, delivered } = this.options.timing;
    const failure = this.failNextReason;
    this.failNextReason = null;
    const step = (delay: number, action: () => void): void => {
      message.timers.push(this.setTimer(action, delay));
    };
    step(sent, () => {
      if (failure === 'radio_error') {
        this.finish(message, 'failed', 'radio_error');
      } else {
        this.statusEvent(message, 'sent');
      }
    });
    if (failure === 'radio_error') {
      return;
    }
    if (failure === 'timeout') {
      step(delivered, () => this.finish(message, 'failed', 'timeout', 3));
      return;
    }
    if (!message.ack) {
      return;
    }
    step(relayed, () => this.statusEvent(message, 'relayed'));
    step(delivered, () => {
      this.finish(message, 'delivered', null);
      contact.last_rssi = -90;
      contact.last_snr = 6.5;
      this.activate(contact);
    });
  }

  private statusEvent(message: MockPending, state: string, extra: JsonObject = {}): void {
    this.event('msg.status', { msg_ref: message.msgRef, to: message.to, state, retry: 0, ...extra });
  }

  /** Beendet eine Nachricht mit ihrem letzten Status und nimmt sie aus der Warteschlange. */
  private finish(message: MockPending, state: 'delivered' | 'failed' | 'cancelled', reason: FailureReason | null, retry = 0): void {
    for (const timer of message.timers) {
      clearTimeout(timer);
      this.timers.delete(timer);
    }
    this.pending.delete(message.msgRef);
    const extra: JsonObject = { retry };
    if (reason !== null) {
      extra['reason'] = reason;
    }
    if (state === 'delivered') {
      extra['hops'] = 1;
      extra['rtt_ms'] = this.options.timing.delivered;
    }
    this.event('msg.status', { msg_ref: message.msgRef, to: message.to, state, ...extra });
  }

  private messageCancel(args: JsonObject): JsonObject {
    const msgRef = requiredInteger(args, 'msg_ref', 0, Number.MAX_SAFE_INTEGER);
    const message = this.pending.get(msgRef);
    if (!message) {
      throw new MockFailure('E_INVALID_ARG', `no pending message ${msgRef}`, 'msg_ref');
    }
    this.afterResponse.push(() => this.finish(message, 'cancelled', null));
    return { state: 'cancelled' };
  }

  private messagePending(): JsonObject {
    return {
      pending: [...this.pending.values()].map((message) => ({
        msg_ref: message.msgRef,
        to: message.to,
        type: message.type,
        ctr: message.ctr,
        state: 'queued',
        retry: 0,
      })),
    };
  }

  // ---- radio / mesh / led ----

  private radioResult(warnings: string[]): JsonObject {
    const result: JsonObject = {
      ...this.radio,
      est_airtime_ms_23b: loraAirtimeMs(23, this.radio),
      max_text_bytes: MAX_TEXT_BYTES,
    };
    if (warnings.length > 0) {
      result['warnings'] = warnings;
    }
    return result;
  }

  private radioSet(args: JsonObject): JsonObject {
    const next: RadioConfig = { ...this.radio };
    const preset = args['preset'];
    if (preset !== undefined) {
      const values = typeof preset === 'string' ? RADIO_PRESETS[preset] : undefined;
      if (!values) {
        throw new MockFailure('E_INVALID_ARG', 'unknown preset', 'preset');
      }
      Object.assign(next, values);
    }
    const freq = numberArg(args, 'freq_mhz', { min: 150, max: 960 });
    const bandwidth = numberArg(args, 'bw_khz', { min: 62.5, max: 500 });
    if (bandwidth !== undefined && ![62.5, 125, 250, 500].includes(bandwidth)) {
      throw new MockFailure('E_INVALID_ARG', 'bw_khz must be 62.5, 125, 250 or 500', 'bw_khz');
    }
    next.freq_mhz = freq ?? next.freq_mhz;
    next.bw_khz = bandwidth ?? next.bw_khz;
    next.sf = numberArg(args, 'sf', { min: 5, max: 12, integer: true }) ?? next.sf;
    next.cr = numberArg(args, 'cr', { min: 5, max: 8, integer: true }) ?? next.cr;
    next.tx_power_dbm = numberArg(args, 'tx_power_dbm', { min: -9, max: 22, integer: true }) ?? next.tx_power_dbm;
    next.preamble = numberArg(args, 'preamble', { min: 6, max: 64, integer: true }) ?? next.preamble;
    next.sync_word = numberArg(args, 'sync_word', { min: 0, max: 255, integer: true }) ?? next.sync_word;
    booleanArg(args, 'persist');
    this.radio = next;
    const warnings: string[] = [];
    if (next.freq_mhz < 863 || next.freq_mhz > 870) {
      warnings.push('outside_eu868');
    }
    if (next.tx_power_dbm > 14) {
      warnings.push('above_eu868_power_limit');
    }
    if (next.sync_word === 0x12 || next.sync_word === 0x34) {
      warnings.push('reserved_sync_word');
    }
    warnings.push('mesh_incompatible');
    return this.radioResult(warnings);
  }

  private meshSet(args: JsonObject): JsonObject {
    const next: MeshConfig = { ...this.mesh, ack_default: { ...this.mesh.ack_default } };
    next.hop_default = numberArg(args, 'hop_default', { min: 0, max: 7, integer: true }) ?? next.hop_default;
    next.relay_enabled = booleanArg(args, 'relay_enabled') ?? next.relay_enabled;
    next.relay_when_locked = booleanArg(args, 'relay_when_locked') ?? next.relay_when_locked;
    next.cad_enabled = booleanArg(args, 'cad_enabled') ?? next.cad_enabled;
    next.backoff_slots = numberArg(args, 'backoff_slots', { min: 0, max: 32, integer: true }) ?? next.backoff_slots;
    next.retries = numberArg(args, 'retries', { min: 0, max: 3, integer: true }) ?? next.retries;
    next.retry_base_ms = numberArg(args, 'retry_base_ms', { min: 0, max: 60000, integer: true }) ?? next.retry_base_ms;
    next.rate_limit_per_src =
      numberArg(args, 'rate_limit_per_src', { min: 0, max: 255, integer: true }) ?? next.rate_limit_per_src;
    const ack = args['ack_default'];
    if (ack !== undefined) {
      if (!isObject(ack)) {
        throw new MockFailure('E_INVALID_ARG', 'ack_default must be an object', 'ack_default');
      }
      next.ack_default.text = booleanArg(ack, 'text') ?? next.ack_default.text;
      next.ack_default.reaction = booleanArg(ack, 'reaction') ?? next.ack_default.reaction;
      next.ack_default.geo = booleanArg(ack, 'geo') ?? next.ack_default.geo;
    }
    booleanArg(args, 'persist');
    this.mesh = next;
    return { ...this.mesh };
  }

  private ledSet(args: JsonObject): JsonObject {
    const next: JsonObject = { ...this.led };
    next['enabled'] = booleanArg(args, 'enabled') ?? this.led['enabled'];
    next['quiet'] = booleanArg(args, 'quiet') ?? this.led['quiet'];
    next['brightness'] = numberArg(args, 'brightness', { min: 0, max: 255, integer: true }) ?? this.led['brightness'];
    next['state_patterns'] = this.mergePatterns(args, 'state_patterns', LED_STATES);
    next['event_patterns'] = this.mergePatterns(args, 'event_patterns', LED_EVENTS);
    booleanArg(args, 'persist');
    this.led = next;
    return { ...this.led };
  }

  private mergePatterns(args: JsonObject, key: string, allowed: string[]): JsonObject {
    const current = this.led[key];
    const merged: JsonObject = isObject(current) ? { ...current } : {};
    const update = args[key];
    if (update === undefined) {
      return merged;
    }
    if (!isObject(update)) {
      throw new MockFailure('E_INVALID_ARG', `${key} must be an object`, key);
    }
    for (const [name, pattern] of Object.entries(update)) {
      if (!allowed.includes(name)) {
        throw new MockFailure('E_INVALID_ARG', `unknown ${key} entry ${name}`, key);
      }
      this.checkPattern(pattern, `${key}.${name}`);
      merged[name] = pattern;
    }
    return merged;
  }

  private checkPattern(pattern: JsonValue, field: string): void {
    if (typeof pattern === 'string' && BUILTIN_PATTERNS.includes(pattern)) {
      return;
    }
    if (isObject(pattern) && Array.isArray(pattern['steps'])) {
      const steps = pattern['steps'];
      const valid =
        steps.length >= 1 &&
        steps.length <= 16 &&
        steps.every((step) => typeof step === 'number' && step >= 10 && step <= 10000);
      if (valid) {
        return;
      }
    }
    throw new MockFailure('E_INVALID_ARG', 'pattern is not valid', field);
  }
}
