import { Injectable } from '@angular/core';

import { SerialTransport, TransportError } from './serial-transport';

/**
 * Platzhalter für Android, bis das USB-Serial-Plugin da ist (T06): es findet nie ein Gerät.
 * T06 ersetzt ihn in `app.config.ts` durch den echten Transport.
 */
@Injectable({ providedIn: 'root' })
export class UnavailableSerialTransport extends SerialTransport {
  async open(): Promise<void> {
    throw new TransportError('no-device', 'Das USB-Serial-Plugin ist noch nicht eingebaut');
  }

  async write(): Promise<void> {
    throw new TransportError('open-failed', 'Keine Verbindung');
  }

  async close(): Promise<void> {
    // Nichts zu schliessen.
  }

  onData(): void {
    // Es kommen nie Daten.
  }

  onClosed(): void {
    // Die Verbindung ist nie offen.
  }
}
