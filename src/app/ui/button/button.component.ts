import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { OgIconComponent, type OgIconName } from '../icon/icon.component';

/** Varianten des Buttons (Skill `offgrid-design-system` §4, og-button). */
export type OgButtonVariant = 'primary' | 'secondary' | 'danger-text';

@Component({
  selector: 'og-button',
  imports: [OgIconComponent],
  template: `
    <button [class]="classes()" [type]="type()" [disabled]="disabled()" (click)="onPressed()">
      @if (icon(); as name) {
        <og-icon [name]="name" [size]="iconSize()" />
      }
      <span class="og-button__label"><ng-content /></span>
    </button>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      box-sizing: border-box;
      padding: 0 16px;
      border: none;
      cursor: pointer;
    }

    .og-button--full {
      width: 100%;
    }

    .og-button--primary {
      height: var(--og-btn-h);
      border-radius: var(--og-r-btn);
      background: var(--og-accent);
      @include og-type-body;
      font-weight: 700;
      color: var(--og-on-accent);
    }

    .og-button--secondary {
      height: var(--og-btn2-h);
      border-radius: var(--og-r-btn2);
      background: transparent;
      border: 1px solid var(--og-border);
      @include og-type-body-2;
      font-weight: 600;
      color: var(--og-text);
    }

    .og-button--danger-text {
      height: 56px;
      background: transparent;
      justify-content: flex-start;
      @include og-type-body;
      font-weight: 600;
      color: var(--og-danger);
    }

    .og-button:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgButtonComponent {
  /** Aussehen des Buttons. */
  readonly variant = input<OgButtonVariant>('primary');
  /** Typ des Buttons. */
  readonly type = input<'button' | 'submit'>('button');
  /** Button ist deaktiviert (Opazität 0.4, kein Klick). */
  readonly disabled = input(false);
  /** Optionales Icon vor dem Text. */
  readonly icon = input<OgIconName>();
  /** Button über die volle Breite. */
  readonly fullWidth = input(true);
  /** Wird ausgelöst, wenn der Button gedrückt wird. */
  readonly pressed = output<void>();

  protected readonly classes = computed(
    () => `og-button og-button--${this.variant()}${this.fullWidth() ? ' og-button--full' : ''}`,
  );

  /** Der Primärbutton zeigt das Icon mit 20px, sonst gilt die Standardgrösse des Icons. */
  protected readonly iconSize = computed(() => (this.variant() === 'primary' ? 20 : undefined));

  protected onPressed(): void {
    this.pressed.emit();
  }
}
