import { log } from '../log';
import type { JsonObject } from '../models/device';
import { DeviceError, isDeviceErrorCode } from './device-error';

/** Ein Ereignis des Geräts, noch ohne Typprüfung der Nutzdaten. */
export interface RawEvent {
  evt: string;
  /** Betriebszeit des Geräts in Millisekunden. */
  t: number;
  data: JsonObject;
}

/** Schreibt eine fertige Zeile (inklusive abschliessendem LF) auf die Leitung. */
export type LineWriter = (line: string) => Promise<void>;

export interface SerialClientOptions {
  /** Höchstlänge einer Zeile in Bytes inklusive LF. */
  maxLine: number;
  /** Höchstens so viele Anfragen gleichzeitig unterwegs. */
  maxInFlight: number;
  /** Zeitlimit normaler Befehle. */
  timeoutMs: number;
  /** Zeitlimit für `sec.*`, `pair.complete` und `contact.delete`. */
  slowTimeoutMs: number;
  /** Abstand der `sys.hello`-Wiederholungen. */
  helloIntervalMs: number;
  /** Abstand der `sys.ping`-Heartbeats. */
  pingIntervalMs: number;
}

/** Werte aus Offgrid Host Interface v1 (§3.2, §4.4, §12). */
export const DEFAULT_CLIENT_OPTIONS: SerialClientOptions = {
  maxLine: 2048,
  maxInFlight: 4,
  timeoutMs: 2000,
  slowTimeoutMs: 5000,
  helloIntervalMs: 500,
  pingIntervalMs: 5000,
};

interface PendingRequest {
  resolve: (result: JsonObject) => void;
  reject: (error: DeviceError) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface QueuedRequest {
  cmd: string;
  args: JsonObject | undefined;
  resolve: (result: JsonObject) => void;
  reject: (error: DeviceError) => void;
}

const encoder = new TextEncoder();

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSON-Lines-Client für die Host-API des Geräts.
 *
 * Eine Zeile ist ein JSON-Objekt, abgeschlossen mit LF. Es gibt drei Arten von Zeilen:
 * Anfrage (`id`, `cmd`, `args`), Antwort (`id`, `ok`, `result` oder `error`) und Ereignis (`evt`, `t`, `data`).
 * Der Client kennt weder USB noch Befehle; er bekommt Text hinein (`receive`) und gibt Zeilen aus (`LineWriter`).
 */
export class SerialClient {
  private readonly options: SerialClientOptions;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly waiting: QueuedRequest[] = [];
  private nextId = 1;
  private buffer = '';
  /** Nach dem Öffnen wird bis zum ersten LF alles verworfen (halbe Zeile beim Anschliessen). */
  private discardingUntilLf = true;
  /** Eine zu lange Zeile wird bis zu ihrem LF verworfen. */
  private discardingLongLine = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pingInFlight = false;
  private pingFailures = 0;
  private eventHandler: ((event: RawEvent) => void) | null = null;

  constructor(
    private readonly writeLine: LineWriter,
    options: Partial<SerialClientOptions> = {},
  ) {
    this.options = { ...DEFAULT_CLIENT_OPTIONS, ...options };
  }

  /** Beginnt eine neue Verbindung: leert den Puffer und verwirft bis zum ersten LF. */
  open(): void {
    this.buffer = '';
    this.discardingUntilLf = true;
    this.discardingLongLine = false;
  }

  /** Beendet die Verbindung: stoppt Heartbeat und weist alle offenen Anfragen ab. */
  close(): void {
    this.stopHeartbeat();
    const error = (): DeviceError => new DeviceError('E_DISCONNECTED', 'Verbindung zum Gerät beendet');
    for (const [id, request] of this.pending) {
      clearTimeout(request.timer);
      request.reject(error());
      this.pending.delete(id);
    }
    for (const request of this.waiting.splice(0)) {
      request.reject(error());
    }
    this.buffer = '';
    this.discardingUntilLf = true;
    this.discardingLongLine = false;
  }

