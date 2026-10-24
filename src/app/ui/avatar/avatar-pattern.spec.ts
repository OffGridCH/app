import { AVATAR_PATTERN_SIZE, avatarPattern } from './avatar-pattern';

/**
 * Tests für das Schlüssel-Muster (Profilbild) aus dem Seed.
 *
 * Quelle der Definition: Skill `offgrid-crypto-handshake` §4 (Schlüssel-Muster) und
 * Ticket T02 („`avatarPattern`: 25 Werte, spiegelsymmetrisch, gleicher Seed → gleiches
 * Raster, mindestens 5 Zellen an“).
 *
 * `crypto.subtle` wird **nicht** gemockt: `src/test-setup.ts` stellt die echte WebCrypto
 * von Node bereit, deshalb wird hier der echte SHA-256-Pfad geprüft.
 */

/** Öffentlicher Schlüssel eines Kontakts (Base64-Text, Skill `offgrid-design-system` §4). */
const PUBLIC_KEY = 'k3F9dQm1rT7bX2ZpL8sWc0Ae4NvH6JgUyR5PiOdSlF1M=';

/** Install-ID des eigenen Geräts (Skill `offgrid-design-system` §4). */
const INSTALL_ID = '8f3c1d2e-9a4b-4c7d-8e1f-2a3b4c5d6e7f';

/** Seed mit Umlauten – prüft, dass die UTF-8-Bytes des Seeds gehasht werden. */
const SEED_WITH_UMLAUT = 'Grüße';

/** Anzahl der getesteten Seeds (`seed-0` bis `seed-200`). */
const SEED_RANGE = 200;

/**
 * Bekanntes Raster zum leeren Seed (Known Answer Test).
 *
 * SHA-256 des leeren Strings ist
 * `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Daraus folgt
 * nach der Skill-Definition (`bytes[y * 3 + x] & 1`, Spalte 3 = Spalte 1, Spalte 4 =
 * Spalte 0) das Raster unten. Es hat neun aktive Zellen und wird deshalb nicht
 * aufgefüllt.
 */
const EMPTY_SEED_PATTERN: boolean[] = [
  true, false, false, false, true,
  false, false, false, false, false,
  false, false, false, false, false,
  true, false, false, false, true,
  true, true, true, true, true,
];

/**
 * Bildet das Rohraster nach der Skill-Definition: SHA-256 über die UTF-8-Bytes des Seeds,
 * Zelle (Zeile `y`, Spalte `x`) = `(bytes[y * 3 + x] & 1) === 1`, Spalte 3 = Spalte 1,
 * Spalte 4 = Spalte 0.
 *
 * Nutzt die echte WebCrypto aus `src/test-setup.ts`.
 */
async function rawPattern(seed: string): Promise<boolean[]> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return patternOfBytes(new Uint8Array(digest));
}

/** Wandelt Hash-Bytes in ein 5×5-Raster (Zeilen von oben, links nach rechts). */
function patternOfBytes(bytes: Uint8Array): boolean[] {
  const cells = new Array<boolean>(AVATAR_PATTERN_SIZE).fill(false);

  for (let row = 0; row < 5; row++) {
    const offset = row * 5;
    for (let column = 0; column < 3; column++) {
      cells[offset + column] = (bytes[row * 3 + column] & 1) === 1;
    }
    cells[offset + 3] = cells[offset + 1];
    cells[offset + 4] = cells[offset + 0];
  }

  return cells;
}

/** Anzahl der aktiven Zellen. */
function countActive(cells: boolean[]): number {
  return cells.reduce((sum, cell) => sum + (cell ? 1 : 0), 0);
}

/** Die Seeds `seed-0` bis `seed-200`. */
function seedsInRange(): string[] {
  return Array.from({ length: SEED_RANGE + 1 }, (_unused, index) => `seed-${index}`);
}

