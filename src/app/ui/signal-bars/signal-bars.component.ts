import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Signalstufe (Skill `offgrid-design-system` §4, og-signal-bars). */
export type OgSignalLevel = 0 | 1 | 2 | 3 | 4;

/** Grösse der Balken (Skill `offgrid-design-system` §4, og-signal-bars). */
export type OgSignalBarsSize = 'md' | 'sm';

interface OgSignalBar {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

/** Die vier Balken im 20×14-Raster (Skill `offgrid-design-system` §4, og-signal-bars). */
const BARS: readonly OgSignalBar[] = [
  { x: 0, y: 10, height: 4 },
  { x: 5.5, y: 7, height: 7 },
  { x: 11, y: 4, height: 10 },
  { x: 16.5, y: 0, height: 14 },
];

@Component({
  selector: 'og-signal-bars',
  template: `
    <svg
      class="og-signal-bars"
      [attr.width]="width()"
      [attr.height]="height()"
      viewBox="0 0 20 14"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    >
      @for (bar of bars(); track bar.x) {
        <rect
          [attr.x]="bar.x"
          [attr.y]="bar.y"
          width="3.5"
          [attr.height]="bar.height"
          rx="1"
          [class.on]="bar.on"
          [class.off]="!bar.on"
        />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .on {
      fill: var(--og-accent);
    }

    .off {
      fill: var(--og-signal-off);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgSignalBarsComponent {
  /** Stufe 0 bis 4: so viele Balken sind an. */
  readonly level = input.required<OgSignalLevel>();
  /** Grösse der Balken. */
  readonly size = input<OgSignalBarsSize>('md');
  /** Ansage für Screenreader (Pflicht). Leer = rein dekorativ, wird nicht angesagt. */
  readonly label = input.required<string>();

  protected readonly width = computed(() => (this.size() === 'sm' ? 15 : 20));
  protected readonly height = computed(() => (this.size() === 'sm' ? 11 : 14));

  /** Die vier Balken; die ersten `level` Balken sind an. */
  protected readonly bars = computed(() =>
    BARS.map((bar, index) => ({ ...bar, on: index < this.level() })),
  );
}