  /** Setzt die Funktion, die Ereignisse des Geräts erhält. Ereignisse werden nie beantwortet. */
  onEvent(handler: (event: RawEvent) => void): void {
    this.eventHandler = handler;
  }

  /** Nimmt Text von der Leitung entgegen (beliebig in Stücke geschnitten). */
  receive(chunk: string): void {
    let rest = chunk;
    if (this.discardingUntilLf) {
      const lf = rest.indexOf('\n');
      if (lf < 0) {
        return;
      }
      rest = rest.slice(lf + 1);
      this.discardingUntilLf = false;
    }
    this.buffer += rest;
    let lf = this.buffer.indexOf('\n');
    while (lf >= 0) {
      const line = this.buffer.slice(0, lf);
      this.buffer = this.buffer.slice(lf + 1);
      if (this.discardingLongLine) {
        this.discardingLongLine = false;
      } else {
        this.handleLine(line);
      }
      lf = this.buffer.indexOf('\n');
    }
    // Ein Zeichen braucht mindestens ein Byte: ab maxLine Zeichen ohne LF ist die Zeile sicher zu lang.
    if (this.buffer.length >= this.options.maxLine) {
      log.warn('Zeile vom Gerät ist länger als', this.options.maxLine, 'Bytes und wird verworfen');
      this.buffer = '';
      this.discardingLongLine = true;
    }
  }

  /** Sendet eine Anfrage und wartet auf die Antwort mit derselben `id`. */
  request(cmd: string, args?: JsonObject): Promise<JsonObject> {
    return new Promise<JsonObject>((resolve, reject) => {
      this.waiting.push({ cmd, args, resolve, reject });
      this.pump();
    });
  }

  /**
   * `sys.hello`, bis eine Antwort kommt (Boot-Rennen, Offgrid Host Interface v1 §3.3).
   *
   * Die erste Anfrage geht sofort raus, danach alle 500 ms eine weitere. Die erste Antwort gewinnt.
   * Nach `maxAttempts` Anfragen ohne Antwort schlägt der Aufruf mit `E_TIMEOUT` fehl.
   * Antwortet das Gerät mit einem Fehler (z. B. `E_PROTO_MISMATCH`), schlägt der Aufruf sofort fehl.
   */
  hello(args: JsonObject, maxAttempts = 10): Promise<JsonObject> {
    return new Promise<JsonObject>((resolve, reject) => {
      let settled = false;
      let attempts = 0;
      let timer: ReturnType<typeof setInterval> | null = null;

      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer !== null) {
          clearInterval(timer);
        }
        action();
      };

      let outstanding = 0;

      const attempt = (): void => {
        attempts += 1;
        outstanding += 1;
        this.request('sys.hello', args).then(
          (result) => finish(() => resolve(result)),
          (error: unknown) => {
            outstanding -= 1;
            if (error instanceof DeviceError && error.code === 'E_TIMEOUT') {
              if (attempts >= maxAttempts && outstanding === 0) {
                finish(() => reject(error));
              }
            } else {
              finish(() => reject(error instanceof DeviceError ? error : new DeviceError('E_INTERNAL', 'sys.hello')));
            }
          },
        );
        if (attempts >= maxAttempts && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };

      attempt();
      if (attempts < maxAttempts) {
        timer = setInterval(attempt, this.options.helloIntervalMs);
      }
    });
  }

  /**
   * Startet den Heartbeat: alle 5 s `sys.ping`. Schlägt ein Ping fehl, erfährt es `onFailure`
   * mit der Zahl der Fehlschläge in Folge. Ein erfolgreicher Ping setzt den Zähler zurück.
   */
  startHeartbeat(onFailure: (error: DeviceError, consecutiveFailures: number) => void): void {
    this.stopHeartbeat();
    this.pingFailures = 0;
    this.pingTimer = setInterval(() => {
      if (this.pingInFlight) {
        return;
      }
      this.pingInFlight = true;
      this.request('sys.ping').then(
        () => {
          this.pingInFlight = false;
          this.pingFailures = 0;
        },
        (error: unknown) => {
          this.pingInFlight = false;
          if (error instanceof DeviceError && error.code === 'E_DISCONNECTED') {
            return;
          }
          this.pingFailures += 1;
          onFailure(
            error instanceof DeviceError ? error : new DeviceError('E_INTERNAL', 'Ping fehlgeschlagen'),
            this.pingFailures,
          );
        },
      );
    }, this.options.pingIntervalMs);
  }

