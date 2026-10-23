import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { dataProviders } from '../../app.config';
import { BrowserKeystoreService } from '../keystore/browser-keystore.service';
import { KeystoreService } from '../keystore/keystore.service';
import { DEFAULT_LIMITS } from '../models/antenna';
import type { DeviceEvent, JsonObject } from '../models/device';
import { AntennaPort } from './antenna-port';
import { DeviceError } from './device-error';
import { SerialTransport, TransportError } from './serial-transport';
import {
  LoopbackTransport,
  provisionedDevice,
  setupAntennaHarness,
  type AntennaHarness,
} from './antenna-harness.testing';

/** Leitung mit Drehbuch: der Test bestimmt, was das „Gerät“ auf jede Anfrage antwortet. */
class ScriptedTransport extends SerialTransport {
  readonly requests: JsonObject[] = [];
  private dataHandler: ((chunk: string) => void) | null = null;
  openError: TransportError | null = null;

  constructor(private readonly script: (request: JsonObject, reply: (line: JsonObject) => void) => void) {
    super();
  }

  async open(): Promise<void> {
    if (this.openError) {
      throw this.openError;
    }
    this.dataHandler?.('\n');
  }

  async write(text: string): Promise<void> {
    for (const line of text.split('\n')) {
      if (line.length > 0) {
        const request = JSON.parse(line) as JsonObject;
        this.requests.push(request);
        this.script(request, (answer) => this.dataHandler?.(`${JSON.stringify(answer)}\n`));
      }
    }
  }

  async close(): Promise<void> {
    // nichts zu schliessen
  }

  /** Das „Gerät“ schickt von sich aus Text. */
  push(chunk: string): void {
    this.dataHandler?.(chunk);
  }

  onData(handler: (chunk: string) => void): void {
    this.dataHandler = handler;
  }

  onClosed(): void {
    // nicht gebraucht
  }
}

function helloResult(overrides: JsonObject = {}): JsonObject {
  return {
    device: 'heltec_wifi_lora_32_v3',
    chip: 'ESP32-S3',
    device_id: '7CDFA100ABCD',
    fw: { version: '0.1.0', build: '2026-10-22' },
    proto: '1.0',
    state: 'unprovisioned',
    session: { device_eph_pub: 'A'.repeat(43) + '=', nonce: 'AAAAAAAAAAAAAAAAAAAAAA==' },
    limits: { max_line: 2048, max_contacts: 32, max_text_bytes: 83, pending_queue: 8 },
    ...overrides,
  };
}

