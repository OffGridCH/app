import { vi } from 'vitest';

import { fromBase64, toBase64 } from '../crypto/base64';
import { BrowserKeystoreService } from '../keystore/browser-keystore.service';
import type { DeviceSession, JsonObject } from '../models/device';
import { FAST_TIMING, TEST_CONTACTS } from './antenna-harness.testing';
import { DeviceError } from './device-error';
import { MockDevice, fingerprintOf, loraAirtimeMs, nodeIdOf, type MockDeviceOptions } from './mock-device';
import { SerialClient, type RawEvent } from './serial-client';

const ALICE_PUBLIC = 'Losog8J7ORNZ19DBXQCBWmaTKQo43Y66NBzAfdqo7U0=';
const BOB_PUBLIC = 'wLEmtaoTS4TmRiUla43olzeHYSsfODnSxgUm0hFOiG0=';
/** Der QR-Text von Bob aus Offgrid Host Interface v1, §11.3. */
const BOB_QR = 'T0cxwLEmtaoTS4TmRiUla43olzeHYSsfODnSxgUm0hFOiG0gISIjJCUmJygpKissLS4vQm9i';

/** Ein Client, der direkt mit einem simulierten Gerät spricht. */
class Rig {
  readonly device: MockDevice;
  readonly client: SerialClient;
  readonly events: RawEvent[] = [];
  readonly keystore = new BrowserKeystoreService();

  constructor(options: Partial<MockDeviceOptions> = {}) {
    this.client = new SerialClient(async (line) => this.device.receiveLine(line));
    this.device = new MockDevice((line) => this.client.receive(line), {
      ...options,
      timing: { ...FAST_TIMING, ...options.timing },
    });
    this.client.onEvent((event) => this.events.push(event));
    this.client.open();
    this.device.start();
  }

  call(cmd: string, args?: JsonObject): Promise<JsonObject> {
    return this.client.request(cmd, args);
  }

  async hello(): Promise<{ session: DeviceSession; deviceId: string; result: JsonObject }> {
    const result = await this.call('sys.hello', { app: 'test', app_proto: '1.0' });
    const session = result['session'] as { device_eph_pub: string; nonce: string };
    return {
      session: { deviceEphPub: session.device_eph_pub, nonce: session.nonce },
      deviceId: String(result['device_id']),
      result,
    };
  }

  async authenticate(cmd: 'sec.provision' | 'sec.unlock', extra: JsonObject = {}): Promise<JsonObject> {
    const { session, deviceId } = await this.hello();
    const envelope = await this.keystore.createUnlockEnvelope(session, deviceId);
    return this.call(cmd, { app_eph_pub: envelope.appEphPub, wrapped_token: envelope.wrappedToken, ...extra });
  }

  /** Richtet das Gerät ein und entsperrt es. */
  async provision(name = 'Alice'): Promise<JsonObject> {
    return this.authenticate('sec.provision', { name });
  }

  eventsNamed(evt: string): RawEvent[] {
    return this.events.filter((event) => event.evt === evt);
  }

  waitForEvent(evt: string, count = 1): Promise<void> {
    return vi.waitFor(() => expect(this.eventsNamed(evt).length).toBeGreaterThanOrEqual(count), { timeout: 2000 });
  }

  async error(cmd: string, args?: JsonObject): Promise<DeviceError> {
    const caught: unknown = await this.call(cmd, args).then(
      () => null,
      (error: unknown) => error,
    );
    if (!(caught instanceof DeviceError)) {
      throw new Error(`${cmd} hätte fehlschlagen müssen`);
    }
    return caught;
  }

  dispose(): void {
    this.client.close();
    this.device.dispose();
  }
}

/** Ein eingerichtetes, entsperrtes Gerät mit zwei Kontakten. */
async function unlockedRig(): Promise<Rig> {
  const rig = new Rig({ state: 'locked', identityName: 'Test', contacts: TEST_CONTACTS.map((c) => ({ ...c })), adoptFirstToken: true });
  await rig.authenticate('sec.unlock');
  return rig;
}

