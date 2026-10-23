import { Injectable, inject } from '@angular/core';

import type { Contact } from '../../models/contact';
import { ContactRepository } from '../contact.repository';
import { nowIso } from '../sqlite-mapping';
import { MemoryCoordinateRepository } from './memory-coordinate.repository';
import { MemoryMessageRepository } from './memory-message.repository';

/** Kontakte im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemoryContactRepository extends ContactRepository {
  private readonly rows = new Map<string, Contact>();
  private readonly messages = inject(MemoryMessageRepository);
  private readonly coordinates = inject(MemoryCoordinateRepository);

  /** Leert alle Kontakte. */
  clear(): void {
    this.rows.clear();
  }

  /** Fügt mehrere Kontakte ein. */
  insertMany(rows: Contact[]): void {
    for (const row of rows) {
      this.rows.set(row.id, row);
    }
  }

  async all(): Promise<Contact[]> {
    return [...this.rows.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async byId(id: string): Promise<Contact | null> {
    return this.rows.get(id) ?? null;
  }

  async byReceivingKeyTag(tag: string, tagOf: (key: string) => Promise<string>): Promise<Contact | null> {
    const contacts = await this.all();
    for (const contact of contacts) {
      if ((await tagOf(contact.receivingKey)) === tag) {
        return contact;
      }
    }
    return null;
  }

  async insert(contact: Contact): Promise<void> {
    this.rows.set(contact.id, contact);
  }

  async updateNames(id: string, displayName: string, firstName: string | null, lastName: string | null): Promise<void> {
    const contact = this.rows.get(id);
    if (!contact) {
      return;
    }
    this.rows.set(id, {
      ...contact,
      displayName,
      firstName,
      lastName,
      updatedAt: nowIso(),
    });
  }

  async updateSignal(id: string, rssi: number, seenAt: string): Promise<void> {
    const contact = this.rows.get(id);
    if (!contact) {
      return;
    }
    this.rows.set(id, {
      ...contact,
      lastRssi: rssi,
      lastSeenAt: seenAt,
      updatedAt: nowIso(),
    });
  }

  async delete(id: string): Promise<void> {
    // Wie SQLite mit `ON DELETE CASCADE` fallen die Nachrichten und Koordinaten des Kontakts weg.
    const messageIds = this.messages.deleteByContact(id);
    this.coordinates.deleteByContact(id);
    this.coordinates.deleteByMessages(messageIds);
    this.rows.delete(id);
  }

  async count(): Promise<number> {
    return this.rows.size;
  }
}
