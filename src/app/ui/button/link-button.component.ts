import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OgIconComponent, type OgIconName } from '../icon/icon.component';
import { type OgButtonVariant } from './button.component';

@Component({
  selector: 'og-link-button',
  imports: [OgIconComponent, RouterLink],
  template: `
    <a
      [class]="classes()"
      [routerLink]="disabled() ? null : routerLink()"
      [attr.aria-disabled]="disabled() ? 'true' : null"
      (click)="onPressed()"
    >
      @if (icon(); as name) {
        <og-icon [name]="name" [size]="iconSize()" />
      }
      <span class="og-link-button__label"><ng-content /></span>
    </a>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-link-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-sizing: border-box;
      padding: 0 16px;
      border: none;
      cursor: pointer;
      text-decoration: none;
    }

    .og-link-button--full {
      width: 100%;
    }

    .og-link-button--primary {
      height: var(--og-btn-h);
      border-radius: var(--og-r-btn);
      background: var(--og-accent);
      @include og-type-body;
      font-weight: 700;
      color: var(--og-on-accent);
    }

    .og-link-button--secondary {
      height: var(--og-btn2-h);
      border-radius: var(--og-r-btn2);
      background: transparent;
      border: 1px solid var(--og-border);
      @include og-type-body-2;
      font-weight: 600;
      color: var(--og-text);
    }

    .og-link-button--danger-text {
      height: 56px;
      background: transparent;
      justify-content: flex-start;
      @include og-type-body;
      font-weight: 600;
      color: var(--og-danger);
    }

    .og-link-button--disabled {
      opacity: 0.4;
      pointer-events: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgLinkButtonComponent {
  /** Aussehen des Buttons. */
  readonly variant = input<OgButtonVariant>('primary');
  /** Route, auf die der Link zeigt. */
  readonly routerLink = input<string | readonly string[]>();
  /** Button ist deaktiviert (Opazität 0.4, kein Klick). */
  readonly disabled = input(false);
  /** Optionales Icon vor dem Text. */
  readonly icon = input<OgIconName>();
  /** Button über die volle Breite. */
  readonly fullWidth = input(true);
  /** Wird ausgelöst, wenn der Link gedrückt wird. */
  readonly pressed = output<void>();

  protected readonly classes = computed(
    () =>
      `og-link-button og-link-button--${this.variant()}${this.fullWidth() ? ' og-link-button--full' : ''}${
        this.disabled() ? ' og-link-button--disabled' : ''
      }`,
  );

  /** Der Primärbutton zeigt das Icon mit 20px, sonst gilt die Standardgrösse des Icons. */
  protected readonly iconSize = computed(() => (this.variant() === 'primary' ? 20 : undefined));

  protected onPressed(): void {
    if (this.disabled()) {
      return;
    }
    this.pressed.emit();
  }
}
