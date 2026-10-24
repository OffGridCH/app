import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { OgIconComponent } from '../icon/icon.component';

/** Ein Schritt der Schritt-Liste (Skill `offgrid-design-system` §4, og-step-list). */
export interface OgStep {
  label: string;
  state: 'done' | 'active' | 'todo';
  meta?: string;
}

/** Darstellung des aktiven Schritts (Skill `offgrid-design-system` §4, og-step-list). */
export type OgStepListActiveStyle = 'pulse' | 'spinner';

@Component({
  selector: 'og-step-list',
  imports: [OgIconComponent],
  template: `
    <ol class="og-step-list" [class.og-step-list--compact]="compact()">
      @for (step of steps(); track $index; let last = $last) {
        <li class="og-step-list__step" [class.og-step-list__step--last]="last">
          <span
            class="og-step-list__marker"
            [class.og-step-list__marker--done]="step.state === 'done'"
            [class.og-step-list__marker--todo]="step.state === 'todo'"
          >
            @if (step.state === 'done') {
              <og-icon name="check" [size]="14" />
            } @else if (step.state === 'active' && activeStyle() === 'pulse') {
              <span class="og-step-list__pulse"></span>
            } @else if (step.state === 'active') {
              <span class="og-step-list__spinner"></span>
            }
          </span>
          <span
            class="og-step-list__label"
            [class.og-step-list__label--active]="step.state === 'active'"
            [class.og-step-list__label--todo]="step.state === 'todo'"
          >
            {{ step.label }}
          </span>
          @if (step.meta; as meta) {
            <span
              class="og-step-list__meta"
              [class.og-step-list__meta--active]="step.state === 'active'"
            >
              {{ meta }}
            </span>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-step-list {
      display: flex;
      flex-direction: column;
      list-style: none;
      box-sizing: border-box;
      margin: 26px var(--og-gutter) 0 var(--og-gutter);
      padding: 6px 16px;
      border-radius: var(--og-r-card);
      background: var(--og-surface-2);
      border: 1px solid var(--og-line);
    }

    .og-step-list--compact {
      margin-top: 24px;
    }

    .og-step-list__step {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 52px;
      border-bottom: 1px solid var(--og-line);
    }

    .og-step-list__step--last {
      border-bottom: none;
    }

    .og-step-list__marker {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      box-sizing: border-box;
      flex-shrink: 0;
      border-radius: var(--og-r-xs);
      color: var(--og-on-accent);
    }

    .og-step-list__marker--done {
      background: var(--og-accent);
    }

    .og-step-list__marker--todo {
      background: transparent;
      border: 1.5px solid var(--og-border-muted);
    }

    .og-step-list__label {
      @include og-type-row;
      flex-grow: 1;
      color: var(--og-text);
    }

    .og-step-list__label--active {
      font-weight: 600;
    }

    .og-step-list__label--todo {
      color: var(--og-text-3);
    }

    .og-step-list__meta {
      @include og-type-meta;
      flex-shrink: 0;
    }

    .og-step-list__meta--active {
      color: var(--og-accent);
    }

    .og-step-list__pulse {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--og-accent);
      animation: og-step-pulse 1.6s ease-out infinite;
    }

    .og-step-list__spinner {
      width: 18px;
      height: 18px;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2.5px solid var(--og-border-muted);
      border-top-color: var(--og-accent);
      animation: og-step-spin 0.9s linear infinite;
    }

    @keyframes og-step-pulse {
      0% {
        box-shadow: 0 0 0 0 var(--og-accent-pulse);
      }
      100% {
        box-shadow: 0 0 0 10px transparent;
      }
    }

    @keyframes og-step-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .og-step-list__pulse,
      .og-step-list__spinner {
        animation: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgStepListComponent {
  /** Die Schritte der Liste. */
  readonly steps = input.required<OgStep[]>();
  /** Kompakter Abstand (Onboarding). */
  readonly compact = input(false);
  /** Darstellung des aktiven Schritts: pulsierender Punkt oder Spinner. */
  readonly activeStyle = input<OgStepListActiveStyle>('pulse');
}
