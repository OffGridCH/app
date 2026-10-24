import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

import { OgIconComponent } from '../icon/icon.component';

/** Zählt die UTF-8-Bytes eines Textes (die Seite übergibt `contentBytes` aus `core/messaging/limits.ts`). */
export type OgComposerByteCounter = (text: string) => number;

/** Laufende Nummer für die eindeutige Id des Eingabefeldes. */
let composerCounter = 0;

@Component({
  selector: 'og-composer',
  imports: [OgIconComponent],
  template: `
    <div class="og-composer" [class.og-composer--with-location]="showLocation()">
      @if (showLocation()) {
        <button
          type="button"
          class="og-composer__location"
          aria-label="Standort senden"
          (click)="location.emit()"
        >
          <og-icon name="pin" [size]="22" />
        </button>
      }
      <div class="og-composer__field">
        <label class="og-sr-only" [attr.for]="inputId">{{ label() }}</label>
        <input
          [id]="inputId"
          class="og-composer__input"
          type="text"
          [placeholder]="placeholder()"
          [value]="text()"
          (input)="onInput($event)"
          (keydown.enter)="onEnter($event)"
        />
        <div class="og-composer__counter" [class.og-composer__counter--over]="overLimit()">
          {{ counterText() }}
        </div>
      </div>
      <button
        type="button"
        class="og-composer__send"
        [attr.aria-label]="sendLabel()"
        [disabled]="sendDisabled()"
        (click)="sendMessage()"
      >
        <og-icon name="send" [size]="22" />
      </button>
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-composer {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      box-sizing: border-box;
      padding: 10px 14px 22px 14px;
      background: var(--og-bar);
      border-top: 1px solid var(--og-line);
    }

    .og-composer--with-location {
      gap: 8px;
    }

    .og-composer__location {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      box-sizing: border-box;
      margin-bottom: 21px;
      flex-shrink: 0;
      padding: 0;
      border: 1px solid var(--og-border);
      border-radius: var(--og-r-btn2);
      background: var(--og-surface);
      color: var(--og-text);
      cursor: pointer;
    }

    .og-composer__field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex-grow: 1;
      min-width: 0;
    }

    .og-composer__input {
      height: var(--og-composer-h);
      box-sizing: border-box;
      padding: 0 16px;
      border-radius: var(--og-r-btn2);
      border: 1px solid var(--og-border);
      background: var(--og-surface);
      @include og-type-body;
      color: var(--og-text);
      outline: none;
    }

    .og-composer__input::placeholder {
      color: var(--og-placeholder);
    }

    .og-composer__input:focus {
      border-color: var(--og-accent);
    }

    .og-composer__counter {
      @include og-type-meta;
      padding-left: 4px;
    }

    .og-composer__counter--over {
      color: var(--og-danger);
    }

    .og-composer__send {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      box-sizing: border-box;
      margin-bottom: 21px;
      flex-shrink: 0;
      padding: 0;
      border: none;
      border-radius: var(--og-r-btn2);
      background: var(--og-accent);
      color: var(--og-on-accent);
      cursor: pointer;
    }

    .og-composer__send:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgComposerComponent {
  /** Platzhalter im Eingabefeld. */
  readonly placeholder = input('');
  /** Verstecktes Label des Eingabefeldes, z. B. „Nachricht an Anna“. */
  readonly label = input.required<string>();
  /** Beschriftung des Senden-Buttons als `aria-label`. */
  readonly sendLabel = input.required<string>();
  /** Maximale Grösse eines Funkspruchs in Bytes. */
  readonly maxBytes = input.required<number>();
  /** Zählt die Bytes des Textes (die Seite übergibt `contentBytes`). */
  readonly countBytes = input.required<OgComposerByteCounter>();
  /** Zeigt den Standort-Button. */
  readonly showLocation = input(false);
  /** Blockiert das Senden, wenn der Text zu gross ist. */
  readonly blockOverLimit = input(true);
  /** Text der Nachricht (Zwei-Wege-Bindung). */
  readonly text = model('');
  /** Wird ausgelöst, wenn gesendet wird. */
  readonly send = output<string>();
  /** Wird ausgelöst, wenn der Standort-Button gedrückt wird. */
  // eslint-disable-next-line @angular-eslint/no-output-native -- Name ist im Skill `offgrid-design-system` §4 (og-composer) festgelegt.
  readonly location = output<void>();

  /** Eindeutige Id des Eingabefeldes (für das Label). */
  protected readonly inputId = `og-composer-${++composerCounter}`;

  /** Bytes des aktuellen Textes (nur über `countBytes`). */
  protected readonly bytes = computed(() => this.countBytes()(this.text()));

  /** Der Text ist grösser als erlaubt. */
  protected readonly overLimit = computed(() => this.bytes() > this.maxBytes());

  /** Senden ist gesperrt: leerer Text oder (bei `blockOverLimit`) zu viele Bytes. */
  protected readonly sendDisabled = computed(
    () => this.text().trim().length === 0 || (this.overLimit() && this.blockOverLimit()),
  );

  /** Zähler unter dem Eingabefeld (Skill `offgrid-design-system` §4, og-composer). */
  protected readonly counterText = computed(
    () => `${this.bytes()} / ${this.maxBytes()} Zeichen pro Funkspruch`,
  );

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    if (!this.sendDisabled()) {
      this.sendMessage();
    }
  }

  protected sendMessage(): void {
    if (this.sendDisabled()) {
      return;
    }
    this.send.emit(this.text().trim());
    this.text.set('');
  }
}
