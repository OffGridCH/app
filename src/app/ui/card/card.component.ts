import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'og-card',
  template: `
    <div class="og-card" [class.og-card--padded]="padded()">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .og-card {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      margin: 0 var(--og-gutter);
      border-radius: var(--og-r-card);
      background: var(--og-surface);
      border: 1px solid var(--og-border);
    }

    .og-card--padded {
      padding: 16px;
      gap: 14px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgCardComponent {
  /** true = Karte mit Innenabstand (Formular), false = Karte mit Zeilen. */
  readonly padded = input(false);
}
