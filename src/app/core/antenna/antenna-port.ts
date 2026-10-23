import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';

import { KeystoreService } from '../keystore/keystore.service';
import { log } from '../log';
import {
  DEFAULT_LIMITS,
  type AntennaErrorCode,
  type AntennaState,
  type DeviceInfo,
  type DeviceLimits,
} from '../models/antenna';
import type { DeviceEvent, DeviceSession, HelloResult, JsonObject } from '../models/device';
import { DeviceError } from './device-error';
import { parseDeviceState, parseEvent, parseHello } from './device-parse';
import { SerialClient, type RawEvent } from './serial-client';
import { SerialTransport, TransportError } from './serial-transport';

/** Name und Protokollversion der App für `sys.hello`. */
const APP_NAME = 'offgrid-android';
const APP_PROTO = '1.0';
const SUPPORTED_MAJOR = 1;

/** So viele Heartbeats in Folge ohne Antwort gelten als „Verbindung verloren“. */
const HEARTBEAT_FAILURES_UNTIL_LOST = 2;

/** Eigene Kennung des Geräts nach dem Entsperren. */
export interface DeviceIdentity {
  /** 4 Hex-Zeichen, Grossbuchstaben. */
  nodeId: string;
  name: string;
}

/**
 * Die Antenne aus Sicht der App: Verbindung, Zustand und Befehle.
 *
 * Zustandsautomat (`state`):
 * - `disconnected`: keine Verbindung.
 * - `unprovisioned`: verbunden, das Gerät hat noch keinen Tresor. Nur `provision()` geht.
 * - `locked`: verbunden, der Tresor ist zu. `unlock()` öffnet ihn mit dem Token aus dem Schlüsselspeicher.
 * - `unlocked`: das Gerät arbeitet (Funk an, Kontakte und Nachrichten verfügbar).
 *
 * Der Port öffnet gesperrte Geräte beim Verbinden und nach Neustart oder Auto-Lock von selbst.
 * Fehler setzt er in `error`, sie werden nicht in die Oberfläche geworfen. Befehle laufen über `request()`.
 */
@Injectable({ providedIn: 'root' })
export class AntennaPort {
  private readonly transport = inject(SerialTransport);
  private readonly keystore = inject(KeystoreService);
  private readonly client = new SerialClient((line) => this.transport.write(line));
  private readonly eventSubject = new Subject<DeviceEvent>();

  private readonly stateSignal = signal<AntennaState>('disconnected');
  private readonly connectingSignal = signal(false);
  private readonly errorSignal = signal<AntennaErrorCode | null>(null);
  private readonly deviceSignal = signal<DeviceInfo | null>(null);
  private readonly identitySignal = signal<DeviceIdentity | null>(null);
  private readonly limitsSignal = signal<DeviceLimits>(DEFAULT_LIMITS);

  /** Zustand des Geräts. */
  readonly state = this.stateSignal.asReadonly();
  /** `true`, solange `connect()` läuft. */
  readonly connecting = this.connectingSignal.asReadonly();
  /** Letzter Fehler der Verbindung oder des Entsperrens. */
  readonly error = this.errorSignal.asReadonly();
  /** Gerätedaten aus `sys.hello`, solange verbunden. */
  readonly device = this.deviceSignal.asReadonly();
  /** Eigene Kennung, solange entsperrt. */
  readonly identity = this.identitySignal.asReadonly();
  /** Grenzen des Geräts (Standardwerte, bis `sys.hello` geantwortet hat). */
  readonly limits = this.limitsSignal.asReadonly();
  /** Verbunden, egal in welchem Gerätezustand. */
  readonly connected = computed(() => this.stateSignal() !== 'disconnected');
  /** Ereignisse des Geräts, die die App auswertet. Sie werden nie beantwortet. */
  readonly events: Observable<DeviceEvent> = this.eventSubject.asObservable();

  /** Einmalige Sitzung aus dem letzten `sys.hello`. */
  private session: DeviceSession | null = null;
  private recovery: Promise<void> | null = null;

  constructor() {
    this.transport.onData((chunk) => this.client.receive(chunk));
    this.transport.onClosed(() => void this.abort('lost'));
    this.client.onEvent((raw) => this.handleEvent(raw));
  }

