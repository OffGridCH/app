import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { OgIconButtonComponent } from '../icon-button/icon-button.component';

@Component({
  selector: 'og-topbar',
  imports: [OgIconButtonComponent],
  template: `
    <header class="og-topbar">
      <og-icon-button icon="back" shape="plain" [label]="backLabel()" [routerLink]="backLink()" />
      <h1 class="og-topbar__title">{{ title() }}</h1>
      <div class="og-topbar__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-topbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 14px 12px 8px 6px;
    }

    .og-topbar__title {
      margin: 0;
      @include og-type-page-title;
      color: var(--og-text);
    }

    .og-topbar__actions {
      display: flex;
      align-items: center;
      margin-left: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgTopbarComponent {
  /** Titel der Unterseite. */
  readonly title = input.required<string>();
  /** Route des Zurück-Buttons. */
  readonly backLink = input<string | readonly string[]>();
  /** Beschriftung des Zurück-Buttons als `aria-label`, z. B. „Zurück zu den Kontakten“. */
  readonly backLabel = input.required<string>();
}
