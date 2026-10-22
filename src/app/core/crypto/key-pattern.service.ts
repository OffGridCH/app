import { Injectable } from '@angular/core';

import type { Contact } from '../models/contact';

// Schlüssel-Muster zum Vergleich. Quelle: Skill `offgrid-crypto-handshake` §4.

/** Raster 5 × 5, spiegelsymmetrisch: für jede Zeile werden 3 Bytes der linken Hälfte gelesen. */
const ZEILEN = 5;
const SPALTEN_LINKS = 3;

/** Nie ein fast leeres Bild: mindestens diese Zellen zusätzlich setzen (Mitte und Zeile 2, Spalte 1/3). */
const ZELLE_MITTE = 12;
const ZELLE_LINKS = 11;
const ZELLE_RECHTS = 13;
const MINDEST_AN = 5;

@Injectable({ providedIn: 'root' })
export class KeyPatternService {
  private readonly cache = new Map<string, Promise<boolean[]>>();

  /** Muster eines Kontakts: die beiden Schlüssel sortiert aneinandergehängt als UTF-8 → SHA-256. */
  forContact(contact: Contact): Promise<boolean[]> {
    const eingabe = [contact.sendingKey, contact.receivingKey].sort().join('');
    return this.muster(eingabe);
  }

  /** Eigenes Muster aus der `install_id` (Einstellungen, Leerzustand). */
  forInstall(installId: string): Promise<boolean[]> {
    return this.muster(installId);
  }

  private async muster(eingabe: string): Promise<boolean[]> {
    const gespeichert = this.cache.get(eingabe);
    if (gespeichert !== undefined) {
      return [...(await gespeichert)];
    }

    const berechnet = this.zeichne(eingabe);
    this.cache.set(eingabe, berechnet);
    return [...(await berechnet)];
  }

  private async zeichne(eingabe: string): Promise<boolean[]> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(eingabe));
    const bytes = new Uint8Array(digest);
    const zellen: boolean[] = [];

    for (let zeile = 0; zeile < ZEILEN; zeile += 1) {
      for (let spalte = 0; spalte < ZEILEN; spalte += 1) {
        // Spalte 3 = Spalte 1, Spalte 4 = Spalte 0.
        const index = spalte < SPALTEN_LINKS ? spalte : ZEILEN - 1 - spalte;
        zellen.push((bytes[zeile * SPALTEN_LINKS + index] & 1) === 1);
      }
    }

    if (zellen.filter((an) => an).length < MINDEST_AN) {
      zellen[ZELLE_LINKS] = true;
      zellen[ZELLE_MITTE] = true;
      zellen[ZELLE_RECHTS] = true;
    }

    return zellen;
  }
}
