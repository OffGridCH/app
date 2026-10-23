import { ApplicationConfig, Provider } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { MockSerialTransport } from './core/antenna/mock-serial-transport';
import { SerialTransport } from './core/antenna/serial-transport';
import { UnavailableSerialTransport } from './core/antenna/unavailable-transport';
import { ContactRepository, SqliteContactRepository } from './core/data/contact.repository';
import { CoordinateRepository, SqliteCoordinateRepository } from './core/data/coordinate.repository';
import { DatabaseService, SqliteDatabaseService } from './core/data/database.service';
import { MemoryContactRepository } from './core/data/memory/memory-contact.repository';
import { MemoryCoordinateRepository } from './core/data/memory/memory-coordinate.repository';
import { MemoryDatabaseService } from './core/data/memory/memory-database.service';
import { MemoryMessageRepository } from './core/data/memory/memory-message.repository';
import { MemorySettingsRepository } from './core/data/memory/memory-settings.repository';
import { MessageRepository, SqliteMessageRepository } from './core/data/message.repository';
import { SettingsRepository, SqliteSettingsRepository } from './core/data/settings.repository';
import { AndroidKeystoreService } from './core/keystore/android-keystore.service';
import { BrowserKeystoreService } from './core/keystore/browser-keystore.service';
import { KeystoreService } from './core/keystore/keystore.service';
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
  { provide: SettingsRepository, useExisting: isNative() ? SqliteSettingsRepository : MemorySettingsRepository },
];

/**
 * Plattform-Weiche für die Antenne und das Entsperr-Geheimnis.
 *
 * Im Browser (und auf Android mit `localStorage og.mock = '1'`, zum Vorführen ohne Hardware) läuft das simulierte
 * Gerät mit einem Schlüssel im Arbeitsspeicher. Nativ spricht die App über das USB-Serial-Plugin (T06;
 * bis dahin ein Platzhalter) und holt das Token aus dem Android Keystore.
 */
function useMockAntenna(): boolean {
  return !isNative() || localStorage.getItem('og.mock') === '1';
}

export const antennaProviders: Provider[] = [
  { provide: SerialTransport, useExisting: useMockAntenna() ? MockSerialTransport : UnavailableSerialTransport },
  { provide: KeystoreService, useExisting: useMockAntenna() ? BrowserKeystoreService : AndroidKeystoreService },
];

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes, withComponentInputBinding()),
    ...dataProviders,
    ...antennaProviders,
  ],
};
