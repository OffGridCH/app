/**
 * Schlüssel-Muster (Profilbild) aus einem Seed.
 *
 * Das Muster ist ein 5×5-Raster mit 25 Werten (Zeilen von oben, links nach rechts).
 * Jede Zeile ist spiegelsymmetrisch: Spalte 0 gleich Spalte 4, Spalte 1 gleich Spalte 3.
 * Gleicher Seed ergibt immer dasselbe Raster.
 *
 * Quelle des Musters: Skill `offgrid-design-system` §4 (og-avatar).
 */

/** Kantenlänge des Rasters (Zeilen und Spalten). */
const GRID = 5;

/** Anzahl der Werte des Musters (25). */
export const AVATAR_PATTERN_SIZE = GRID * GRID;

/** Mindestzahl aktiver Zellen. */
const MIN_ACTIVE_CELLS = 5;

/**
 * Zellen, die der Skill zusätzlich setzt, wenn das Raster zu wenige aktive Zellen hat:
 * die Mitte von Zeile 2 (11 = Zeile 2/Spalte 1, 12 = Zeile 2/Spalte 2, 13 = Zeile 2/Spalte 3).
 *
 * 11 und 13 sind Spiegelbilder voneinander (Spalte 1 = Spalte 3) und werden deshalb immer
 * gemeinsam gesetzt. 12 ist die Mittelspalte und damit ihr eigenes Spiegelbild.
 */
const FILL_CENTRE_PAIR: readonly [number, number] = [11, 13];

/** Mittlere Zelle von Zeile 2 (Spalte 2) – eigenes Spiegelbild. */
const FILL_CENTRE_CELL = 12;

/**
 * Weitere spiegelsymmetrische Paare zum Auffüllen auf mindestens fünf aktive Zellen.
 * Jedes Paar besteht aus zwei Zellen, die Spiegelbilder voneinander sind
 * (Spalte 0 ↔ Spalte 4, Spalte 1 ↔ Spalte 3), damit die Symmetrie erhalten bleibt.
 */
const FILL_PAIRS: readonly (readonly [number, number])[] = [
  [6, 8],
  [16, 18],
  [1, 3],
  [21, 23],
  [0, 4],
  [20, 24],
  [5, 9],
  [15, 19],
  [10, 14],
];

/** Anzahl der aktiven Zellen. */
function countActive(cells: boolean[]): number {
  return cells.reduce((sum, cell) => sum + (cell ? 1 : 0), 0);
}

/**
 * Setzt ein Spiegelpaar immer gemeinsam: beide Zellen werden gesetzt oder beide bleiben leer.
 * Nur so bleibt die Spiegelung (Spalte 0 = Spalte 4, Spalte 1 = Spalte 3) in jeder Zeile
 * garantiert erhalten.
 *
 * @returns Anzahl der neu gesetzten Zellen.
 */
function setPair(cells: boolean[], left: number, right: number): number {
  let added = 0;
  if (!cells[left]) {
    cells[left] = true;
    added++;
  }
  if (!cells[right]) {
    cells[right] = true;
    added++;
  }
  return added;
}

/**
 * Füllt das Muster so auf, dass mindestens fünf Zellen aktiv sind.
 *
 * Zuerst setzt der Skill die Zellen 11, 12 und 13 (Mitte von Zeile 2), wenn das Raster
 * weniger als fünf aktive Zellen hat: 11 und 13 als Spiegelpaar, 12 separat. Es gibt
 * dabei keinen Abbruch – alle drei Zellen werden gesetzt, damit die Mitte von Zeile 2
 * vollständig ist und die Symmetrie gewahrt bleibt.
 *
 * Das allein garantiert aber keine fünf aktiven Zellen: die drei Zellen können schon
 * aktiv sein. Deshalb wird danach mit deterministischen, spiegelsymmetrischen Paaren
 * weitergesetzt, bis mindestens fünf Zellen aktiv sind. Da jede Zelle mit ihrem
 * Spiegelbild gemeinsam gesetzt wird, bleibt die Symmetrie erhalten.
 */
function ensureMinimum(cells: boolean[]): void {
  let active = countActive(cells);

  if (active < MIN_ACTIVE_CELLS) {
    active += setPair(cells, FILL_CENTRE_PAIR[0], FILL_CENTRE_PAIR[1]);
    if (!cells[FILL_CENTRE_CELL]) {
      cells[FILL_CENTRE_CELL] = true;
      active++;
    }
  }

  for (const [left, right] of FILL_PAIRS) {
    if (active >= MIN_ACTIVE_CELLS) {
      return;
    }
    active += setPair(cells, left, right);
  }
}

/**
 * Erzeugt das Schlüssel-Muster zu einem Seed.
 *
 * Der Hash wird mit SHA-256 über die UTF-8-Bytes des Seeds gebildet. Für Zeile `y` (0–4)
 * und Spalte `x` (0–2) ist die Zelle an, wenn `(bytes[y * 3 + x] & 1) === 1`;
 * Spalte 3 gleich Spalte 1 und Spalte 4 gleich Spalte 0 (spiegelsymmetrisch).
 *
 * Seed bei Kontakten: `contact.publicKey` (Base64-Text), eigenes Bild: `install_id`,
 * Gruppen (T20): `group_key`.
 *
 * @param seed Text, aus dem das Muster abgeleitet wird (gleicher Seed → gleiches Muster).
 * @returns 25 Werte, Zeilen von oben, links nach rechts; `true` = Zelle ist an.
 */
export async function avatarPattern(seed: string): Promise<boolean[]> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  const bytes = new Uint8Array(digest);
  const cells = new Array<boolean>(AVATAR_PATTERN_SIZE).fill(false);

  for (let row = 0; row < GRID; row++) {
    const offset = row * GRID;
    for (let column = 0; column < 3; column++) {
      cells[offset + column] = (bytes[row * 3 + column] & 1) === 1;
    }
    cells[offset + 3] = cells[offset + 1];
    cells[offset + 4] = cells[offset + 0];
  }

  ensureMinimum(cells);
  return cells;
}
