import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonFooter } from '@ionic/angular';

import { AntennaPort } from '../../core/antenna/antenna-port';
import { formatMHz } from '../../core/format/radio';
import { formatListTime } from '../../core/format/time';
import { log } from '../../core/log';
import { MessagingService } from '../../core/messaging/messaging.service';
import { signalLabel } from '../../core/messaging/signal';
import type { AntennaState } from '../../core/models/antenna';
import type { ContactListItem } from '../../core/models/contact';
import type { JsonObject } from '../../core/models/device';
import type { Message } from '../../core/models/message';
import { SettingsService } from '../../core/settings/settings.service';
import {
  OgAvatarComponent,
  OgIconButtonComponent,
  OgLinkButtonComponent,
  OgStatusDotComponent,
  avatarPattern,
} from '../../ui';
import { KontaktZeileComponent, type KontaktZeile } from './kontakt-zeile.component';

/** Kleinste und grösste Frequenz, die das Gerät meldet (`radio.get`, Skill `offgrid-antenna-protocol` §5). */
const MIN_FREQ_MHZ = 150;
const MAX_FREQ_MHZ = 960;

/**
 * Die Frequenz aus der Antwort von `radio.get` in Hz.
 *
 * Der Vertrag nennt die Frequenz in MHz (`freq_mhz`); die Anzeige braucht Hz (`formatMHz`).
 *
 * @returns die Frequenz in Hz oder `null`, wenn die Antwort keine gültige Frequenz nennt.
 */
function freqHzOf(result: JsonObject): number | null {
  const mhz = result['freq_mhz'];
  if (typeof mhz !== 'number' || !Number.isFinite(mhz) || mhz < MIN_FREQ_MHZ || mhz > MAX_FREQ_MHZ) {
    return null;
  }
  return Math.round(mhz * 1e6);
}

/** Vorschau der letzten Nachricht (Skill `offgrid-screens` §3). */
function previewOf(message: Message | null): string {
  if (message === null) {
    return 'Noch keine Nachrichten';
  }
  if (message.kind === 'location') {
    return message.direction === 'out' ? 'Du: Standort' : 'Standort';
  }
  return message.direction === 'out' ? `Du: ${message.content}` : message.content;
}

/**
 * Screen „Kontakte“: die Liste der Kontakte mit letzter Nachricht, die Statuszeile der Antenne,
 * die ausstehenden Kontakte und der Leerzustand (Skill `offgrid-screens` §3).
 */
