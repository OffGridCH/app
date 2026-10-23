import { TestBed } from '@angular/core/testing';

import type { Contact, Coordinate } from '../../models/contact';
import { MessageStatus, type Message } from '../../models/message';
import { MemoryContactRepository } from './memory-contact.repository';
import { MemoryCoordinateRepository } from './memory-coordinate.repository';
import { MemoryDatabaseService } from './memory-database.service';
import { MemoryHandshakeRepository } from './memory-handshake.repository';
import { MemoryMessageRepository } from './memory-message.repository';
import { MemorySettingsRepository } from './memory-settings.repository';

const KEY_A = 'a'.repeat(32);
const KEY_B = 'b'.repeat(32);
const T0 = '2026-01-01T10:00:00.000Z';

function contact(id: string, displayName: string): Contact {
  return {
    id,
    sendingKey: KEY_A,
    receivingKey: KEY_B,
    displayName,
    firstName: null,
    lastName: null,
    handshakeAt: T0,
    lastRssi: null,
    lastSeenAt: null,
    createdAt: T0,
    updatedAt: null,
  };
}

function message(id: string, contactId: string, sentAt: string, kind: Message['kind'] = 'text'): Message {
  return {
    id,
    contactId,
    wireId: '0000000a',
    content: kind === 'location' ? '' : 'Hallo',
    direction: 'in',
    kind,
    sentAt,
    status: MessageStatus.Delivered,
    rssi: null,
    readAt: null,
    createdAt: sentAt,
    updatedAt: null,
  };
}

function coordinate(id: string, contactId: string, messageId: string | null, recordedAt: string): Coordinate {
  return {
    id,
    contactId,
    messageId,
    latitude: 47.05021,
    longitude: 8.30934,
    accuracy: 5,
    context: 'einmal',
    shareId: null,
    shareUntil: null,
    recordedAt,
    createdAt: recordedAt,
    updatedAt: null,
  };
}

