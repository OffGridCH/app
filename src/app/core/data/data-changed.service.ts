import { Injectable, signal } from '@angular/core';

/**
 * Meldet Änderungen an Kontakten, Handshakes und ganzen Datenbeständen.
 *
 * Dienste, die ihre Listen bei einer Änderung neu laden, reagieren auf `version`.
 */
@Injectable({ providedIn: 'root' })
export class DataChangedService {
  private readonly versionSignal = signal(0);

  /** Steigt bei jeder Meldung um eins. */
  readonly version = this.versionSignal.asReadonly();

  /** Meldet eine Änderung. */
  notify(): void {
    this.versionSignal.update((version) => version + 1);
  }
}
