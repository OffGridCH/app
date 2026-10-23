import { DatabaseSync } from 'node:sqlite';

import { TestBed } from '@angular/core/testing';

import { NodeSqliteDatabase, openTestDatabase } from '../../../testing/node-sqlite';
import type { Contact, Coordinate } from '../models/contact';
import type { Handshake } from '../models/handshake';
import { MessageStatus, type Message } from '../models/message';
import { SqliteContactRepository } from './contact.repository';
import { SqliteCoordinateRepository } from './coordinate.repository';
import { SqliteDatabaseService } from './database.service';
import { SqliteHandshakeRepository } from './handshake.repository';
import { MemoryMessageRepository } from './memory/memory-message.repository';
import { SqliteMessageRepository } from './message.repository';
import { SqliteSettingsRepository } from './settings.repository';
import { MESSAGE_COLUMNS, MESSAGE_COLUMNS_QUALIFIED, MESSAGE_LAST_PER_CONTACT } from './sqlite-mapping';

const KEY_A = 'a'.repeat(32);
const KEY_B = 'b'.repeat(32);
const KEY_C = 'c'.repeat(32);
const KEY_D = 'd'.repeat(32);

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
function contact(id: string, displayName: string, sendingKey: string, receivingKey: string): Contact {
  return {
    id,
    sendingKey,
    receivingKey,
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

/** Eine Nachricht für die Testdaten. */
function message(id: string, contactId: string, sentAt: string, content: string): Message {
  return {
    id,
    contactId,
    wireId: id.padEnd(8, '0'),
    content,
    direction: 'in',
    kind: 'text',
    sentAt,
    status: MessageStatus.Delivered,
    rssi: null,
    readAt: null,
    createdAt: sentAt,
    updatedAt: null,
  };
}

/** Eine Koordinate für die Testdaten. */
function coordinate(
  id: string,
  contactId: string,
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

/** Ein Handshake für die Testdaten. */
function handshake(id: string, role: Handshake['role'], state: Handshake['state']): Handshake {
  return {
    id,
    role,
    localKey: KEY_A,
    remoteKey: KEY_B,
    peerName: 'Jonas Keller',
    state,
    contactId: null,
    createdAt: T0,
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
      await contacts.insert(contact('c1', 'Anna', KEY_A, KEY_B));
      await contacts.insert(contact('c2', 'Luca', KEY_C, KEY_D));
      await messages.insert(message('m1', 'c1', T0, 'erste'));
      await messages.insert(message('m2', 'c1', T1, 'zweite'));
      await messages.insert(message('m3', 'c2', T2, 'von Luca'));

      const rows = db.prepare(MESSAGE_LAST_PER_CONTACT).all();

      expect(rows.map((row) => row['contact_id'])).toEqual(['c1', 'c2']);
      expect(rows.map((row) => row['content'])).toEqual(['zweite', 'von Luca']);
      expect(rows.map((row) => row['id'])).toEqual(['m2', 'm3']);
    });

    it('qualifiziert alle projizierten Spalten mit dem Tabellennamen', () => {
      expect(MESSAGE_COLUMNS_QUALIFIED).toBe(
        'messages.id, messages.contact_id, messages.wire_id, messages.content, messages.direction, ' +
          'messages.kind, messages.sent_at, messages.status, messages.rssi, messages.read_at, ' +
          'messages.created_at, messages.updated_at',
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
      await contacts.insert(contact('c1', 'Anna', KEY_A, KEY_B));
      await contacts.insert(contact('c2', 'Luca', KEY_C, KEY_D));
      await messages.insert(message('m1', 'c1', T0, 'erste'));
      await messages.insert(message('m2', 'c1', T1, 'zweite'));
      await messages.insert(message('m3', 'c2', T2, 'von Luca'));
    });

    it('liefert je Kontakt die neueste Nachricht', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);

      const last = await messages.lastPerContact();

      expect(last.size).toBe(2);
      expect(last.get('c1')?.id).toBe('m2');
      expect(last.get('c1')?.content).toBe('zweite');
      expect(last.get('c2')?.id).toBe('m3');
      expect(last.get('c2')?.content).toBe('von Luca');
    });

    it('verhält sich wie die Memory-Implementierung', async () => {
      const sqlite = TestBed.inject(SqliteMessageRepository);
      const memory = new MemoryMessageRepository();
      for (const row of [
        message('m1', 'c1', T0, 'erste'),
        message('m2', 'c1', T1, 'zweite'),
        message('m3', 'c2', T2, 'von Luca'),
      ]) {
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

  describe('übrige Abfragen der Daten-Repositories', () => {
    beforeEach(async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      const handshakes = TestBed.inject(SqliteHandshakeRepository);
      const settings = TestBed.inject(SqliteSettingsRepository);
      await contacts.insert(contact('c1', 'Anna', KEY_A, KEY_B));
      await contacts.insert(contact('c2', 'Luca', KEY_C, KEY_D));
      await messages.insert(message('m1', 'c1', T0, 'erste'));
      await messages.insert(message('m2', 'c1', T1, 'zweite'));
      await messages.insert(message('m3', 'c2', T2, 'von Luca'));
      await coordinates.insert(coordinate('k1', 'c1', 'm2', T1, 'share-1'));
      await coordinates.insert(coordinate('k2', 'c2', 'm3', T2));
      await handshakes.insert(handshake('h1', 'shower', 'done'));
      await handshakes.insert(handshake('h2', 'scanner', 'sent'));
      await settings.set('display_name', 'HolyG');
    });

    it('führt alle Leseabfragen ohne Mehrdeutigkeit aus', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      const handshakes = TestBed.inject(SqliteHandshakeRepository);
      const settings = TestBed.inject(SqliteSettingsRepository);

      const results = await Promise.all([
        contacts.all(),
        contacts.byId('c1'),
        contacts.count(),
        messages.forContact('c1'),
        messages.lastPerContact(),
        messages.unreadPerContact(),
        messages.queued(),
        messages.byWireId('c1', 'm100000'),
        messages.count(),
        coordinates.latestForMessage('m2'),
        coordinates.latestForMessages(['m2', 'm3']),
        coordinates.messageIdForShare('c1', 'share-1'),
        coordinates.count(),
        handshakes.open(),
        handshakes.doneShowers(),
        settings.all(),
      ]);

      expect(results).toHaveLength(16);
    });

    it('führt alle Schreibabfragen ohne Fehler aus', async () => {
      const contacts = TestBed.inject(SqliteContactRepository);
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);
      const handshakes = TestBed.inject(SqliteHandshakeRepository);
      const settings = TestBed.inject(SqliteSettingsRepository);

      await expect(contacts.updateNames('c1', 'Anna Meier', 'Anna', 'Meier')).resolves.toBeUndefined();
      await expect(contacts.updateSignal('c1', -92, T1)).resolves.toBeUndefined();
      await expect(messages.setStatus('m1', MessageStatus.Queued)).resolves.toBeUndefined();
      await expect(messages.markRead('c1', T1)).resolves.toBeUndefined();
      await expect(coordinates.insert(coordinate('k3', 'c1', null, T1))).resolves.toBeUndefined();
      await expect(handshakes.update(handshake('h1', 'shower', 'done'))).resolves.toBeUndefined();
      await expect(settings.set('display_name', 'HolyG')).resolves.toBeUndefined();
      await expect(settings.get('display_name')).resolves.toBe('HolyG');
    });

    it('liefert je Kontakt die neueste Nachricht und je Nachricht die neueste Koordinate', async () => {
      const messages = TestBed.inject(SqliteMessageRepository);
      const coordinates = TestBed.inject(SqliteCoordinateRepository);

      const last = await messages.lastPerContact();
      const latest = await coordinates.latestForMessages(['m1', 'm2', 'm3']);

      expect(last.get('c1')?.id).toBe('m2');
      expect(last.get('c2')?.id).toBe('m3');
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
