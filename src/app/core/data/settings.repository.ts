import { Injectable, inject } from '@angular/core';

import { SqliteDatabaseService } from './database.service';
import { SETTING_UPSERT } from './sqlite-mapping';

/**
 * Einstellungen (Schlüssel/Wert) lesen und schreiben.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class SettingsRepository {
  /** Wert eines Schlüssels oder `null`. */
  abstract get(key: string): Promise<string | null>;

  /** Wert eines Schlüssels setzen. */
  abstract set(key: string, value: string): Promise<void>;

  /** Alle Einstellungen. */
  abstract all(): Promise<Record<string, string>>;
}

/** Einstellungen in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteSettingsRepository extends SettingsRepository {
  private readonly db = inject(SqliteDatabaseService);

  async get(key: string): Promise<string | null> {
    const rows = await this.db.query('SELECT value FROM settings WHERE key = ?', [key]);
    const value = rows[0]?.['value'];
    return typeof value === 'string' ? value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.run(SETTING_UPSERT, [key, value]);
  }

  async all(): Promise<Record<string, string>> {
    const rows = await this.db.query('SELECT key, value FROM settings');
    const settings: Record<string, string> = {};
    for (const row of rows) {
      const key = row['key'];
      const value = row['value'];
      if (typeof key === 'string' && typeof value === 'string') {
        settings[key] = value;
      }
    }
    return settings;
  }
}
