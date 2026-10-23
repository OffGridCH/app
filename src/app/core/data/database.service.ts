import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

import { log } from '../log';
import type { Contact, Coordinate } from '../models/contact';
import type { Message } from '../models/message';
import { MIGRATIONS } from './migrations';
import {
  CONTACT_INSERT,
  COORDINATE_INSERT,
  MESSAGE_INSERT,
  SETTING_UPSERT,
  contactValues,
  coordinateValues,
  messageValues,
  type SqlValue,
} from './sqlite-mapping';

/** Alle Nutzdaten der Datenbank (Import/Export). */
export interface DatabaseData {
  contacts: Contact[];
  messages: Message[];
  coordinates: Coordinate[];
  displayName: string;
}

/** Ein Schritt innerhalb einer Transaktion. */
interface SqlTask {
  statement: string;
  values?: SqlValue[];
}

const DATABASE_NAME = 'offgrid';
const DATABASE_VERSION = 1;

/**
 * Zugriff auf die Datenbank der App.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class DatabaseService {
  /** Öffnet die Datenbank und führt offene Migrationen aus. */
  abstract open(): Promise<void>;

  /** Ersetzt alle Nutzdaten (Import). Die Settings bleiben erhalten. */
  abstract replaceAll(data: DatabaseData): Promise<void>;

  /** Löscht Kontakte, Nachrichten und Koordinaten. Die Settings bleiben erhalten. */
  abstract deleteAllUserData(): Promise<void>;
}

/** Datenbank der App auf Basis von SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteDatabaseService extends DatabaseService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private opening: Promise<void> | null = null;

  async open(): Promise<void> {
    if (!this.opening) {
      this.opening = this.setup();
    }
    await this.opening;
  }

  /** Führt eine Abfrage aus und liefert die Zeilen als Objekte (Spaltenname -> Wert). */
  async query(statement: string, values: SqlValue[] = []): Promise<Record<string, unknown>[]> {
    const db = await this.connection();
    const result = await db.query(statement, values);
    return (result.values ?? []) as Record<string, unknown>[];
  }

  /** Führt ein Statement mit Parametern aus (Schreiben). */
  async run(statement: string, values: SqlValue[] = []): Promise<void> {
    const db = await this.connection();
    await db.run(statement, values, false);
  }

  async replaceAll(data: DatabaseData): Promise<void> {
    const db = await this.connection();
    const tasks: SqlTask[] = [
      { statement: 'DELETE FROM coordinates' },
      { statement: 'DELETE FROM messages' },
      { statement: 'DELETE FROM contacts' },
      ...data.contacts.map((contact) => ({ statement: CONTACT_INSERT, values: contactValues(contact) })),
      ...data.messages.map((message) => ({ statement: MESSAGE_INSERT, values: messageValues(message) })),
      ...data.coordinates.map((coordinate) => ({ statement: COORDINATE_INSERT, values: coordinateValues(coordinate) })),
      { statement: SETTING_UPSERT, values: ['display_name', data.displayName] },
    ];
    await db.executeTransaction(tasks);
  }

  async deleteAllUserData(): Promise<void> {
    const db = await this.connection();
    const tasks: SqlTask[] = [
      { statement: 'DELETE FROM coordinates' },
      { statement: 'DELETE FROM messages' },
      { statement: 'DELETE FROM contacts' },
    ];
    await db.executeTransaction(tasks);
  }

  private async setup(): Promise<void> {
    const existing = await this.sqlite.isConnection(DATABASE_NAME, false);
    const db =
      existing.result === true
        ? await this.sqlite.retrieveConnection(DATABASE_NAME, false)
        : await this.sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', DATABASE_VERSION, false);
    await db.open();
    this.db = db;
    // Fremdschlüssel ausserhalb einer Transaktion aktivieren.
    await db.execute('PRAGMA foreign_keys = ON;', false);
    await this.migrate(db);
  }

  private async connection(): Promise<SQLiteDBConnection> {
    await this.open();
    if (!this.db) {
      throw new Error('Datenbank nicht geöffnet');
    }
    return this.db;
  }

  /** Führt alle Migrationen aus, die neuer als die gespeicherte Version sind. */
  private async migrate(db: SQLiteDBConnection): Promise<void> {
    const current = await this.readUserVersion(db);
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) {
        continue;
      }
      const tasks: SqlTask[] = migration.statements.map((statement) => ({ statement }));
      await db.executeTransaction(tasks);
      await db.execute(userVersionStatement(migration.version), false);
      log.info(`Datenbank auf Version ${migration.version} aktualisiert`);
    }
  }

  /** Liest die gespeicherte Schema-Version aus `PRAGMA user_version`. */
  private async readUserVersion(db: SQLiteDBConnection): Promise<number> {
    const result = await db.query('PRAGMA user_version;');
    const rows = (result.values ?? []) as Record<string, unknown>[];
    const value = rows[0]?.['user_version'];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }
}

/**
 * `PRAGMA user_version` kann keine Parameter binden, darum wird die Version geprüft,
 * bevor sie in das Statement geschrieben wird.
 */
function userVersionStatement(version: number): string {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error(`Ungültige Datenbankversion ${version}`);
  }
  return `PRAGMA user_version = ${version};`;
}
