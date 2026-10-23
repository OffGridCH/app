import { TestBed } from '@angular/core/testing';

import { MemorySettingsRepository } from '../data/memory/memory-settings.repository';
import { SettingsRepository } from '../data/settings.repository';
import { SettingsService } from './settings.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('SettingsService', () => {
  let service: SettingsService;
  let repository: MemorySettingsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SettingsRepository, useExisting: MemorySettingsRepository }],
    });
    service = TestBed.inject(SettingsService);
    repository = TestBed.inject(MemorySettingsRepository);
  });

  it('erzeugt beim ersten Start eine Install-Id', async () => {
    await service.load();

    expect(service.installId()).toMatch(UUID);
    expect(await repository.get('install_id')).toBe(service.installId());
  });

  it('behält die Install-Id beim weiteren Laden', async () => {
    await service.load();
    const first = service.installId();

    await service.load();

    expect(service.installId()).toBe(first);
  });

  it('übernimmt eine vorhandene Install-Id', async () => {
    await repository.set('install_id', 'demo-install-id');

    await service.load();

    expect(service.installId()).toBe('demo-install-id');
  });

  it('startet mit den Standardwerten', async () => {
    await service.load();

    expect(service.displayName()).toBe('');
    expect(service.onboardingDone()).toBe(false);
    expect(service.bgReceive()).toBe(true);
    expect(service.vibrate()).toBe(false);
  });

  it('übernimmt die gespeicherten Werte', async () => {
    await repository.set('display_name', 'HolyG');
    await repository.set('onboarding_done', '1');
    await repository.set('bg_receive', '0');
    await repository.set('vibrate', '1');

    await service.load();

    expect(service.displayName()).toBe('HolyG');
    expect(service.onboardingDone()).toBe(true);
    expect(service.bgReceive()).toBe(false);
    expect(service.vibrate()).toBe(true);
  });

  it('speichert Anzeigename, Hintergrundempfang und Vibration', async () => {
    await service.load();

    await service.setDisplayName('HolyG');
    await service.setBgReceive(false);
    await service.setVibrate(true);

    expect(service.displayName()).toBe('HolyG');
    expect(service.bgReceive()).toBe(false);
    expect(service.vibrate()).toBe(true);
    expect(await repository.get('display_name')).toBe('HolyG');
    expect(await repository.get('bg_receive')).toBe('0');
    expect(await repository.get('vibrate')).toBe('1');
  });

  it('schliesst das Onboarding ab', async () => {
    await service.load();

    await service.completeOnboarding();

    expect(service.onboardingDone()).toBe(true);
    expect(await repository.get('onboarding_done')).toBe('1');
  });
});
