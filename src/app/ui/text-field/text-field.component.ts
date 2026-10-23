import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

/** Typ des Eingabefeldes (Skill `offgrid-design-system` §4, og-text-field). */
export type OgTextFieldType = 'text' | 'password';

@Component({
  selector: 'og-text-field',
  template: `
    <div class="og-text-field">
      <label class="og-text-field__label" [attr.for]="id()">
        {{ label() }}
        @if (optional()) {
          <span class="og-text-field__optional"> (optional)</span>
        }
      </label>
      <input
        class="og-text-field__input"
        [id]="id()"
        [type]="type()"
        [placeholder]="placeholder()"
        [attr.maxlength]="maxlength()"
        [value]="value()"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
      @if (hint(); as hintText) {
        <p class="og-text-field__hint">{{ hintText }}</p>
      }
      @if (error(); as errorText) {
        <p class="og-text-field__error">{{ errorText }}</p>
      }
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-text-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .og-text-field__label {
      @include og-type-help;
      color: var(--og-text-2);
    }

    .og-text-field__optional {
      color: var(--og-text-3);
    }

    .og-text-field__input {
      height: var(--og-input-h);
      box-sizing: border-box;
      padding: 0 14px;
      border-radius: var(--og-r-input);
      border: 1px solid var(--og-border);
      background: var(--og-input);
      @include og-type-body;
      color: var(--og-text);
      outline: none;
    }

    .og-text-field__input::placeholder {
      color: var(--og-placeholder);
    }

    .og-text-field__input:focus {
      border-color: var(--og-accent);
    }

    .og-text-field__hint {
      margin: 0;
      @include og-type-help;
    }

    .og-text-field__error {
      margin: 0;
      @include og-type-help;
      color: var(--og-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgTextFieldComponent {
  /** Id des Eingabefeldes (für `<label for>`). */
  readonly id = input.required<string>();
  /** Beschriftung des Eingabefeldes. */
  readonly label = input.required<string>();
  /** Typ des Eingabefeldes. */
  readonly type = input<OgTextFieldType>('text');
  /** Platzhaltertext. */
  readonly placeholder = input('');
  /** Hilfstext unter dem Feld. */
  readonly hint = input<string>();
  /** Beschriftung erhält den Zusatz „ (optional)“. */
  readonly optional = input(false);
  /** Maximale Länge der Eingabe. */
  readonly maxlength = input<number | null>(null);
  /** Fehlertext unter dem Feld. */
  readonly error = input<string | null>(null);
  /** Inhalt des Eingabefeldes (Zwei-Wege-Bindung). */
  readonly value = model('');
  /** Wird ausgelöst, wenn das Feld verlassen wird. */
  readonly blurred = output<void>();

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onBlur(): void {
    this.blurred.emit();
  }
}
