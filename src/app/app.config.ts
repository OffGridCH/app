import { ApplicationConfig, Provider } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { ContactRepository, SqliteContactRepository } from './core/data/contact.repository';
import { CoordinateRepository, SqliteCoordinateRepository } from './core/data/coordinate.repository';
import { DatabaseService, SqliteDatabaseService } from './core/data/database.service';
import { HandshakeRepository, SqliteHandshakeRepository } from './core/data/handshake.repository';
import { MemoryContactRepository } from './core/data/memory/memory-contact.repository';
import { MemoryCoordinateRepository } from './core/data/memory/memory-coordinate.repository';
import { MemoryDatabaseService } from './core/data/memory/memory-database.service';
import { MemoryHandshakeRepository } from './core/data/memory/memory-handshake.repository';
import { MemoryMessageRepository } from './core/data/memory/memory-message.repository';
import { MemorySettingsRepository } from './core/data/memory/memory-settings.repository';
import { MessageRepository, SqliteMessageRepository } from './core/data/message.repository';
import { SettingsRepository, SqliteSettingsRepository } from './core/data/settings.repository';
import { isNative } from './core/platform';

/**
 * Plattform-Weiche für Datenbank und Repositories.
 *
 * Nativ SQLite, im Browser der Arbeitsspeicher. `useExisting` sorgt dafür,
 * dass die App und die Repositories dieselben Instanzen benutzen.
 */
export const dataProviders: Provider[] = [
  { provide: DatabaseService, useExisting: isNative() ? SqliteDatabaseService : MemoryDatabaseService },
  { provide: ContactRepository, useExisting: isNative() ? SqliteContactRepository : MemoryContactRepository },
  { provide: MessageRepository, useExisting: isNative() ? SqliteMessageRepository : MemoryMessageRepository },
  { provide: CoordinateRepository, useExisting: isNative() ? SqliteCoordinateRepository : MemoryCoordinateRepository },
  { provide: HandshakeRepository, useExisting: isNative() ? SqliteHandshakeRepository : MemoryHandshakeRepository },
  { provide: SettingsRepository, useExisting: isNative() ? SqliteSettingsRepository : MemorySettingsRepository },
];

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes, withComponentInputBinding()),
    ...dataProviders,
  ],
};
