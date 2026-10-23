import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'og-badge',
  template: `
    @if (count() > 0) {
      <span class="og-badge">{{ text() }}</span>
    }
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: inline-flex;
    }

    .og-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      box-sizing: border-box;
      padding: 0 5px;
      border-radius: var(--og-r-pill);
      background: var(--og-accent);
      @include og-type-meta;
      font-weight: 700;
      color: var(--og-on-accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgBadgeComponent {
  /** Anzahl der ungelesenen Nachrichten. Bei 0 wird nichts gerendert. */
  readonly count = input(0);

  /** Ab 100 wird „99+“ angezeigt. */
  protected readonly text = computed(() => (this.count() > 99 ? '99+' : String(this.count())));
}
