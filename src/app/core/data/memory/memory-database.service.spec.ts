import { TestBed } from '@angular/core/testing';

import type { Contact, Coordinate } from '../../models/contact';
import { MessageStatus, type Message } from '../../models/message';
import { MemoryContactRepository } from './memory-contact.repository';
import { MemoryCoordinateRepository } from './memory-coordinate.repository';
import { MemoryDatabaseService } from './memory-database.service';
import { MemoryMessageRepository } from './memory-message.repository';
import { MemorySettingsRepository } from './memory-settings.repository';
import { DEMO_CONTACTS } from './seed';

const PUBLIC_KEY_A = `${'A'.repeat(43)}=`;
const PUBLIC_KEY_B = `${'B'.repeat(43)}=`;
const T0 = '2026-01-01T10:00:00.000Z';

function contact(contactId: number, name: string, publicKey = PUBLIC_KEY_A): Contact {
  return {
    contactId,
    name,
    nodeId: 'E841',
    publicKey,
    state: 'active',
    fingerprint: '0501 3010 7790',
    lastRssi: null,
    lastSnr: null,
    txCtr: 0,
    rxHighestCtr: null,
  };
}

function message(
  id: string,
  contactId: number,
  sentAt: string,
  options: Partial<Message> = {},
): Message {
  return {
    id,
    contactId,
    ctr: 1,
    msgRef: null,
    content: options.kind === 'location' ? '' : 'Hallo',
    direction: 'in',
    kind: 'text',
    sentAt,
    status: MessageStatus.Delivered,
    rssi: null,
    readAt: null,
    createdAt: sentAt,
    updatedAt: null,
    ...options,
  };
}

