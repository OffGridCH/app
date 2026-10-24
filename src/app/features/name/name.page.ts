import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter } from '@ionic/angular';

import { AntennaPort } from '../../core/antenna/antenna-port';
import { log } from '../../core/log';
import { isValidDisplayName } from '../../core/messaging/limits';
import type { FormErrorCode } from '../../core/models/errors';
import { SettingsService } from '../../core/settings/settings.service';
import { OgButtonComponent, OgCardComponent, OgNoteComponent, OgTextFieldComponent } from '../../ui';

/** Fehler der Seite „Name“ (Skill `offgrid-screens` §0). */
type NameErrorCode = 'unlock-failed' | 'rate-limited' | 'keystore-failed' | 'lost' | 'antenna-not-ready';

/** Die Fehlertexte der Seite (Skill `offgrid-screens` §0). */
const NAME_ERROR_TEXTS: Record<NameErrorCode, string> = {
  'unlock-failed': 'Die Antenne lässt sich mit diesem Handy nicht entsperren.',
  'rate-limited': 'Zu viele Versuche. Warte kurz und versuch es erneut.',
  'keystore-failed': 'Der Schlüsselspeicher des Handys ist nicht verfügbar.',
  lost: 'Verbindung zur Antenne verloren.',
  'antenna-not-ready': 'Antenne nicht bereit. Verbinde sie zuerst.',
};

/** Die Formularfehlertexte (Skill `offgrid-screens` §0). */
const FORM_ERROR_TEXTS: Record<FormErrorCode, string> = {
  'name-invalid': 'Der Name muss 1 bis 24 Bytes lang sein (Umlaute zählen doppelt).',
  'password-too-short': 'Mindestens 8 Zeichen.',
  'password-mismatch': 'Die Passwörter stimmen nicht überein.',
};

/**
 * Screen „Name“: Onboarding Schritt 2 (Skill `offgrid-screens` §2).
 *
 * Der Name geht an die Antenne: ein frisches Gerät wird dabei eingerichtet (`sec.provision`), ein
 * eingerichtetes bekommt den neuen Namen (`id.set_name`). Danach wird der Name gespeichert, das
 * Onboarding abgeschlossen und zu den Kontakten gewechselt.
 */
@Component({
  selector: 'app-name',
  template: `
    <ion-content>
      <div class="name">
        <div class="name__text">
          <p class="name__step">SCHRITT 2 VON 2</p>
          <h1 class="name__title">Wie heisst du?</h1>
          <p class="name__lead">Dieser Name wird beim Hinzufügen an deine Kontakte übertragen.</p>
        </div>

        <og-card [padded]="true">
          <og-text-field
            id="dn"
            label="Anzeigename"
            [(value)]="name"
            [error]="nameError()"
            (blurred)="onBlurred()"
          />
        </og-card>

        @if (errorText(); as error) {
          <og-note [text]="error" />
        }
      </div>
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="name__footer">
        <og-button variant="primary" [disabled]="!canSave()" (pressed)="onSave()">Los gehts</og-button>
      </div>
    </ion-footer>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    .name {
      display: flex;
      flex-direction: column;
      padding-top: 56px;
    }

    .name__text {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 var(--og-gutter-text);
    }

    .name__step {
      @include og-type-section;
      margin: 0;
      color: var(--og-accent);
    }

    .name__title {
      @include og-type-display;
      margin: 0;
    }

    .name__lead {
      @include og-type-body-2;
      margin: 0;
    }

    og-card {
      margin-top: 24px;
    }

    .name__footer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 var(--og-gutter) calc(26px + env(safe-area-inset-bottom)) var(--og-gutter);
    }
  `,
  imports: [IonContent, IonFooter, OgButtonComponent, OgCardComponent, OgNoteComponent, OgTextFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class NamePage {
  private readonly antenna = inject(AntennaPort);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  /** Der eingegebene Anzeigename. */
  protected readonly name = signal('');

  /** Das Feld wurde verlassen: der Fehler darf jetzt erscheinen. */
  private readonly touched = signal(false);

  /** Der Name wird gerade gespeichert. */
  private readonly saving = signal(false);

  /** Der Fehler der Seite (als `og-note`). */
  private readonly errorCode = signal<NameErrorCode | null>(null);

  /** „Los gehts“ ist aktiv, wenn der Name gültig ist und nichts gespeichert wird. */
  protected readonly canSave = computed(() => !this.saving() && isValidDisplayName(this.name()));

  /** Der Fehlercode des Anzeigenamens (null, solange kein Feldfehler angezeigt wird). */
  private readonly nameErrorCode = computed<FormErrorCode | null>(() =>
    this.touched() && !isValidDisplayName(this.name()) ? 'name-invalid' : null,
  );

  /** Der Fehlertext unter dem Feld (nur, wenn das Feld schon verlassen wurde). */
  protected readonly nameError = computed<string | null>(() => {
    const code = this.nameErrorCode();
    return code === null ? null : FORM_ERROR_TEXTS[code];
  });

  /** Der Text des Seitenfehlers. */
  protected readonly errorText = computed<string | null>(() => {
    const code = this.errorCode();
    return code === null ? null : NAME_ERROR_TEXTS[code];
  });

  protected onBlurred(): void {
    this.touched.set(true);
  }

  /** „Los gehts“: den Namen an die Antenne geben, speichern und zu den Kontakten wechseln. */
  protected async onSave(): Promise<void> {
    const name = this.name().trim();
    if (!isValidDisplayName(name)) {
      this.touched.set(true);
      return;
    }

    this.saving.set(true);
    this.errorCode.set(null);
    try {
      const state = this.antenna.state();
      if (state === 'unprovisioned') {
        // Ein frisches Gerät bekommt beim Einrichten seine Identität und den Namen.
        const ready = await this.antenna.provision(name);
        if (!ready) {
          this.errorCode.set(this.pageError());
          return;
        }
      } else if (state === 'unlocked') {
        await this.antenna.request('id.set_name', { name });
      } else {
        this.errorCode.set(this.pageError());
        return;
      }

      await this.settings.setDisplayName(name);
      await this.settings.completeOnboarding();
      await this.router.navigateByUrl('/kontakte', { replaceUrl: true });
    } catch (error) {
      log.error('Der Name konnte nicht gespeichert werden', error);
      this.errorCode.set(this.pageError());
    } finally {
      this.saving.set(false);
    }
  }

  /** Der Fehler der Antenne als Fehler der Seite (Skill `offgrid-screens` §0). */
  private pageError(): NameErrorCode {
    const error = this.antenna.error();
    if (error === 'rate-limited' || error === 'keystore-failed' || error === 'lost') {
      return error;
    }
    return error === null ? 'antenna-not-ready' : 'unlock-failed';
  }
}