describe('MockDevice', () => {
  let rig: Rig;

  afterEach(() => rig.dispose());

  describe('Start und sys.hello', () => {
    it('meldet sich beim Start mit sys.boot', () => {
      rig = new Rig();

      expect(rig.eventsNamed('sys.boot')).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            device_id: '7CDFA100ABCD',
            fw: '0.1.0',
            proto: '1.0',
            state: 'unprovisioned',
            reset_reason: 'power_on',
          }),
        }),
      ]);
    });

    it('antwortet auf sys.hello mit Geräteinfo, Sitzung und den Grenzen des Vertrags', async () => {
      rig = new Rig();

      const { result } = await rig.hello();

      expect(result).toMatchObject({
        device: 'heltec_wifi_lora_32_v3',
        chip: 'ESP32-S3',
        device_id: '7CDFA100ABCD',
        fw: { version: '0.1.0', build: '2026-10-22' },
        proto: '1.0',
        state: 'unprovisioned',
        limits: { max_line: 2048, max_contacts: 32, max_text_bytes: 83, pending_queue: 8 },
      });
      const session = result['session'] as { device_eph_pub: string; nonce: string };
      expect(fromBase64(session.device_eph_pub)).toHaveLength(32);
      expect(fromBase64(session.nonce)).toHaveLength(16);
    });

    it('gibt bei jedem sys.hello eine neue Sitzung', async () => {
      rig = new Rig();

      const first = await rig.hello();
      const second = await rig.hello();

      expect(first.session.deviceEphPub).not.toBe(second.session.deviceEphPub);
      expect(first.session.nonce).not.toBe(second.session.nonce);
    });

    it('lehnt eine andere Hauptversion mit E_PROTO_MISMATCH ab', async () => {
      rig = new Rig();

      const error = await rig.error('sys.hello', { app: 'test', app_proto: '2.0' });

      expect(error.code).toBe('E_PROTO_MISMATCH');
    });

    it('beantwortet sys.ping mit der Betriebszeit und sys.status in jedem Zustand', async () => {
      rig = new Rig();

      expect(await rig.call('sys.ping')).toEqual({ uptime_ms: expect.any(Number) });
      expect(await rig.call('sys.status')).toMatchObject({
        state: 'unprovisioned',
        radio: { running: false, relay_only: false },
        security: { secure_boot: false, flash_encryption: false },
      });
      expect(Object.keys(await rig.call('sys.status'))).not.toContain('queue');
    });

    it('meldet bei sys.status im entsperrten Zustand Warteschlange und Kontakte', async () => {
      rig = await unlockedRig();

      expect(await rig.call('sys.status')).toMatchObject({
        state: 'unlocked',
        radio: { running: true, relay_only: false },
        queue: { pending: 0, capacity: 8 },
        contacts: { used: 2, capacity: 32 },
      });
    });
  });

  describe('Zeilen', () => {
    it('antwortet auf kaputtes JSON mit E_PARSE ohne id', async () => {
      rig = new Rig();
      const replies: string[] = [];
      const device = new MockDevice((line) => replies.push(line), { timing: FAST_TIMING });
      device.start();

      device.receiveLine('{kaputt');
      await vi.waitFor(() => expect(replies.length).toBeGreaterThan(2));

      const response = JSON.parse(replies[replies.length - 1]) as JsonObject;
      expect(response).toEqual({ ok: false, error: { code: 'E_PARSE', message: expect.any(String) } });
      device.dispose();
    });

    it('meldet einen unbekannten Befehl mit E_UNKNOWN_CMD', async () => {
      rig = new Rig();

      expect((await rig.error('foo.bar')).code).toBe('E_UNKNOWN_CMD');
      expect((await rig.error('dbg.rf_trace', { enabled: true })).code).toBe('E_UNKNOWN_CMD');
    });

    it('toleriert ein CR am Zeilenende', async () => {
      rig = new Rig();
      const replies: string[] = [];
      const device = new MockDevice((line) => replies.push(line), { timing: FAST_TIMING });
      device.start();

      device.receiveLine('{"id":1,"cmd":"sys.ping"}\r');
      await vi.waitFor(() => expect(replies.some((line) => line.includes('"id":1'))).toBe(true));
      device.dispose();
    });
  });

  describe('Zustände und Zugriff', () => {
    it('lehnt Befehle ohne Tresor mit E_NOT_PROVISIONED ab', async () => {
      rig = new Rig();

      for (const cmd of ['id.get', 'pair.begin', 'contact.list', 'msg.pending', 'radio.set', 'sec.unlock', 'sec.lock']) {
        expect((await rig.error(cmd, cmd === 'radio.set' ? {} : undefined)).code).toBe('E_NOT_PROVISIONED');
      }
    });

    it('lehnt Befehle bei gesperrtem Gerät mit E_LOCKED ab', async () => {
      rig = new Rig({ state: 'locked', identityName: 'Test' });

      for (const cmd of ['id.get', 'pair.begin', 'contact.list', 'msg.pending', 'sec.lock']) {
        expect((await rig.error(cmd)).code).toBe('E_LOCKED');
      }
      expect((await rig.error('msg.send', { to: 1, type: 'text', text: 'hi' })).code).toBe('E_LOCKED');
    });

    it('lässt radio.get, mesh.get und led.get in jedem Zustand zu', async () => {
      rig = new Rig({ state: 'locked', identityName: 'Test' });

      expect(await rig.call('radio.get')).toMatchObject({ sf: 9 });
      expect(await rig.call('mesh.get')).toMatchObject({ hop_default: 3 });
      expect(await rig.call('led.get')).toMatchObject({ enabled: true });
    });

    it('meldet E_ALREADY_PROVISIONED bei sec.provision auf einem eingerichteten Gerät', async () => {
      rig = new Rig({ state: 'locked', identityName: 'Test' });

      expect((await rig.error('sec.provision', {})).code).toBe('E_ALREADY_PROVISIONED');
    });

    it('meldet E_ALREADY_UNLOCKED bei sec.unlock auf einem entsperrten Gerät', async () => {
      rig = await unlockedRig();

      expect((await rig.error('sec.unlock', {})).code).toBe('E_ALREADY_UNLOCKED');
    });
  });

  describe('sec.provision und sec.unlock', () => {
    it('richtet das Gerät mit dem verpackten Token ein', async () => {
      rig = new Rig();

      const result = await rig.provision('Alice');

      expect(result).toMatchObject({ name: 'Alice', state: 'unlocked', node_id: expect.stringMatching(/^[0-9A-F]{4}$/) });
      expect(fromBase64(String(result['public_key']))).toHaveLength(32);
      expect(await rig.call('sys.status')).toMatchObject({ state: 'unlocked' });
    });

    it('sendet sec.state nach der Antwort', async () => {
      rig = new Rig();

      await rig.provision('Alice');
      await rig.waitForEvent('sec.state');

      expect(rig.eventsNamed('sec.state')[0].data).toEqual({ state: 'unlocked', reason: 'provision' });
    });

    it('gibt Default-Namen Offgrid-XXXX, wenn kein Name kommt', async () => {
      rig = new Rig();

      const result = await rig.authenticate('sec.provision');

      expect(result['name']).toMatch(/^Offgrid-[0-9A-F]{4}$/);
    });

    it('lehnt einen zu langen Namen mit E_INVALID_ARG ab', async () => {
      rig = new Rig();

      const error = await rig
        .authenticate('sec.provision', { name: 'a'.repeat(25) })
        .then(() => null, (e: unknown) => e as DeviceError);

      expect(error).toMatchObject({ code: 'E_INVALID_ARG', field: 'name' });
    });

    it('entsperrt nach einem Neustart mit demselben Schlüssel des Handys', async () => {
      rig = new Rig();
      await rig.provision('Alice');
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);
      expect(rig.eventsNamed('sys.boot')[1].data).toMatchObject({ state: 'locked' });

      const result = await rig.authenticate('sec.unlock');

      expect(result).toMatchObject({ state: 'unlocked', name: 'Alice', contacts: 0, radio: { running: true, relay_only: false } });
    });

    it('lehnt ein Token eines anderen Handys mit E_UNLOCK_FAILED ab', async () => {
      rig = new Rig();
      await rig.provision('Alice');
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);
      rig.keystore.useKey(new Uint8Array(32).fill(7));

      const error = await rig.authenticate('sec.unlock').then(() => null, (e: unknown) => e as DeviceError);

      expect(error).toMatchObject({ code: 'E_UNLOCK_FAILED' });
    });

    it('verbraucht die Sitzung bei jedem Versuch (E_NO_SESSION)', async () => {
      rig = new Rig();
      const { session, deviceId } = await rig.hello();
      const envelope = await rig.keystore.createUnlockEnvelope(session, deviceId);
      const args = { app_eph_pub: envelope.appEphPub, wrapped_token: envelope.wrappedToken, name: 'Alice' };

      await rig.call('sec.provision', args);
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);

      expect((await rig.error('sec.unlock', args)).code).toBe('E_NO_SESSION');
    });

    it('lässt einen aufgezeichneten Wrap nicht erneut zu (Replay)', async () => {
      rig = new Rig();
      await rig.provision('Alice');
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);
      const first = await rig.hello();
      const envelope = await rig.keystore.createUnlockEnvelope(first.session, first.deviceId);
      const args = { app_eph_pub: envelope.appEphPub, wrapped_token: envelope.wrappedToken };
      await rig.call('sec.unlock', args);
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 3);
      await rig.hello();

      expect((await rig.error('sec.unlock', args)).code).toBe('E_UNLOCK_FAILED');
    });

    it('lehnt ein Argument falscher Länge mit E_INVALID_ARG ab', async () => {
      rig = new Rig();
      await rig.hello();

      const error = await rig.error('sec.provision', {
        app_eph_pub: toBase64(new Uint8Array(32)),
        wrapped_token: toBase64(new Uint8Array(59)),
      });

      expect(error).toMatchObject({ code: 'E_INVALID_ARG', field: 'wrapped_token' });
    });

    it('antwortet nach 3 Fehlversuchen mit E_RATE_LIMITED', async () => {
      rig = new Rig();
      await rig.provision('Alice');
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);
      rig.keystore.useKey(new Uint8Array(32).fill(1));

      for (let attempt = 0; attempt < 3; attempt++) {
        const error = await rig.authenticate('sec.unlock').then(() => null, (e: unknown) => e as DeviceError);
        expect(error).toMatchObject({ code: 'E_UNLOCK_FAILED' });
      }

      const blocked = await rig.authenticate('sec.unlock').then(() => null, (e: unknown) => e as DeviceError);
      expect(blocked).toMatchObject({ code: 'E_RATE_LIMITED' });
    });

    it('nimmt im Demo-Modus das erste Token an und behält es', async () => {
      rig = new Rig({ state: 'locked', identityName: 'Demo', adoptFirstToken: true });
      await rig.authenticate('sec.unlock');
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);

      await expect(rig.authenticate('sec.unlock')).resolves.toMatchObject({ state: 'unlocked' });

      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 3);
      rig.keystore.useKey(new Uint8Array(32).fill(9));
      const error = await rig.authenticate('sec.unlock').then(() => null, (e: unknown) => e as DeviceError);
      expect(error).toMatchObject({ code: 'E_UNLOCK_FAILED' });
    });

    it('sperrt mit sec.lock und meldet sec.state', async () => {
      rig = await unlockedRig();

      expect(await rig.call('sec.lock')).toEqual({ state: 'locked' });
      await rig.waitForEvent('sec.state', 2);

      expect(rig.eventsNamed('sec.state')[1].data).toEqual({ state: 'locked', reason: 'lock' });
      expect((await rig.error('id.get')).code).toBe('E_LOCKED');
    });

    it('sperrt sich ohne Lebenszeichen von selbst und lässt wartende Nachrichten mit Grund locked scheitern', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        contacts: TEST_CONTACTS.map((c) => ({ ...c })),
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, lockTimeout: 80, delivered: 5000, relayed: 5000, sent: 5000 },
      });
      await rig.authenticate('sec.unlock');
      await rig.call('msg.send', { to: 1, type: 'text', text: 'hi' });

      await rig.waitForEvent('sec.state', 2);

      expect(rig.eventsNamed('sec.state')[1].data).toEqual({ state: 'locked', reason: 'heartbeat_timeout' });
      expect(rig.eventsNamed('msg.status')[0].data).toMatchObject({ msg_ref: 1, to: 1, state: 'failed', reason: 'locked' });
    });

    it('zählt jede gültige Zeile als Lebenszeichen, nicht nur sys.ping', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, lockTimeout: 120 },
      });
      await rig.authenticate('sec.unlock');

      for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        await rig.call('id.get');
      }

      expect(rig.eventsNamed('sec.state')).toHaveLength(1);
    });
  });

  describe('Identität', () => {
    it('liefert id.get und ändert den Namen mit id.set_name', async () => {
      rig = await unlockedRig();

      expect(await rig.call('id.get')).toMatchObject({ name: 'Test', node_id: expect.any(String) });
      await rig.call('id.set_name', { name: 'Neuer Name' });
      expect(await rig.call('id.get')).toMatchObject({ name: 'Neuer Name' });
      expect((await rig.error('id.set_name', { name: '' })).code).toBe('E_INVALID_ARG');
      expect((await rig.error('id.set_name', { name: 'ä'.repeat(13) })).code).toBe('E_INVALID_ARG');
    });
  });

  describe('Pairing', () => {
    it('berechnet node_id und Fingerabdruck wie die Spezifikation', async () => {
      expect(await nodeIdOf(fromBase64(ALICE_PUBLIC))).toBe('E3F0');
      expect(await nodeIdOf(fromBase64(BOB_PUBLIC))).toBe('E841');
      expect(await fingerprintOf(fromBase64(ALICE_PUBLIC), fromBase64(BOB_PUBLIC))).toBe('0501 3010 7790');
      expect(await fingerprintOf(fromBase64(BOB_PUBLIC), fromBase64(ALICE_PUBLIC))).toBe('0501 3010 7790');
    });

    it('liefert in pair.begin den QR-Text: Base64 von "OG1" + Public Key + Salz + Name', async () => {
      rig = await unlockedRig();

      const result = await rig.call('pair.begin');

      const bytes = fromBase64(String(result['qr']));
      expect(new TextDecoder().decode(bytes.slice(0, 3))).toBe('OG1');
      expect(toBase64(bytes.slice(3, 35))).toBe(String((await rig.call('id.get'))['public_key']));
      expect(new TextDecoder().decode(bytes.slice(51))).toBe('Test');
      expect(result).toMatchObject({ qr_bytes: bytes.length, expires_s: 300 });
    });

    it('legt mit pair.complete einen ausstehenden Kontakt mit Fingerabdruck an', async () => {
      rig = await unlockedRig();
      await rig.call('pair.begin');

      const result = await rig.call('pair.complete', { qr: BOB_QR });

      expect(result['warnings']).toEqual([]);
      expect(result['contact']).toEqual({
        contact_id: 3,
        name: 'Bob',
        node_id: 'E841',
        public_key: BOB_PUBLIC,
        state: 'pending',
        fingerprint: expect.stringMatching(/^\d{4} \d{4} \d{4}$/),
        tx_ctr: 0,
        rx_highest_ctr: null,
        last_rssi: null,
        last_snr: null,
      });
    });

    it('zeigt auf beiden Seiten denselben Fingerabdruck, wenn der Austausch nicht verfälscht wurde', async () => {
      const first = await unlockedRig();
      const second = new Rig({ state: 'locked', identityName: 'Zwei', adoptFirstToken: true });
      await second.authenticate('sec.unlock');
      try {
        const firstQr = String((await first.call('pair.begin'))['qr']);
        const secondQr = String((await second.call('pair.begin'))['qr']);

        const firstContact = (await first.call('pair.complete', { qr: secondQr }))['contact'] as JsonObject;
        const secondContact = (await second.call('pair.complete', { qr: firstQr }))['contact'] as JsonObject;

        expect(firstContact['fingerprint']).toBe(secondContact['fingerprint']);
      } finally {
        second.dispose();
        rig = first;
      }
    });

    it('übernimmt den Namen aus args.name statt aus dem Code', async () => {
      rig = await unlockedRig();
      await rig.call('pair.begin');

      const result = await rig.call('pair.complete', { qr: BOB_QR, name: 'Robert' });

      expect(result['contact']).toMatchObject({ name: 'Robert' });
    });

    it('macht den Kontakt nach dem ersten gültigen Paket des Gegenübers aktiv (contact.state)', async () => {
      rig = await unlockedRig();
      await rig.call('pair.begin');
      await rig.call('pair.complete', { qr: BOB_QR });

      await rig.waitForEvent('contact.state');

      expect(rig.eventsNamed('contact.state')[0].data).toEqual({ contact_id: 3, state: 'active' });
      expect((await rig.call('contact.get', { contact_id: 3 }))['contact']).toMatchObject({ state: 'active' });
    });

    it('meldet E_NO_PAIRING ohne pair.begin', async () => {
      rig = await unlockedRig();

      expect((await rig.error('pair.complete', { qr: BOB_QR })).code).toBe('E_NO_PAIRING');
    });

    it('verwirft das offene Pairing mit pair.cancel', async () => {
      rig = await unlockedRig();
      await rig.call('pair.begin');

      expect(await rig.call('pair.cancel')).toEqual({ cancelled: true });
      expect((await rig.error('pair.complete', { qr: BOB_QR })).code).toBe('E_NO_PAIRING');
    });

    it('meldet E_INVALID_QR bei falschem Base64, falscher Kennung oder zu kurzem Code', async () => {
      rig = await unlockedRig();
      await rig.call('pair.begin');

      expect((await rig.error('pair.complete', { qr: '!!!' })).code).toBe('E_INVALID_QR');
      expect((await rig.error('pair.complete', { qr: toBase64(new TextEncoder().encode('XX1'.padEnd(60, 'a'))) })).code).toBe(
        'E_INVALID_QR',
      );
      expect((await rig.error('pair.complete', { qr: toBase64(new TextEncoder().encode('OG1abc')) })).code).toBe('E_INVALID_QR');
    });

    it('meldet E_SELF_PAIR beim eigenen Code', async () => {
      rig = await unlockedRig();
      const own = String((await rig.call('pair.begin'))['qr']);

      expect((await rig.error('pair.complete', { qr: own })).code).toBe('E_SELF_PAIR');
    });

    it('meldet E_CONTACT_EXISTS bei doppeltem Schlüssel und ersetzt mit replace: true', async () => {
      rig = await unlockedRig();
      await rig.call('pair.begin');
      await rig.call('pair.complete', { qr: BOB_QR });
      await rig.call('pair.begin');
      expect((await rig.error('pair.complete', { qr: BOB_QR })).code).toBe('E_CONTACT_EXISTS');

      const result = await rig.call('pair.complete', { qr: BOB_QR, replace: true });

      expect(result['contact']).toMatchObject({ contact_id: 3, state: 'pending', tx_ctr: 0 });
    });

    it('meldet E_STORAGE_FULL, wenn alle 32 Plätze belegt sind', async () => {
      const contacts = Array.from({ length: 32 }, (_, i) => ({
        ...TEST_CONTACTS[0],
        contact_id: i + 1,
        name: `K${i + 1}`,
        public_key: toBase64(new Uint8Array(32).fill(i + 1)),
      }));
      rig = new Rig({ state: 'locked', identityName: 'Test', contacts, adoptFirstToken: true });
      await rig.authenticate('sec.unlock');
      await rig.call('pair.begin');

      expect((await rig.error('pair.complete', { qr: BOB_QR })).code).toBe('E_STORAGE_FULL');
    });

    it('warnt bei gleicher node_id (node_id_collision)', async () => {
      const contacts = [{ ...TEST_CONTACTS[0], node_id: 'E841', public_key: toBase64(new Uint8Array(32).fill(3)) }];
      rig = new Rig({ state: 'locked', identityName: 'Test', contacts, adoptFirstToken: true });
      await rig.authenticate('sec.unlock');
      await rig.call('pair.begin');

      const result = await rig.call('pair.complete', { qr: BOB_QR });

      expect(result['warnings']).toEqual(['node_id_collision']);
    });
  });

  describe('Kontakte', () => {
    it('liefert contact.list seitenweise (höchstens 10, und die Antwort passt in eine Zeile)', async () => {
      const contacts = Array.from({ length: 12 }, (_, i) => ({
        ...TEST_CONTACTS[0],
        contact_id: i + 1,
        name: `K${i + 1}`,
        public_key: toBase64(new Uint8Array(32).fill(i + 1)),
      }));
      rig = new Rig({ state: 'locked', identityName: 'Test', contacts, adoptFirstToken: true });
      await rig.authenticate('sec.unlock');

      const first = await rig.call('contact.list');
      const firstPage = first['contacts'] as JsonObject[];
      const second = await rig.call('contact.list', { offset: firstPage.length });

      expect(first).toMatchObject({ total: 12, offset: 0 });
      expect(firstPage.length).toBeLessThanOrEqual(10);
      expect(firstPage.length + (second['contacts'] as JsonObject[]).length).toBe(12);
      expect((await rig.error('contact.list', { limit: 11 })).code).toBe('E_INVALID_ARG');
    });

    it('liefert contact.get und meldet E_NO_SUCH_CONTACT für einen leeren Platz', async () => {
      rig = await unlockedRig();

      expect((await rig.call('contact.get', { contact_id: 1 }))['contact']).toMatchObject({ name: 'Anna', node_id: 'ECE4' });
      expect(await rig.error('contact.get', { contact_id: 9 })).toMatchObject({ code: 'E_NO_SUCH_CONTACT', field: 'contact_id' });
      expect((await rig.error('contact.get', { contact_id: 0 })).code).toBe('E_INVALID_ARG');
      expect((await rig.error('contact.get', {})).code).toBe('E_INVALID_ARG');
    });

    it('enthält nie Schlüssel in einem Kontakt-Objekt', async () => {
      rig = await unlockedRig();

      const contact = (await rig.call('contact.get', { contact_id: 1 }))['contact'] as JsonObject;

      expect(Object.keys(contact).sort()).toEqual(
        ['contact_id', 'fingerprint', 'last_rssi', 'last_snr', 'name', 'node_id', 'public_key', 'rx_highest_ctr', 'state', 'tx_ctr'].sort(),
      );
    });

    it('benennt mit contact.rename um', async () => {
      rig = await unlockedRig();

      await rig.call('contact.rename', { contact_id: 1, name: 'Anna M.' });

      expect((await rig.call('contact.get', { contact_id: 1 }))['contact']).toMatchObject({ name: 'Anna M.' });
      expect((await rig.error('contact.rename', { contact_id: 1, name: 'a'.repeat(25) })).code).toBe('E_INVALID_ARG');
    });

    it('löscht mit contact.delete nur mit confirm: true', async () => {
      rig = await unlockedRig();

      expect((await rig.error('contact.delete', { contact_id: 1 })).code).toBe('E_CONFIRM_REQUIRED');
      await rig.call('contact.delete', { contact_id: 1, confirm: true });

      expect((await rig.error('contact.get', { contact_id: 1 })).code).toBe('E_NO_SUCH_CONTACT');
    });

    it('lässt wartende Nachrichten an einen gelöschten Kontakt mit contact_deleted scheitern', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        contacts: TEST_CONTACTS.map((c) => ({ ...c })),
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, sent: 5000, relayed: 5000, delivered: 5000 },
      });
      await rig.authenticate('sec.unlock');
      await rig.call('msg.send', { to: 1, type: 'text', text: 'hi' });

      await rig.call('contact.delete', { contact_id: 1, confirm: true });

      expect(rig.eventsNamed('msg.status')[0].data).toMatchObject({ state: 'failed', reason: 'contact_deleted' });
    });
  });

  describe('msg.send', () => {
    it('antwortet mit Handle, Zähler, effektiven Werten und der Airtime (23 Byte für "Hello!")', async () => {
      rig = await unlockedRig();

      const result = await rig.call('msg.send', { to: 1, type: 'text', text: 'Hello!', ack: true });

      expect(result).toEqual({
        msg_ref: 1,
        ctr: 1,
        ack_requested: true,
        hops: 3,
        state: 'queued',
        bytes_on_air: 23,
        est_airtime_ms: 206,
      });
    });

    it('zählt Handle und Zähler hoch', async () => {
      rig = await unlockedRig();

      const first = await rig.call('msg.send', { to: 1, type: 'text', text: 'eins' });
      const second = await rig.call('msg.send', { to: 1, type: 'text', text: 'zwei' });
      const other = await rig.call('msg.send', { to: 2, type: 'text', text: 'drei' });

      expect([first['msg_ref'], second['msg_ref'], other['msg_ref']]).toEqual([1, 2, 3]);
      expect([first['ctr'], second['ctr'], other['ctr']]).toEqual([1, 2, 1]);
    });

    it('nimmt 83 Bytes an und lehnt 84 mit E_TOO_LONG ab', async () => {
      rig = await unlockedRig();

      await expect(rig.call('msg.send', { to: 1, type: 'text', text: 'a'.repeat(83) })).resolves.toMatchObject({ state: 'queued' });
      const error = await rig.error('msg.send', { to: 1, type: 'text', text: 'a'.repeat(84) });

      expect(error).toMatchObject({ code: 'E_TOO_LONG', field: 'text', message: 'text is 84 bytes, max is 83' });
    });

    it('zählt Bytes, nicht Zeichen', async () => {
      rig = await unlockedRig();

      expect((await rig.error('msg.send', { to: 1, type: 'text', text: 'ä'.repeat(42) })).code).toBe('E_TOO_LONG');
      await expect(rig.call('msg.send', { to: 1, type: 'text', text: 'ä'.repeat(41) })).resolves.toBeDefined();
    });

    it('prüft Argumente mit E_INVALID_ARG und field', async () => {
      rig = await unlockedRig();

      expect(await rig.error('msg.send', { type: 'text', text: 'x' })).toMatchObject({ code: 'E_INVALID_ARG', field: 'to' });
      expect(await rig.error('msg.send', { to: '1', type: 'text', text: 'x' })).toMatchObject({ code: 'E_INVALID_ARG', field: 'to' });
      expect(await rig.error('msg.send', { to: 1, type: 'bild' })).toMatchObject({ code: 'E_INVALID_ARG', field: 'type' });
      expect(await rig.error('msg.send', { to: 1, type: 'text' })).toMatchObject({ code: 'E_INVALID_ARG', field: 'text' });
      expect(await rig.error('msg.send', { to: 1, type: 'text', text: 'x', hops: 8 })).toMatchObject({ code: 'E_INVALID_ARG', field: 'hops' });
      expect(await rig.error('msg.send', { to: 1, type: 'text', text: 'x', ack: 'ja' })).toMatchObject({ code: 'E_INVALID_ARG', field: 'ack' });
    });

    it('meldet E_NO_SUCH_CONTACT für einen leeren Platz', async () => {
      rig = await unlockedRig();

      expect(await rig.error('msg.send', { to: 9, type: 'text', text: 'x' })).toMatchObject({ code: 'E_NO_SUCH_CONTACT', field: 'to' });
    });

    it('meldet E_QUEUE_FULL bei mehr als 8 wartenden Nachrichten', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        contacts: TEST_CONTACTS.map((c) => ({ ...c })),
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, sent: 5000, relayed: 5000, delivered: 5000 },
      });
      await rig.authenticate('sec.unlock');
      for (let i = 0; i < 8; i++) {
        await rig.call('msg.send', { to: 1, type: 'text', text: `n${i}` });
      }

      expect((await rig.error('msg.send', { to: 1, type: 'text', text: 'neun' })).code).toBe('E_QUEUE_FULL');
      expect((await rig.call('msg.pending'))['pending']).toHaveLength(8);
    });

    it('sendet msg.status sent, relayed und delivered und macht den Kontakt aktiv', async () => {
      rig = await unlockedRig();

      await rig.call('msg.send', { to: 2, type: 'text', text: 'Hallo', ack: true });
      await vi.waitFor(() => expect(rig.eventsNamed('msg.status')).toHaveLength(3), { timeout: 2000 });

      expect(rig.eventsNamed('msg.status').map((event) => event.data['state'])).toEqual(['sent', 'relayed', 'delivered']);
      expect(rig.eventsNamed('msg.status')[2].data).toMatchObject({ msg_ref: 1, to: 2, retry: 0, hops: 1, rtt_ms: expect.any(Number) });
      expect(rig.eventsNamed('contact.state')[0].data).toEqual({ contact_id: 2, state: 'active' });
      expect(await rig.call('msg.pending')).toEqual({ pending: [] });
    });

    it('quittiert Reaktionen und Standort standardmässig nicht (nur sent)', async () => {
      rig = await unlockedRig();

      await rig.call('msg.send', { to: 1, type: 'reaction', target: { author: 'peer', ref: 1 }, emoji: '👍' });
      await rig.call('msg.send', { to: 1, type: 'geo', lat: 47.0517, lon: 8.3075 });
      await rig.waitForEvent('msg.status', 2);
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(rig.eventsNamed('msg.status').map((event) => event.data['state'])).toEqual(['sent', 'sent']);
    });

    it('meldet failed mit Grund timeout, wenn failNext(timeout) gesetzt ist', async () => {
      rig = await unlockedRig();
      rig.device.failNext('timeout');

      await rig.call('msg.send', { to: 1, type: 'text', text: 'weg' });
      await vi.waitFor(() => expect(rig.eventsNamed('msg.status')).toHaveLength(2), { timeout: 2000 });

      expect(rig.eventsNamed('msg.status')[1].data).toMatchObject({ state: 'failed', reason: 'timeout', retry: 3 });
    });

    it('meldet failed mit Grund radio_error, wenn failNext(radio_error) gesetzt ist', async () => {
      rig = await unlockedRig();
      rig.device.failNext('radio_error');

      await rig.call('msg.send', { to: 1, type: 'text', text: 'weg' });
      await rig.waitForEvent('msg.status');

      expect(rig.eventsNamed('msg.status')[0].data).toMatchObject({ state: 'failed', reason: 'radio_error' });
    });

    it('prüft Reaktionen (Emoji aus der Tabelle, target.author, target.ref)', async () => {
      rig = await unlockedRig();
      const target = { author: 'me', ref: 1 };

      await expect(rig.call('msg.send', { to: 1, type: 'reaction', target, emoji: '❤️' })).resolves.toBeDefined();
      await expect(rig.call('msg.send', { to: 1, type: 'reaction', target, emoji: null })).resolves.toBeDefined();
      expect((await rig.error('msg.send', { to: 1, type: 'reaction', target, emoji: '🍕' })).code).toBe('E_INVALID_ARG');
      expect((await rig.error('msg.send', { to: 1, type: 'reaction', target: { author: 'x', ref: 1 }, emoji: '👍' })).code).toBe('E_INVALID_ARG');
      expect((await rig.error('msg.send', { to: 1, type: 'reaction', target: { author: 'me', ref: 70000 }, emoji: '👍' })).code).toBe('E_INVALID_ARG');
    });

    it('prüft Standortwerte', async () => {
      rig = await unlockedRig();

      await expect(rig.call('msg.send', { to: 1, type: 'geo', lat: 47.0517, lon: 8.3075, alt_m: 450, age_s: 120 })).resolves.toBeDefined();
      expect(await rig.error('msg.send', { to: 1, type: 'geo', lat: 91, lon: 8 })).toMatchObject({ code: 'E_INVALID_ARG', field: 'lat' });
      expect(await rig.error('msg.send', { to: 1, type: 'geo', lat: 47 })).toMatchObject({ code: 'E_INVALID_ARG', field: 'lon' });
      expect((await rig.error('msg.send', { to: 1, type: 'geo', lat: 47, lon: 8, age_s: 3000 })).code).toBe('E_INVALID_ARG');
    });

    it('bricht mit msg.cancel ab und meldet cancelled', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        contacts: TEST_CONTACTS.map((c) => ({ ...c })),
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, sent: 5000, relayed: 5000, delivered: 5000 },
      });
      await rig.authenticate('sec.unlock');
      await rig.call('msg.send', { to: 1, type: 'text', text: 'hi' });

      expect(await rig.call('msg.cancel', { msg_ref: 1 })).toEqual({ state: 'cancelled' });
      await rig.waitForEvent('msg.status');

      expect(rig.eventsNamed('msg.status')[0].data).toMatchObject({ msg_ref: 1, state: 'cancelled' });
      expect((await rig.error('msg.cancel', { msg_ref: 1 })).code).toBe('E_INVALID_ARG');
    });

    it('listet wartende Nachrichten mit msg.pending', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        contacts: TEST_CONTACTS.map((c) => ({ ...c })),
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, sent: 5000, relayed: 5000, delivered: 5000 },
      });
      await rig.authenticate('sec.unlock');
      await rig.call('msg.send', { to: 1, type: 'text', text: 'hi' });

      expect(await rig.call('msg.pending')).toEqual({
        pending: [{ msg_ref: 1, to: 1, type: 'text', ctr: 1, state: 'queued', retry: 0 }],
      });
    });

    it('vergisst die Warteschlange nach einem Neustart', async () => {
      rig = new Rig({
        state: 'locked',
        identityName: 'Test',
        contacts: TEST_CONTACTS.map((c) => ({ ...c })),
        adoptFirstToken: true,
        timing: { ...FAST_TIMING, sent: 5000, relayed: 5000, delivered: 5000 },
      });
      await rig.authenticate('sec.unlock');
      await rig.call('msg.send', { to: 1, type: 'text', text: 'hi' });
      rig.device.reboot();
      await rig.waitForEvent('sys.boot', 2);
      await rig.authenticate('sec.unlock');

      expect(await rig.call('msg.pending')).toEqual({ pending: [] });
    });
  });

  describe('Eingang (Hooks)', () => {
    it('meldet einen Text als msg.received und macht den Kontakt aktiv', async () => {
      rig = await unlockedRig();

      rig.device.injectText(2, 'Hallo!');

      expect(rig.eventsNamed('msg.received')[0].data).toEqual({
        from: 2,
        type: 'text',
        ctr: 1,
        text: 'Hallo!',
        hops: 1,
        retry: 0,
        rssi: -92,
        snr: 7.5,
      });
      expect(rig.eventsNamed('contact.state')[0].data).toEqual({ contact_id: 2, state: 'active' });
      expect((await rig.call('contact.get', { contact_id: 2 }))['contact']).toMatchObject({ rx_highest_ctr: 1, last_rssi: -92, last_snr: 7.5 });
    });

    it('zählt den Zähler eingehender Nachrichten hoch', async () => {
      rig = await unlockedRig();

      rig.device.injectText(1, 'eins');
      rig.device.injectText(1, 'zwei');

      expect(rig.eventsNamed('msg.received').map((event) => event.data['ctr'])).toEqual([1, 2]);
    });

    it('meldet Reaktionen mit target aus Sicht der App und Standort mit lat/lon', async () => {
      rig = await unlockedRig();

      rig.device.injectReaction(1, { author: 'me', ref: 1 }, '👍');
      rig.device.injectReaction(1, { author: 'me', ref: 1 }, null);
      rig.device.injectGeo(1, 47.05169, 8.30751);

      const [reaction, removal, geo] = rig.eventsNamed('msg.received').map((event) => event.data);
      expect(reaction).toMatchObject({ type: 'reaction', target: { author: 'me', ref: 1 }, emoji: '👍' });
      expect(removal).toMatchObject({ type: 'reaction', emoji: null });
      expect(geo).toMatchObject({ type: 'geo', lat: 47.05169, lon: 8.30751, alt_m: null, age_s: null });
    });

    it('meldet nichts, solange das Gerät gesperrt ist', async () => {
      rig = new Rig({ state: 'locked', identityName: 'Test', contacts: TEST_CONTACTS.map((c) => ({ ...c })) });

      rig.device.injectText(1, 'unsichtbar');

      expect(rig.eventsNamed('msg.received')).toEqual([]);
    });
  });

  describe('radio, mesh, led', () => {
    it('liefert die Standardwerte von radio.get samt Airtime und Textlimit', async () => {
      rig = await unlockedRig();

      expect(await rig.call('radio.get')).toEqual({
        freq_mhz: 869.525,
        bw_khz: 125,
        sf: 9,
        cr: 5,
        tx_power_dbm: 14,
        preamble: 8,
        sync_word: 79,
        est_airtime_ms_23b: 206,
        max_text_bytes: 83,
      });
    });

    it('rechnet die Airtime der Presets wie die Spezifikation', () => {
      const base = { sf: 9, bw_khz: 125, cr: 5, preamble: 8 };

      expect(loraAirtimeMs(23, base)).toBe(206);
      expect(loraAirtimeMs(23, { ...base, sf: 7, bw_khz: 250 })).toBe(31);
      expect(loraAirtimeMs(23, { ...base, sf: 11 })).toBe(823);
      expect(loraAirtimeMs(23, { ...base, sf: 10 })).toBe(371);
    });

    it('ändert mit radio.set eine Teilmenge und meldet Warnungen', async () => {
      rig = await unlockedRig();

      const result = await rig.call('radio.set', { sf: 10, tx_power_dbm: 17 });

      expect(result).toEqual({
        freq_mhz: 869.525,
        bw_khz: 125,
        sf: 10,
        cr: 5,
        tx_power_dbm: 17,
        preamble: 8,
        sync_word: 79,
        est_airtime_ms_23b: 371,
        max_text_bytes: 83,
        warnings: ['above_eu868_power_limit', 'mesh_incompatible'],
      });
    });

    it('kennt die Presets fast und long_range', async () => {
      rig = await unlockedRig();

      expect(await rig.call('radio.set', { preset: 'fast' })).toMatchObject({ sf: 7, bw_khz: 250, est_airtime_ms_23b: 31 });
      expect(await rig.call('radio.set', { preset: 'long_range' })).toMatchObject({ sf: 11, bw_khz: 125, est_airtime_ms_23b: 823 });
      expect((await rig.error('radio.set', { preset: 'schnell' })).field).toBe('preset');
    });

    it('warnt bei Frequenz ausserhalb EU868 und bei reserviertem Sync-Word', async () => {
      rig = await unlockedRig();

      const result = await rig.call('radio.set', { freq_mhz: 915, sync_word: 0x34 });

      expect(result['warnings']).toEqual(['outside_eu868', 'reserved_sync_word', 'mesh_incompatible']);
    });

    it('prüft radio.set alles-oder-nichts', async () => {
      rig = await unlockedRig();

      expect(await rig.error('radio.set', { sf: 13 })).toMatchObject({ code: 'E_INVALID_ARG', field: 'sf' });
      expect(await rig.error('radio.set', { sf: 8, bw_khz: 100 })).toMatchObject({ code: 'E_INVALID_ARG', field: 'bw_khz' });
      expect(await rig.error('radio.set', { sf: 8, cr: '5' })).toMatchObject({ code: 'E_INVALID_ARG', field: 'cr' });
      expect((await rig.call('radio.get'))['sf']).toBe(9);
    });

    it('zeigt mesh.get die Standardwerte und ändert mit mesh.set', async () => {
      rig = await unlockedRig();

      expect(await rig.call('mesh.get')).toEqual({
        hop_default: 3,
        relay_enabled: true,
        relay_when_locked: false,
        cad_enabled: true,
        backoff_slots: 8,
        retries: 3,
        retry_base_ms: 0,
        rate_limit_per_src: 20,
        ack_default: { text: true, reaction: false, geo: false },
      });
      const result = await rig.call('mesh.set', { hop_default: 5, ack_default: { geo: true } });
      expect(result).toMatchObject({ hop_default: 5, ack_default: { text: true, reaction: false, geo: true } });
      expect((await rig.error('mesh.set', { hop_default: 8 })).field).toBe('hop_default');
    });

    it('nutzt hop_default und ack_default von mesh für msg.send', async () => {
      rig = await unlockedRig();
      await rig.call('mesh.set', { hop_default: 5, ack_default: { geo: true } });

      expect(await rig.call('msg.send', { to: 1, type: 'geo', lat: 47, lon: 8 })).toMatchObject({ ack_requested: true, hops: 5 });
      expect(await rig.call('msg.send', { to: 1, type: 'text', text: 'x', ack: false, hops: 1 })).toMatchObject({ ack_requested: false, hops: 1 });
    });

    it('liefert led.get mit den Standardmustern und den eingebauten Namen', async () => {
      rig = await unlockedRig();

      const result = await rig.call('led.get');

      expect(result).toMatchObject({
        enabled: true,
        quiet: false,
        brightness: 128,
        state_patterns: { unprovisioned: 'pulse', locked: 'blink_slow', unlocked: 'off' },
        event_patterns: { msg_received: 'double', failed: { steps: [100, 100], repeat: 3 } },
      });
      expect(result['builtin_patterns']).toEqual(['off', 'on', 'flash', 'blink_slow', 'blink_fast', 'double', 'heartbeat', 'pulse']);
    });

    it('führt bei led.set verschachtelte Objekte zusammen', async () => {
      rig = await unlockedRig();

      const result = await rig.call('led.set', {
        brightness: 40,
        state_patterns: { locked: { steps: [50, 1950] } },
        event_patterns: { msg_received: { steps: [200, 100, 200], repeat: 2 } },
      });

      expect(result).toMatchObject({
        brightness: 40,
        state_patterns: { unprovisioned: 'pulse', locked: { steps: [50, 1950] }, unlocked: 'off' },
        event_patterns: { tx: 'flash', msg_received: { steps: [200, 100, 200], repeat: 2 } },
      });
    });

    it('prüft led.set', async () => {
      rig = await unlockedRig();

      expect(await rig.error('led.set', { brightness: 256 })).toMatchObject({ code: 'E_INVALID_ARG', field: 'brightness' });
      expect((await rig.error('led.set', { state_patterns: { locked: 'wild' } })).code).toBe('E_INVALID_ARG');
      expect((await rig.error('led.set', { state_patterns: { unknown: 'off' } })).code).toBe('E_INVALID_ARG');
      expect((await rig.error('led.set', { event_patterns: { tx: { steps: [5] } } })).code).toBe('E_INVALID_ARG');
      expect((await rig.call('led.get'))['brightness']).toBe(128);
    });
  });

  describe('Neustart und Trennen', () => {
    it('antwortet auf sys.reboot und bootet danach gesperrt mit sys.boot', async () => {
      rig = await unlockedRig();

      await rig.call('sys.reboot');
      await rig.waitForEvent('sys.boot', 2);

      expect(rig.eventsNamed('sys.boot')[1].data).toMatchObject({ state: 'locked', reset_reason: 'software' });
      expect((await rig.error('id.get')).code).toBe('E_LOCKED');
    });

    it('behält Kontakte und Tresor, wenn das Kabel getrennt und wieder angeschlossen wird', async () => {
      rig = await unlockedRig();

      rig.device.detach();
      rig.device.start();
      await rig.waitForEvent('sys.boot', 2);
      await rig.authenticate('sec.unlock');

      expect((await rig.call('contact.list'))['total']).toBe(2);
    });

    it('spricht nicht mehr, wenn die Leitung getrennt ist', async () => {
      rig = await unlockedRig();
      const count = rig.events.length;

      rig.device.detach();
      rig.device.injectText(1, 'ins Leere');

      expect(rig.events).toHaveLength(count);
    });
  });
});