  /** Stoppt den Heartbeat. */
  stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.pingInFlight = false;
  }

  /** Schickt wartende Anfragen los, solange weniger als `maxInFlight` unterwegs sind. */
  private pump(): void {
    while (this.waiting.length > 0 && this.pending.size < this.options.maxInFlight) {
      const request = this.waiting.shift();
      if (request) {
        this.dispatch(request);
      }
    }
  }

  private dispatch(request: QueuedRequest): void {
    const id = this.nextId++;
    const envelope: JsonObject = request.args === undefined ? { id, cmd: request.cmd } : { id, cmd: request.cmd, args: request.args };
    const line = `${JSON.stringify(envelope)}\n`;
    if (encoder.encode(line).length > this.options.maxLine) {
      request.reject(
        new DeviceError('E_LINE_TOO_LONG', `Anfrage ${request.cmd} ist länger als ${this.options.maxLine} Bytes`),
      );
      return;
    }
    const timer = setTimeout(() => {
      if (this.pending.delete(id)) {
        request.reject(new DeviceError('E_TIMEOUT', `Keine Antwort auf ${request.cmd}`));
        this.pump();
      }
    }, this.timeoutFor(request.cmd));
    this.pending.set(id, { resolve: request.resolve, reject: request.reject, timer });
    this.writeLine(line).catch(() => {
      const entry = this.pending.get(id);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(id);
        entry.reject(new DeviceError('E_DISCONNECTED', `Schreiben von ${request.cmd} fehlgeschlagen`));
        this.pump();
      }
    });
  }

  private timeoutFor(cmd: string): number {
    const slow = cmd.startsWith('sec.') || cmd === 'pair.complete' || cmd === 'contact.delete';
    return slow ? this.options.slowTimeoutMs : this.options.timeoutMs;
  }

  private handleLine(rawLine: string): void {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.length === 0) {
      return;
    }
    if (encoder.encode(line).length + 1 > this.options.maxLine) {
      log.warn('Zeile vom Gerät ist zu lang und wird verworfen');
      return;
    }
    // Boot-Ausgabe des ESP32 und verirrte Debug-Texte beginnen nie mit `{`.
    if (!line.startsWith('{')) {
      log.debug('Zeile ohne { verworfen');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      log.warn('Ungültiges JSON vom Gerät verworfen');
      return;
    }
    if (!isObject(parsed)) {
      return;
    }
    if (typeof parsed['evt'] === 'string') {
      const data = parsed['data'];
      const t = parsed['t'];
      this.eventHandler?.({ evt: parsed['evt'], t: typeof t === 'number' ? t : 0, data: isObject(data) ? data : {} });
      return;
    }
    const id = parsed['id'];
    if (typeof id === 'number' && typeof parsed['ok'] === 'boolean') {
      this.handleResponse(id, parsed);
      return;
    }
    // Antwort ohne `id` (z. B. `E_PARSE`): sie lässt sich keiner Anfrage zuordnen.
    log.warn('Antwort ohne passende id verworfen');
  }

  private handleResponse(id: number, response: JsonObject): void {
    const entry = this.pending.get(id);
    if (!entry) {
      log.debug('Antwort auf unbekannte oder abgelaufene Anfrage', id);
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(id);
    if (response['ok'] === true) {
      const result = response['result'];
      entry.resolve(isObject(result) ? result : {});
    } else {
      const error = response['error'];
      const body = isObject(error) ? error : {};
      const code = isDeviceErrorCode(body['code']) ? body['code'] : 'E_INTERNAL';
      const message = typeof body['message'] === 'string' ? body['message'] : 'Fehler des Geräts';
      const field = typeof body['field'] === 'string' ? body['field'] : null;
      entry.reject(new DeviceError(code, message, field));
    }
    this.pump();
  }
}
