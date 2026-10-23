import { Injectable } from '@angular/core';

import { MessageStatus, type Direction, type Message } from '../../models/message';
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
  insertMany(rows: readonly Message[]): void {
    for (const row of rows) {
      this.rows.set(row.id, { ...row });
    }
  }

  /**
   * Entfernt alle Nachrichten eines Kontakts und liefert ihre Ids.
   *
   * Entspricht dem `ON DELETE CASCADE` von SQLite (nur in Memory vorhanden).
   */
  deleteByContact(contactId: number): string[] {
    const removed: string[] = [];
    for (const [id, message] of this.rows) {
      if (message.contactId === contactId) {
        this.rows.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  async byId(id: string): Promise<Message | null> {
    return this.rows.get(id) ?? null;
  }

  async forContact(contactId: number): Promise<Message[]> {
    return [...this.rows.values()]
      .filter((message) => message.contactId === contactId)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async lastPerContact(): Promise<Map<number, Message>> {
    const last = new Map<number, Message>();
    for (const message of this.rows.values()) {
      const current = last.get(message.contactId);
      if (!current || message.sentAt >= current.sentAt) {
        last.set(message.contactId, message);
      }
    }
    return last;
  }

  async unreadPerContact(): Promise<Map<number, number>> {
    const unread = new Map<number, number>();
    for (const message of this.rows.values()) {
      if (message.direction === 'in' && message.readAt === null) {
        unread.set(message.contactId, (unread.get(message.contactId) ?? 0) + 1);
      }
    }
    return unread;
  }

  async queued(): Promise<Message[]> {
    return [...this.rows.values()]
      .filter(
        (message) =>
          message.status === MessageStatus.Queued && message.direction === 'out' && message.msgRef === null,
      )
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  async byMsgRef(msgRef: number): Promise<Message | null> {
    const open = [...this.rows.values()]
      .filter(
        (message) =>
          message.msgRef === msgRef &&
          message.direction === 'out' &&
          (message.status === MessageStatus.Queued || message.status === MessageStatus.Sent),
      )
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return open[0] ?? null;
  }

  async byCtr(contactId: number, direction: Direction, ctr: number): Promise<Message | null> {
    for (const message of this.rows.values()) {
      if (message.contactId === contactId && message.direction === direction && message.ctr === ctr) {
        return message;
      }
    }
    return null;
  }

  async insert(message: Message): Promise<void> {
    this.rows.set(message.id, { ...message });
  }

  async setStatus(id: string, status: MessageStatus): Promise<void> {
    const message = this.rows.get(id);
    if (message) {
      this.rows.set(id, { ...message, status, updatedAt: nowIso() });
    }
  }

  async assignRef(id: string, ctr: number, msgRef: number, status: MessageStatus): Promise<void> {
    const message = this.rows.get(id);
    if (message) {
      this.rows.set(id, { ...message, ctr, msgRef, status, updatedAt: nowIso() });
    }
  }

  async requeue(id: string): Promise<void> {
    const message = this.rows.get(id);
    if (message) {
      this.rows.set(id, { ...message, ctr: null, msgRef: null, status: MessageStatus.Queued, updatedAt: nowIso() });
    }
  }

  async failPending(): Promise<number> {
    let failed = 0;
    for (const [id, message] of this.rows) {
      const open = message.status === MessageStatus.Queued || message.status === MessageStatus.Sent;
      if (message.direction === 'out' && message.msgRef !== null && open) {
        this.rows.set(id, { ...message, status: MessageStatus.Failed, updatedAt: nowIso() });
        failed += 1;
      }
    }
    return failed;
  }

  async markRead(contactId: number, at: string): Promise<void> {
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
