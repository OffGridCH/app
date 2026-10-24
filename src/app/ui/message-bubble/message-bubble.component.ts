import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { OgSignalBarsComponent, type OgSignalLevel } from '../signal-bars/signal-bars.component';

/** Richtung einer Nachricht (Skill `offgrid-design-system` §4, og-message-bubble). */
export type OgMessageDirection = 'in' | 'out';

/** Zustand einer ausgehenden Nachricht (Skill `offgrid-design-system` §4, og-message-bubble). */
export type OgMessageStatus = 'queued' | 'sent' | 'delivered' | 'failed';

@Component({
  selector: 'og-message-bubble',
  imports: [OgSignalBarsComponent],
  template: `
    <div
      class="og-message-bubble"
      [class.og-message-bubble--out]="direction() === 'out'"
      [class.og-message-bubble--failed]="status() === 'failed'"
      [class.og-message-bubble--group-start]="groupStart()"
    >
      <div [class]="bubbleClasses()">{{ text() }}</div>
      <div
        class="og-message-bubble__meta"
        [class.og-message-bubble__meta--in]="direction() === 'in'"
        [class.og-message-bubble__meta--failed]="status() === 'failed'"
      >
        @if (direction() === 'in') {
          <span class="og-message-bubble__meta-text">{{ meta() }}</span>
        } @else if (status() === 'failed') {
          <span class="og-message-bubble__failed">Nicht gesendet</span>
          <button type="button" class="og-message-bubble__retry" (click)="retry.emit()">Erneut senden</button>
        } @else {
          <span class="og-message-bubble__meta-text">{{ meta() }}</span>
          <og-signal-bars size="sm" [level]="signalLevel()" label="" />
        }
      </div>
    </div>
  `,
  styles: `
    @use '../../../theme/typography.scss' as *;

    :host {
      display: block;
    }

    .og-message-bubble {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      max-width: 78%;
    }

    .og-message-bubble--out {
      align-items: flex-end;
    }

    .og-message-bubble--group-start {
      margin-top: 8px;
    }

    .og-message-bubble--failed {
      gap: 6px;
    }

    .og-message-bubble__bubble {
      box-sizing: border-box;
      padding: 10px 14px;
      border-radius: 20px 20px 20px 6px;
      background: var(--og-surface);
      border: 1px solid var(--og-border);
      @include og-type-body;
      color: var(--og-text);
    }

    .og-message-bubble__bubble--out {
      border-radius: 20px 20px 6px 20px;
      font-weight: 500;
    }

    .og-message-bubble__bubble--sent {
      background: var(--og-accent);
      border-color: var(--og-accent);
      color: var(--og-on-accent);
    }

    .og-message-bubble__bubble--queued {
      background: transparent;
      border: 1.5px dashed var(--og-accent);
      color: var(--og-text);
    }

    .og-message-bubble__bubble--failed {
      background: transparent;
      border: 1.5px solid var(--og-danger);
      color: var(--og-text);
    }

    .og-message-bubble__meta {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-right: 6px;
    }

    .og-message-bubble__meta--in {
      padding-right: 0;
      padding-left: 6px;
    }

    .og-message-bubble__meta--failed {
      gap: 10px;
    }

    .og-message-bubble__meta-text {
      @include og-type-meta;
    }

    .og-message-bubble__failed {
      @include og-type-meta;
      color: var(--og-danger);
    }

    .og-message-bubble__retry {
      height: 32px;
      box-sizing: border-box;
      padding: 0 12px;
      border-radius: var(--og-r-sm);
      border: 1px solid var(--og-border);
      background: var(--og-surface);
      @include og-type-help;
      font-weight: 600;
      color: var(--og-text);
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgMessageBubbleComponent {
  /** Richtung der Nachricht. */
  readonly direction = input.required<OgMessageDirection>();
  /** Zustand der Nachricht (nur für ausgehende Nachrichten). */
  readonly status = input<OgMessageStatus>('sent');
  /** Text der Nachricht. */
  readonly text = input('');
  /** Meta-Text (Zeit, Status). */
  readonly meta = input('');
  /** Richtungswechsel: zusätzlicher Abstand nach oben. */
  readonly groupStart = input(false);
  /** Wird ausgelöst, wenn „Erneut senden“ gedrückt wird. */
  readonly retry = output<void>();

  /** Signalstufe der Statusanzeige: gesendet 2, zugestellt 4, in Warteschlange 0. */
  protected readonly signalLevel = computed<OgSignalLevel>(() => {
    switch (this.status()) {
      case 'delivered':
        return 4;
      case 'queued':
        return 0;
      default:
        return 2;
    }
  });

  protected readonly bubbleClasses = computed(() => {
    const classes = ['og-message-bubble__bubble'];
    if (this.direction() === 'in') {
      return classes.join(' ');
    }
    classes.push('og-message-bubble__bubble--out');
    if (this.status() === 'queued') {
      classes.push('og-message-bubble__bubble--queued');
    } else if (this.status() === 'failed') {
      classes.push('og-message-bubble__bubble--failed');
    } else {
      classes.push('og-message-bubble__bubble--sent');
    }
    return classes.join(' ');
  });
}
