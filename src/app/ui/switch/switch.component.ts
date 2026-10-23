import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

@Component({
  selector: 'og-switch',
  template: `
    <button
      type="button"
      role="switch"
      class="og-switch"
      [class.og-switch--on]="checked()"
      [attr.aria-checked]="checked()"
      [attr.aria-labelledby]="labelledBy()"
      (click)="toggle()"
    >
      <span class="og-switch__knob"></span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .og-switch {
      display: flex;
      align-items: center;
      width: 52px;
      height: 32px;
      box-sizing: border-box;
      padding: 3px;
      border: none;
      border-radius: var(--og-r-pill);
      background: var(--og-signal-off);
      cursor: pointer;
      transition: background 150ms ease;
    }

    .og-switch--on {
      background: var(--og-accent);
      justify-content: flex-end;
    }

    .og-switch__knob {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--og-text-3);
      transition: background 150ms ease;
    }

    .og-switch--on .og-switch__knob {
      background: var(--og-on-accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgSwitchComponent {
  /** Zustand des Schalters (Zwei-Wege-Bindung). */
  readonly checked = model(false);
  /** Id des Textes, der den Schalter beschriftet. */
  readonly labelledBy = input.required<string>();

  protected toggle(): void {
    this.checked.update((value) => !value);
  }
}
