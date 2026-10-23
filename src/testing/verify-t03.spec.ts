import { TestBed } from '@angular/core/testing';

import { KeyPatternService } from '../app/core/crypto/key-pattern.service';
import { contentBytes, isValidDisplayName, maxContentBytes } from '../app/core/messaging/limits';
import { signalLevel } from '../app/core/messaging/signal';

describe('T03 – modulübergreifende Grundinvarianten', () => {
  it('hält die Grenzen von Name, Textinhalt, Schlüsselmuster und Signal konsistent', async () => {
    const name = 'ä'.repeat(12);
    expect(contentBytes(name)).toBe(24);
    expect(isValidDisplayName(name)).toBe(true);
    expect(maxContentBytes(222)).toBe(83);

    TestBed.configureTestingModule({ providers: [KeyPatternService] });
    const pattern = await TestBed.inject(KeyPatternService).forInstall('t03');
    expect(pattern).toHaveLength(25);
    for (let row = 0; row < 5; row++) {
      expect(pattern[row * 5 + 0]).toBe(pattern[row * 5 + 4]);
      expect(pattern[row * 5 + 1]).toBe(pattern[row * 5 + 3]);
    }

    const now = new Date('2026-01-15T12:00:00.000Z');
    const seenAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(signalLevel(-80, seenAt, now)).toBe(4);
  });
});
