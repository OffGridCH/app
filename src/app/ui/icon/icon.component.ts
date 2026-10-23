import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Namen der Icons laut Skill `offgrid-design-system` §3. */
export type OgIconName =
  | 'back'
  | 'plus'
  | 'settings'
  | 'send'
  | 'check'
  | 'qr'
  | 'antenna'
  | 'upload'
  | 'download'
  | 'file'
  | 'info'
  | 'warning'
  | 'pin'
  | 'map'
  | 'copy'
  | 'refresh'
  | 'users';

interface OgIconMetrics {
  readonly size: number;
  readonly strokeWidth: number;
}

/** Standardgrösse und Standardstrichstärke je Icon (Skill `offgrid-design-system` §3). */
const ICON_METRICS: Record<OgIconName, OgIconMetrics> = {
  back: { size: 22, strokeWidth: 2 },
  plus: { size: 20, strokeWidth: 2 },
  settings: { size: 20, strokeWidth: 2 },
  send: { size: 22, strokeWidth: 2.2 },
  check: { size: 14, strokeWidth: 3 },
  qr: { size: 20, strokeWidth: 2.2 },
  antenna: { size: 22, strokeWidth: 2 },
  upload: { size: 22, strokeWidth: 2 },
  download: { size: 22, strokeWidth: 2 },
  file: { size: 20, strokeWidth: 2 },
  info: { size: 18, strokeWidth: 2 },
  warning: { size: 18, strokeWidth: 2 },
  pin: { size: 22, strokeWidth: 2 },
  map: { size: 20, strokeWidth: 2.2 },
  copy: { size: 20, strokeWidth: 2 },
  refresh: { size: 18, strokeWidth: 2 },
  users: { size: 20, strokeWidth: 2 },
};

@Component({
  selector: 'og-icon',
  template: `
    <svg
      [attr.width]="iconSize()"
      [attr.height]="iconSize()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="iconStrokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('back') {
          <path d="M15 5l-7 7 7 7" />
        }
        @case ('plus') {
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        }
        @case ('settings') {
          <path d="M4 7h10" />
          <path d="M18 7h2" />
          <circle cx="16" cy="7" r="2" />
          <path d="M4 17h2" />
          <path d="M10 17h10" />
          <circle cx="8" cy="17" r="2" />
        }
        @case ('send') {
          <path d="M12 19V5" />
          <path d="M6 11l6-6 6 6" />
        }
        @case ('check') {
          <path d="M5 12l5 5 9-10" />
        }
        @case ('qr') {
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M14 14h3v3" />
          <path d="M21 14v7h-7" />
        }
        @case ('antenna') {
          <path d="M12 13v8" />
          <circle cx="12" cy="11" r="2" />
          <path d="M7.8 6.8a6 6 0 0 0 0 8.4" />
          <path d="M16.2 6.8a6 6 0 0 1 0 8.4" />
          <path d="M5 4a10 10 0 0 0 0 14" />
          <path d="M19 4a10 10 0 0 1 0 14" />
        }
        @case ('upload') {
          <path d="M12 15V3" />
          <path d="M7 8l5-5 5 5" />
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        }
        @case ('download') {
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        }
        @case ('file') {
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5" />
        }
        @case ('info') {
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16.5v.01" />
        }
        @case ('warning') {
          <path d="M12 3l9.5 17h-19z" />
          <path d="M12 10v4" />
          <path d="M12 17v.01" />
        }
        @case ('pin') {
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.5" />
        }
        @case ('map') {
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
          <path d="M9 4v14" />
          <path d="M15 6v14" />
        }
        @case ('copy') {
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        }
        @case ('refresh') {
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        }
        @case ('users') {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
          <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgIconComponent {
  /** Name des Icons (Pflicht). */
  readonly name = input.required<OgIconName>();
  /** Kantenlänge in px. Default: Wert aus der Icon-Tabelle. */
  readonly size = input<number>();
  /** Strichstärke. Default: Wert aus der Icon-Tabelle. */
  readonly strokeWidth = input<number>();

  protected readonly iconSize = computed(() => this.size() ?? ICON_METRICS[this.name()].size);
  protected readonly iconStrokeWidth = computed(() => this.strokeWidth() ?? ICON_METRICS[this.name()].strokeWidth);
}
