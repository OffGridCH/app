import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OgAvatarComponent, OgBadgeComponent, OgSignalBarsComponent, type OgSignalLevel } from '../../ui';

/**
 * Eine Zeile der Kontaktliste: Name, Vorschau, Zeit, Ungelesene und Signal
 * (Skill `offgrid-screens` §3).
 */
export interface KontaktZeile {
  /** Platz des Kontakts (für die Route zum Chat). */
  readonly contactId: number;
  /** Anzeigename des Kontakts. */
  readonly name: string;
  /** Muster des Avatars (25 Werte). */
  readonly pattern: boolean[];
  /** Vorschau der letzten Nachricht. */
  readonly preview: string;
  /** Zeit der letzten Nachricht (leer, wenn es keine gibt). */
  readonly time: string;
  /** Anzahl der ungelesenen Nachrichten. */
  readonly unread: number;
  /** Signal-Level des Kontakts. */
  readonly level: OgSignalLevel;
  /** Ansage der Signalbalken. */
  readonly signal: string;
}

/**
 * Eine Zeile der Kontaktliste: der Kontakt mit letzter Nachricht oder ein ausstehender Kontakt.
 *
 * Der ausstehende Kontakt ist nicht klickbar (ein `<div>`), sein Schlüssel fehlt noch.
 */
@Component({
  selector: 'app-kontakt-zeile',
  template: `
    <ng-template #inhalt>
      <og-avatar [size]="48" [variant]="pending() ? 'pending' : 'normal'" [pattern]="zeile().pattern" />
      <span class="zeile__text">
        <span class="zeile__top">
          <span class="zeile__name">{{ zeile().name }}</span>
          <og-signal-bars
            size="md"
            [level]="pending() ? 0 : zeile().level"
            [label]="pending() ? '' : zeile().signal"
          />
        </span>
        <span class="zeile__bottom">
          @if (pending()) {
            <span class="zeile__pending">Schlüssel ausstehend</span>
          } @else {
            <span class="zeile__preview" [class.zeile__preview--unread]="zeile().unread > 0">
              {{ zeile().preview }}
            </span>
            <span class="zeile__right">
              <og-badge [count]="zeile().unread" />
              <span class="zeile__time">{{ zeile().time }}</span>
            </span>
          }
        </span>
      </span>
    </ng-template>

    @if (pending()) {
      <div class="zeile">
        <ng-container [ngTemplateOutlet]="inhalt"></ng-container>
      </div>
    } @else {
      <a class="zeile" [routerLink]="['/chat', zeile().contactId]">
        <ng-container [ngTemplateOutlet]="inhalt"></ng-container>
      </a>
    }
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .zeile {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px;
      border-radius: var(--og-r-btn);
      color: var(--og-text);
      text-decoration: none;
    }

    .zeile__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }

    .zeile__top,
    .zeile__bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .zeile__name {
      @include og-type-body-strong;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .zeile__preview {
      @include og-type-preview;
      color: var(--og-text-3);
    }

    .zeile__preview--unread {
      color: var(--og-text-2);
    }

    .zeile__right {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 6px;
    }

    .zeile__time {
      @include og-type-meta;
    }

    .zeile__pending {
      @include og-type-note;
      color: var(--og-accent);
    }
  `,
  imports: [NgTemplateOutlet, RouterLink, OgAvatarComponent, OgBadgeComponent, OgSignalBarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class KontaktZeileComponent {
  /** Die Zeile mit Kontakt, letzter Nachricht und Signal. */
  readonly zeile = input.required<KontaktZeile>();
  /** `true`, wenn der Schlüssel des Kontakts noch aussteht: die Zeile ist dann nicht klickbar. */
  readonly pending = input(false);
}
