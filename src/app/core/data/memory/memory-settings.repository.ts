import { Injectable } from '@angular/core';

import { SettingsRepository } from '../settings.repository';

/** Einstellungen im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemorySettingsRepository extends SettingsRepository {
  private readonly rows = new Map<string, string>();

  /** Leert alle Einstellungen. */
  clear(): void {
    this.rows.clear();
  }

  /** Fügt mehrere Einstellungen ein. */
  insertMany(rows: Record<string, string>): void {
    for (const [key, value] of Object.entries(rows)) {
      this.rows.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.rows.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.rows.set(key, value);
  }

  async all(): Promise<Record<string, string>> {
    return Object.fromEntries(this.rows);
  }
}
