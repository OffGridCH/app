import { DatabaseSync } from 'node:sqlite';

import { TestBed } from '@angular/core/testing';

import { NodeSqliteDatabase, openTestDatabase } from '../../../testing/node-sqlite';
import type { Contact } from '../models/contact';
import { MessageStatus, type Message } from '../models/message';
import { SqliteContactRepository } from './contact.repository';
import { SqliteDatabaseService } from './database.service';
import { SqliteMessageRepository } from './message.repository';
import { MESSAGE_COLUMNS, MESSAGE_LAST_PER_CONTACT } from './sqlite-mapping';

const T0 = '2026-01-01T10:00:00.000Z';
const T1 = '2026-01-01T11:00:00.000Z';

/**
 * Gegenprobe zum Produktivcode.
 *
 * Der Test lässt den echten `SqliteMessageRepository` gegen das Statement laufen,
 * das vor der Korrekturrunde im Einsatz war (unqualifizierte Spaltennamen).
 * Schlägt der Produktivcode damit fehl, sind die Tests in `sqlite-mapping.spec.ts`
 * aussagekräftig: mit dem alten Statement wären sie rot.
 */
const MESSAGE_LAST_PER_CONTACT_UNQUALIFIED = `SELECT ${MESSAGE_COLUMNS} FROM messages
  INNER JOIN (
    SELECT contact_id, MAX(sent_at) AS max_sent FROM messages GROUP BY contact_id
  ) latest ON latest.contact_id = messages.contact_id AND latest.max_sent = messages.sent_at
  ORDER BY messages.sent_at ASC`;

/** Ein Kontakt für die Testdaten. */
function contact(id: string): Contact {
  return {
    id,
    sendingKey: 'a'.repeat(32),
    receivingKey: 'b'.repeat(32),
    displayName: 'Anna',
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
function message(id: string, sentAt: string): Message {
  return {
    id,
    contactId: 'c1',
    wireId: id.padEnd(8, '0'),
    content: 'Hallo',
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

describe('Gegenprobe: Produktivcode mit dem Statement vor der Korrekturrunde', () => {
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

  it('bricht lastPerContact() auf einer leeren Datenbank mit „ambiguous column name“ ab', async () => {
    adapter.replaceStatement = (statement) =>
      statement === MESSAGE_LAST_PER_CONTACT ? MESSAGE_LAST_PER_CONTACT_UNQUALIFIED : statement;
    const messages = TestBed.inject(SqliteMessageRepository);

    await expect(messages.lastPerContact()).rejects.toThrow(/ambiguous column name/i);
  });

  it('bricht lastPerContact() mit Daten mit „ambiguous column name“ ab', async () => {
    const contacts = TestBed.inject(SqliteContactRepository);
    const messages = TestBed.inject(SqliteMessageRepository);
    await contacts.insert(contact('c1'));
    await messages.insert(message('m1', T0));
    await messages.insert(message('m2', T1));
    adapter.replaceStatement = (statement) =>
      statement === MESSAGE_LAST_PER_CONTACT ? MESSAGE_LAST_PER_CONTACT_UNQUALIFIED : statement;

    await expect(messages.lastPerContact()).rejects.toThrow(/ambiguous column name/i);
  });

  it('läuft mit dem Statement aus dem Produktivcode ohne Fehler durch', async () => {
    const messages = TestBed.inject(SqliteMessageRepository);

    await expect(messages.lastPerContact()).resolves.toEqual(new Map());
  });
});
