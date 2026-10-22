import { TestBed } from '@angular/core/testing';

import { type Contact } from '../models/contact';

import { KeyPatternService } from './key-pattern.service';

// Pflichttests laut Skill `offgrid-testing`: 25 Werte; Spiegelung Spalte 0=4, 1=3;
// gleiche Schlüssel in anderer Reihenfolge → gleiches Muster.

const SCHLUESSEL_A = '000102030405060708090a0b0c0d0e0f';
const SCHLUESSEL_B = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';

function kontakt(sendingKey: string, receivingKey: string): Contact {
  return {
    id: 'kontakt-1',
    sendingKey,
    receivingKey,
    displayName: 'Anna',
    firstName: null,
    lastName: null,
    handshakeAt: '2026-10-01T10:00:00.000Z',
    lastRssi: -92,
    lastSeenAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: null,
  };
}

/** Muster nach der Regel aus Skill `offgrid-crypto-handshake` §4, unabhängig nachgerechnet. */
async function erwartetesMuster(eingabe: string): Promise<boolean[]> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(eingabe));
  const bytes = new Uint8Array(digest);
  const zellen: boolean[] = [];

  for (let zeile = 0; zeile < 5; zeile += 1) {
    for (let spalte = 0; spalte < 5; spalte += 1) {
      const index = spalte < 3 ? spalte : 4 - spalte;
      zellen.push((bytes[zeile * 3 + index] & 1) === 1);
    }
  }

  if (zellen.filter((an) => an).length < 5) {
    zellen[11] = true;
    zellen[12] = true;
    zellen[13] = true;
  }

  return zellen;
}

describe('KeyPatternService', () => {
  let service: KeyPatternService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeyPatternService);
  });

  it('liefert 25 Boolean-Werte', async () => {
    const muster = await service.forContact(kontakt(SCHLUESSEL_A, SCHLUESSEL_B));

    expect(muster).toHaveLength(25);
    expect(muster.every((zelle) => typeof zelle === 'boolean')).toBe(true);
  });

  it('ist spiegelsymmetrisch: Spalte 0 = 4 und Spalte 1 = 3', async () => {
    const muster = await service.forContact(kontakt(SCHLUESSEL_A, SCHLUESSEL_B));

    for (let zeile = 0; zeile < 5; zeile += 1) {
      expect(muster[zeile * 5]).toBe(muster[zeile * 5 + 4]);
      expect(muster[zeile * 5 + 1]).toBe(muster[zeile * 5 + 3]);
    }
  });

  it('hat nie weniger als 5 gesetzte Zellen', async () => {
    for (let lauf = 0; lauf < 40; lauf += 1) {
      const muster = await service.forInstall(`install-${lauf}`);

      expect(muster.filter((an) => an).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('gibt für beide Reihenfolgen der Schlüssel dasselbe Muster', async () => {
    const hin = await service.forContact(kontakt(SCHLUESSEL_A, SCHLUESSEL_B));
    const herum = await service.forContact(kontakt(SCHLUESSEL_B, SCHLUESSEL_A));

    expect(herum).toEqual(hin);
  });

  it('folgt der Regel aus dem Skill: SHA-256 über die sortierten Schlüssel, Spiegelung, Ausnahme', async () => {
    const eingabe = [SCHLUESSEL_A, SCHLUESSEL_B].sort().join('');

    expect(await service.forContact(kontakt(SCHLUESSEL_A, SCHLUESSEL_B))).toEqual(await erwartetesMuster(eingabe));
  });

  it('nutzt für das eigene Muster die install_id', async () => {
    const installId = '6f0a1b2c-3d4e-5f60-7182-93a4b5c6d7e8';

    expect(await service.forInstall(installId)).toEqual(await erwartetesMuster(installId));
  });

  it('liefert bei gleicher Eingabe immer dasselbe Muster, aber keine geteilte Liste', async () => {
    const muster = await service.forInstall('gleiche-id');
    const kopie = await service.forInstall('gleiche-id');

    expect(kopie).toEqual(muster);
    expect(kopie).not.toBe(muster);
  });

  it('gibt unterschiedlichen Kontakten unterschiedliche Muster', async () => {
    const erst = await service.forContact(kontakt(SCHLUESSEL_A, SCHLUESSEL_B));
    const zweit = await service.forContact(
      kontakt('11111111111111111111111111111111', '22222222222222222222222222222222'),
    );

    expect(zweit).not.toEqual(erst);
  });
});
