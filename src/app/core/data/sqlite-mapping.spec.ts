import { DatabaseSync } from 'node:sqlite';

import { TestBed } from '@angular/core/testing';

import { NodeSqliteDatabase, openTestDatabase } from '../../../testing/node-sqlite';
import type { Contact, Coordinate } from '../models/contact';
import { MessageStatus, type Message } from '../models/message';
import { SqliteContactRepository } from './contact.repository';
import { SqliteCoordinateRepository } from './coordinate.repository';
import { SqliteDatabaseService } from './database.service';
import { MemoryMessageRepository } from './memory/memory-message.repository';
import { SqliteMessageRepository } from './message.repository';
import { SqliteSettingsRepository } from './settings.repository';
import { MESSAGE_COLUMNS, MESSAGE_COLUMNS_QUALIFIED, MESSAGE_LAST_PER_CONTACT } from './sqlite-mapping';

const KEY_A = `${'A'.repeat(43)}=`;
const KEY_B = `${'B'.repeat(43)}=`;

const T0 = '2026-01-01T10:00:00.000Z';
const T1 = '2026-01-01T11:00:00.000Z';
const T2 = '2026-01-02T09:00:00.000Z';

/**
 * Das Statement vor der Korrekturrunde: die projizierten Spalten waren nicht
 * qualifiziert. Dient nur der Gegenprobe in diesem Test, steht nicht im Produktivcode.
 */
const MESSAGE_LAST_PER_CONTACT_UNQUALIFIED = `SELECT ${MESSAGE_COLUMNS} FROM messages
  INNER JOIN (
    SELECT contact_id, MAX(sent_at) AS max_sent FROM messages GROUP BY contact_id
  ) latest ON latest.contact_id = messages.contact_id AND latest.max_sent = messages.sent_at
  ORDER BY messages.sent_at ASC`;

/** Ein Kontakt für die Testdaten. */
function contact(contactId: number, name: string, publicKey: string): Contact {
  return {
    contactId,
    name,
    nodeId: 'ECE4',
    publicKey,
    state: 'active',
    fingerprint: '4821 0937 1156',
    lastRssi: null,
    lastSnr: null,
    txCtr: 0,
    rxHighestCtr: null,
  };
}

