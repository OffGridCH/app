import { Injectable, inject } from '@angular/core';

import type { Contact } from '../models/contact';
import { SqliteDatabaseService } from './database.service';
import {
  CONTACT_COLUMNS,
  CONTACT_DELETE,
  CONTACT_INSERT,
  CONTACT_UPDATE_NAMES,
  CONTACT_UPDATE_SIGNAL,
  contactValues,
  countOf,
  nowIso,
  toContact,
} from './sqlite-mapping';

/**
 * Kontakte lesen und schreiben.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class ContactRepository {
  /** Alle Kontakte, älteste zuerst. */
  abstract all(): Promise<Contact[]>;

  /** Ein Kontakt nach Id oder `null`. */
  abstract byId(id: string): Promise<Contact | null>;

  /** Ein Kontakt, dessen Empfangsschlüssel zum angegebenen Tag passt. */
  abstract byReceivingKeyTag(tag: string, tagOf: (key: string) => Promise<string>): Promise<Contact | null>;

  /** Neuer Kontakt. */
  abstract insert(contact: Contact): Promise<void>;

  /** Anzeigename und Vor-/Nachname eines Kontakts ändern. */
  abstract updateNames(
    id: string,
    displayName: string,
    firstName: string | null,
    lastName: string | null,
  ): Promise<void>;

  /** Signalstärke und Zeitpunkt des letzten Empfangs aktualisieren. */
  abstract updateSignal(id: string, rssi: number, seenAt: string): Promise<void>;

  /** Kontakt löschen (Nachrichten und Koordinaten mit ihm fallen weg). */
  abstract delete(id: string): Promise<void>;

  /** Anzahl der Kontakte. */
  abstract count(): Promise<number>;
}

/** Kontakte in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteContactRepository extends ContactRepository {
  private readonly db = inject(SqliteDatabaseService);

  async all(): Promise<Contact[]> {
    const rows = await this.db.query(`SELECT ${CONTACT_COLUMNS} FROM contacts ORDER BY created_at ASC`);
    return rows.map(toContact);
  }

  async byId(id: string): Promise<Contact | null> {
    const rows = await this.db.query(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE id = ?`, [id]);
    return rows.length > 0 ? toContact(rows[0]) : null;
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
    await this.db.run(CONTACT_INSERT, contactValues(contact));
  }

  async updateNames(id: string, displayName: string, firstName: string | null, lastName: string | null): Promise<void> {
    await this.db.run(CONTACT_UPDATE_NAMES, [displayName, firstName, lastName, nowIso(), id]);
  }

  async updateSignal(id: string, rssi: number, seenAt: string): Promise<void> {
    await this.db.run(CONTACT_UPDATE_SIGNAL, [rssi, seenAt, nowIso(), id]);
  }

  async delete(id: string): Promise<void> {
    await this.db.run(CONTACT_DELETE, [id]);
  }

  async count(): Promise<number> {
    const rows = await this.db.query('SELECT COUNT(*) AS total FROM contacts');
    return countOf(rows);
  }
}
