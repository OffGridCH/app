import { Injectable, inject } from '@angular/core';

import { MessageStatus, type Message } from '../models/message';
import { SqliteDatabaseService } from './database.service';
import {
  MESSAGE_COLUMNS,
  MESSAGE_INSERT,
  MESSAGE_LAST_PER_CONTACT,
  MESSAGE_MARK_READ,
  MESSAGE_UPDATE_STATUS,
  countOf,
  messageValues,
  nowIso,
  toMessage,
} from './sqlite-mapping';

/**
 * Nachrichten lesen und schreiben.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class MessageRepository {
  /** Alle Nachrichten eines Kontakts, älteste zuerst. */
  abstract forContact(contactId: string): Promise<Message[]>;

  /** Die letzte Nachricht je Kontakt. */
  abstract lastPerContact(): Promise<Map<string, Message>>;

  /** Anzahl ungelesener eingehender Nachrichten je Kontakt. */
  abstract unreadPerContact(): Promise<Map<string, number>>;

  /** Nachrichten in der Warteschlange, älteste zuerst. */
  abstract queued(): Promise<Message[]>;

  /** Eine Nachricht nach Kontakt und Funk-Id oder `null`. */
  abstract byWireId(contactId: string, wireId: string): Promise<Message | null>;

  /** Neue Nachricht. */
  abstract insert(message: Message): Promise<void>;

  /** Zustand einer Nachricht ändern (wartet, gesendet, zugestellt, fehlgeschlagen). */
  abstract setStatus(id: string, status: MessageStatus): Promise<void>;

  /** Eingehende Nachrichten eines Kontakts als gelesen markieren. */
  abstract markRead(contactId: string, at: string): Promise<void>;

  /** Anzahl der Nachrichten. */
  abstract count(): Promise<number>;
}

/** Nachrichten in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteMessageRepository extends MessageRepository {
  private readonly db = inject(SqliteDatabaseService);

  async forContact(contactId: string): Promise<Message[]> {
    const rows = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE contact_id = ? ORDER BY sent_at ASC`,
      [contactId],
    );
    return rows.map(toMessage);
  }

  async lastPerContact(): Promise<Map<string, Message>> {
    const rows = await this.db.query(MESSAGE_LAST_PER_CONTACT);
    const last = new Map<string, Message>();
    for (const row of rows) {
      const message = toMessage(row);
      last.set(message.contactId, message);
    }
    return last;
  }

  async unreadPerContact(): Promise<Map<string, number>> {
    const rows = await this.db.query(
      "SELECT contact_id, COUNT(*) AS total FROM messages WHERE direction = 'in' AND read_at IS NULL GROUP BY contact_id",
    );
    const unread = new Map<string, number>();
    for (const row of rows) {
      const contactId = row['contact_id'];
      const total = row['total'];
      if (typeof contactId === 'string') {
        unread.set(contactId, typeof total === 'number' ? total : Number(total ?? 0));
      }
    }
    return unread;
  }

  async queued(): Promise<Message[]> {
    const rows = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE status = ? AND direction = 'out' ORDER BY sent_at ASC`,
      [MessageStatus.Queued],
    );
    return rows.map(toMessage);
  }

  async byWireId(contactId: string, wireId: string): Promise<Message | null> {
    const rows = await this.db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE contact_id = ? AND wire_id = ?`, [
      contactId,
      wireId,
    ]);
    return rows.length > 0 ? toMessage(rows[0]) : null;
  }

  async insert(message: Message): Promise<void> {
    await this.db.run(MESSAGE_INSERT, messageValues(message));
  }

  async setStatus(id: string, status: MessageStatus): Promise<void> {
    await this.db.run(MESSAGE_UPDATE_STATUS, [status, nowIso(), id]);
  }

  async markRead(contactId: string, at: string): Promise<void> {
    await this.db.run(MESSAGE_MARK_READ, [at, nowIso(), contactId]);
  }

  async count(): Promise<number> {
    const rows = await this.db.query('SELECT COUNT(*) AS total FROM messages');
    return countOf(rows);
  }
}
