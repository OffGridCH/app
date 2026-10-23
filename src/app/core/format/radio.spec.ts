import { formatMHz } from './radio';

describe('formatMHz', () => {
  it('zeigt die Frequenz in MHz', () => {
    expect(formatMHz(868100000)).toBe('868');
  });

  it('rundet nach unten', () => {
    expect(formatMHz(915000000)).toBe('915');
  });
});
