import { Injectable, inject } from '@angular/core';

import { DatabaseService, type DatabaseData } from '../database.service';
import { MemoryContactRepository } from './memory-contact.repository';
import { MemoryCoordinateRepository } from './memory-coordinate.repository';
import { MemoryMessageRepository } from './memory-message.repository';
import { MemorySettingsRepository } from './memory-settings.repository';
import { createDemoData } from './seed';

/** Datenbank im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemoryDatabaseService extends DatabaseService {
  private readonly contacts = inject(MemoryContactRepository);
  private readonly messages = inject(MemoryMessageRepository);
  private readonly coordinates = inject(MemoryCoordinateRepository);
  private readonly settings = inject(MemorySettingsRepository);

  async open(): Promise<void> {
    // Im Browser gibt es keine Datei, die geöffnet werden müsste.
  }

  async replaceAll(data: DatabaseData): Promise<void> {
    this.clearUserData();
    this.contacts.insertMany(data.contacts);
    this.messages.insertMany(data.messages);
    this.coordinates.insertMany(data.coordinates);
    await this.settings.set('display_name', data.displayName);
  }

  async deleteAllUserData(): Promise<void> {
    this.clearUserData();
  }

  /** Füllt die Datenbank mit den Demo-Daten (nur im Browser, nie in Tests). */
  async seedDemo(): Promise<void> {
    const demo = createDemoData();
    this.clearUserData();
    this.contacts.insertMany(demo.contacts);
    this.messages.insertMany(demo.messages);
    this.settings.insertMany(demo.settings);
  }

  private clearUserData(): void {
    this.contacts.clear();
    this.messages.clear();
    this.coordinates.clear();
  }
}
