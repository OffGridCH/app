import { vi } from 'vitest';

import type { JsonObject } from '../models/device';
import { DeviceError } from './device-error';
import { SerialClient, type RawEvent } from './serial-client';

/** Eine Anfrage, wie sie auf der Leitung steht. */
interface SentRequest {
  id: number;
  cmd: string;
  args?: JsonObject;
}

describe('SerialClient', () => {
  let lines: string[];
  let client: SerialClient;
  let events: RawEvent[];

  /** Alle bisher gesendeten Anfragen. */
  function sent(): SentRequest[] {
    return lines.map((line) => JSON.parse(line) as SentRequest);
  }

  function respond(id: number, result: JsonObject = {}): void {
    client.receive(`${JSON.stringify({ id, ok: true, result })}\n`);
  }

  function fail(id: number, code: string, message = 'Fehler', field?: string): void {
    const error = field === undefined ? { code, message } : { code, message, field };
    client.receive(`${JSON.stringify({ id, ok: false, error })}\n`);
  }

  /** Anfrage, deren Ergebnis uninteressant ist (Abbruch beim Aufräumen ist kein Fehler). */
  function fire(cmd: string, args?: JsonObject): void {
    client.request(cmd, args).catch(() => undefined);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    lines = [];
    events = [];
    client = new SerialClient(async (line) => {
      lines.push(line);
    });
    client.onEvent((event) => events.push(event));
    client.open();
    client.receive('\n');
  });

  afterEach(() => {
    client.close();
    vi.useRealTimers();
  });

  describe('Anfragen und Antworten', () => {
    it('schreibt eine Zeile mit id, cmd und args und schliesst mit LF ab', async () => {
      const promise = client.request('msg.send', { to: 1, type: 'text', text: 'Hallo' });

      expect(lines).toEqual([`${JSON.stringify({ id: 1, cmd: 'msg.send', args: { to: 1, type: 'text', text: 'Hallo' } })}\n`]);
      respond(1, { msg_ref: 1 });
      await expect(promise).resolves.toEqual({ msg_ref: 1 });
    });

    it('lässt args weg, wenn es keine gibt', () => {
      fire('sys.status');

      expect(sent()[0]).toEqual({ id: 1, cmd: 'sys.status' });
    });

    it('vergibt eindeutige, aufsteigende ids', () => {
      fire('sys.status');
      fire('sys.status');
      fire('sys.status');

      expect(sent().map((request) => request.id)).toEqual([1, 2, 3]);
    });

    it('ordnet Antworten über die id zu, auch in anderer Reihenfolge', async () => {
      const first = client.request('contact.get', { contact_id: 1 });
      const second = client.request('contact.get', { contact_id: 2 });

      respond(2, { contact: 'zwei' });
      respond(1, { contact: 'eins' });

      await expect(first).resolves.toEqual({ contact: 'eins' });
      await expect(second).resolves.toEqual({ contact: 'zwei' });
    });

    it('liefert bei fehlendem result ein leeres Objekt', async () => {
      const promise = client.request('sec.lock');

      client.receive('{"id":1,"ok":true}\n');

      await expect(promise).resolves.toEqual({});
    });

    it('wirft bei ok:false einen DeviceError mit code, message und field', async () => {
      const promise = client.request('msg.send', { to: 1, type: 'text', text: 'x' });

      fail(1, 'E_TOO_LONG', 'text is 91 bytes, max is 83', 'text');

      const error: unknown = await promise.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toMatchObject({ code: 'E_TOO_LONG', message: 'text is 91 bytes, max is 83', field: 'text' });
    });

    it('setzt field auf null, wenn das Gerät keines nennt', async () => {
      const promise = client.request('sec.lock');

      fail(1, 'E_LOCKED');

      await expect(promise).rejects.toMatchObject({ code: 'E_LOCKED', field: null });
    });

    it('macht aus einem unbekannten Fehlercode E_INTERNAL', async () => {
      const promise = client.request('sys.status');

      fail(1, 'E_GIBT_ES_NICHT');

      await expect(promise).rejects.toMatchObject({ code: 'E_INTERNAL' });
    });

    it('beantwortet jede Anfrage genau einmal: eine zweite Antwort mit derselben id wird ignoriert', async () => {
      const promise = client.request('sys.status');

      respond(1, { state: 'locked' });
      respond(1, { state: 'unlocked' });

      await expect(promise).resolves.toEqual({ state: 'locked' });
    });

    it('ignoriert Antworten auf unbekannte ids', () => {
      expect(() => respond(99)).not.toThrow();
    });
  });

  describe('Ereignisse', () => {
    it('gibt Ereignisse mit evt, t und data weiter', () => {
      client.receive('{"evt":"msg.status","t":2210,"data":{"msg_ref":1,"state":"sent"}}\n');

      expect(events).toEqual([{ evt: 'msg.status', t: 2210, data: { msg_ref: 1, state: 'sent' } }]);
    });

    it('beantwortet Ereignisse nie', () => {
      client.receive('{"evt":"sys.boot","t":1,"data":{}}\n');
      client.receive('{"evt":"sec.state","t":2,"data":{"state":"locked"}}\n');

      expect(lines).toEqual([]);
    });

    it('füllt fehlende Felder eines Ereignisses auf', () => {
      client.receive('{"evt":"log"}\n');

      expect(events).toEqual([{ evt: 'log', t: 0, data: {} }]);
    });

    it('liefert Ereignisse zwischen zwei Antworten', async () => {
      const promise = client.request('sys.ping');

      client.receive('{"evt":"log","t":1,"data":{}}\n');
      respond(1, { uptime_ms: 5 });

      await expect(promise).resolves.toEqual({ uptime_ms: 5 });
      expect(events).toHaveLength(1);
    });
  });

  describe('Zeilen', () => {
    it('setzt eine Zeile aus mehreren Stücken zusammen', async () => {
      const promise = client.request('sys.status');

      client.receive('{"id":1,"ok":tr');
      client.receive('ue,"result":{"state":"lock');
      client.receive('ed"}}\n');

      await expect(promise).resolves.toEqual({ state: 'locked' });
    });

    it('verarbeitet zwei Zeilen in einem Stück', async () => {
      const first = client.request('sys.status');
      const second = client.request('sys.ping');

      client.receive('{"id":1,"ok":true,"result":{"a":1}}\n{"id":2,"ok":true,"result":{"b":2}}\n');

      await expect(first).resolves.toEqual({ a: 1 });
      await expect(second).resolves.toEqual({ b: 2 });
    });

    it('toleriert ein CR vor dem LF', async () => {
      const promise = client.request('sys.status');

      client.receive('{"id":1,"ok":true,"result":{"a":1}}\r\n');

      await expect(promise).resolves.toEqual({ a: 1 });
    });

    it('verwirft Zeilen ohne führendes {', async () => {
      const promise = client.request('sys.status');

      client.receive('ets Jun  8 2016 00:22:57\n');
      client.receive('rst:0x1 (POWERON_RESET),boot:0x13\n');
      client.receive('  {"id":1,"ok":true,"result":{"x":1}}\n');
      client.receive('{"id":1,"ok":true,"result":{"a":1}}\n');

      await expect(promise).resolves.toEqual({ a: 1 });
    });

    it('ignoriert ungültiges JSON und leere Zeilen', () => {
      expect(() => {
        client.receive('{kaputt\n');
        client.receive('\n\n');
        client.receive('[1,2]\n');
      }).not.toThrow();
      expect(events).toEqual([]);
    });

    it('verwirft nach dem Öffnen alles bis zum ersten LF', () => {
      client.close();
      client.open();

      client.receive('"result":{}}\n{"evt":"log","t":1,"data":{}}\n');

      expect(events).toEqual([{ evt: 'log', t: 1, data: {} }]);
    });

    it('verwirft vor dem ersten LF auch über mehrere Stücke', () => {
      client.close();
      client.open();

      client.receive('halbe Zei');
      client.receive('le ohne Ende');
      expect(events).toEqual([]);
      client.receive('\n{"evt":"log","t":1,"data":{}}\n');

      expect(events).toHaveLength(1);
    });

    it('weist eine Zeile über 2048 Bytes ab und liest die nächste wieder', async () => {
      const promise = client.request('sys.status');
      const tooLong = JSON.stringify({ id: 1, ok: true, result: { text: 'a'.repeat(2100) } });

      client.receive(`${tooLong}\n`);
      client.receive('{"id":1,"ok":true,"result":{"a":1}}\n');

      await expect(promise).resolves.toEqual({ a: 1 });
    });

    it('nimmt eine Zeile mit genau 2048 Bytes inklusive LF an', async () => {
      const promise = client.request('sys.status');
      const base = JSON.stringify({ id: 1, ok: true, result: { text: '' } });
      const filler = 'a'.repeat(2047 - base.length);
      const line = JSON.stringify({ id: 1, ok: true, result: { text: filler } });

      expect(new TextEncoder().encode(`${line}\n`).length).toBe(2048);
      client.receive(`${line}\n`);

      await expect(promise).resolves.toEqual({ text: filler });
    });

    it('weist eine Zeile mit 2049 Bytes ab', async () => {
      const promise = client.request('sys.status');
      const base = JSON.stringify({ id: 1, ok: true, result: { text: '' } });
      const line = JSON.stringify({ id: 1, ok: true, result: { text: 'a'.repeat(2048 - base.length) } });

      expect(new TextEncoder().encode(`${line}\n`).length).toBe(2049);
      client.receive(`${line}\n`);
      client.receive('{"id":1,"ok":true,"result":{"a":1}}\n');

      await expect(promise).resolves.toEqual({ a: 1 });
    });

    it('zählt Bytes, nicht Zeichen (Umlaute)', async () => {
      const promise = client.request('sys.status');
      const line = JSON.stringify({ id: 1, ok: true, result: { text: 'ä'.repeat(1100) } });

      client.receive(`${line}\n`);
      client.receive('{"id":1,"ok":true,"result":{"a":1}}\n');

      await expect(promise).resolves.toEqual({ a: 1 });
    });

    it('weist eine zu lange Anfrage ab, ohne zu schreiben', async () => {
      const promise = client.request('msg.send', { to: 1, type: 'text', text: 'a'.repeat(2100) });

      await expect(promise).rejects.toMatchObject({ code: 'E_LINE_TOO_LONG' });
      expect(lines).toEqual([]);
    });

    it('schickt Nicht-ASCII-Text als UTF-8 ohne Escapes', () => {
      fire('msg.send', { to: 1, type: 'text', text: 'Grüsse 👍' });

      expect(lines[0]).toContain('Grüsse 👍');
    });
  });

  describe('Anfragen in Flight', () => {
    it('hat höchstens 4 Anfragen gleichzeitig unterwegs', () => {
      for (let i = 0; i < 6; i++) {
        fire('sys.ping');
      }

      expect(lines).toHaveLength(4);
    });

    it('schickt die nächste Anfrage, sobald eine Antwort da ist, in der Reihenfolge der Aufrufe', () => {
      for (let i = 0; i < 6; i++) {
        fire('contact.get', { contact_id: i + 1 });
      }

      respond(1);
      expect(lines).toHaveLength(5);
      expect(sent()[4].args).toEqual({ contact_id: 5 });

      respond(2);
      expect(lines).toHaveLength(6);
      expect(sent()[5].args).toEqual({ contact_id: 6 });
    });

    it('gibt den Platz auch nach einem Zeitlimit frei', async () => {
      const promises = Array.from({ length: 5 }, () => client.request('sys.ping').catch(() => 'timeout'));

      expect(lines).toHaveLength(4);
      await vi.advanceTimersByTimeAsync(2000);

      expect(lines).toHaveLength(5);
      await Promise.all(promises.slice(0, 4));
    });
  });

  describe('Zeitlimits', () => {
    it('bricht normale Befehle nach 2 s mit E_TIMEOUT ab', async () => {
      const promise = client.request('sys.status').catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(1999);
      expect(lines).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1);

      await expect(promise).resolves.toMatchObject({ code: 'E_TIMEOUT' });
    });

    it.each(['sec.unlock', 'sec.provision', 'sec.lock', 'pair.complete', 'contact.delete'])(
      'gibt %s 5 s Zeit',
      async (cmd) => {
        let result: unknown = 'offen';
        client.request(cmd).then(
          () => (result = 'ok'),
          (error: unknown) => (result = error),
        );

        await vi.advanceTimersByTimeAsync(4999);
        expect(result).toBe('offen');
        await vi.advanceTimersByTimeAsync(1);

        expect(result).toMatchObject({ code: 'E_TIMEOUT' });
      },
    );

    it('zählt das Zeitlimit ab dem Senden, nicht ab dem Aufruf', async () => {
      for (let i = 0; i < 4; i++) {
        fire('sys.ping');
      }
      let result: unknown = 'offen';
      client.request('sys.status').then(
        () => (result = 'ok'),
        (error: unknown) => (result = error),
      );

      await vi.advanceTimersByTimeAsync(1000);
      respond(1);
      expect(lines).toHaveLength(5);

      await vi.advanceTimersByTimeAsync(1500);
      expect(result).toBe('offen');
      await vi.advanceTimersByTimeAsync(500);
      expect(result).toMatchObject({ code: 'E_TIMEOUT' });
    });

    it('ignoriert eine späte Antwort nach dem Zeitlimit', async () => {
      const promise = client.request('sys.status').catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(2000);
      respond(1, { state: 'locked' });

      await expect(promise).resolves.toMatchObject({ code: 'E_TIMEOUT' });
    });
  });

  describe('sys.hello', () => {
    it('wiederholt sys.hello alle 500 ms, bis eine Antwort kommt', async () => {
      const promise = client.hello({ app: 'offgrid-android', app_proto: '1.0' });

      expect(lines).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(500);
      expect(lines).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(500);
      expect(lines).toHaveLength(3);

      respond(3, { state: 'locked' });
      await expect(promise).resolves.toEqual({ state: 'locked' });

      await vi.advanceTimersByTimeAsync(5000);
      expect(lines).toHaveLength(3);
      expect(sent().every((request) => request.cmd === 'sys.hello')).toBe(true);
      expect(sent()[0].args).toEqual({ app: 'offgrid-android', app_proto: '1.0' });
    });

    it('nimmt die erste Antwort, auch wenn sie zu einer früheren Anfrage gehört', async () => {
      const promise = client.hello({});

      await vi.advanceTimersByTimeAsync(500);
      respond(1, { state: 'unprovisioned' });

      await expect(promise).resolves.toEqual({ state: 'unprovisioned' });
    });

    it('gibt nach der maximalen Zahl von Versuchen auf', async () => {
      const promise = client.hello({}, 3).catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(1000 + 2000);

      await expect(promise).resolves.toMatchObject({ code: 'E_TIMEOUT' });
      expect(lines).toHaveLength(3);
    });

    it('bricht bei einer Fehlerantwort sofort ab', async () => {
      const promise = client.hello({}).catch((error: unknown) => error);

      fail(1, 'E_PROTO_MISMATCH');

      await expect(promise).resolves.toMatchObject({ code: 'E_PROTO_MISMATCH' });
      await vi.advanceTimersByTimeAsync(2000);
      expect(lines).toHaveLength(1);
    });
  });

  describe('Heartbeat', () => {
    it('sendet alle 5 s sys.ping', async () => {
      client.startHeartbeat(() => undefined);

      await vi.advanceTimersByTimeAsync(4999);
      expect(lines).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(sent().map((request) => request.cmd)).toEqual(['sys.ping']);
      respond(1, { uptime_ms: 1 });

      await vi.advanceTimersByTimeAsync(5000);
      expect(sent().map((request) => request.cmd)).toEqual(['sys.ping', 'sys.ping']);
    });

    it('meldet fehlgeschlagene Pings mit der Zahl der Fehlschläge in Folge', async () => {
      const failures: number[] = [];
      client.startHeartbeat((_error, count) => failures.push(count));

      await vi.advanceTimersByTimeAsync(5000 + 2000);
      await vi.advanceTimersByTimeAsync(5000 + 2000);

      expect(failures).toEqual([1, 2]);
    });

    it('setzt den Zähler nach einem erfolgreichen Ping zurück', async () => {
      const failures: number[] = [];
      client.startHeartbeat((_error, count) => failures.push(count));

      await vi.advanceTimersByTimeAsync(5000 + 2000);
      await vi.advanceTimersByTimeAsync(4000);
      respond(2, { uptime_ms: 1 });
      await vi.advanceTimersByTimeAsync(8000);

      expect(failures).toEqual([1, 1]);
    });

    it('stoppt mit stopHeartbeat', async () => {
      client.startHeartbeat(() => undefined);
      client.stopHeartbeat();

      await vi.advanceTimersByTimeAsync(20000);

      expect(lines).toHaveLength(0);
    });
  });

  describe('close', () => {
    it('weist offene und wartende Anfragen mit E_DISCONNECTED ab', async () => {
      const promises = Array.from({ length: 6 }, () => client.request('sys.ping').catch((error: unknown) => error));

      client.close();

      for (const result of await Promise.all(promises)) {
        expect(result).toMatchObject({ code: 'E_DISCONNECTED' });
      }
    });

    it('wirft bei einem Schreibfehler E_DISCONNECTED', async () => {
      const broken = new SerialClient(async () => {
        throw new Error('weg');
      });
      broken.open();
      broken.receive('\n');

      await expect(broken.request('sys.ping')).rejects.toMatchObject({ code: 'E_DISCONNECTED' });
      broken.close();
    });
  });
});
