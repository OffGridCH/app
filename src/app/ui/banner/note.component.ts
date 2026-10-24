import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { OgIconComponent } from '../icon/icon.component';

@Component({
  selector: 'og-note',
  imports: [OgIconComponent],
  template: `
    <div class="og-note" role="note">
      <og-icon name="warning" [size]="18" />
      <span class="og-note__text">{{ text() }}</span>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .og-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      box-sizing: border-box;
      margin: 14px var(--og-gutter) 0 var(--og-gutter);
      padding: 14px 16px;
      border-radius: var(--og-r-btn);
      background: var(--og-danger-bg);
      border: 1px solid var(--og-danger-border);
    }

    og-icon {
      color: var(--og-danger-title);
    }

    .og-note__text {
      font-family: var(--og-font);
      font-size: 14px;
      line-height: 1.45;
      font-weight: 400;
      color: var(--og-danger-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgNoteComponent {
  /** Text des Hinweises. */
  readonly text = input('');
}
