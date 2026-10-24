import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  provideRouter,
  Router,
  type UrlTree,
} from '@angular/router';
import { vi } from 'vitest';

import { dataProviders } from '../app.config';
import { routes } from '../app.routes';
import { AppStartService } from './app-start.service';
import { onboardingGuard } from './onboarding.guard';
import { SettingsService } from './settings/settings.service';

describe('onboardingGuard', () => {
  let settings: SettingsService;
  let router: Router;
  let init: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    init = vi.fn(async () => {
      await TestBed.inject(SettingsService).load();
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...dataProviders,
        { provide: AppStartService, useValue: { init } },
      ],
    });
    settings = TestBed.inject(SettingsService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  /** Führt den Guard im Injection-Kontext aus. */
  async function runGuard(): Promise<boolean | UrlTree> {
    const result = await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return result as boolean | UrlTree;
  }

  it('lässt geschützte Routen zu, wenn das Onboarding abgeschlossen ist', async () => {
    await settings.completeOnboarding();

    expect(await runGuard()).toBe(true);
  });

  it('schickt ohne abgeschlossenes Onboarding auf /verbinden', async () => {
    const result = await runGuard();

    expect(router.serializeUrl(result as UrlTree)).toBe('/verbinden');
  });

  it('wartet auf den Start der App, solange die Einstellungen noch nicht geladen sind', async () => {
    expect(settings.installId()).toBe('');

    const result = await runGuard();

    expect(init).toHaveBeenCalledTimes(1);
    expect(settings.installId()).not.toBe('');
    expect(router.serializeUrl(result as UrlTree)).toBe('/verbinden');
  });

  it('startet die App nicht noch einmal, wenn die Einstellungen schon geladen sind', async () => {
    await settings.load();

    const result = await runGuard();

    expect(init).not.toHaveBeenCalled();
    expect(router.serializeUrl(result as UrlTree)).toBe('/verbinden');
  });

  it('schützt alle Routen ausser den beiden Onboarding-Schritten', () => {
    const onboarding = ['verbinden', 'name'];

    for (const route of routes) {
      if (route.path === '' || onboarding.includes(route.path ?? '')) {
        continue;
      }
      expect(route.canActivate ?? []).toContain(onboardingGuard);
    }
  });
});