describe('MemoryDatabaseService', () => {
  let database: MemoryDatabaseService;
  let contacts: MemoryContactRepository;
  let messages: MemoryMessageRepository;
  let coordinates: MemoryCoordinateRepository;
  let handshakes: MemoryHandshakeRepository;
  let settings: MemorySettingsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    database = TestBed.inject(MemoryDatabaseService);
    contacts = TestBed.inject(MemoryContactRepository);
    messages = TestBed.inject(MemoryMessageRepository);
    coordinates = TestBed.inject(MemoryCoordinateRepository);
    handshakes = TestBed.inject(MemoryHandshakeRepository);
    settings = TestBed.inject(MemorySettingsRepository);
  });

  it('startet leer', async () => {
    expect(await contacts.count()).toBe(0);
    expect(await messages.count()).toBe(0);
    expect(await coordinates.count()).toBe(0);
    expect(await handshakes.open()).toEqual([]);
    expect(await settings.all()).toEqual({});
  });

  it('öffnet ohne Fehler', async () => {
    await expect(database.open()).resolves.toBeUndefined();
  });

  /** Ein Kontakt im Seed anhand des Anzeigenamens. */
  async function contactByName(displayName: string): Promise<Contact> {
    const found = (await contacts.all()).find((c) => c.displayName === displayName);
    if (!found) {
      throw new Error(`Kontakt ${displayName} fehlt`);
    }
    return found;
  }

  describe('Lösch-Kaskade (wie ON DELETE CASCADE in SQLite)', () => {
    beforeEach(async () => {
      await contacts.insert(contact('c1', 'Anna'));
      await contacts.insert(contact('c2', 'Luca'));
      await messages.insert(message('m1', 'c1', T0));
      await messages.insert(message('m2', 'c1', T0, 'location'));
      await messages.insert(message('m3', 'c2', T0));
      await coordinates.insert(coordinate('k1', 'c1', 'm2', T0));
      await coordinates.insert(coordinate('k2', 'c1', null, T0));
      await coordinates.insert(coordinate('k3', 'c2', 'm3', T0));
    });

    it('löscht mit dem Kontakt auch seine Nachrichten', async () => {
      await contacts.delete('c1');

      expect(await messages.forContact('c1')).toEqual([]);
      expect(await messages.byWireId('c1', '0000000a')).toBeNull();
    });

    it('löscht mit dem Kontakt auch seine Koordinaten', async () => {
      await contacts.delete('c1');

      expect(await coordinates.latestForMessage('m2')).toBeNull();
      expect(await coordinates.count()).toBe(1);
      expect(await coordinates.latestForMessage('m3')).not.toBeNull();
    });

    it('lässt die Daten anderer Kontakte unberührt', async () => {
      await contacts.delete('c1');

      expect(await contacts.byId('c2')).not.toBeNull();
      expect(await messages.forContact('c2')).toHaveLength(1);
    });
  });

  describe('seedDemo (Demo-Verlauf laut offgrid-screens §6)', () => {
    beforeEach(async () => {
      await database.seedDemo();
    });

    it('legt drei Demo-Kontakte mit Signalstärke an', async () => {
      const all = await contacts.all();

      expect(all).toHaveLength(3);
      expect(all.map((c) => c.displayName).sort()).toEqual(['Anna Meier', 'Luca Bernasconi', 'Mia Frei']);
      expect(all.map((c) => [c.displayName, c.lastRssi])).toContainEqual(['Anna Meier', -92]);
      expect(all.map((c) => [c.displayName, c.lastRssi])).toContainEqual(['Luca Bernasconi', -100]);
      expect(all.map((c) => [c.displayName, c.lastRssi])).toContainEqual(['Mia Frei', -110]);
      expect(all.map((c) => [c.firstName, c.lastName])).toContainEqual(['Anna', 'Meier']);
      expect(all.map((c) => [c.firstName, c.lastName])).toContainEqual(['Luca', 'Bernasconi']);
      expect(all.map((c) => [c.firstName, c.lastName])).toContainEqual(['Mia', 'Frei']);
    });

    it('legt sechs Nachrichten an, davon eine ungelesen', async () => {
      expect(await messages.count()).toBe(6);

      const unread = await messages.unreadPerContact();
      const anna = await contactByName('Anna Meier');
      expect([...unread.values()]).toEqual([1]);
      expect(unread.get(anna.id)).toBe(1);
    });

    it('legt den Verlauf mit Anna Meier an', async () => {
      const anna = await contactByName('Anna Meier');
      const history = await messages.forContact(anna.id);

      expect(history.map((m) => m.content)).toEqual([
        'Bin oben beim Gipfelkreuz. Hier gibt es keinen Handyempfang.',
        'Wir sind bei der Hütte und kommen in etwa 20 Minuten.',
        'Wartest du dort auf uns?',
        'Ja, ich warte hier. Es ist ziemlich windig.',
      ]);
      expect(history.map((m) => m.direction)).toEqual(['in', 'out', 'out', 'in']);
      expect(history.map((m) => m.readAt !== null)).toEqual([true, false, false, false]);
      expect(history.map((m) => m.status)).toEqual([
        MessageStatus.Delivered,
        MessageStatus.Delivered,
        MessageStatus.Sent,
        MessageStatus.Delivered,
      ]);
    });

    it('legt die Nachrichten von Luca Bernasconi und Mia Frei an', async () => {
      const luca = await contactByName('Luca Bernasconi');
      const mia = await contactByName('Mia Frei');

      const lucaHistory = await messages.forContact(luca.id);
      expect(lucaHistory.map((m) => m.content)).toEqual(['Basislager erreicht.']);
      expect(lucaHistory[0].direction).toBe('in');
      expect(lucaHistory[0].readAt).not.toBeNull();

      const miaHistory = await messages.forContact(mia.id);
      expect(miaHistory.map((m) => m.content)).toEqual(['Wir starten morgen um 7 Uhr.']);
      expect(miaHistory[0].direction).toBe('out');
      expect(miaHistory[0].status).toBe(MessageStatus.Delivered);
      expect(mia.lastSeenAt).toBe(miaHistory[0].sentAt);
    });

    it('legt den offenen Handshake „Jonas Keller" an', async () => {
      const open = await handshakes.open();

      expect(open).toHaveLength(1);
      expect(open[0].role).toBe('scanner');
      expect(open[0].state).toBe('sent');
      expect(open[0].peerName).toBe('Jonas Keller');
    });

    it('setzt die Demo-Einstellungen', async () => {
      expect(await settings.all()).toEqual({
        install_id: 'demo-install-id',
        display_name: 'HolyG',
        onboarding_done: '1',
        bg_receive: '1',
        vibrate: '0',
      });
    });

    it('legt keine Standort-Nachrichten an', async () => {
      expect(await coordinates.count()).toBe(0);
    });
  });

  describe('deleteAllUserData', () => {
    it('löscht Kontakte, Nachrichten, Koordinaten und Handshakes, lässt die Einstellungen stehen', async () => {
      await database.seedDemo();
      await settings.set('display_name', 'HolyG');

      await database.deleteAllUserData();

      expect(await contacts.count()).toBe(0);
      expect(await messages.count()).toBe(0);
      expect(await coordinates.count()).toBe(0);
      expect(await handshakes.open()).toEqual([]);
      expect(await settings.get('display_name')).toBe('HolyG');
    });
  });
});
