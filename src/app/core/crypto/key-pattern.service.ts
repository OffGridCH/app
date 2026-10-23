import { Injectable } from '@angular/core';

import type { Contact } from '../models/contact';

const GRID_SIZE = 5;
const HALF_COLUMNS = 3;
const MIN_ON_CELLS = 5;
const CENTER_INDEX = 12;
const CENTER_LEFT_INDEX = 11;
const CENTER_RIGHT_INDEX = 13;

const encoder = new TextEncoder();

/**
 * Schlüssel-Muster (5×5, spiegelsymmetrisch): Menschen vergleichen das Muster auf beiden Handys.
 * Kontakt: die beiden Schlüssel sortiert, aneinandergehängt → SHA-256.
 * Eigenes Muster: die `install_id` → SHA-256.
 */
@Injectable({ providedIn: 'root' })
export class KeyPatternService {
  private readonly cache = new Map<string, boolean[]>();

  async forContact(contact: Contact): Promise<boolean[]> {
    const keys = [contact.sendingKey, contact.receivingKey].sort();
    return this.patternFor(keys.join(''));
  }

  async forInstall(installId: string): Promise<boolean[]> {
    return this.patternFor(installId);
  }

  private async patternFor(input: string): Promise<boolean[]> {
    const cached = this.cache.get(input);
    if (cached !== undefined) {
      return cached;
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input)));
    const pattern = toPattern(digest);
    this.cache.set(input, pattern);
    return pattern;
  }
}

/** 25 Zellen zeilenweise: Spalte 3 spiegelt Spalte 1, Spalte 4 spiegelt Spalte 0. */
function toPattern(bytes: Uint8Array): boolean[] {
  const cells = new Array<boolean>(GRID_SIZE * GRID_SIZE).fill(false);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < HALF_COLUMNS; x++) {
      const on = (bytes[y * HALF_COLUMNS + x] & 1) === 1;
      cells[y * GRID_SIZE + x] = on;
      cells[y * GRID_SIZE + (GRID_SIZE - 1 - x)] = on;
    }
  }
  if (cells.filter((on) => on).length < MIN_ON_CELLS) {
    cells[CENTER_INDEX] = true;
    cells[CENTER_LEFT_INDEX] = true;
    cells[CENTER_RIGHT_INDEX] = true;
  }
  return cells;
}
