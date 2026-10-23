import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OgIconComponent, type OgIconName } from '../icon/icon.component';

/** Formen des Icon-Buttons (Skill `offgrid-design-system` §4, og-icon-button). */
export type OgIconButtonShape = 'round' | 'plain';

@Component({
  selector: 'og-icon-button',
  imports: [OgIconComponent, RouterLink],
  template: `
    @if (routerLink(); as link) {
      <a [class]="classes()" [routerLink]="link" [attr.aria-label]="label()">
        <og-icon [name]="icon()" />
      </a>
    } @else {
      <button type="button" [class]="classes()" [attr.aria-label]="label()">
        <og-icon [name]="icon()" />
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }

    .og-icon-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--og-touch);
      height: var(--og-touch);
      box-sizing: border-box;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--og-text);
      cursor: pointer;
      text-decoration: none;
    }

    .og-icon-button--round {
      border-radius: 50%;
      background: var(--og-surface);
      border: 1px solid var(--og-border);
    }

    .og-icon-button--plain {
      border-radius: var(--og-r-input);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgIconButtonComponent {
  /** Name des Icons (Pflicht). */
  readonly icon = input.required<OgIconName>();
  /** Beschriftung des Buttons als `aria-label` (Pflicht). */
  readonly label = input.required<string>();
  /** Form des Buttons. */
  readonly shape = input<OgIconButtonShape>('round');
  /** Route, auf die der Button zeigt. Ohne Route rendert der Button ein `<button>`. */
  readonly routerLink = input<string | readonly string[]>();

  protected readonly classes = computed(() => `og-icon-button og-icon-button--${this.shape()}`);
}
