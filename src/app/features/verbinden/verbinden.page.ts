import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonFooter } from '@ionic/angular';

import { AntennaPort } from '../../core/antenna/antenna-port';
import type { AntennaErrorCode } from '../../core/models/antenna';
import { SettingsService } from '../../core/settings/settings.service';
import { OgButtonComponent, OgIconComponent, OgNoteComponent, OgStepListComponent, type OgStep } from '../../ui';

/** Fehlertexte der Antenne (Skill `offgrid-screens` §0). */
const ANTENNA_ERROR_TEXTS: Record<AntennaErrorCode, string> = {
  'no-device': 'Keine Antenne gefunden. Prüfe das USB-C-Kabel.',
  'permission-denied': 'Zugriff auf die Antenne wurde nicht erlaubt.',
  'open-failed': 'Die Antenne liess sich nicht öffnen. Steck sie neu ein.',
  'no-hello': 'Die Antenne antwortet nicht.',
  'proto-mismatch': 'Die Firmware der Antenne passt nicht zu dieser App-Version.',
  lost: 'Verbindung zur Antenne verloren.',
  'unlock-failed': 'Die Antenne lässt sich mit diesem Handy nicht entsperren.',
  'rate-limited': 'Zu viele Versuche. Warte kurz und versuch es erneut.',
  'keystore-failed': 'Der Schlüsselspeicher des Handys ist nicht verfügbar.',
};

/**
 * Screen „Verbinden“: Onboarding Schritt 1 und „Neu verbinden“ aus den Einstellungen
 * (Skill `offgrid-screens` §1).
 */
@Component({
  selector: 'app-verbinden',
  template: `
    <ion-content>
      <div class="verbinden">
        <div class="verbinden__hero" aria-hidden="true">
          <span class="verbinden__ring verbinden__ring--outer"></span>
          <span class="verbinden__ring verbinden__ring--middle"></span>
          <span class="verbinden__ring verbinden__ring--inner"></span>
          <span class="verbinden__tile">
            <og-icon name="antenna" [size]="40" />
          </span>
        </div>

        <div class="verbinden__text">
          @if (!onboardingDone()) {
            <p class="verbinden__step">SCHRITT 1 VON 2</p>
          }
          <h1 class="verbinden__title">Antenne anschliessen</h1>
          <p class="verbinden__lead">
            Verbinde die OffGrid-Antenne per USB-C mit deinem Handy. Danach schreibst du auch ohne Mobilnetz.
          </p>
        </div>

        <og-step-list [steps]="steps()" [compact]="true" activeStyle="spinner" />

        @if (errorText(); as error) {
          <og-note [text]="error" />
        }
      </div>
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="verbinden__footer">
        <og-button variant="primary" [disabled]="!canContinue()" (pressed)="onContinue()">Weiter</og-button>
        <og-button variant="secondary" [disabled]="connecting()" (pressed)="onSearchAgain()">Erneut suchen</og-button>
      </div>
    </ion-footer>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    .verbinden {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }

    .verbinden__hero {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 330px;
    }

    .verbinden__ring {
      position: absolute;
      border-radius: 50%;
    }

    .verbinden__ring--outer {
      width: 300px;
      height: 300px;
      border: 1px solid var(--og-line);
    }

    .verbinden__ring--middle {
      width: 220px;
      height: 220px;
      border: 1px solid var(--og-border-muted);
    }

    .verbinden__ring--inner {
      width: 140px;
      height: 140px;
      border: 1.5px solid var(--og-accent-soft);
    }

    .verbinden__tile {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 84px;
      height: 84px;
      border-radius: var(--og-r-qr);
      background: var(--og-accent);
      color: var(--og-on-accent);
    }

    .verbinden__text {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 var(--og-gutter-text);
    }

    .verbinden__step {
      @include og-type-section;
      margin: 0;
      color: var(--og-accent);
    }

    .verbinden__title {
      @include og-type-display;
      margin: 0;
    }

    .verbinden__lead {
      @include og-type-body-2;
      margin: 0;
    }

    .verbinden__footer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 0 var(--og-gutter) calc(26px + env(safe-area-inset-bottom)) var(--og-gutter);
    }
  `,
  imports: [IonContent, IonFooter, OgButtonComponent, OgIconComponent, OgNoteComponent, OgStepListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class VerbindenPage implements OnInit {
  private readonly antenna = inject(AntennaPort);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  /** `true`, wenn das Onboarding abgeschlossen ist. */
  protected readonly onboardingDone = this.settings.onboardingDone;

  /** `true`, solange die App die Antenne sucht oder verbindet. */
  protected readonly connecting = this.antenna.connecting;

  /** Die drei Schritte der Liste (Skill `offgrid-screens` §1). */
  protected readonly steps = computed<OgStep[]>(() => {
    const state = this.antenna.state();
    const device = this.antenna.device();
    const connecting = this.connecting();
    // Das Gerät hat geantwortet, sobald `sys.hello` die Gerätedaten geliefert hat.
    const answered = device !== null;
    const connected = state === 'unprovisioned' || state === 'locked' || state === 'unlocked';

    return [
      {
        label: 'USB-Gerät erkannt',
        state: answered ? 'done' : connecting ? 'active' : 'todo',
        meta: device?.device,
      },
      {
        label: 'Verbindung wird aufgebaut',
        state: connected ? 'done' : connecting ? 'active' : 'todo',
      },
      {
        label: 'Funkmodul bereit',
        state: state === 'unlocked' ? 'done' : 'todo',
        meta: state === 'unlocked' && device !== null ? `FW ${device.fwVersion}` : undefined,
      },
    ];
  });

  /** Der Text des Antennenfehlers, falls es einen gibt. */
  protected readonly errorText = computed<string | null>(() => {
    const error = this.antenna.error();
    return error === null ? null : ANTENNA_ERROR_TEXTS[error];
  });

  /** „Weiter“ ist aktiv, wenn die Antenne bereit ist – im Onboarding auch, wenn sie noch frisch ist. */
  protected readonly canContinue = computed(() => {
    const state = this.antenna.state();
    if (state === 'unlocked') {
      return true;
    }
    return state === 'unprovisioned' && !this.onboardingDone();
  });

  ngOnInit(): void {
    if (this.antenna.state() === 'disconnected') {
      void this.antenna.connect();
    }
  }

  /** „Weiter“: im Onboarding zur Namensseite, sonst zu den Einstellungen. */
  protected onContinue(): void {
    void this.router.navigateByUrl(this.onboardingDone() ? '/einstellungen' : '/name');
  }

  /** „Erneut suchen“: die Antenne noch einmal verbinden oder ein gesperrtes Gerät wieder entsperren. */
  protected onSearchAgain(): void {
    // Ein gesperrtes Gerät ist noch verbunden: `connect()` kehrt sofort zurück und es passiert nichts.
    // Deshalb im Zustand `locked` gezielt erneut entsperren.
    if (this.antenna.state() === 'locked') {
      void this.antenna.unlock();
      return;
    }
    void this.antenna.connect();
  }
}