  /**
   * Öffnet die Leitung, spricht `sys.hello` und entsperrt ein gesperrtes Gerät.
   *
   * Tut nichts, wenn schon verbunden oder gerade am Verbinden. Fehler stehen danach in `error`.
   */
  async connect(): Promise<void> {
    if (this.connectingSignal() || this.stateSignal() !== 'disconnected') {
      return;
    }
    this.connectingSignal.set(true);
    this.errorSignal.set(null);
    try {
      // Zuerst den Client öffnen: Das Gerät meldet sich beim Öffnen der Leitung mit einem LF und `sys.boot`.
      this.client.open();
      await this.transport.open();
      const hello = await this.hello();
      this.applyHello(hello);
      this.client.startHeartbeat((_error, failures) => {
        if (failures >= HEARTBEAT_FAILURES_UNTIL_LOST) {
          void this.abort('lost');
        }
      });
      if (this.stateSignal() === 'locked') {
        await this.unlock();
      }
    } catch (error) {
      await this.abort(this.connectErrorCode(error));
    } finally {
      this.connectingSignal.set(false);
    }
  }

  /** Beendet die Verbindung. */
  async disconnect(): Promise<void> {
    await this.abort(null);
  }

  /**
   * Richtet ein neues Gerät ein (`sec.provision`): es erzeugt seine Identität und sperrt sich auf dieses Handy.
   *
   * @returns `true`, wenn das Gerät jetzt entsperrt ist. Sonst steht der Grund in `error`.
   */
  async provision(name: string): Promise<boolean> {
    if (this.stateSignal() !== 'unprovisioned') {
      return this.stateSignal() === 'unlocked';
    }
    return this.authenticate('sec.provision', { name });
  }

  /**
   * Öffnet den Tresor (`sec.unlock`) mit dem Token aus dem Schlüsselspeicher.
   *
   * @returns `true`, wenn das Gerät jetzt entsperrt ist. Sonst steht der Grund in `error`.
   */
  async unlock(): Promise<boolean> {
    if (this.stateSignal() !== 'locked') {
      return this.stateSignal() === 'unlocked';
    }
    return this.authenticate('sec.unlock');
  }

  /** Sperrt das Gerät sofort (`sec.lock`). Es wird nicht von selbst wieder entsperrt. */
  async lock(): Promise<void> {
    await this.request('sec.lock');
    this.session = null;
    this.identitySignal.set(null);
    this.stateSignal.set('locked');
  }

  /**
   * Schickt einen Befehl und wartet auf die Antwort. Wirft `DeviceError` mit dem Code des Geräts.
   *
   * Meldet das Gerät `E_LOCKED` oder `E_NOT_PROVISIONED`, zieht der Port seinen Zustand nach.
   */
  async request(cmd: string, args?: JsonObject): Promise<JsonObject> {
    if (this.stateSignal() === 'disconnected') {
      throw new DeviceError('E_DISCONNECTED', 'Die Antenne ist nicht verbunden');
    }
    try {
      return await this.client.request(cmd, args);
    } catch (error) {
      this.syncStateFromError(error);
      throw error;
    }
  }

  private hello(): Promise<HelloResult> {
    return this.client.hello({ app: APP_NAME, app_proto: APP_PROTO }).then((raw) => {
      const hello = parseHello(raw);
      if (Number.parseInt(hello.info.proto.split('.')[0], 10) !== SUPPORTED_MAJOR) {
        throw new DeviceError('E_PROTO_MISMATCH', `Das Gerät spricht Protokoll ${hello.info.proto}`);
      }
      return hello;
    });
  }

  /** Neue einmalige Sitzung holen (nach jedem Versuch nötig). */
  private async refreshSession(): Promise<void> {
    const hello = parseHello(await this.client.request('sys.hello', { app: APP_NAME, app_proto: APP_PROTO }));
    this.applyHello(hello);
  }

  private applyHello(hello: HelloResult): void {
    this.session = hello.session;
    this.deviceSignal.set(hello.info);
    this.limitsSignal.set(hello.limits);
    this.stateSignal.set(hello.state);
  }