function coordinate(id: string, contactId: number, messageId: string | null, recordedAt: string): Coordinate {
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
  let settings: MemorySettingsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    database = TestBed.inject(MemoryDatabaseService);
    contacts = TestBed.inject(MemoryContactRepository);
    messages = TestBed.inject(MemoryMessageRepository);
    coordinates = TestBed.inject(MemoryCoordinateRepository);
    settings = TestBed.inject(MemorySettingsRepository);
  });

  it('startet leer', async () => {
    expect(await contacts.count()).toBe(0);
    expect(await messages.count()).toBe(0);
    expect(await coordinates.count()).toBe(0);
    expect(await settings.all()).toEqual({});
  });

  it('öffnet ohne Fehler', async () => {
    await expect(database.open()).resolves.toBeUndefined();
  });

  /** Ein Kontakt im Seed anhand des Namens. */
  async function contactByName(name: string): Promise<Contact> {
    const found = (await contacts.all()).find((c) => c.name === name);
    if (!found) {
      throw new Error(`Kontakt ${name} fehlt`);
    }
    return found;
  }

  describe('Kontakte', () => {
    it('liefert die Kontakte nach Platz', async () => {
      await contacts.upsert(contact(3, 'Mia', PUBLIC_KEY_B));
      await contacts.upsert(contact(1, 'Anna'));

      expect((await contacts.all()).map((c) => c.contactId)).toEqual([1, 3]);
      expect((await contacts.byId(3))?.name).toBe('Mia');
      expect(await contacts.byId(2)).toBeNull();
    });

    it('aktualisiert einen Kontakt mit upsert, ohne seinen Verlauf zu löschen', async () => {
      await contacts.upsert(contact(1, 'Anna'));
      await messages.insert(message('m1', 1, T0));

      await contacts.upsert({ ...contact(1, 'Anna Meier'), state: 'pending', txCtr: 5 });

      expect(await contacts.count()).toBe(1);
      expect(await contacts.byId(1)).toMatchObject({ name: 'Anna Meier', state: 'pending', txCtr: 5 });
      expect(await messages.forContact(1)).toHaveLength(1);
    });

    it('ändert Namen, Signalwerte und Zustand einzeln', async () => {
      await contacts.upsert({ ...contact(1, 'Anna'), state: 'pending' });

      await contacts.updateName(1, 'Anna M.');
      await contacts.updateLink(1, -90, 6.5);
      await contacts.setState(1, 'active');

      expect(await contacts.byId(1)).toMatchObject({ name: 'Anna M.', lastRssi: -90, lastSnr: 6.5, state: 'active' });
    });

    it('ignoriert Änderungen an unbekannten Kontakten', async () => {
      await contacts.updateName(9, 'Niemand');
      await contacts.setState(9, 'active');

      expect(await contacts.count()).toBe(0);
    });
  });

  describe('Nachrichten', () => {
    it('findet eine offene ausgehende Nachricht über ihr Handle, eine fertige nicht', async () => {
      await messages.insert(
        message('m1', 1, T0, { direction: 'out', ctr: 4, msgRef: 7, status: MessageStatus.Sent }),
      );
      await messages.insert(
        message('m2', 1, T0, { direction: 'out', ctr: 3, msgRef: 8, status: MessageStatus.Delivered }),
      );

      expect((await messages.byMsgRef(7))?.id).toBe('m1');
      expect(await messages.byMsgRef(8)).toBeNull();
      expect(await messages.byMsgRef(99)).toBeNull();
    });

    it('findet Nachrichten über Kontakt, Richtung und Zähler', async () => {
      await messages.insert(message('in', 1, T0, { direction: 'in', ctr: 2 }));
      await messages.insert(message('out', 1, T0, { direction: 'out', ctr: 2 }));

      expect((await messages.byCtr(1, 'in', 2))?.id).toBe('in');
      expect((await messages.byCtr(1, 'out', 2))?.id).toBe('out');
      expect(await messages.byCtr(2, 'in', 2)).toBeNull();
      expect(await messages.byCtr(1, 'in', 3)).toBeNull();
    });

    it('zählt nur Nachrichten ohne Handle als noch nicht beim Gerät', async () => {
      await messages.insert(
        message('wartet', 1, '2026-01-01T10:01:00.000Z', { direction: 'out', ctr: null, status: MessageStatus.Queued }),
      );
      await messages.insert(
        message('beim-geraet', 1, '2026-01-01T10:02:00.000Z', {
          direction: 'out',
          msgRef: 5,
          status: MessageStatus.Queued,
        }),
      );
      await messages.insert(message('fertig', 1, T0, { direction: 'out', status: MessageStatus.Delivered }));

      expect((await messages.queued()).map((m) => m.id)).toEqual(['wartet']);
    });

    it('trägt Zähler und Handle nach msg.send ein', async () => {
      await messages.insert(message('m1', 1, T0, { direction: 'out', ctr: null, status: MessageStatus.Queued }));

      await messages.assignRef('m1', 9, 4, MessageStatus.Queued);

      expect(await messages.byId('m1')).toMatchObject({ ctr: 9, msgRef: 4, status: MessageStatus.Queued });
    });

    it('markiert nach einem Neustart des Geräts alles als gescheitert, was dort wartete', async () => {
      await messages.insert(
        message('a', 1, T0, { direction: 'out', msgRef: 1, status: MessageStatus.Queued }),
      );
      await messages.insert(message('b', 1, T0, { direction: 'out', msgRef: 2, status: MessageStatus.Sent }));
      await messages.insert(message('c', 1, T0, { direction: 'out', msgRef: 3, status: MessageStatus.Delivered }));
      await messages.insert(message('d', 1, T0, { direction: 'out', ctr: null, status: MessageStatus.Queued }));
      await messages.insert(message('e', 1, T0, { direction: 'in', status: MessageStatus.Delivered }));

      expect(await messages.failPending()).toBe(2);

      const statuses = Object.fromEntries(
        await Promise.all(
          ['a', 'b', 'c', 'd', 'e'].map(async (id) => [id, (await messages.byId(id))?.status] as const),
        ),
      );
      expect(statuses).toEqual({
        a: MessageStatus.Failed,
        b: MessageStatus.Failed,
        c: MessageStatus.Delivered,
        d: MessageStatus.Queued,
        e: MessageStatus.Delivered,
      });
    });

    it('legt eine gescheiterte Nachricht ohne Zähler und Handle wieder in die Warteschlange', async () => {
      await messages.insert(
        message('m1', 1, T0, { direction: 'out', ctr: 4, msgRef: 7, status: MessageStatus.Failed }),
      );

      await messages.requeue('m1');

      expect(await messages.byId('m1')).toMatchObject({ ctr: null, msgRef: null, status: MessageStatus.Queued });
      expect((await messages.queued()).map((m) => m.id)).toEqual(['m1']);
    });
  });

  describe('Lösch-Kaskade (wie ON DELETE CASCADE in SQLite)', () => {
    beforeEach(async () => {
      await contacts.upsert(contact(1, 'Anna'));
      await contacts.upsert(contact(2, 'Luca', PUBLIC_KEY_B));
      await messages.insert(message('m1', 1, T0));
      await messages.insert(message('m2', 1, T0, { kind: 'location', ctr: 2 }));
      await messages.insert(message('m3', 2, T0));
      await coordinates.insert(coordinate('k1', 1, 'm2', T0));
      await coordinates.insert(coordinate('k2', 1, null, T0));
      await coordinates.insert(coordinate('k3', 2, 'm3', T0));
    });

    it('löscht mit dem Kontakt auch seine Nachrichten', async () => {
      await contacts.delete(1);

      expect(await messages.forContact(1)).toEqual([]);
      expect(await messages.byCtr(1, 'in', 1)).toBeNull();
    });

    it('löscht mit dem Kontakt auch seine Koordinaten', async () => {
      await contacts.delete(1);

      expect(await coordinates.latestForMessage('m2')).toBeNull();
      expect(await coordinates.count()).toBe(1);
      expect(await coordinates.latestForMessage('m3')).not.toBeNull();
    });

    it('lässt die Daten anderer Kontakte unberührt', async () => {
      await contacts.delete(1);

      expect(await contacts.byId(2)).not.toBeNull();
      expect(await messages.forContact(2)).toHaveLength(1);
    });
  });

  describe('seedDemo (Demo-Verlauf laut offgrid-screens §6)', () => {
    beforeEach(async () => {
      await database.seedDemo();
    });

    it('legt drei aktive Demo-Kontakte mit Signalstärke und einen ausstehenden an', async () => {
      const all = await contacts.all();

      expect(all.map((c) => [c.contactId, c.name, c.state])).toEqual([
        [1, 'Anna Meier', 'active'],
        [2, 'Luca Bernasconi', 'active'],
        [3, 'Mia Frei', 'active'],
        [4, 'Jonas Keller', 'pending'],
      ]);
      expect(all.map((c) => [c.name, c.lastRssi])).toContainEqual(['Anna Meier', -92]);
      expect(all.map((c) => [c.name, c.lastRssi])).toContainEqual(['Luca Bernasconi', -100]);
      expect(all.map((c) => [c.name, c.lastRssi])).toContainEqual(['Mia Frei', -110]);
    });

    it('hat für jeden Kontakt nur Felder der Host-API und keine Schlüssel', async () => {
      for (const c of await contacts.all()) {
        expect(Object.keys(c).sort()).toEqual(
          [
            'contactId',
            'fingerprint',
            'lastRssi',
            'lastSnr',
            'name',
            'nodeId',
            'publicKey',
            'rxHighestCtr',
            'state',
            'txCtr',
          ].sort(),
        );
        expect(c.fingerprint).toMatch(/^\d{4} \d{4} \d{4}$/);
        expect(c.nodeId).toMatch(/^[0-9A-F]{4}$/);
        expect(c.publicKey).toHaveLength(44);
      }
    });

    it('stimmt mit den Kontakten überein, die das simulierte Gerät kennt', async () => {
      expect(await contacts.all()).toEqual([...DEMO_CONTACTS]);
    });

    it('legt sechs Nachrichten an, davon eine ungelesen', async () => {
      expect(await messages.count()).toBe(6);

      const unread = await messages.unreadPerContact();
      expect([...unread.entries()]).toEqual([[1, 1]]);
    });

    it('legt den Verlauf mit Anna Meier an', async () => {
      const anna = await contactByName('Anna Meier');
      const history = await messages.forContact(anna.contactId);

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

    it('gibt den Nachrichten Zähler statt Funk-Ids und kein Handle', async () => {
      const anna = await contactByName('Anna Meier');
      const history = await messages.forContact(anna.contactId);

      expect(history.map((m) => [m.direction, m.ctr])).toEqual([
        ['in', 1],
        ['out', 1],
        ['out', 2],
        ['in', 2],
      ]);
      expect(history.every((m) => m.msgRef === null)).toBe(true);
    });

    it('legt die Nachrichten von Luca Bernasconi und Mia Frei an', async () => {
      const luca = await contactByName('Luca Bernasconi');
      const mia = await contactByName('Mia Frei');

      const lucaHistory = await messages.forContact(luca.contactId);
      expect(lucaHistory.map((m) => m.content)).toEqual(['Basislager erreicht.']);
      expect(lucaHistory[0].direction).toBe('in');
      expect(lucaHistory[0].readAt).not.toBeNull();

      const miaHistory = await messages.forContact(mia.contactId);
      expect(miaHistory.map((m) => m.content)).toEqual(['Wir starten morgen um 7 Uhr.']);
      expect(miaHistory[0].direction).toBe('out');
      expect(miaHistory[0].status).toBe(MessageStatus.Delivered);
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
    it('löscht Kontakte, Nachrichten und Koordinaten, lässt die Einstellungen stehen', async () => {
      await database.seedDemo();
      await settings.set('display_name', 'HolyG');

      await database.deleteAllUserData();

      expect(await contacts.count()).toBe(0);
      expect(await messages.count()).toBe(0);
      expect(await coordinates.count()).toBe(0);
      expect(await settings.get('display_name')).toBe('HolyG');
    });
  });
});
