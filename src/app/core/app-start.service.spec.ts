import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { dataProviders } from '../app.config';
import { AntennaPort } from './antenna/antenna-port';
import { AppStartService } from './app-start.service';
import { DatabaseService } from './data/database.service';
import { MemoryContactRepository } from './data/memory/memory-contact.repository';
import { MemoryDatabaseService } from './data/memory/memory-database.service';
import { MemoryMessageRepository } from './data/memory/memory-message.repository';
import { MemorySettingsRepository } from './data/memory/memory-settings.repository';
import { SettingsRepository } from './data/settings.repository';
import { MockSerialTransport } from './antenna/mock-serial-transport';
import { SerialTransport } from './antenna/serial-transport';
import { BrowserKeystoreService } from './keystore/browser-keystore.service';
import { KeystoreService } from './keystore/keystore.service';
import { SettingsService } from './settings/settings.service';

describe('AppStartService', () => {
  let service: AppStartService;
  let database: MemoryDatabaseService;
  let settings: SettingsService;
  let contacts: MemoryContactRepository;
  let messages: MemoryMessageRepository;
  let memorySettings: MemorySettingsRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ...dataProviders,
        { provide: DatabaseService, useExisting: MemoryDatabaseService },
        { provide: SettingsRepository, useExisting: MemorySettingsRepository },
        { provide: SerialTransport, useExisting: MockSerialTransport },
        { provide: KeystoreService, useExisting: BrowserKeystoreService },
      ],
    });
    service = TestBed.inject(AppStartService);
    database = TestBed.inject(MemoryDatabaseService);
    settings = TestBed.inject(SettingsService);
    contacts = TestBed.inject(MemoryContactRepository);
    messages = TestBed.inject(MemoryMessageRepository);
    memorySettings = TestBed.inject(MemorySettingsRepository);
  });

  afterEach(async () => {
    await TestBed.inject(AntennaPort).disconnect();
    localStorage.clear();
  });

  it('verbindet die Antenne im Hintergrund, ohne darauf zu warten', async () => {
    const connect = vi.spyOn(TestBed.inject(AntennaPort), 'connect');

    await service.init();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(AntennaPort).connecting()).toBe(true);
  });

  it('entsperrt das simulierte Gerät und gleicht die Kontakte ab', async () => {
    await service.init();

    await vi.waitFor(() => expect(TestBed.inject(AntennaPort).state()).toBe('unlocked'), { timeout: 3000 });
    expect(TestBed.inject(AntennaPort).identity()?.name).toBe('HolyG');
    expect(await contacts.count()).toBe(4);
  });

  it('startet mit og.noseed = 1 ein frisches, noch nicht eingerichtetes Gerät', async () => {
    localStorage.setItem('og.noseed', '1');

    await service.init();

    await vi.waitFor(() => expect(TestBed.inject(AntennaPort).state()).toBe('unprovisioned'), { timeout: 3000 });
  });

  it('legt die Demo-Daten an und lädt danach die Einstellungen', async () => {
    const seed = vi.spyOn(database, 'seedDemo');
    const load = vi.spyOn(settings, 'load');

    await service.init();

    expect(seed).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(seed.mock.invocationCallOrder[0]).toBeLessThan(load.mock.invocationCallOrder[0]);
  });

  it('übernimmt die Einstellungen aus dem Seed', async () => {
    await service.init();

    expect(settings.displayName()).toBe('HolyG');
    expect(settings.installId()).toBe('demo-install-id');
    expect(settings.onboardingDone()).toBe(true);
    expect(await contacts.count()).toBe(4);
    expect(await messages.count()).toBe(6);
  });

  it('startet mit localStorage og.noseed = 1 mit einer leeren Datenbank', async () => {
    localStorage.setItem('og.noseed', '1');

    await service.init();

    expect(await contacts.count()).toBe(0);
    expect(await messages.count()).toBe(0);
    expect(settings.installId()).not.toBe('demo-install-id');
    expect(settings.installId()).not.toBe('');
    expect(await memorySettings.get('display_name')).toBeNull();
    expect(Object.keys(await memorySettings.all())).toEqual(['install_id']);
  });
});
