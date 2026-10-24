import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Ton des Banners (Skill `offgrid-design-system` §4, og-banner). */
export type OgBannerTone = 'danger';

@Component({
  selector: 'og-banner',
  template: `
    <div [class]="classes()" role="status">
      <div class="og-banner__body">
        <div class="og-banner__title">{{ title() }}</div>
        <div class="og-banner__text">{{ text() }}</div>
      </div>
      <ng-content />
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      margin: 12px 14px 0 14px;
      padding: 12px 12px 12px 16px;
      border-radius: var(--og-r-btn);
      background: var(--og-danger-bg);
      border: 1px solid var(--og-danger-border);
    }

    .og-banner__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex-grow: 1;
      min-width: 0;
    }

    .og-banner__title {
      @include og-type-row;
      font-weight: 650;
      color: var(--og-danger-title);
    }

    .og-banner__text {
      @include og-type-help;
      color: var(--og-danger-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgBannerComponent {
  /** Ton des Banners. */
  readonly tone = input<OgBannerTone>('danger');
  /** Titel des Banners. */
  readonly title = input('');
  /** Text des Banners. */
  readonly text = input('');

  protected readonly classes = computed(() => `og-banner og-banner--${this.tone()}`);
}
