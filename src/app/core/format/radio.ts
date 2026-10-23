/** Frequenz in MHz als Text, z. B. 868100000 → „868“. */
export function formatMHz(freqHz: number): string {
  return String(Math.floor(freqHz / 1e6));
}