  private async authenticate(cmd: 'sec.provision' | 'sec.unlock', extra: JsonObject = {}): Promise<boolean> {
    this.errorSignal.set(null);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (this.session === null) {
          await this.refreshSession();
        }
        const device = this.deviceSignal();
        const session = this.session;
        if (device === null || session === null) {
          throw new DeviceError('E_NO_SESSION', 'Keine Sitzung');
        }
        const envelope = await this.keystore.createUnlockEnvelope(session, device.deviceId);
        // Die Sitzung ist einmalig: nach dem Versuch zählt sie als verbraucht, egal wie er ausgeht.
        this.session = null;
        try {
          const result = await this.client.request(cmd, {
            app_eph_pub: envelope.appEphPub,
            wrapped_token: envelope.wrappedToken,
            ...extra,
          });
          this.applyAuthResult(result);
          return true;
        } catch (error) {
          if (error instanceof DeviceError && error.code === 'E_NO_SESSION' && attempt === 0) {
            continue;
          }
          throw error;
        }
      }
      return false;
    } catch (error) {
      return this.handleAuthError(error);
    }
  }

  private applyAuthResult(result: JsonObject): void {
    const nodeId = result['node_id'];
    const name = result['name'];
    const state = result['state'];
    if (typeof nodeId === 'string' && typeof name === 'string') {
      this.identitySignal.set({ nodeId, name });
    }
    this.stateSignal.set(typeof state === 'string' ? parseDeviceState(state) : 'unlocked');
  }

  private handleAuthError(error: unknown): boolean {
    if (!(error instanceof DeviceError)) {
      log.error('Schlüsselspeicher fehlgeschlagen', error);
      this.errorSignal.set('keystore-failed');
      return false;
    }
    switch (error.code) {
      case 'E_ALREADY_UNLOCKED':
        this.stateSignal.set('unlocked');
        return true;
      case 'E_ALREADY_PROVISIONED':
        this.stateSignal.set('locked');
        this.errorSignal.set('unlock-failed');
        return false;
      case 'E_NOT_PROVISIONED':
        this.stateSignal.set('unprovisioned');
        return false;
      case 'E_RATE_LIMITED':
        this.errorSignal.set('rate-limited');
        return false;
      case 'E_DISCONNECTED':
      case 'E_TIMEOUT':
        this.errorSignal.set('lost');
        return false;
      default:
        this.errorSignal.set('unlock-failed');
        return false;
    }
  }

  private syncStateFromError(error: unknown): void {
    if (!(error instanceof DeviceError)) {
      return;
    }
    if (error.code === 'E_LOCKED' && this.stateSignal() === 'unlocked') {
      this.session = null;
      this.stateSignal.set('locked');
      void this.recover();
    } else if (error.code === 'E_NOT_PROVISIONED') {
      this.stateSignal.set('unprovisioned');
    }
  }

  private handleEvent(raw: RawEvent): void {
    const event = parseEvent(raw);
    if (event === null) {
      return;
    }
    switch (event.evt) {
      case 'sys.boot':
        // Beim Verbinden holt `connect()` den Zustand selbst über `sys.hello`.
        if (!this.connectingSignal()) {
          this.session = null;
          this.identitySignal.set(null);
          this.stateSignal.set(event.state);
          void this.recover();
        }
        break;
      case 'sec.state':
        this.stateSignal.set(event.state);
        if (event.state !== 'unlocked') {
          this.identitySignal.set(null);
        }
        if (event.state === 'locked') {
          this.session = null;
          if (event.reason === 'heartbeat_timeout') {
            void this.recover();
          }
        }
        break;
      default:
        break;
    }
    this.eventSubject.next(event);
  }

  /** Nach Neustart oder Auto-Lock: neue Sitzung holen und ein gesperrtes Gerät wieder entsperren. */
  private recover(): Promise<void> {
    this.recovery ??= this.runRecovery().finally(() => {
      this.recovery = null;
    });
    return this.recovery;
  }

  private async runRecovery(): Promise<void> {
    if (this.connectingSignal() || this.stateSignal() === 'disconnected') {
      return;
    }
    try {
      await this.refreshSession();
      if (this.stateSignal() === 'locked') {
        await this.unlock();
      }
    } catch (error) {
      // Ein totes Gerät bemerkt der Heartbeat; hier genügt ein Log.
      log.warn('Wiederherstellung nach Neustart oder Sperre fehlgeschlagen', error);
    }
  }

  private connectErrorCode(error: unknown): AntennaErrorCode {
    if (error instanceof TransportError) {
      return error.code;
    }
    if (error instanceof DeviceError) {
      switch (error.code) {
        case 'E_PROTO_MISMATCH':
          return 'proto-mismatch';
        case 'E_TIMEOUT':
        case 'E_INVALID_RESPONSE':
          return 'no-hello';
        default:
          return 'lost';
      }
    }
    return 'open-failed';
  }

  /** Verbindung beenden. `code` ist der Fehler, den die Oberfläche zeigen soll; `null` heisst „absichtlich“. */
  private async abort(code: AntennaErrorCode | null): Promise<void> {
    const wasConnected = this.stateSignal() !== 'disconnected' || this.connectingSignal();
    this.client.close();
    this.session = null;
    this.deviceSignal.set(null);
    this.identitySignal.set(null);
    this.stateSignal.set('disconnected');
    this.errorSignal.set(code);
    if (wasConnected || code !== null) {
      try {
        await this.transport.close();
      } catch (error) {
        log.warn('Schliessen der Verbindung fehlgeschlagen', error);
      }
    }
  }
}