@Component({
  selector: 'app-kontakte',
  template: `
    <ion-content>
      <div class="kontakte">
        <header class="kontakte__header">
          <div class="kontakte__title">OffGrid</div>
          <div class="kontakte__actions">
            <og-icon-button icon="settings" label="Einstellungen" shape="round" routerLink="/einstellungen" />
            @if (!isEmpty()) {
              <og-icon-button icon="plus" label="Kontakt hinzufügen" shape="round" routerLink="/kontakte/neu" />
            }
          </div>
        </header>

        <a class="kontakte__status" routerLink="/verbinden">
          <og-status-dot [state]="antennaReady() ? 'ok' : 'danger'" />
          <span class="kontakte__status-text">{{ antennaReady() ? 'Antenne verbunden' : 'Antenne getrennt' }}</span>
          <span class="kontakte__meta">{{ statusMeta() }}</span>
        </a>
        <div class="kontakte__divider"></div>

        @if (isEmpty()) {
          <div class="kontakte__empty">
            <div class="kontakte__empty-art" aria-hidden="true">
              <og-avatar [pattern]="ownPattern()" [size]="56" />
              <span class="kontakte__dots"><span></span><span></span><span></span></span>
              <og-avatar variant="pending" [size]="56" />
            </div>
            <div class="kontakte__empty-text">
              <h1 class="kontakte__empty-title">Noch keine Kontakte</h1>
              <p class="kontakte__empty-lead">
                Triff dich mit jemandem, der OffGrid nutzt, und scannt gegenseitig eure Codes. Danach könnt ihr ohne Mobilnetz schreiben.
              </p>
            </div>
          </div>
        } @else {
          <nav class="kontakte__list" aria-label="Kontakte">
            @for (row of rows(); track row.contactId) {
              <app-kontakt-zeile [zeile]="row" />
            }
            @for (row of pendingRows(); track row.contactId) {
              <app-kontakt-zeile [zeile]="row" [pending]="true" />
            }
          </nav>
        }
      </div>
    </ion-content>

    <ion-footer class="ion-no-border">
      <div class="kontakte__footer">
        <og-link-button variant="primary" icon="qr" routerLink="/kontakte/neu">
          {{ isEmpty() ? 'Ersten Kontakt hinzufügen' : 'Kontakt hinzufügen' }}
        </og-link-button>
      </div>
    </ion-footer>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    .kontakte {
      display: flex;
      flex-direction: column;
      min-height: 100%;
    }

    .kontakte__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 22px var(--og-gutter-title) 6px;
    }

    .kontakte__title,
    .kontakte__empty-title,
    .kontakte__empty-lead {
      margin: 0;
    }

    .kontakte__title {
      @include og-type-app-title;
    }

    .kontakte__actions {
      display: flex;
      gap: 8px;
    }

    .kontakte__status {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: var(--og-touch);
      margin: 0 var(--og-gutter-title);
      color: var(--og-text-2);
      text-decoration: none;
    }

    .kontakte__status-text {
      @include og-type-note;
    }

    .kontakte__meta {
      @include og-type-meta;
    }

    .kontakte__divider {
      height: 1px;
      margin: 6px var(--og-gutter-title) 8px;
      background: var(--og-line);
    }

    .kontakte__list {
      display: flex;
      flex: 1;
      flex-direction: column;
      padding: 0 8px;
    }

    .kontakte__empty {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 22px;
      padding: 0 36px;
    }

    .kontakte__empty-art {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .kontakte__dots {
      display: flex;
      gap: 6px;
    }

    .kontakte__dots span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--og-border-muted);
    }

    .kontakte__empty-text {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-align: center;
    }

    .kontakte__empty-title {
      @include og-type-empty-title;
    }

    .kontakte__empty-lead {
      @include og-type-body-2;
    }

    .kontakte__footer {
      padding: 12px var(--og-gutter) calc(26px + env(safe-area-inset-bottom));
    }
  `,
  imports: [
    IonContent,
    IonFooter,
    RouterLink,
    OgAvatarComponent,
    OgIconButtonComponent,
    OgLinkButtonComponent,
    OgStatusDotComponent,
    KontaktZeileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class KontaktePage {
  private readonly messaging = inject(MessagingService);
  private readonly antenna = inject(AntennaPort);
  private readonly settings = inject(SettingsService);

  /** Muster der Kontakt-Avatare (aus dem Public Key des Kontakts). */
  private readonly contactPatterns = signal<ReadonlyMap<number, boolean[]>>(new Map());
  /** Eigenes Muster (aus der Install-ID). */
  private readonly ownPatternSignal = signal<boolean[]>([]);
  /** Die Frequenz der Antenne in Hz (aus `radio.get`), `null`, wenn das Gerät keine meldet. */
  private readonly frequency = signal<number | null>(null);
  /** Nummer des laufenden Frequenz-Abrufs: nur das neueste Ergebnis wird übernommen. */
  private frequencyToken = 0;

  /** Die Kontakte mit letzter Nachricht, Ungelesenen und Signal-Level. */
  protected readonly contacts = this.messaging.contacts;

  /** Die Zeilen der Kontaktliste (Kontakte mit Nachricht). */
  protected readonly rows = computed<KontaktZeile[]>(() => {
    const patterns = this.contactPatterns();
    return this.contacts()
      .filter((item) => item.contact.state !== 'pending')
      .map((item) => this.toRow(item, patterns.get(item.contact.contactId) ?? []));
  });

  /** Die ausstehenden Zeilen (Kontakte, deren Schlüssel noch aussteht). */
  protected readonly pendingRows = computed<KontaktZeile[]>(() =>
    this.contacts()
      .filter((item) => item.contact.state === 'pending')
      .map((item) => this.toRow(item, [])),
  );

  /** Leerzustand: keine Kontakte und keine ausstehenden. */
  protected readonly isEmpty = computed(() => this.contacts().length === 0);

  /** Die Antenne ist bereit: das Gerät ist entsperrt und arbeitet. */
  protected readonly antennaReady = computed(() => this.antenna.state() === 'unlocked');

  /** Der Meta-Text der Statuszeile (Skill `offgrid-screens` §0). */
  protected readonly statusMeta = computed(() => {
    if (!this.antennaReady()) {
      return '· Tippen zum Verbinden';
    }
    const freq = this.frequency();
    // Ohne Frequenz des Geräts bleibt der Meta-Text bei dem, was sicher ist: dem Anschluss.
    return freq === null ? '· USB-C' : `· USB-C · ${formatMHz(freq)} MHz`;
  });

  /** Das eigene Muster für den Leerzustand. */
  protected readonly ownPattern = this.ownPatternSignal.asReadonly();

  constructor() {
    // Die Muster der Avatare brauchen einen Hash: sie werden geladen, sobald die Kontakte stehen.
    effect(() => {
      const items = this.contacts();
      const installId = this.settings.installId();
      untracked(() => void this.loadPatterns(items, installId));
    });
    // Die Frequenz nennt nur das Gerät selbst (`radio.get`): sie wird bei jeder Verbindung neu gelesen.
    effect(() => {
      const state = this.antenna.state();
      untracked(() => void this.loadFrequency(state));
    });
  }

  /** Baut die Zeile eines Kontakts (Vorschau, Zeit, Ungelesene, Signal). */
  private toRow(item: ContactListItem, pattern: boolean[]): KontaktZeile {
    return {
      contactId: item.contact.contactId,
      name: item.contact.name,
      pattern,
      preview: previewOf(item.lastMessage),
      time: item.lastMessage === null ? '' : formatListTime(item.lastMessage.sentAt, new Date()),
      unread: this.messaging.unreadCount(item.contact.contactId)(),
      level: item.signalLevel,
      signal: signalLabel(item.signalLevel),
    };
  }

  /** Lädt die Muster der Avatare: je Kontakt aus dem Public Key, das eigene aus der Install-ID. */
  private async loadPatterns(items: ContactListItem[], installId: string): Promise<void> {
    const patterns = new Map(this.contactPatterns());
    let changed = false;
    for (const item of items) {
      const contactId = item.contact.contactId;
      if (!patterns.has(contactId)) {
        patterns.set(contactId, await avatarPattern(item.contact.publicKey));
        changed = true;
      }
    }
    if (installId !== '' && this.ownPatternSignal().length === 0) {
      this.ownPatternSignal.set(await avatarPattern(installId));
      changed = true;
    }
    if (changed) {
      this.contactPatterns.set(patterns);
    }
  }

  /**
   * Liest die Frequenz der Antenne beim Gerät (`radio.get`).
   *
   * Der Vertrag erlaubt `radio.get` in jedem Zustand; antwortet das Gerät nicht oder nennt es keine
   * Frequenz, bleibt die Frequenz unbekannt (die Statuszeile zeigt dann nur den Anschluss).
   */
  private async loadFrequency(state: AntennaState): Promise<void> {
    const token = ++this.frequencyToken;
    if (state === 'disconnected') {
      this.frequency.set(null);
      return;
    }
    try {
      const freq = freqHzOf(await this.antenna.request('radio.get'));
      if (token === this.frequencyToken) {
        this.frequency.set(freq);
      }
    } catch (error) {
      log.warn('Frequenz der Antenne ist unbekannt', error);
      if (token === this.frequencyToken) {
        this.frequency.set(null);
      }
    }
  }
}
