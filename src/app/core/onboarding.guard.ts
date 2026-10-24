import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { AppStartService } from './app-start.service';
import { SettingsService } from './settings/settings.service';

/**
 * Funktionaler Guard für die geschützten Routen (Skill `offgrid-architecture` §5).
 *
 * Ohne abgeschlossenes Onboarding führt jede geschützte Route auf `/verbinden`.
 *
 * Der Start der App läuft im Hintergrund: Datenbank, Demo-Daten und Einstellungen werden erst dort
 * geladen. Solange die Install-ID fehlt, sind die Einstellungen noch nicht geladen – der Guard wartet
 * dann auf den Start. Sonst hielte er ein fertiges Handy für ein Gerät ohne Onboarding und würde den
 * Benutzer im Kreis schicken.
 */
export const onboardingGuard: CanActivateFn = async () => {
  const appStart = inject(AppStartService);
  const settings = inject(SettingsService);
  const router = inject(Router);

  if (settings.installId() === '') {
    await appStart.init();
  }

  return settings.onboardingDone() ? true : router.createUrlTree(['/verbinden']);
};
