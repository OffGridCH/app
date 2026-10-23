import { Injectable, inject, signal } from '@angular/core';

import { SettingsRepository } from '../data/settings.repository';

/**
 * Einstellungen der App (Anzeigename, Install-ID, Schalter).
 *
 * Die Werte liegen in der Datenbank, die Signale sind der schnelle Lesezugriff.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly repository = inject(SettingsRepository);

  private readonly displayNameSignal = signal('');
  private readonly installIdSignal = signal('');
  private readonly bgReceiveSignal = signal(true);
  private readonly vibrateSignal = signal(false);
  private readonly onboardingDoneSignal = signal(false);

  /** Anzeigename (leer, solange das Onboarding Schritt 2 fehlt). */
  readonly displayName = this.displayNameSignal.asReadonly();

  /** Eigene Install-Id, beim ersten Start erzeugt. */
  readonly installId = this.installIdSignal.asReadonly();

  /** Nachrichten im Hintergrund empfangen. */
  readonly bgReceive = this.bgReceiveSignal.asReadonly();

  /** Vibration bei einer Nachricht. */
  readonly vibrate = this.vibrateSignal.asReadonly();

  /** Onboarding abgeschlossen. */
  readonly onboardingDone = this.onboardingDoneSignal.asReadonly();

  /** Lädt die Einstellungen aus der Datenbank und legt die Install-ID an, falls sie fehlt. */
  async load(): Promise<void> {
    const values = await this.repository.all();

    const installId = values['install_id'];
    if (installId) {
      this.installIdSignal.set(installId);
    } else {
      const created = crypto.randomUUID();
      await this.repository.set('install_id', created);
      this.installIdSignal.set(created);
    }

    this.displayNameSignal.set(values['display_name'] ?? '');
    this.onboardingDoneSignal.set(values['onboarding_done'] === '1');
    this.bgReceiveSignal.set((values['bg_receive'] ?? '1') === '1');
    this.vibrateSignal.set((values['vibrate'] ?? '0') === '1');
  }

  /** Anzeigename speichern. */
  async setDisplayName(value: string): Promise<void> {
    await this.repository.set('display_name', value);
    this.displayNameSignal.set(value);
  }

  /** Hintergrundempfang speichern. */
  async setBgReceive(value: boolean): Promise<void> {
    await this.repository.set('bg_receive', value ? '1' : '0');
    this.bgReceiveSignal.set(value);
  }

  /** Vibration speichern. */
  async setVibrate(value: boolean): Promise<void> {
    await this.repository.set('vibrate', value ? '1' : '0');
    this.vibrateSignal.set(value);
  }

  /** Onboarding als erledigt markieren. */
  async completeOnboarding(): Promise<void> {
    await this.repository.set('onboarding_done', '1');
    this.onboardingDoneSignal.set(true);
  }
}
