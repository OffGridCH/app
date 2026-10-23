import { Injectable } from '@angular/core';

import { MessageStatus, type Message } from '../../models/message';
import { MessageRepository } from '../message.repository';
import { nowIso } from '../sqlite-mapping';

/** Nachrichten im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemoryMessageRepository extends MessageRepository {
  private readonly rows = new Map<string, Message>();

  /** Leert alle Nachrichten. */
  clear(): void {
    this.rows.clear();
  }

  /** Fügt mehrere Nachrichten ein. */
  insertMany(rows: Message[]): void {
    for (const row of rows) {
      this.rows.set(row.id, row);
    }
  }

  /**
   * Entfernt alle Nachrichten eines Kontakts und liefert ihre Ids.
   *
   * Entspricht dem `ON DELETE CASCADE` von SQLite (nur in Memory vorhanden).
   */
  deleteByContact(contactId: string): string[] {
    const removed: string[] = [];
    for (const [id, message] of this.rows) {
      if (message.contactId === contactId) {
        this.rows.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  async forContact(contactId: string): Promise<Message[]> {
    return [...this.rows.values()]
      .filter((message) => message.contactId === contactId)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async lastPerContact(): Promise<Map<string, Message>> {
    const last = new Map<string, Message>();
    for (const message of this.rows.values()) {
      const current = last.get(message.contactId);
      if (!current || message.sentAt >= current.sentAt) {
        last.set(message.contactId, message);
      }
    }
    return last;
  }

  async unreadPerContact(): Promise<Map<string, number>> {
    const unread = new Map<string, number>();
    for (const message of this.rows.values()) {
      if (message.direction === 'in' && message.readAt === null) {
        unread.set(message.contactId, (unread.get(message.contactId) ?? 0) + 1);
      }
    }
    return unread;
  }

  async queued(): Promise<Message[]> {
    return [...this.rows.values()]
      .filter((message) => message.status === MessageStatus.Queued && message.direction === 'out')
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async byWireId(contactId: string, wireId: string): Promise<Message | null> {
    for (const message of this.rows.values()) {
      if (message.contactId === contactId && message.wireId === wireId) {
        return message;
      }
    }
    return null;
  }

  async insert(message: Message): Promise<void> {
    this.rows.set(message.id, message);
  }

  async setStatus(id: string, status: MessageStatus): Promise<void> {
    const message = this.rows.get(id);
    if (!message) {
      return;
    }
    this.rows.set(id, { ...message, status, updatedAt: nowIso() });
  }

  async markRead(contactId: string, at: string): Promise<void> {
    for (const [id, message] of this.rows) {
      if (message.contactId === contactId && message.direction === 'in' && message.readAt === null) {
        this.rows.set(id, { ...message, readAt: at, updatedAt: nowIso() });
      }
    }
  }

  async count(): Promise<number> {
    return this.rows.size;
  }
}