/** Eine Nachricht für die Testdaten. */
function message(id: string, contactId: number, sentAt: string, content: string, options: Partial<Message> = {}): Message {
  return {
    id,
    contactId,
    ctr: Number(id.slice(1)),
    msgRef: null,
    content,
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

/** Eine Koordinate für die Testdaten. */
function coordinate(
  id: string,
  contactId: number,
  messageId: string | null,
  recordedAt: string,
  shareId: string | null = null,
): Coordinate {
  return {
    id,
    contactId,
    messageId,
    latitude: 47.05021,
    longitude: 8.30934,
    accuracy: 5,
    context: 'einmal',
    shareId,
    shareUntil: null,
    recordedAt,
    createdAt: recordedAt,
    updatedAt: null,
  };
}

describe('SQLite-Abfragen der Daten-Repositories (echte SQLite-Ausführung)', () => {
  let db: DatabaseSync;
  let adapter: NodeSqliteDatabase;

  beforeEach(() => {
    db = openTestDatabase();
    adapter = new NodeSqliteDatabase(db);
    TestBed.configureTestingModule({
      providers: [{ provide: SqliteDatabaseService, useValue: adapter }],
    });
  });

  afterEach(() => {
    db.close();
  });

  describe('MESSAGE_LAST_PER_CONTACT', () => {
    it('lässt sich auf einer leeren Datenbank vorbereiten und ausführen', () => {
      const rows = db.prepare(MESSAGE_LAST_PER_CONTACT).all();

      expect(rows).toEqual([]);
    });

    it('liefert je Kontakt die neueste Nachricht', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      await contacts.upsert(contact(1, 'Anna', KEY_A));
      await contacts.upsert(contact(2, 'Luca', KEY_B));
      await messages.insert(message('m1', 1, T0, 'erste'));
      await messages.insert(message('m2', 1, T1, 'zweite'));
      await messages.insert(message('m3', 2, T2, 'von Luca'));

      const rows = db.prepare(MESSAGE_LAST_PER_CONTACT).all();

      expect(rows.map((row) => row['contact_id'])).toEqual([1, 2]);
      expect(rows.map((row) => row['content'])).toEqual(['zweite', 'von Luca']);
      expect(rows.map((row) => row['id'])).toEqual(['m2', 'm3']);
    });

    it('qualifiziert alle projizierten Spalten mit dem Tabellennamen', () => {
      expect(MESSAGE_COLUMNS_QUALIFIED).toBe(
        'messages.id, messages.contact_id, messages.ctr, messages.msg_ref, messages.content, ' +
          'messages.direction, messages.kind, messages.sent_at, messages.status, messages.rssi, ' +
          'messages.read_at, messages.created_at, messages.updated_at',
      );
      for (const column of MESSAGE_COLUMNS.split(', ')) {
        expect(MESSAGE_LAST_PER_CONTACT).toContain(`messages.${column}`);
      }
      expect(MESSAGE_LAST_PER_CONTACT).not.toContain(`SELECT ${MESSAGE_COLUMNS} `);
    });

    it('scheitert mit dem unqualifizierten Statement schon beim Vorbereiten', () => {
      expect(() => db.prepare(MESSAGE_LAST_PER_CONTACT_UNQUALIFIED)).toThrow(/ambiguous column name/i);
    });
  });

  describe('SqliteMessageRepository.lastPerContact()', () => {
    beforeEach(async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      await contacts.upsert(contact(1, 'Anna', KEY_A));
      await contacts.upsert(contact(2, 'Luca', KEY_B));
      await messages.insert(message('m1', 1, T0, 'erste'));
      await messages.insert(message('m2', 1, T1, 'zweite'));
      await messages.insert(message('m3', 2, T2, 'von Luca'));
    });

    it('liefert je Kontakt die neueste Nachricht', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);

      const last = await messages.lastPerContact();

      expect(last.size).toBe(2);
      expect(last.get(1)?.id).toBe('m2');
      expect(last.get(1)?.content).toBe('zweite');
      expect(last.get(2)?.id).toBe('m3');
      expect(last.get(2)?.content).toBe('von Luca');
    });

    it('verhält sich wie die Memory-Implementierung', async () => {
      const sqlite = TestBed.inject(SqliteMessageRepository);
      const memory = new MemoryMessageRepository();
      for (const row of [message('m1', 1, T0, 'erste'), message('m2', 1, T1, 'zweite'), message('m3', 2, T2, 'von Luca')]) {
        await memory.insert(row);
      }

      const fromSqlite = await sqlite.lastPerContact();
      const fromMemory = await memory.lastPerContact();

      expect([...fromSqlite.keys()].sort()).toEqual([...fromMemory.keys()].sort());
      for (const [contactId, value] of fromSqlite) {
        expect(fromMemory.get(contactId)?.id).toBe(value.id);
        expect(fromMemory.get(contactId)?.sentAt).toBe(value.sentAt);
        expect(fromMemory.get(contactId)?.content).toBe(value.content);
      }
    });
  });

  describe('SqliteContactRepository', () => {
    it('speichert und liest Kontakte ohne Schlüssel in der Tabelle', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);

      await contacts.upsert({ ...contact(3, 'Mia', KEY_A), lastRssi: -90, lastSnr: 6.5, txCtr: 4, rxHighestCtr: 7 });

      expect(await contacts.byId(3)).toEqual({
        contactId: 3,
        name: 'Mia',
        nodeId: 'ECE4',
        publicKey: KEY_A,
        state: 'active',
        fingerprint: '4821 0937 1156',
        lastRssi: -90,
        lastSnr: 6.5,
        txCtr: 4,
        rxHighestCtr: 7,
      });
      expect(Object.keys(db.prepare('SELECT * FROM contacts').get() ?? {})).toEqual([
        'contact_id',
        'name',
        'node_id',
        'public_key',
        'state',
        'fingerprint',
        'last_rssi',
        'last_snr',
        'tx_ctr',
        'rx_highest_ctr',
      ]);
    });

    it('aktualisiert mit upsert, ohne den Verlauf des Kontakts zu löschen (kein REPLACE)', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      await contacts.upsert(contact(1, 'Anna', KEY_A));
      await messages.insert(message('m1', 1, T0, 'bleibt'));

      await contacts.upsert({ ...contact(1, 'Anna Meier', KEY_A), state: 'pending', txCtr: 9 });

      expect(await contacts.count()).toBe(1);
      expect(await contacts.byId(1)).toMatchObject({ name: 'Anna Meier', state: 'pending', txCtr: 9 });
      expect(await messages.forContact(1)).toHaveLength(1);
    });

    it('ändert Namen, Signal und Zustand', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      await contacts.upsert({ ...contact(1, 'Anna', KEY_A), state: 'pending' });

      await contacts.updateName(1, 'Anna M.');
      await contacts.updateLink(1, -100, 3.5);
      await contacts.setState(1, 'active');

      expect(await contacts.byId(1)).toMatchObject({ name: 'Anna M.', lastRssi: -100, lastSnr: 3.5, state: 'active' });
    });

    it('lehnt einen Schlüssel ab, der schon einem anderen Platz gehört', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      await contacts.upsert(contact(1, 'Anna', KEY_A));

      await expect(contacts.upsert(contact(2, 'Doppelt', KEY_A))).rejects.toThrow(/UNIQUE/);
    });

    it('löscht mit dem Kontakt Nachrichten und Koordinaten (ON DELETE CASCADE)', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      await contacts.upsert(contact(1, 'Anna', KEY_A));
      await contacts.upsert(contact(2, 'Luca', KEY_B));
      await messages.insert(message('m1', 1, T0, 'weg'));
      await messages.insert(message('m2', 2, T0, 'bleibt'));
      await coordinates.insert(coordinate('k1', 1, 'm1', T0));

      await contacts.delete(1);

      expect(await messages.count()).toBe(1);
      expect(await coordinates.count()).toBe(0);
      expect(await contacts.count()).toBe(1);
    });

    it('lehnt eine Nachricht für einen unbekannten Kontakt ab (Fremdschlüssel)', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);

      await expect(messages.insert(message('m1', 9, T0, 'Waise'))).rejects.toThrow(/FOREIGN KEY/);
    });
  });

  describe('SqliteMessageRepository (Zähler, Handle, Warteschlange)', () => {
    beforeEach(async () => {
      await TestBed.inject(SqliteContactRepository).upsert(contact(1, 'Anna', KEY_A));
    });

    it('findet eine offene ausgehende Nachricht über ihr Handle, eine fertige nicht', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      await messages.insert(message('m1', 1, T0, 'offen', { direction: 'out', msgRef: 7, status: MessageStatus.Sent }));
      await messages.insert(message('m2', 1, T1, 'fertig', { direction: 'out', msgRef: 8, status: MessageStatus.Delivered }));

      expect((await messages.byMsgRef(7))?.id).toBe('m1');
      expect(await messages.byMsgRef(8)).toBeNull();
      expect(await messages.byMsgRef(99)).toBeNull();
    });

    it('findet Nachrichten über Kontakt, Richtung und Zähler', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      await messages.insert(message('m1', 1, T0, 'rein', { direction: 'in', ctr: 2 }));
      await messages.insert(message('m2', 1, T0, 'raus', { direction: 'out', ctr: 2 }));

      expect((await messages.byCtr(1, 'in', 2))?.content).toBe('rein');
      expect((await messages.byCtr(1, 'out', 2))?.content).toBe('raus');
      expect(await messages.byCtr(1, 'in', 3)).toBeNull();
    });

    it('listet nur Nachrichten ohne Handle als noch nicht beim Gerät', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      await messages.insert(message('m1', 1, T0, 'wartet', { direction: 'out', ctr: null, status: MessageStatus.Queued }));
      await messages.insert(message('m2', 1, T1, 'beim Gerät', { direction: 'out', msgRef: 3, status: MessageStatus.Queued }));
      await messages.insert(message('m3', 1, T2, 'fertig', { direction: 'out', status: MessageStatus.Delivered }));

      expect((await messages.queued()).map((entry) => entry.id)).toEqual(['m1']);
    });

    it('trägt Zähler und Handle ein und legt eine Nachricht wieder in die Warteschlange', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      await messages.insert(message('m1', 1, T0, 'Hallo', { direction: 'out', ctr: null, status: MessageStatus.Queued }));

      await messages.assignRef('m1', 9, 4, MessageStatus.Queued);
      expect(await messages.byId('m1')).toMatchObject({ ctr: 9, msgRef: 4, status: MessageStatus.Queued });

      await messages.setStatus('m1', MessageStatus.Failed);
      await messages.requeue('m1');
      expect(await messages.byId('m1')).toMatchObject({ ctr: null, msgRef: null, status: MessageStatus.Queued });
    });

    it('lässt nach einem Neustart des Geräts alles scheitern, was dort wartete', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      await messages.insert(message('m1', 1, T0, 'a', { direction: 'out', msgRef: 1, status: MessageStatus.Queued }));
      await messages.insert(message('m2', 1, T0, 'b', { direction: 'out', msgRef: 2, status: MessageStatus.Sent }));
      await messages.insert(message('m3', 1, T0, 'c', { direction: 'out', msgRef: 3, status: MessageStatus.Delivered }));
      await messages.insert(message('m4', 1, T0, 'd', { direction: 'out', ctr: null, status: MessageStatus.Queued }));
      await messages.insert(message('m5', 1, T0, 'e', { direction: 'in', status: MessageStatus.Delivered }));

      expect(await messages.failPending()).toBe(2);

      const statuses = await Promise.all(['m1', 'm2', 'm3', 'm4', 'm5'].map(async (id) => (await messages.byId(id))?.status));
      expect(statuses).toEqual([
        MessageStatus.Failed,
        MessageStatus.Failed,
        MessageStatus.Delivered,
        MessageStatus.Queued,
        MessageStatus.Delivered,
      ]);
    });

    it('verhält sich bei byMsgRef, byCtr, queued und failPending wie die Memory-Implementierung', async () => {
      const sqlite = TestBed.inject(SqliteMessageRepository);
      const memory = new MemoryMessageRepository();
      const rows = [
        message('m1', 1, T0, 'a', { direction: 'out', msgRef: 1, status: MessageStatus.Queued }),
        message('m2', 1, T0, 'b', { direction: 'out', msgRef: 2, status: MessageStatus.Sent }),
        message('m3', 1, T1, 'c', { direction: 'out', msgRef: 3, status: MessageStatus.Delivered }),
        message('m4', 1, T1, 'd', { direction: 'out', ctr: null, status: MessageStatus.Queued }),
        message('m5', 1, T2, 'e', { direction: 'in', ctr: 3 }),
      ];
      for (const row of rows) {
        await sqlite.insert(row);
        await memory.insert(row);
      }

      for (const ref of [1, 2, 3, 4]) {
        expect((await sqlite.byMsgRef(ref))?.id).toBe((await memory.byMsgRef(ref))?.id);
      }
      expect((await sqlite.byCtr(1, 'in', 3))?.id).toBe((await memory.byCtr(1, 'in', 3))?.id);
      expect((await sqlite.queued()).map((row) => row.id)).toEqual((await memory.queued()).map((row) => row.id));
      expect(await sqlite.failPending()).toBe(await memory.failPending());
      expect((await sqlite.forContact(1)).map((row) => row.status)).toEqual(
        (await memory.forContact(1)).map((row) => row.status),
      );
    });
  });

  describe('übrige Abfragen der Daten-Repositories', () => {
    beforeEach(async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      const settings = TestBed.inject(SqliteSettingsRepository);
      await contacts.upsert(contact(1, 'Anna', KEY_A));
      await contacts.upsert(contact(2, 'Luca', KEY_B));
      await messages.insert(message('m1', 1, T0, 'erste'));
      await messages.insert(message('m2', 1, T1, 'zweite'));
      await messages.insert(message('m3', 2, T2, 'von Luca'));
      await coordinates.insert(coordinate('k1', 1, 'm2', T1, 'share-1'));
      await coordinates.insert(coordinate('k2', 2, 'm3', T2));
      await settings.set('display_name', 'HolyG');
    });

    it('führt alle Leseabfragen ohne Mehrdeutigkeit aus', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      const settings = TestBed.inject(SqliteSettingsRepository);

      const results = await Promise.all([
        contacts.all(),
        contacts.byId(1),
        contacts.count(),
        messages.forContact(1),
        messages.lastPerContact(),
        messages.unreadPerContact(),
        messages.queued(),
        messages.byMsgRef(1),
        messages.byCtr(1, 'in', 1),
        messages.count(),
        coordinates.latestForMessage('m2'),
        coordinates.latestForMessages(['m2', 'm3']),
        coordinates.messageIdForShare(1, 'share-1'),
        coordinates.count(),
        settings.all(),
      ]);

      expect(results).toHaveLength(15);
    });

    it('führt alle Schreibabfragen ohne Fehler aus', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      const settings = TestBed.inject(SqliteSettingsRepository);

      await expect(contacts.updateName(1, 'Anna Meier')).resolves.toBeUndefined();
      await expect(contacts.updateLink(1, -92, 7)).resolves.toBeUndefined();
      await expect(contacts.setState(1, 'pending')).resolves.toBeUndefined();
      await expect(messages.setStatus('m1', MessageStatus.Queued)).resolves.toBeUndefined();
      await expect(messages.markRead(1, T1)).resolves.toBeUndefined();
      await expect(coordinates.insert(coordinate('k3', 1, null, T1))).resolves.toBeUndefined();
      await expect(settings.set('display_name', 'HolyG')).resolves.toBeUndefined();
      await expect(settings.get('display_name')).resolves.toBe('HolyG');
    });

    it('liefert je Kontakt die neueste Nachricht und je Nachricht die neueste Koordinate', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);

      const last = await messages.lastPerContact();
      const latest = await coordinates.latestForMessages(['m1', 'm2', 'm3']);

      expect(last.get(1)?.id).toBe('m2');
      expect(last.get(2)?.id).toBe('m3');
      expect(latest.get('m2')?.id).toBe('k1');
      expect(latest.get('m3')?.id).toBe('k2');
    });
  });
});

describe('SqliteMessageRepository.lastPerContact() auf leerer Datenbank', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openTestDatabase();
    TestBed.configureTestingModule({
      providers: [{ provide: SqliteDatabaseService, useValue: new NodeSqliteDatabase(db) }],
    });
  });

  afterEach(() => {
    db.close();
  });

  it('liefert keine Nachricht und meldet keinen Fehler', async () => {
    const messages = TestBed.inject(SqliteMessageRepository);

    await expect(messages.lastPerContact()).resolves.toEqual(new Map());
  });
});