describe('AntennaPort', () => {
  let harness: AntennaHarness;
  let current: AntennaPort | null = null;

  /** Port mit einer Drehbuch-Leitung (ohne simuliertes Gerät). */
  function scripted(transport: SerialTransport, keystore: KeystoreService = new BrowserKeystoreService()): AntennaPort {
    TestBed.configureTestingModule({
      providers: [
        ...dataProviders,
        { provide: SerialTransport, useValue: transport },
        { provide: KeystoreService, useValue: keystore },
      ],
    });
    current = TestBed.inject(AntennaPort);
    return current;
  }

  /** Port mit simuliertem Gerät. */
  function simulated(options?: Parameters<typeof setupAntennaHarness>[0]): AntennaHarness {
    harness = setupAntennaHarness(options);
    current = harness.antenna;
    return harness;
  }

  afterEach(async () => {
    vi.useRealTimers();
    await current?.disconnect();
    current = null;
  });

  describe('Verbinden', () => {
    it('startet getrennt mit den Grenzen des Vertrags', () => {
      simulated();

      expect(harness.antenna.state()).toBe('disconnected');
      expect(harness.antenna.connecting()).toBe(false);
      expect(harness.antenna.error()).toBeNull();
      expect(harness.antenna.device()).toBeNull();
      expect(harness.antenna.limits()).toEqual(DEFAULT_LIMITS);
    });

    it('verbindet mit einem neuen Gerät und bleibt unprovisioniert', async () => {
      simulated();

      await harness.antenna.connect();

      expect(harness.antenna.state()).toBe('unprovisioned');
      expect(harness.antenna.connected()).toBe(true);
      expect(harness.antenna.error()).toBeNull();
      expect(harness.antenna.device()).toEqual({
        device: 'heltec_wifi_lora_32_v3',
        chip: 'ESP32-S3',
        deviceId: '7CDFA100ABCD',
        fwVersion: '0.1.0',
        fwBuild: '2026-10-22',
        proto: '1.0',
      });
      expect(harness.antenna.limits()).toEqual({ maxLine: 2048, maxContacts: 32, maxTextBytes: 83, pendingQueue: 8 });
    });

    it('entsperrt ein gesperrtes Gerät beim Verbinden von selbst', async () => {
      simulated(provisionedDevice('Test'));

      await harness.antenna.connect();

      expect(harness.antenna.state()).toBe('unlocked');
      expect(harness.antenna.identity()).toEqual({ nodeId: expect.stringMatching(/^[0-9A-F]{4}$/), name: 'Test' });
      expect(harness.antenna.error()).toBeNull();
    });

    it('zeigt connecting() während des Verbindens', async () => {
      simulated();

      const connecting = harness.antenna.connect();

      expect(harness.antenna.connecting()).toBe(true);
      await connecting;
      expect(harness.antenna.connecting()).toBe(false);
    });

    it('verbindet nicht doppelt', async () => {
      simulated();
      const open = vi.spyOn(harness.transport, 'open');

      await Promise.all([harness.antenna.connect(), harness.antenna.connect()]);
      await harness.antenna.connect();

      expect(open).toHaveBeenCalledTimes(1);
    });

    it('trennt mit disconnect() ohne Fehler', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();

      await harness.antenna.disconnect();

      expect(harness.antenna.state()).toBe('disconnected');
      expect(harness.antenna.error()).toBeNull();
      expect(harness.antenna.device()).toBeNull();
      expect(harness.antenna.identity()).toBeNull();
    });

    it('lässt sich nach dem Trennen erneut verbinden und entsperren', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();
      await harness.antenna.disconnect();

      await harness.antenna.connect();

      expect(harness.antenna.state()).toBe('unlocked');
    });
  });

  describe('Verbindungsfehler', () => {
    it.each([
      ['no-device', 'Kein Gerät'],
      ['permission-denied', 'Keine Berechtigung'],
      ['open-failed', 'Öffnen gescheitert'],
    ] as const)('meldet %s vom Transport', async (code, message) => {
      const transport = new ScriptedTransport(() => undefined);
      transport.openError = new TransportError(code, message);
      const antenna = scripted(transport);

      await antenna.connect();

      expect(antenna.state()).toBe('disconnected');
      expect(antenna.error()).toBe(code);
      expect(antenna.connecting()).toBe(false);
    });

    it('meldet proto-mismatch bei einer anderen Hauptversion', async () => {
      const transport = new ScriptedTransport((request, reply) =>
        reply({ id: request['id'] as number, ok: true, result: helloResult({ proto: '2.0' }) }),
      );
      const antenna = scripted(transport);

      await antenna.connect();

      expect(antenna.state()).toBe('disconnected');
      expect(antenna.error()).toBe('proto-mismatch');
    });

    it('meldet proto-mismatch, wenn das Gerät E_PROTO_MISMATCH antwortet', async () => {
      const transport = new ScriptedTransport((request, reply) =>
        reply({ id: request['id'] as number, ok: false, error: { code: 'E_PROTO_MISMATCH', message: 'x' } }),
      );
      const antenna = scripted(transport);

      await antenna.connect();

      expect(antenna.error()).toBe('proto-mismatch');
    });

    it('wiederholt sys.hello und gibt dann mit no-hello auf, wenn das Gerät schweigt', async () => {
      vi.useFakeTimers();
      const transport = new ScriptedTransport(() => undefined);
      const antenna = scripted(transport);

      const connecting = antenna.connect();
      await vi.advanceTimersByTimeAsync(500 * 9 + 2000);
      await connecting;

      expect(transport.requests.filter((request) => request['cmd'] === 'sys.hello')).toHaveLength(10);
      expect(antenna.error()).toBe('no-hello');
      expect(antenna.state()).toBe('disconnected');
    });

    it('meldet lost, wenn die Antwort auf sys.hello kaputt ist', async () => {
      const transport = new ScriptedTransport((request, reply) =>
        reply({ id: request['id'] as number, ok: true, result: { device: 'x' } }),
      );
      const antenna = scripted(transport);

      await antenna.connect();

      expect(antenna.error()).toBe('no-hello');
    });

    it('meldet lost, wenn das Kabel gezogen wird', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();

      harness.transport.unplug();

      await vi.waitFor(() => expect(harness.antenna.state()).toBe('disconnected'));
      expect(harness.antenna.error()).toBe('lost');
    });

    it('meldet lost, wenn zwei Heartbeats in Folge unbeantwortet bleiben', async () => {
      vi.useFakeTimers();
      const transport = new ScriptedTransport((request, reply) => {
        if (request['cmd'] === 'sys.hello') {
          reply({ id: request['id'] as number, ok: true, result: helloResult() });
        }
      });
      const antenna = scripted(transport);
      await antenna.connect();
      expect(antenna.state()).toBe('unprovisioned');

      await vi.advanceTimersByTimeAsync(5000 + 2000);
      expect(antenna.state()).toBe('unprovisioned');
      await vi.advanceTimersByTimeAsync(5000 + 2000);

      expect(transport.requests.filter((request) => request['cmd'] === 'sys.ping')).toHaveLength(2);
      expect(antenna.state()).toBe('disconnected');
      expect(antenna.error()).toBe('lost');
    });

    it('sendet alle 5 s sys.ping als Heartbeat, solange das Gerät antwortet', async () => {
      vi.useFakeTimers();
      const transport = new ScriptedTransport((request, reply) => {
        const id = request['id'] as number;
        reply(
          request['cmd'] === 'sys.hello'
            ? { id, ok: true, result: helloResult() }
            : { id, ok: true, result: { uptime_ms: 1 } },
        );
      });
      const antenna = scripted(transport);
      await antenna.connect();

      await vi.advanceTimersByTimeAsync(5000 * 3);

      expect(transport.requests.filter((request) => request['cmd'] === 'sys.ping')).toHaveLength(3);
      expect(antenna.state()).toBe('unprovisioned');
    });
  });

  describe('Einrichten und Entsperren', () => {
    it('richtet ein neues Gerät mit provision() ein', async () => {
      simulated();
      await harness.antenna.connect();

      const ok = await harness.antenna.provision('Alice');

      expect(ok).toBe(true);
      expect(harness.antenna.state()).toBe('unlocked');
      expect(harness.antenna.identity()).toMatchObject({ name: 'Alice' });
      expect(harness.antenna.error()).toBeNull();
    });

    it('meldet bei einem zu langen Namen einen Fehler und bleibt unprovisioniert', async () => {
      simulated();
      await harness.antenna.connect();

      const ok = await harness.antenna.provision('a'.repeat(25));

      expect(ok).toBe(false);
      expect(harness.antenna.state()).toBe('unprovisioned');
      expect(harness.antenna.error()).toBe('unlock-failed');
    });

    it('tut bei provision() auf einem schon eingerichteten Gerät nichts', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();
      const requests = vi.spyOn(harness.antenna, 'request');

      expect(await harness.antenna.provision('Egal')).toBe(true);
      expect(requests).not.toHaveBeenCalled();
    });

    it('meldet unlock-failed bei einem Token eines anderen Handys', async () => {
      simulated();
      await harness.antenna.connect();
      await harness.antenna.provision('Alice');
      harness.device.reboot();
      harness.keystore.useKey(new Uint8Array(32).fill(5));

      await vi.waitFor(() => expect(harness.antenna.error()).toBe('unlock-failed'));

      expect(harness.antenna.state()).toBe('locked');
    });

    it('meldet rate-limited nach drei Fehlversuchen', async () => {
      simulated();
      await harness.antenna.connect();
      await harness.antenna.provision('Alice');
      harness.device.reboot();
      harness.keystore.useKey(new Uint8Array(32).fill(5));
      await vi.waitFor(() => expect(harness.antenna.error()).toBe('unlock-failed'));

      expect(await harness.antenna.unlock()).toBe(false);
      expect(await harness.antenna.unlock()).toBe(false);
      expect(harness.antenna.error()).toBe('unlock-failed');
      expect(await harness.antenna.unlock()).toBe(false);

      expect(harness.antenna.error()).toBe('rate-limited');
    });

    it('meldet keystore-failed, wenn der Schlüsselspeicher scheitert', async () => {
      class BrokenKeystore extends KeystoreService {
        protected hmac(): Promise<Uint8Array> {
          return Promise.reject(new Error('Keystore gesperrt'));
        }
      }
      const antenna = scripted(new LoopbackTransport(provisionedDevice()), new BrokenKeystore());

      await antenna.connect();

      expect(antenna.state()).toBe('locked');
      expect(antenna.error()).toBe('keystore-failed');
    });

    it('holt für jeden Versuch eine neue Sitzung (sys.hello vor sec.unlock)', async () => {
      const transport = new LoopbackTransport(provisionedDevice());
      const lines: string[] = [];
      const write = transport.write.bind(transport);
      vi.spyOn(transport, 'write').mockImplementation((text: string) => {
        lines.push(text);
        return write(text);
      });
      const antenna = scripted(transport);
      await antenna.connect();
      await antenna.lock();
      lines.length = 0;

      await antenna.unlock();

      const commands = lines.map((line) => (JSON.parse(line) as { cmd: string }).cmd);
      expect(commands).toEqual(['sys.hello', 'sec.unlock']);
      expect(antenna.state()).toBe('unlocked');
    });

    it('sperrt mit lock() und entsperrt mit unlock()', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();

      await harness.antenna.lock();
      expect(harness.antenna.state()).toBe('locked');
      expect(harness.antenna.identity()).toBeNull();

      expect(await harness.antenna.unlock()).toBe(true);
      expect(harness.antenna.state()).toBe('unlocked');
    });

    it('entsperrt nach lock() nicht von selbst wieder', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();

      await harness.antenna.lock();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(harness.antenna.state()).toBe('locked');
    });
  });

  describe('Ereignisse des Geräts', () => {
    it('entsperrt nach einem Neustart des Geräts von selbst wieder', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();
      const events: DeviceEvent[] = [];
      harness.antenna.events.subscribe((event) => events.push(event));

      harness.device.reboot();

      expect(harness.antenna.state()).toBe('locked');
      await vi.waitFor(() => expect(harness.antenna.state()).toBe('unlocked'));
      expect(events.map((event) => event.evt)).toContain('sys.boot');
    });

    it('entsperrt nach dem Auto-Lock von selbst wieder', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();
      const events: DeviceEvent[] = [];
      harness.antenna.events.subscribe((event) => events.push(event));

      harness.device.lockNow('heartbeat_timeout');

      await vi.waitFor(() => expect(events.some((event) => event.evt === 'sec.state')).toBe(true));
      await vi.waitFor(() => expect(harness.antenna.state()).toBe('unlocked'));
    });

    it('gibt eingehende Nachrichten, Status und Kontaktzustand als typisierte Ereignisse weiter', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();
      const events: DeviceEvent[] = [];
      harness.antenna.events.subscribe((event) => events.push(event));

      harness.device.injectText(2, 'Hallo!');
      await harness.antenna.request('msg.send', { to: 1, type: 'text', text: 'hi' });
      await vi.waitFor(() => expect(events.filter((event) => event.evt === 'msg.status').length).toBeGreaterThan(0));

      expect(events.find((event) => event.evt === 'msg.received')).toMatchObject({
        message: { from: 2, type: 'text', text: 'Hallo!', ctr: 1, rssi: -92, snr: 7.5 },
      });
      expect(events.find((event) => event.evt === 'contact.state')).toMatchObject({ contactId: 2, state: 'active' });
      expect(events.find((event) => event.evt === 'msg.status')).toMatchObject({ status: { msgRef: 1, to: 1, state: 'sent' } });
    });

    it('ignoriert Ereignisse, die die App nicht auswertet, und kaputte Ereignisse', async () => {
      const transport = new ScriptedTransport((request, reply) =>
        reply({ id: request['id'] as number, ok: true, result: helloResult() }),
      );
      const antenna = scripted(transport);
      const events: DeviceEvent[] = [];
      antenna.events.subscribe((event) => events.push(event));
      await antenna.connect();

      transport.push('{"evt":"log","t":1,"data":{"level":"info","msg":"x"}}\n');
      transport.push('{"evt":"rf.tx","t":2,"data":{}}\n');
      transport.push('{"evt":"msg.status","t":3,"data":{"msg_ref":"eins"}}\n');

      expect(events).toEqual([]);
    });

    it('zieht den Zustand nach, wenn ein Befehl E_LOCKED meldet', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();
      harness.device.lockNow('lock');

      const error: unknown = await harness.antenna.request('id.get').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toMatchObject({ code: 'E_LOCKED' });
      expect(harness.antenna.state()).not.toBe('unlocked');
    });
  });

  describe('request', () => {
    it('wirft E_DISCONNECTED, solange nicht verbunden', async () => {
      simulated();

      await expect(harness.antenna.request('sys.status')).rejects.toMatchObject({ code: 'E_DISCONNECTED' });
    });

    it('reicht Ergebnis und Fehlercode des Geräts durch', async () => {
      simulated(provisionedDevice());
      await harness.antenna.connect();

      await expect(harness.antenna.request('contact.get', { contact_id: 1 })).resolves.toMatchObject({
        contact: { name: 'Anna' },
      });
      await expect(harness.antenna.request('contact.get', { contact_id: 9 })).rejects.toMatchObject({
        code: 'E_NO_SUCH_CONTACT',
        field: 'contact_id',
      });
    });
  });
});
