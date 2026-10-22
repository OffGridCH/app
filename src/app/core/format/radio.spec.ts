import { formatMHz } from './radio';

// Pflichttests laut Skill `offgrid-testing`: `formatMHz(868100000)` = „868“.

describe('formatMHz', () => {
  it('rundet 868100000 auf 868 ab', () => {
    expect(formatMHz(868100000)).toBe('868');
  });

  it('rundet immer ab, nie auf', () => {
    expect(formatMHz(868_999_999)).toBe('868');
    expect(formatMHz(869_000_000)).toBe('869');
  });

  it('liefert bei 1 GHz dreistellig', () => {
    expect(formatMHz(915_000_000)).toBe('915');
  });
});
