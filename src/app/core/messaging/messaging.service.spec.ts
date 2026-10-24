import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { setupAntennaHarness, provisionedDevice, type AntennaHarness } from '../antenna/antenna-harness.testing';
import { ContactRepository } from '../data/contact.repository';
import { CoordinateRepository } from '../data/coordinate.repository';
import { DataChangedService } from '../data/data-changed.service';
import { MessageRepository } from '../data/message.repository';
import { HandshakeService } from '../handshake/handshake.service';
import { MessageStatus, type Message } from '../models/message';
import { MessagingService, type ReactionEvent } from './messaging.service';
import { contentBytes } from './limits';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('MessagingService', () => {
  let harness: AntennaHarness;
  let messaging: MessagingService;
  let messages: MessageRepository;
  let contacts: ContactRepository;
  let coordinates: CoordinateRepository;
  let handshake: HandshakeService;
  let dataChanged: DataChangedService;

  /** Verbindet, entsperrt und spiegelt die Kontakte des Geräts. */
  async function connected(options = provisionedDevice()): Promise<void> {
    harness = setupAntennaHarness(options);
    messaging = TestBed.inject(MessagingService);
    messages = TestBed.inject(MessageRepository);
    contacts = TestBed.inject(ContactRepository);
    coordinates = TestBed.inject(CoordinateRepository);
    handshake = TestBed.inject(HandshakeService);
    dataChanged = TestBed.inject(DataChangedService);
    await harness.antenna.connect();
    await handshake.syncContacts();
  }

  async function messagesOf(contactId: number): Promise<Message[]> {
    return messages.forContact(contactId);
  }

  async function waitForStatus(id: string, status: MessageStatus): Promise<void> {
    await vi.waitFor(async () => expect((await messages.byId(id))?.status).toBe(status), { timeout: 2000 });
  }

  afterEach(async () => {
    await harness?.antenna.disconnect();
  });

  describe('Textlimit', () => {
    it('nimmt vor dem Verbinden den Standardwert des Vertrags (83 → 83)', () => {
      harness = setupAntennaHarness();
      messaging = TestBed.inject(MessagingService);

      expect(messaging.maxContentBytes()).toBe(83);
    });

    it('übernimmt das gemeldete Limit unverändert', async () => {
      await connected();

      expect(messaging.maxContentBytes()).toBe(83);
    });
  });

  describe('Senden', () => {
    it('speichert den Text, übergibt ihn an das Gerät und zeigt Zähler und Handle', async () => {
      await connected();

      await messaging.sendText(1, 'Hello!');

      const [message] = await messagesOf(1);
      expect(message).toMatchObject({
        direction: 'out',
        kind: 'text',
        content: 'Hello!',
        ctr: 1,
        msgRef: 1,
        readAt: null,
      });
      expect([MessageStatus.Queued, MessageStatus.Sent, MessageStatus.Delivered]).toContain(message.status);
    });

    it('setzt den Status aus msg.status: sent, relayed → Gesendet, delivered → Zugestellt', async () => {
      await connected();
      const seen: MessageStatus[] = [];
      dataChanged = TestBed.inject(DataChangedService);

      await messaging.sendText(1, 'Hallo');
      const [message] = await messagesOf(1);
      for (let i = 0; i < 60 && seen[seen.length - 1] !== MessageStatus.Delivered; i++) {
        const status = (await messages.byId(message.id))?.status;
        if (status !== undefined && seen[seen.length - 1] !== status) {
          seen.push(status);
        }
        await sleep(2);
      }

      expect(seen[seen.length - 1]).toBe(MessageStatus.Delivered);
      expect(seen).not.toContain(MessageStatus.Failed);
    });

    it('macht den ausstehenden Kontakt nach der Quittung aktiv', async () => {
      await connected();

      await messaging.sendText(2, 'Hallo Luca');
      const [message] = await messagesOf(2);
      await waitForStatus(message.id, MessageStatus.Delivered);

      await vi.waitFor(async () => expect((await contacts.byId(2))?.state).toBe('active'));
    });

    it('trimmt den Text und sendet nichts bei leerem Text', async () => {
      await connected();

      await messaging.sendText(1, '   ');
      await messaging.sendText(1, '');
      await messaging.sendText(1, '  Hallo  ');

      expect((await messagesOf(1)).map((message) => message.content)).toEqual(['Hallo']);
    });

    it('teilt einen langen Text an 83 Bytes in eigene Nachrichten', async () => {
      await connected();
      const text = 'Wir sind bei der Hütte und kommen in etwa 20 Minuten, bitte wartet dort auf uns und bleibt warm.';

      await messaging.sendText(1, text);

      const sent = await messagesOf(1);
      expect(sent.length).toBeGreaterThan(1);
      expect(sent.map((message) => message.content).join('')).toBe(text);
      for (const message of sent) {
        expect(contentBytes(message.content)).toBeLessThanOrEqual(83);
      }
      expect(sent.map((message) => message.ctr)).toEqual(sent.map((_, index) => index + 1));
      expect(new Set(sent.map((message) => message.msgRef)).size).toBe(sent.length);
    });

    it('sendet einen Text mit genau 83 Bytes in einer Nachricht und einen mit 84 in zwei', async () => {
      await connected();

      await messaging.sendText(1, 'a'.repeat(83));
      expect(await messagesOf(1)).toHaveLength(1);
      await messaging.sendText(2, 'a'.repeat(84));
      expect(await messagesOf(2)).toHaveLength(2);
    });

    it('speichert nichts für einen unbekannten Kontakt', async () => {
      await connected();

      await messaging.sendText(9, 'Hallo');

      expect(await messagesOf(9)).toEqual([]);
      expect(await messages.count()).toBe(0);
    });

    it('lässt die Nachricht in der Warteschlange, solange das Gerät nicht entsperrt ist, und sendet sie danach', async () => {
      harness = setupAntennaHarness(provisionedDevice());
      messaging = TestBed.inject(MessagingService);
      messages = TestBed.inject(MessageRepository);
      handshake = TestBed.inject(HandshakeService);
      contacts = TestBed.inject(ContactRepository);
      await contacts.upsert({
        contactId: 1,
        name: 'Anna',
        nodeId: 'ECE4',
        publicKey: 'A5d2V7F/elA8qTcKyHqIP0WiIe7IjNTvZ30L+2bBRls=',
        state: 'active',
        fingerprint: '4821 0937 1156',
        lastRssi: null,
        lastSnr: null,
        txCtr: 0,
        rxHighestCtr: null,
      });

      await messaging.sendText(1, 'Später');
      const [queued] = await messagesOf(1);
      expect(queued).toMatchObject({ status: MessageStatus.Queued, msgRef: null, ctr: null });

      await harness.antenna.connect();
      TestBed.tick();

      await waitForStatus(queued.id, MessageStatus.Delivered);
      expect((await messages.byId(queued.id))?.msgRef).toBe(1);
    });

    it('wartet auch mit mehreren Nachrichten in der Reihenfolge des Schreibens', async () => {
      await connected();
      await harness.antenna.disconnect();

      await messaging.sendText(1, 'eins');
      await messaging.sendText(1, 'zwei');
      await messaging.sendText(1, 'drei');
      await harness.antenna.connect();
      TestBed.tick();

      await vi.waitFor(async () =>
        expect((await messagesOf(1)).every((message) => message.status === MessageStatus.Delivered)).toBe(true),
      );
      expect((await messagesOf(1)).map((message) => [message.content, message.ctr])).toEqual([
        ['eins', 1],
        ['zwei', 2],
        ['drei', 3],
      ]);
    });

    it('hält die Reihenfolge, auch wenn Status-Ereignisse vor dem Eintragen des Handles eintreffen', async () => {
      await connected();
      const original = messages.assignRef.bind(messages);
      vi.spyOn(messages, 'assignRef').mockImplementation(async (id, ctr, msgRef, status) => {
        await sleep(40);
        return original(id, ctr, msgRef, status);
      });

      await messaging.sendText(1, 'Hallo');
      const [message] = await messagesOf(1);

      await waitForStatus(message.id, MessageStatus.Delivered);
    });

    it('legt Nachrichten bei vollem Gerät in die Warteschlange und sendet sie, sobald Platz ist', async () => {
      await connected();

      const texts = Array.from({ length: 11 }, (_, index) => `Nachricht ${index + 1}`);
      await Promise.all(texts.map((text) => messaging.sendText(1, text)));

      await vi.waitFor(
        async () =>
          expect((await messagesOf(1)).every((message) => message.status === MessageStatus.Delivered)).toBe(true),
        { timeout: 3000 },
      );
      expect((await messagesOf(1)).map((message) => message.content)).toEqual(texts);
    });

    it('markiert die Nachricht als gescheitert, wenn das Gerät sie ablehnt (E_TOO_LONG)', async () => {
      await connected();
      vi.spyOn(harness.antenna, 'limits').mockReturnValue({ maxLine: 2048, maxContacts: 32, maxTextBytes: 200, pendingQueue: 8 });

      await messaging.sendText(1, 'a'.repeat(150));

      const [message] = await messagesOf(1);
      expect(message.status).toBe(MessageStatus.Failed);
    });
  });

  describe('Status und Fehler', () => {
    it('setzt failed mit Grund timeout auf Fehlgeschlagen', async () => {
      await connected();
      harness.device.failNext('timeout');

      await messaging.sendText(1, 'weg');
      const [message] = await messagesOf(1);

      await waitForStatus(message.id, MessageStatus.Failed);
    });

    it('setzt failed mit Grund radio_error auf Fehlgeschlagen', async () => {
      await connected();
      harness.device.failNext('radio_error');

      await messaging.sendText(1, 'weg');
      const [message] = await messagesOf(1);

      await waitForStatus(message.id, MessageStatus.Failed);
    });

    it('lässt alles scheitern, was beim Gerät wartete, wenn es neu startet', async () => {
      await connected({
        ...provisionedDevice(),
        timing: { sent: 5000, relayed: 5000, delivered: 5000, contactActive: 5000, lockTimeout: 0 },
      });
      await messaging.sendText(1, 'eins');
      await messaging.sendText(1, 'zwei');
      expect((await messagesOf(1)).map((message) => message.status)).toEqual([MessageStatus.Queued, MessageStatus.Queued]);

      harness.device.reboot();

      await vi.waitFor(async () =>
        expect((await messagesOf(1)).map((message) => message.status)).toEqual([MessageStatus.Failed, MessageStatus.Failed]),
      );
    });

    it('sendet eine gescheiterte Nachricht mit retry() noch einmal', async () => {
      await connected();
      harness.device.failNext('radio_error');
      await messaging.sendText(1, 'Nochmal');
      const [message] = await messagesOf(1);
      await waitForStatus(message.id, MessageStatus.Failed);

      await messaging.retry(message.id);

      await waitForStatus(message.id, MessageStatus.Delivered);
      expect(await messagesOf(1)).toHaveLength(1);
      expect((await messages.byId(message.id))?.msgRef).toBe(2);
    });

    it('ignoriert retry() für Nachrichten, die nicht gescheitert sind', async () => {
      await connected();
      await messaging.sendText(1, 'Hallo');
      const [message] = await messagesOf(1);
      await waitForStatus(message.id, MessageStatus.Delivered);

      await messaging.retry(message.id);

      expect((await messages.byId(message.id))?.msgRef).toBe(1);
      await messaging.retry('gibt-es-nicht');
    });

    it('bricht mit cancel() eine Nachricht ab, die das Gerät noch hält', async () => {
      await connected({
        ...provisionedDevice(),
        timing: { sent: 5000, relayed: 5000, delivered: 5000, contactActive: 5000, lockTimeout: 0 },
      });
      await messaging.sendText(1, 'Doch nicht');
      const [message] = await messagesOf(1);

      await messaging.cancel(message.id);

      await waitForStatus(message.id, MessageStatus.Failed);
    });

    it('bricht mit cancel() eine Nachricht ab, die noch nicht beim Gerät ist', async () => {
      await connected();
      await harness.antenna.disconnect();
      await messaging.sendText(1, 'Offline');
      const [message] = await messagesOf(1);

      await messaging.cancel(message.id);

      expect((await messages.byId(message.id))?.status).toBe(MessageStatus.Failed);
    });
  });

  describe('Empfangen', () => {
    it('speichert einen eingehenden Text als zugestellt und ungelesen, mit Zähler und Signal', async () => {
      await connected();

      harness.device.injectText(1, 'Hallo!');

      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(1));
      const [message] = await messagesOf(1);
      expect(message).toMatchObject({
        direction: 'in',
        kind: 'text',
        content: 'Hallo!',
        ctr: 1,
        msgRef: null,
        status: MessageStatus.Delivered,
        rssi: -92,
        readAt: null,
      });
      expect(await contacts.byId(1)).toMatchObject({ lastRssi: -92, lastSnr: 7.5 });
      expect((await messages.unreadPerContact()).get(1)).toBe(1);
    });

    it('meldet DataChangedService bei jeder neuen Nachricht', async () => {
      await connected();
      const before = dataChanged.version();

      harness.device.injectText(1, 'Hallo!');
      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(1));

      expect(dataChanged.version()).toBeGreaterThan(before);
    });

    it('speichert eine Wiederholung mit demselben Zähler nicht zweimal', async () => {
      await connected();

      harness.device.injectText(1, 'Hallo!', 5);
      harness.device.injectText(1, 'Hallo!', 5);
      harness.device.injectText(1, 'Anderes', 6);

      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(2));
      await sleep(30);
      expect((await messagesOf(1)).map((message) => [message.ctr, message.content])).toEqual([
        [5, 'Hallo!'],
        [6, 'Anderes'],
      ]);
    });

    it('trennt eigene und fremde Zähler (gleicher Zähler, andere Richtung ist keine Wiederholung)', async () => {
      await connected();
      await messaging.sendText(1, 'ausgehend');

      harness.device.injectText(1, 'eingehend', 1);

      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(2));
    });

    it('holt einen unbekannten Kontakt vom Gerät, bevor es die Nachricht speichert', async () => {
      await connected();
      await contacts.delete(1);

      harness.device.injectText(1, 'Ich bin neu hier');

      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(1));
      expect(await contacts.byId(1)).toMatchObject({ name: 'Anna' });
    });

    it('speichert einen eingehenden Standort als Standort-Nachricht mit Koordinate', async () => {
      await connected();

      harness.device.injectGeo(1, 47.05169, 8.30751);

      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(1));
      const [message] = await messagesOf(1);
      expect(message).toMatchObject({ kind: 'location', content: '', direction: 'in' });
      expect(await coordinates.latestForMessage(message.id)).toMatchObject({
        contactId: 1,
        latitude: 47.05169,
        longitude: 8.30751,
        accuracy: null,
        context: 'einmal',
      });
    });

    it('meldet eingehende Reaktionen, ohne sie als Nachricht zu speichern', async () => {
      await connected();
      const received: ReactionEvent[] = [];
      messaging.reactions.subscribe((reaction) => received.push(reaction));

      harness.device.injectReaction(1, { author: 'me', ref: 1 }, '👍');
      harness.device.injectReaction(1, { author: 'me', ref: 1 }, null);

      await vi.waitFor(() => expect(received).toHaveLength(2));
      expect(received[0]).toMatchObject({ contactId: 1, target: { author: 'me', ref: 1 }, emoji: '👍' });
      expect(received[1].emoji).toBeNull();
      expect(await messages.count()).toBe(0);
    });

    it('markiert die Nachrichten eines Kontakts als gelesen', async () => {
      await connected();
      harness.device.injectText(1, 'Hallo!');
      await vi.waitFor(async () => expect((await messages.unreadPerContact()).get(1)).toBe(1));

      await messaging.markRead(1);

      expect((await messages.unreadPerContact()).get(1)).toBeUndefined();
    });
  });

  describe('Reaktionen senden', () => {
    it('sendet eine Reaktion mit target {author, ref} und Emoji', async () => {
      await connected();
      const request = vi.spyOn(harness.antenna, 'request');

      const ok = await messaging.sendReaction(1, { author: 'peer', ref: 1 }, '👍');

      expect(ok).toBe(true);
      expect(request).toHaveBeenCalledWith('msg.send', {
        to: 1,
        type: 'reaction',
        target: { author: 'peer', ref: 1 },
        emoji: '👍',
      });
    });

    it('nimmt eine Reaktion mit emoji null zurück', async () => {
      await connected();

      expect(await messaging.sendReaction(1, { author: 'me', ref: 1 }, null)).toBe(true);
    });

    it('lehnt ein Emoji ausserhalb der Tabelle ab, ohne das Gerät zu fragen', async () => {
      await connected();
      const request = vi.spyOn(harness.antenna, 'request');

      expect(await messaging.sendReaction(1, { author: 'me', ref: 1 }, '🍕')).toBe(false);
      expect(request).not.toHaveBeenCalled();
    });

    it('meldet false, wenn das Gerät nicht entsperrt ist oder ablehnt', async () => {
      await connected();
      expect(await messaging.sendReaction(9, { author: 'me', ref: 1 }, '👍')).toBe(false);

      await harness.antenna.disconnect();
      expect(await messaging.sendReaction(1, { author: 'me', ref: 1 }, '👍')).toBe(false);
    });
  });

  describe('Standort senden', () => {
    it('speichert Standort-Nachricht und Koordinate und sendet type geo mit Alter des Fixes', async () => {
      await connected();
      const request = vi.spyOn(harness.antenna, 'request');
      const fix = { latitude: 47.05021, longitude: 8.30934, accuracy: 8, at: new Date(Date.now() - 30_000).toISOString() };

      await messaging.sendLocation(1, fix);

      const [message] = await messagesOf(1);
      expect(message).toMatchObject({ kind: 'location', content: '', direction: 'out', ctr: 1, msgRef: 1 });
      expect(await coordinates.latestForMessage(message.id)).toMatchObject({
        latitude: 47.05021,
        longitude: 8.30934,
        accuracy: 8,
        context: 'einmal',
        recordedAt: fix.at,
      });
      expect(request).toHaveBeenCalledWith('msg.send', {
        to: 1,
        type: 'geo',
        lat: 47.05021,
        lon: 8.30934,
        age_s: expect.any(Number),
      });
      const args = request.mock.calls.find((call) => call[0] === 'msg.send')?.[1] as { age_s: number };
      expect(args.age_s).toBeGreaterThanOrEqual(30);
      expect(args.age_s).toBeLessThan(40);
    });

    it('setzt den Status Gesendet, weil Standorte standardmässig nicht quittiert werden', async () => {
      await connected();

      await messaging.sendLocation(1, { latitude: 47, longitude: 8, accuracy: 5, at: new Date().toISOString() });
      const [message] = await messagesOf(1);

      await waitForStatus(message.id, MessageStatus.Sent);
    });
  });

  describe('Kontaktliste', () => {
    /** Eine Nachricht mit einem festen Abstand zu jetzt (in Minuten). */
    function messageOf(
      contactId: number,
      direction: Message['direction'],
      content: string,
      minutesAgo: number,
    ): Message {
      const sentAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
      return {
        id: crypto.randomUUID(),
        contactId,
        ctr: 1,
        msgRef: null,
        content,
        direction,
        kind: 'text',
        sentAt,
        status: MessageStatus.Delivered,
        rssi: direction === 'in' ? -92 : null,
        readAt: null,
        createdAt: sentAt,
        updatedAt: null,
      };
    }

    /** Wartet, bis die Kontaktliste die erwartete Zahl von Kontakten zeigt. */
    async function waitForContacts(count: number): Promise<void> {
      await vi.waitFor(
        () => {
          TestBed.tick();
          expect(messaging.contacts()).toHaveLength(count);
        },
        { timeout: 2000 },
      );
    }

    /** Wartet, bis die Liste die erwartete Zahl ungelesener Nachrichten zeigt. */
    async function waitForUnread(contactId: number, count: number): Promise<void> {
      await vi.waitFor(
        () => {
          TestBed.tick();
          expect(messaging.unreadCount(contactId)()).toBe(count);
        },
        { timeout: 2000 },
      );
    }

    it('liefert die Kontakte mit letzter Nachricht, Ungelesenen und Signal-Level', async () => {
      await connected();

      harness.device.injectText(1, 'Hallo!');
      await vi.waitFor(async () => expect(await messagesOf(1)).toHaveLength(1));
      await waitForContacts(2);

      const anna = messaging.contacts().find((item) => item.contact.contactId === 1);
      expect(anna?.contact.name).toBe('Anna');
      expect(anna?.lastMessage?.content).toBe('Hallo!');
      expect(anna?.unread).toBe(1);
      expect(anna?.signalLevel).toBe(3);
      expect(messaging.unreadCount(1)()).toBe(1);
    });

    it('sortiert nach der letzten Nachricht; Kontakte ohne Nachricht stehen nach ihrer Platznummer', async () => {
      // Ohne Antenne bleibt die Kontaktliste unter der Kontrolle des Tests.
      harness = setupAntennaHarness();
      messaging = TestBed.inject(MessagingService);
      messages = TestBed.inject(MessageRepository);
      contacts = TestBed.inject(ContactRepository);
      dataChanged = TestBed.inject(DataChangedService);
      await contacts.upsert({
        contactId: 1,
        name: 'Anna',
        nodeId: 'ECE4',
        publicKey: 'A5d2V7F/elA8qTcKyHqIP0WiIe7IjNTvZ30L+2bBRls=',
        state: 'active',
        fingerprint: '4821 0937 1156',
        lastRssi: null,
        lastSnr: null,
        txCtr: 0,
        rxHighestCtr: null,
      });
      await contacts.upsert({
        contactId: 3,
        name: 'Mia',
        nodeId: '8E2D',
        publicKey: 'DuQAXvPB/3K5X3OnKS0xWmT92GDGn7rAaK40rByhzV0=',
        state: 'active',
        fingerprint: '1659 8842 3370',
        lastRssi: null,
        lastSnr: null,
        txCtr: 0,
        rxHighestCtr: null,
      });
      await contacts.upsert({
        contactId: 4,
        name: 'Nina',
        nodeId: '8DDB',
        publicKey: 'g7QWg+3lRb2fJHHIWz2mlAyShdhQDQyb6uG8Aw//aeo=',
        state: 'active',
        fingerprint: '9027 5513 6841',
        lastRssi: null,
        lastSnr: null,
        txCtr: 0,
        rxHighestCtr: null,
      });
      await messages.insert(messageOf(1, 'in', 'Hallo!', 10));
      await messages.insert(messageOf(3, 'out', 'Wir starten morgen.', 60));
      dataChanged.notify();

      await waitForContacts(3);

      expect(messaging.contacts().map((item) => item.contact.contactId)).toEqual([1, 3, 4]);
      expect(messaging.contacts()[2]?.lastMessage).toBeNull();
    });

    it('setzt das Signal-Level auf 0, wenn die letzte eingehende Nachricht älter als 15 Minuten ist', async () => {
      await connected();
      await contacts.updateLink(1, -92, 7.5);
      await messages.insert(messageOf(1, 'in', 'Hallo!', 20));
      dataChanged.notify();

      await waitForContacts(2);

      const anna = messaging.contacts().find((item) => item.contact.contactId === 1);
      expect(anna?.signalLevel).toBe(0);
    });

    it('setzt das Signal-Level auf 0, wenn der Kontakt noch aussteht', async () => {
      await connected();
      await contacts.updateLink(2, -92, 7.5);
      await messages.insert(messageOf(2, 'in', 'Hallo!', 2));
      dataChanged.notify();

      await waitForContacts(2);

      const luca = messaging.contacts().find((item) => item.contact.contactId === 2);
      expect(luca?.contact.state).toBe('pending');
      expect(luca?.signalLevel).toBe(0);
    });

    it('zählt die ungelesenen Nachrichten je Kontakt', async () => {
      await connected();
      await messages.insert(messageOf(1, 'in', 'Hallo!', 2));
      dataChanged.notify();

      await waitForUnread(1, 1);

      await messaging.markRead(1);
      await waitForUnread(1, 0);
    });

    it('lädt die Liste neu, wenn sich die Daten ändern', async () => {
      await connected();
      await waitForContacts(2);

      await contacts.upsert({
        contactId: 5,
        name: 'Nina',
        nodeId: '8DDB',
        publicKey: 'g7QWg+3lRb2fJHHIWz2mlAyShdhQDQyb6uG8Aw//aeo=',
        state: 'active',
        fingerprint: '9027 5513 6841',
        lastRssi: null,
        lastSnr: null,
        txCtr: 0,
        rxHighestCtr: null,
      });
      dataChanged.notify();

      await waitForContacts(3);
      expect(messaging.contacts().map((item) => item.contact.name)).toContain('Nina');
    });
  });
});
