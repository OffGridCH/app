import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'og-banner-action',
  imports: [RouterLink],
  template: `
    <a class="og-banner-action" [routerLink]="routerLink()">
      <ng-content />
    </a>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .og-banner-action {
      display: inline-flex;
      align-items: center;
      height: 40px;
      box-sizing: border-box;
      padding: 0 14px;
      border-radius: var(--og-r-md);
      background: var(--og-text);
      @include og-type-action;
      color: var(--og-bg);
      text-decoration: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgBannerActionComponent {
  /** Route, auf die die Aktion zeigt. */
  readonly routerLink = input<string | readonly string[]>();
}
