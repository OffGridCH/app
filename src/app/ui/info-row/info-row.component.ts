import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'og-info-row',
  template: `
    <div class="og-info-row" [class.og-info-row--last]="last()">
      <span class="og-info-row__label">{{ label() }}</span>
      <span class="og-info-row__value">
        @if (value(); as text) {
          <span class="og-info-row__text">{{ text }}</span>
        }
        <ng-content />
      </span>
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-info-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: var(--og-row-min);
      padding: 0 16px;
      border-bottom: 1px solid var(--og-line);
    }

    .og-info-row--last {
      border-bottom: none;
    }

    .og-info-row__label {
      @include og-type-row;
      color: var(--og-text-2);
    }

    .og-info-row__value {
      @include og-type-value;
    }

    /* Projizierter Inhalt (z. B. Signalbalken) ersetzt den Wert. */
    .og-info-row__value:has(> :not(.og-info-row__text)) .og-info-row__text {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgInfoRowComponent {
  /** Beschriftung der Zeile. */
  readonly label = input.required<string>();
  /** Wert rechts in der Zeile. Optional, wird vom projizierten Inhalt ersetzt. */
  readonly value = input<string>();
  /** Letzte Zeile der Karte: ohne Trennlinie. */
  readonly last = input(false);
}
