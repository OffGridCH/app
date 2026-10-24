/**
 * Schlüssel-Muster (Profilbild) aus einem Seed.
 *
 * Das Muster ist ein 5×5-Raster mit 25 Werten (Zeilen von oben, links nach rechts).
 * Jede Zeile ist spiegelsymmetrisch: Spalte 0 gleich Spalte 4, Spalte 1 gleich Spalte 3.
 * Gleicher Seed ergibt immer dasselbe Raster.
 */

/** Kantenlänge des Rasters (Zeilen und Spalten). */
const GRID = 5;

/** Anzahl der Werte des Musters (25). */
export const AVATAR_PATTERN_SIZE = GRID * GRID;

/** Mindestzahl aktiver Zellen. */
const MIN_ACTIVE_CELLS = 5;

/** Schwellwert des Pseudozufalls (0 bis 1), ab dem eine Zelle aktiv ist. */
const THRESHOLD = 0.45;

/** Modulus des linearen Kongruenzgenerators. */
const MODULUS = 233280;

/**
 * Deterministischer Pseudozufall (linearer Kongruenzgenerator) wie in der Design-Referenz.
 * Gleicher Seed ergibt immer dieselbe Folge.
 */
function createRandom(seed: number): () => number {
  let state = Math.trunc(seed) % MODULUS;
  if (state < 0) {
    state += MODULUS;
  }
  return () => {
    state = (state * 9301 + 49297) % MODULUS;
    return state / MODULUS;
  };
}

/**
 * Füllt das Muster so auf, dass mindestens fünf Zellen aktiv sind.
 * Die mittlere Spalte ist ihre eigene Spiegelung – die Symmetrie bleibt erhalten.
 */
function ensureMinimum(cells: boolean[]): void {
  let active = cells.reduce((sum, cell) => sum + (cell ? 1 : 0), 0);
  for (let row = 0; row < GRID && active < MIN_ACTIVE_CELLS; row++) {
    const index = row * GRID + 2;
    if (!cells[index]) {
      cells[index] = true;
      active++;
    }
  }
}

/**
 * Erzeugt das Schlüssel-Muster zu einem Seed.
 *
 * @param seed Startwert des Generators (gleicher Seed → gleiches Muster).
 * @returns 25 Werte, Zeilen von oben, links nach rechts; `true` = Zelle ist an.
 */
export function avatarPattern(seed: number): boolean[] {
  const random = createRandom(seed);
  const cells = new Array<boolean>(AVATAR_PATTERN_SIZE).fill(false);

  for (let row = 0; row < GRID; row++) {
    const left = random() > THRESHOLD;
    const middle = random() > THRESHOLD;
    const center = random() > THRESHOLD;
    const offset = row * GRID;
    cells[offset] = left;
    cells[offset + 1] = middle;
    cells[offset + 2] = center;
    cells[offset + 3] = middle;
    cells[offset + 4] = left;
  }

  ensureMinimum(cells);
  return cells;
}
