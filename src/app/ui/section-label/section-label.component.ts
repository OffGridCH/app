import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Einzug des Abschnittstitels (Skill `offgrid-design-system` §4, og-section-label). */
export type OgSectionLabelInset = 'card' | 'list';

@Component({
  selector: 'og-section-label',
  template: `
    <div class="og-section-label" [class.og-section-label--list]="inset() === 'list'">
      <ng-content />
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    .og-section-label {
      @include og-type-section;
      padding: 26px 28px 8px 28px;
    }

    .og-section-label--list {
      padding: 26px 20px 8px 20px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgSectionLabelComponent {
  /** `card` = Einzug wie in den Einstellungen, `list` = kleinerer Einzug. */
  readonly inset = input<OgSectionLabelInset>('card');
}
