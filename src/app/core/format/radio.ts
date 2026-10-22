// Funkformate. Quelle: Skill `offgrid-screens` §0.

/**
 * Frequenz in MHz als Text, z. B. `868100000` → „868“.
 * Überall verwenden, wo neben einer Frequenz „MHz“ steht.
 */
export function formatMHz(freqHz: number): string {
  return String(Math.floor(freqHz / 1e6));
}
