import { Injectable, inject } from '@angular/core';

import type { Contact, ContactState } from '../models/contact';
import { SqliteDatabaseService } from './database.service';
import {
  CONTACT_COLUMNS,
  CONTACT_DELETE,
  CONTACT_UPDATE_LINK,
  CONTACT_UPDATE_NAME,
  CONTACT_UPDATE_STATE,
  CONTACT_UPSERT,
  contactValues,
  countOf,
  toContact,
} from './sqlite-mapping';

/**
 * Kontakte lesen und schreiben.
 *
 * Die Kontakte gehören dem Gerät; die App spiegelt sie (`contact.list`/`contact.get`),
 * damit Verlauf und Anzeige auch ohne Gerät da sind.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class ContactRepository {
  /** Alle Kontakte nach Platz (`contact_id`). */
  abstract all(): Promise<Contact[]>;

  /** Ein Kontakt nach Platz oder `null`. */
  abstract byId(contactId: number): Promise<Contact | null>;

  /** Kontakt einfügen oder aktualisieren. Der Verlauf des Kontakts bleibt dabei erhalten. */
  abstract upsert(contact: Contact): Promise<void>;

  /** Namen ändern. */
  abstract updateName(contactId: number, name: string): Promise<void>;

  /** Signalwerte des letzten empfangenen Pakets. */
  abstract updateLink(contactId: number, rssi: number | null, snr: number | null): Promise<void>;

  /** Zustand ändern (`pending` → `active`). */
  abstract setState(contactId: number, state: ContactState): Promise<void>;

  /** Kontakt löschen (Nachrichten und Koordinaten mit ihm fallen weg). */
  abstract delete(contactId: number): Promise<void>;

  /** Anzahl der Kontakte. */
  abstract count(): Promise<number>;
}

/** Kontakte in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteContactRepository extends ContactRepository {
  private readonly db = inject(SqliteDatabaseService);

  async all(): Promise<Contact[]> {
    const rows = await this.db.query(`SELECT ${CONTACT_COLUMNS} FROM contacts ORDER BY contact_id ASC`);
    return rows.map(toContact);
  }

  async byId(contactId: number): Promise<Contact | null> {
    const rows = await this.db.query(`SELECT ${CONTACT_COLUMNS} FROM contacts WHERE contact_id = ?`, [contactId]);
    return rows.length > 0 ? toContact(rows[0]) : null;
  }

  async upsert(contact: Contact): Promise<void> {
    await this.db.run(CONTACT_UPSERT, contactValues(contact));
  }

  async updateName(contactId: number, name: string): Promise<void> {
    await this.db.run(CONTACT_UPDATE_NAME, [name, contactId]);
  }

  async updateLink(contactId: number, rssi: number | null, snr: number | null): Promise<void> {
    await this.db.run(CONTACT_UPDATE_LINK, [rssi, snr, contactId]);
  }

  async setState(contactId: number, state: ContactState): Promise<void> {
    await this.db.run(CONTACT_UPDATE_STATE, [state, contactId]);
  }

  async delete(contactId: number): Promise<void> {
    await this.db.run(CONTACT_DELETE, [contactId]);
  }

  async count(): Promise<number> {
    const rows = await this.db.query('SELECT COUNT(*) AS total FROM contacts');
    return countOf(rows);
  }
}
