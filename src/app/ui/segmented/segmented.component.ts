import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Ein Segment des Umschalters (Skill `offgrid-design-system` §4, og-segmented). */
export interface OgSegmentedOption {
  value: string;
  label: string;
}

@Component({
  selector: 'og-segmented',
  template: `
    <div class="og-segmented" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="tab"
          class="og-segmented__segment"
          [class.og-segmented__segment--active]="option.value === value()"
          [attr.aria-selected]="option.value === value()"
          (click)="select(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-segmented {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
      box-sizing: border-box;
      margin: 8px var(--og-gutter) 0 var(--og-gutter);
      padding: 4px;
      border-radius: var(--og-r-btn2);
      background: var(--og-surface);
      border: 1px solid var(--og-border);
    }

    .og-segmented__segment {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 44px;
      padding: 0 8px;
      border: none;
      border-radius: var(--og-r-md);
      background: transparent;
      @include og-type-body-2;
      font-weight: 500;
      color: var(--og-text-2);
      cursor: pointer;
    }

    .og-segmented__segment--active {
      background: var(--og-text);
      font-weight: 700;
      color: var(--og-bg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgSegmentedComponent {
  /** Segmente des Umschalters. */
  readonly options = input.required<OgSegmentedOption[]>();
  /** Gewähltes Segment (Zwei-Wege-Bindung). */
  readonly value = model('');
  /** Beschriftung der Liste für Screenreader. */
  readonly ariaLabel = input.required<string>();

  protected select(value: string): void {
    this.value.set(value);
  }
}