describe('avatarPattern', () => {
  it('rechnet mit der echten WebCrypto aus dem Test-Setup', () => {
    expect(globalThis.crypto).toBeDefined();
    expect(typeof globalThis.crypto.subtle.digest).toBe('function');
  });

  it('liefert 25 Werte', async () => {
    expect(AVATAR_PATTERN_SIZE).toBe(25);
    expect(await avatarPattern(INSTALL_ID)).toHaveLength(AVATAR_PATTERN_SIZE);
  });

  it('liefert für einen leeren Seed ebenfalls 25 Werte', async () => {
    expect(await avatarPattern('')).toHaveLength(AVATAR_PATTERN_SIZE);
  });

  it('berechnet das Muster aus SHA-256 über die UTF-8-Bytes des Seeds', async () => {
    expect(await avatarPattern('')).toEqual(EMPTY_SEED_PATTERN);
  });

  it('bildet das Rohraster nach der Skill-Definition ab', async () => {
    for (const seed of [PUBLIC_KEY, INSTALL_ID, 'install_id', 'group_key', SEED_WITH_UMLAUT, 'a']) {
      const raw = await rawPattern(seed);
      expect(countActive(raw), `${seed}, aktive Rohzellen`).toBeGreaterThanOrEqual(5);
      expect(await avatarPattern(seed), seed).toEqual(raw);
    }
  });

  it('hasht die UTF-8-Bytes und nicht die Latin-1-Bytes des Seeds', async () => {
    const pattern = await avatarPattern(SEED_WITH_UMLAUT);

    const utf8Bytes = new Uint8Array(
      await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(SEED_WITH_UMLAUT)),
    );
    expect(pattern).toEqual(patternOfBytes(utf8Bytes));

    const latin1Bytes = new Uint8Array(
      await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array([0x47, 0x72, 0xfc, 0x73, 0x65])),
    );
    expect(pattern).not.toEqual(patternOfBytes(latin1Bytes));
  });

  it('ist spiegelsymmetrisch (Spalte 0 gleich 4, Spalte 1 gleich 3)', async () => {
    const pattern = await avatarPattern(PUBLIC_KEY);

    for (let row = 0; row < 5; row++) {
      const offset = row * 5;
      expect(pattern[offset]).toBe(pattern[offset + 4]);
      expect(pattern[offset + 1]).toBe(pattern[offset + 3]);
    }
  });

  it('ist für viele Seeds spiegelsymmetrisch', async () => {
    for (const seed of seedsInRange()) {
      const pattern = await avatarPattern(seed);

      for (let row = 0; row < 5; row++) {
        const offset = row * 5;
        expect(pattern[offset], `${seed}, Zeile ${row}, Spalte 0/4`).toBe(pattern[offset + 4]);
        expect(pattern[offset + 1], `${seed}, Zeile ${row}, Spalte 1/3`).toBe(pattern[offset + 3]);
      }
    }
  });

  it('hält das Spiegelpaar 11/13 für viele Seeds zusammen', async () => {
    for (const seed of seedsInRange()) {
      const pattern = await avatarPattern(seed);

      expect(pattern[11], `${seed}, Zelle 11/13`).toBe(pattern[13]);
    }
  });

  it('liefert für denselben Seed dasselbe Raster', async () => {
    expect(await avatarPattern(PUBLIC_KEY)).toEqual(await avatarPattern(PUBLIC_KEY));
  });

  it('liefert für verschiedene Seeds verschiedene Raster', async () => {
    const seeds = [PUBLIC_KEY, INSTALL_ID, 'install_id', 'group_key', SEED_WITH_UMLAUT, 'a'];
    const patterns = await Promise.all(seeds.map((seed) => avatarPattern(seed)));

    for (let first = 0; first < seeds.length; first++) {
      for (let second = first + 1; second < seeds.length; second++) {
        expect(patterns[first], `${seeds[first]} / ${seeds[second]}`).not.toEqual(patterns[second]);
      }
    }
  });

  it('schaltet mindestens fünf Zellen an', async () => {
    for (const seed of ['', 'a', 'install_id', 'group_key', INSTALL_ID, PUBLIC_KEY]) {
      const pattern = await avatarPattern(seed);
      expect(countActive(pattern), seed).toBeGreaterThanOrEqual(5);
    }

    for (const seed of seedsInRange()) {
      const pattern = await avatarPattern(seed);
      expect(countActive(pattern), seed).toBeGreaterThanOrEqual(5);
    }
  });

  it('füllt nur auf, wenn das Rohraster weniger als fünf aktive Zellen hat', async () => {
    let unchanged = 0;
    let filled = 0;

    for (const seed of seedsInRange()) {
      const raw = await rawPattern(seed);
      const pattern = await avatarPattern(seed);

      if (countActive(raw) >= 5) {
        expect(pattern, `${seed}, Raster bleibt unverändert`).toEqual(raw);
        unchanged++;
        continue;
      }

      filled++;
      expect(pattern, `${seed}, Raster wurde aufgefüllt`).not.toEqual(raw);
      for (let index = 0; index < AVATAR_PATTERN_SIZE; index++) {
        if (raw[index]) {
          expect(pattern[index], `${seed}, Zelle ${index} bleibt an`).toBe(true);
        }
      }
    }

    expect(unchanged, 'Seeds ohne Auffüllung').toBeGreaterThan(0);
    expect(filled, 'Seeds mit Auffüllung').toBeGreaterThan(0);
  });

  it('setzt bei weniger als fünf aktiven Zellen die Zellen 11, 12 und 13', async () => {
    let sparse = 0;

    for (const seed of seedsInRange()) {
      const raw = await rawPattern(seed);
      if (countActive(raw) >= 5) {
        continue;
      }

      sparse++;
      const pattern = await avatarPattern(seed);
      expect(pattern[11], `${seed}, Zelle 11`).toBe(true);
      expect(pattern[12], `${seed}, Zelle 12`).toBe(true);
      expect(pattern[13], `${seed}, Zelle 13`).toBe(true);
      expect(countActive(pattern), `${seed}, aktive Zellen`).toBeGreaterThanOrEqual(5);
    }

    expect(sparse, 'Seeds mit weniger als fünf aktiven Rohzellen').toBeGreaterThan(0);
  });
});
