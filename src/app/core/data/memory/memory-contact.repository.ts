import { Injectable, inject } from '@angular/core';

import type { Contact, ContactState } from '../../models/contact';
import { ContactRepository } from '../contact.repository';
import { MemoryCoordinateRepository } from './memory-coordinate.repository';
import { MemoryMessageRepository } from './memory-message.repository';

/** Kontakte im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemoryContactRepository extends ContactRepository {
  private readonly rows = new Map<number, Contact>();
  private readonly messages = inject(MemoryMessageRepository);
  private readonly coordinates = inject(MemoryCoordinateRepository);

  /** Leert alle Kontakte. */
  clear(): void {
    this.rows.clear();
  }

  /** Fügt mehrere Kontakte ein. */
  insertMany(rows: readonly Contact[]): void {
    for (const row of rows) {
      this.rows.set(row.contactId, { ...row });
    }
  }

  async all(): Promise<Contact[]> {
    return [...this.rows.values()].sort((a, b) => a.contactId - b.contactId);
  }

  async byId(contactId: number): Promise<Contact | null> {
    return this.rows.get(contactId) ?? null;
  }

  async upsert(contact: Contact): Promise<void> {
    this.rows.set(contact.contactId, { ...contact });
  }

  async updateName(contactId: number, name: string): Promise<void> {
    this.update(contactId, { name });
  }

  async updateLink(contactId: number, rssi: number | null, snr: number | null): Promise<void> {
    this.update(contactId, { lastRssi: rssi, lastSnr: snr });
  }

  async setState(contactId: number, state: ContactState): Promise<void> {
    this.update(contactId, { state });
  }

  async delete(contactId: number): Promise<void> {
    // Wie SQLite mit `ON DELETE CASCADE` fallen die Nachrichten und Koordinaten des Kontakts weg.
    const messageIds = this.messages.deleteByContact(contactId);
    this.coordinates.deleteByContact(contactId);
    this.coordinates.deleteByMessages(messageIds);
    this.rows.delete(contactId);
  }

  async count(): Promise<number> {
    return this.rows.size;
  }

  private update(contactId: number, changes: Partial<Contact>): void {
    const contact = this.rows.get(contactId);
    if (contact) {
      this.rows.set(contactId, { ...contact, ...changes });
    }
  }
}
