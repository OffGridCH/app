import { Injectable, inject } from '@angular/core';

import { MessageStatus, type Direction, type Message } from '../models/message';
import { SqliteDatabaseService } from './database.service';
import {
  MESSAGE_ASSIGN_REF,
  MESSAGE_COLUMNS,
  MESSAGE_FAIL_PENDING,
  MESSAGE_INSERT,
  MESSAGE_LAST_PER_CONTACT,
  MESSAGE_MARK_READ,
  MESSAGE_REQUEUE,
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
  /** Eine Nachricht nach Id oder `null`. */
  abstract byId(id: string): Promise<Message | null>;

  /** Alle Nachrichten eines Kontakts, älteste zuerst. */
  abstract forContact(contactId: number): Promise<Message[]>;

  /** Die letzte Nachricht je Kontakt. */
  abstract lastPerContact(): Promise<Map<number, Message>>;

  /** Anzahl ungelesener eingehender Nachrichten je Kontakt. */
  abstract unreadPerContact(): Promise<Map<number, number>>;

  /** Ausgehende Nachrichten, die noch nicht beim Gerät sind (`msg_ref` leer), älteste zuerst. */
  abstract queued(): Promise<Message[]>;

  /**
   * Die offene ausgehende Nachricht (wartet oder gesendet) mit diesem Handle des Geräts oder `null`.
   *
   * Das Handle gilt nur seit dem letzten Start des Geräts; fertige Nachrichten zählen nicht.
   */
  abstract byMsgRef(msgRef: number): Promise<Message | null>;

  /** Die Nachricht mit diesem Zähler in dieser Richtung oder `null`. */
  abstract byCtr(contactId: number, direction: Direction, ctr: number): Promise<Message | null>;

  /** Neue Nachricht. */
  abstract insert(message: Message): Promise<void>;

  /** Zustand einer Nachricht ändern (wartet, gesendet, zugestellt, fehlgeschlagen). */
  abstract setStatus(id: string, status: MessageStatus): Promise<void>;

  /** Zähler und Handle aus der Antwort des Geräts auf `msg.send` eintragen. */
  abstract assignRef(id: string, ctr: number, msgRef: number, status: MessageStatus): Promise<void>;

  /** Eine gescheiterte Nachricht wieder in die Warteschlange legen (ohne Zähler und Handle). */
  abstract requeue(id: string): Promise<void>;

  /** Alle Nachrichten, die beim Gerät in der Warteschlange waren, als gescheitert markieren. Liefert die Anzahl. */
  abstract failPending(): Promise<number>;

  /** Eingehende Nachrichten eines Kontakts als gelesen markieren. */
  abstract markRead(contactId: number, at: string): Promise<void>;

  /** Anzahl der Nachrichten. */
  abstract count(): Promise<number>;
}

/** Nachrichten in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteMessageRepository extends MessageRepository {
  private readonly db = inject(SqliteDatabaseService);

  async byId(id: string): Promise<Message | null> {
    const rows = await this.db.query(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`, [id]);
    return rows.length > 0 ? toMessage(rows[0]) : null;
  }

  async forContact(contactId: number): Promise<Message[]> {
    const rows = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE contact_id = ? ORDER BY sent_at ASC`,
      [contactId],
    );
    return rows.map(toMessage);
  }

  async lastPerContact(): Promise<Map<number, Message>> {
    const rows = await this.db.query(MESSAGE_LAST_PER_CONTACT);
    const last = new Map<number, Message>();
    for (const row of rows) {
      const message = toMessage(row);
      last.set(message.contactId, message);
    }
    return last;
  }

  async unreadPerContact(): Promise<Map<number, number>> {
    const rows = await this.db.query(
      "SELECT contact_id, COUNT(*) AS total FROM messages WHERE direction = 'in' AND read_at IS NULL GROUP BY contact_id",
    );
    const unread = new Map<number, number>();
    for (const row of rows) {
      const contactId = row['contact_id'];
      const total = row['total'];
      if (typeof contactId === 'number') {
        unread.set(contactId, typeof total === 'number' ? total : Number(total ?? 0));
      }
    }
    return unread;
  }

  async queued(): Promise<Message[]> {
    const rows = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages
       WHERE status = ? AND direction = 'out' AND msg_ref IS NULL ORDER BY sent_at ASC`,
      [MessageStatus.Queued],
    );
    return rows.map(toMessage);
  }

  async byMsgRef(msgRef: number): Promise<Message | null> {
    const rows = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages
       WHERE msg_ref = ? AND direction = 'out' AND status IN (?, ?) ORDER BY sent_at DESC LIMIT 1`,
      [msgRef, MessageStatus.Queued, MessageStatus.Sent],
    );
    return rows.length > 0 ? toMessage(rows[0]) : null;
  }

  async byCtr(contactId: number, direction: Direction, ctr: number): Promise<Message | null> {
    const rows = await this.db.query(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE contact_id = ? AND direction = ? AND ctr = ? LIMIT 1`,
      [contactId, direction, ctr],
    );
    return rows.length > 0 ? toMessage(rows[0]) : null;
  }

  async insert(message: Message): Promise<void> {
    await this.db.run(MESSAGE_INSERT, messageValues(message));
  }

  async setStatus(id: string, status: MessageStatus): Promise<void> {
    await this.db.run(MESSAGE_UPDATE_STATUS, [status, nowIso(), id]);
  }

  async assignRef(id: string, ctr: number, msgRef: number, status: MessageStatus): Promise<void> {
    await this.db.run(MESSAGE_ASSIGN_REF, [ctr, msgRef, status, nowIso(), id]);
  }

  async requeue(id: string): Promise<void> {
    await this.db.run(MESSAGE_REQUEUE, [MessageStatus.Queued, nowIso(), id]);
  }

  async failPending(): Promise<number> {
    const before = await this.db.query(
      "SELECT COUNT(*) AS total FROM messages WHERE direction = 'out' AND msg_ref IS NOT NULL AND status IN (?, ?)",
      [MessageStatus.Queued, MessageStatus.Sent],
    );
    await this.db.run(MESSAGE_FAIL_PENDING, [
      MessageStatus.Failed,
      nowIso(),
      MessageStatus.Queued,
      MessageStatus.Sent,
    ]);
    return countOf(before);
  }

  async markRead(contactId: number, at: string): Promise<void> {
    await this.db.run(MESSAGE_MARK_READ, [at, nowIso(), contactId]);
  }

  async count(): Promise<number> {
    const rows = await this.db.query('SELECT COUNT(*) AS total FROM messages');
    return countOf(rows);
  }
}
