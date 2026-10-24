import { ChangeDetectionStrategy, Component, computed, input, resource } from '@angular/core';
import { create } from 'qrcode';

import { QR_DARK, QR_LIGHT } from './qr-colors';

/** Kantenlänge des QR-Codes in Pixeln (Skill `offgrid-design-system` §4, og-qr). */
const QR_PIXEL_SIZE = 230;

/** Ein dunkles Modul des QR-Rasters. */
interface OgQrCell {
  /** Eindeutiger Index des Moduls (Zeile * Grösse + Spalte). */
  index: number;
  /** Spalte des Moduls. */
  x: number;
  /** Zeile des Moduls. */
  y: number;
}

/** Das QR-Raster: Grösse der Matrix und die dunklen Module. */
interface OgQrRaster {
  /** Kantenlänge der Matrix in Modulen. */
  size: number;
  /** Die dunklen Module des Rasters. */
  cells: OgQrCell[];
}

@Component({
  selector: 'og-qr',
  template: `
    <div class="og-qr__card" role="img" aria-label="QR-Code mit deinem Schlüssel">
      <div class="og-qr__code">
        @if (raster(); as qr) {
          <svg
            class="og-qr__svg"
            [attr.viewBox]="'0 0 ' + qr.size + ' ' + qr.size"
            [attr.width]="pixelSize"
            [attr.height]="pixelSize"
            [attr.fill]="light"
            shape-rendering="crispEdges"
            aria-hidden="true"
          >
            @for (cell of qr.cells; track cell.index) {
              <rect [attr.x]="cell.x" [attr.y]="cell.y" width="1" height="1" [attr.fill]="dark" />
            }
          </svg>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .og-qr__card {
      display: inline-block;
      box-sizing: border-box;
      padding: 22px;
      border-radius: var(--og-r-qr);
      background: var(--og-text);
    }

    .og-qr__code {
      width: 230px;
      height: 230px;
      line-height: 0;
    }

    .og-qr__svg {
      display: block;
      width: 230px;
      height: 230px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OgQrComponent {
  /** Inhalt des QR-Codes (der Text mit dem Schlüssel). */
  readonly data = input.required<string>();

  /** Kantenlänge des QR-Codes in Pixeln. */
  protected readonly pixelSize = QR_PIXEL_SIZE;

  /** Farbe der dunklen Module (Konstante aus `qr-colors.ts`). */
  protected readonly dark = QR_DARK;

  /** Farbe der hellen Module (transparent: den Grund liefert die Karte). */
  protected readonly light = QR_LIGHT;

  /** Erzeugt die Module des QR-Codes (Paket `qrcode`). */
  private readonly qrResource = resource({
    params: () => this.data(),
    loader: async ({ params }) => create(params, { errorCorrectionLevel: 'M' }),
  });

  /** Das QR-Raster mit den dunklen Modulen. */
  protected readonly raster = computed<OgQrRaster | null>(() => {
    if (!this.qrResource.hasValue()) {
      return null;
    }
    const qr = this.qrResource.value();
    const size = qr.modules.size;
    const cells: OgQrCell[] = [];
    qr.modules.data.forEach((dark, index) => {
      if (dark) {
        cells.push({ index, x: index % size, y: Math.floor(index / size) });
      }
    });
    return { size, cells };
  });
}
