import { TestBed } from '@angular/core/testing';

import type { Contact } from '../models/contact';
import { KeyPatternService } from './key-pattern.service';

function contact(sendingKey: string, receivingKey: string): Contact {
  return {
    id: 'kontakt-1',
    sendingKey,
    receivingKey,
    displayName: 'Anna',
    firstName: null,
    lastName: null,
    handshakeAt: '2026-01-15T10:00:00.000Z',
    lastRssi: null,
    lastSeenAt: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: null,
  };
}

describe('KeyPatternService', () => {
  let service: KeyPatternService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [KeyPatternService] });
    service = TestBed.inject(KeyPatternService);
  });

  it('liefert 25 Zellen', async () => {
    const pattern = await service.forInstall('test');

    expect(pattern).toHaveLength(25);
  });

  it('ist spiegelsymmetrisch: Spalte 0 = Spalte 4 und Spalte 1 = Spalte 3', async () => {
    const pattern = await service.forInstall('test');

    for (let row = 0; row < 5; row++) {
      expect(pattern[row * 5 + 0]).toBe(pattern[row * 5 + 4]);
      expect(pattern[row * 5 + 1]).toBe(pattern[row * 5 + 3]);
    }
  });

  it('liefert für dieselben Schlüssel in anderer Reihenfolge dasselbe Muster', async () => {
    const first = await service.forContact(contact('a'.repeat(32), 'b'.repeat(32)));
    const second = await service.forContact(contact('b'.repeat(32), 'a'.repeat(32)));

    expect(first).toEqual(second);
  });

  it('liefert für verschiedene Schlüsselpaare verschiedene Muster', async () => {
    const first = await service.forContact(contact('a'.repeat(32), 'b'.repeat(32)));
    const second = await service.forContact(contact('a'.repeat(32), 'c'.repeat(32)));

    expect(first).not.toEqual(second);
  });

  it('setzt bei fast leerem Muster die Mittelzelle und die Zellen 11 und 13', async () => {
    const pattern = await service.forInstall('leer-231');

    expect(pattern[11]).toBe(true);
    expect(pattern[12]).toBe(true);
    expect(pattern[13]).toBe(true);
    expect(pattern.filter((on) => on)).toHaveLength(6);
  });

  it('liefert für dieselbe install_id immer dasselbe Muster', async () => {
    const first = await service.forInstall('leer-144');
    const second = await service.forInstall('leer-144');

    expect(first).toEqual(second);
  });
});
