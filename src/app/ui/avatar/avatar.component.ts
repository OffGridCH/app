import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Grössen des Avatars (Skill `offgrid-design-system` §4, og-avatar). */
export type OgAvatarSize = 40 | 48 | 56 | 72 | 96;

/** Ausprägung des Avatars (Skill `offgrid-design-system` §4, og-avatar). */
export type OgAvatarVariant = 'normal' | 'pending' | 'square';

interface OgAvatarMetrics {
  /** Kantenlänge einer Rasterzelle in px. */
  readonly cell: number;
  /** Lücke zwischen den Zellen in px. */
  readonly gap: number;
  /** Radius einer Zelle in px. */
  readonly radius: number;
}

/** Zellmasse je Grösse (Skill `offgrid-design-system` §4, og-avatar). */
const AVATAR_METRICS: Record<OgAvatarSize, OgAvatarMetrics> = {
  40: { cell: 4, gap: 1, radius: 1 },
  48: { cell: 5, gap: 1, radius: 1 },
  56: { cell: 5, gap: 1, radius: 1 },
  72: { cell: 7, gap: 1.5, radius: 1 },
  96: { cell: 9, gap: 2, radius: 2 },
};

@Component({
  selector: 'og-avatar',
  host: {
    'aria-hidden': 'true',
  },
  template: `
    <div
      class="og-avatar"
      [class.og-avatar--pending]="variant() === 'pending'"
      [class.og-avatar--square]="variant() === 'square'"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.border-radius.px]="variant() === 'square' ? squareRadius() : null"
    >
      @if (variant() !== 'pending') {
        <div
          class="og-avatar__grid"
          [style.grid-template-columns]="'repeat(5, ' + metrics().cell + 'px)'"
          [style.grid-auto-rows]="metrics().cell + 'px'"
          [style.gap.px]="metrics().gap"
        >
          @for (cell of cells(); track $index) {
            <span
              class="og-avatar__cell"
              [class.og-avatar__cell--on]="cell"
              [style.border-radius.px]="metrics().radius"
            ></span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .og-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border-radius: 50%;
      background: var(--og-surface);
      border: 1px solid var(--og-border);
    }

    .og-avatar--pending {
      background: transparent;
      border: 1.5px dashed var(--og-dashed);
    }

    .og-avatar--square {
      border-radius: 14px;
    }

    .og-avatar__grid {
      display: grid;
    }

    .og-avatar__cell {
      background: transparent;
    }

    .og-avatar__cell--on {
      background: var(--og-text-2);
    }

    .og-avatar--square .og-avatar__cell--on {
      background: var(--og-accent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgAvatarComponent {
  /** Zellwerte des Musters (25 Werte, Zeilen von oben, links nach rechts). */
  readonly pattern = input<boolean[]>([]);
  /** Kantenlänge des Avatars in px. */
  readonly size = input.required<OgAvatarSize>();
  /** Ausprägung: normal, pending (Kontakt ausstehend) oder square (Gruppe, ab T20). */
  readonly variant = input<OgAvatarVariant>('normal');

  protected readonly metrics = computed(() => AVATAR_METRICS[this.size()]);

  /** Radius der eckigen Variante: 12px bei 40, sonst 14px (Skill `offgrid-design-system` §4). */
  protected readonly squareRadius = computed(() => (this.size() === 40 ? 12 : 14));

  /** Die Rasterzellen des Musters. */
  protected readonly cells = computed(() => this.pattern().slice(0, 25));
}
