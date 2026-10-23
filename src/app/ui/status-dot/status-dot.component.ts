import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Zustand des Statuspunkts (Skill `offgrid-design-system` §4, og-status-dot). */
export type OgStatusDotState = 'ok' | 'danger';

@Component({
  selector: 'og-status-dot',
  template: `<span class="og-status-dot" [class.og-status-dot--danger]="state() === 'danger'"></span>`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .og-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--og-ok);
    }

    .og-status-dot--danger {
      background: var(--og-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgStatusDotComponent {
  /** Zustand des Punktes. */
  readonly state = input<OgStatusDotState>('ok');
}
