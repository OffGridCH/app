// Zusatzprüfungen des Testers für den Bereich T03 (Zeit, Krypto, Limits, Signal).
// Diese Datei prüft Eigenschaften quer über mehrere Module, die in den einzelnen
// Spec-Dateien nicht sinnvoll untergebracht werden können.
import { TestBed } from '@angular/core/testing';

import { KeyPatternService } from '../app/core/crypto/key-pattern.service';
import type { Contact } from '../app/core/models/contact';
import { contentBytes, maxContentBytes } from '../app/core/messaging/limits';
import { signalLevel } from '../app/core/messaging/signal';

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

describe('T03 – Eigenschaften über Module hinweg', () => {
  describe('Schlüsselmuster bleibt für viele Eingaben spiegelsymmetrisch', () => {
    let service: KeyPatternService;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [KeyPatternService] });
      service = TestBed.inject(KeyPatternService);
    });

    it('spiegelt jede Zeile für 100 verschiedene Eingaben', async () => {
      for (let i = 0; i < 100; i++) {
        const pattern = await service.forInstall(`install-${i}`);

        expect(pattern).toHaveLength(25);
        for (let row = 0; row < 5; row++) {
          expect(pattern[row * 5 + 0]).toBe(pattern[row * 5 + 4]);
          expect(pattern[row * 5 + 1]).toBe(pattern[row * 5 + 3]);
        }
      }
    });

    it('liefert für dasselbe Schlüsselpaar unabhängig von der Reihenfolge dasselbe Muster', async () => {
      const first = await service.forContact(contact('1'.repeat(32), '2'.repeat(32)));
      const second = await service.forContact(contact('2'.repeat(32), '1'.repeat(32)));

      expect(first).toEqual(second);
    });
  });

  describe('Rahmenbedingungen für Frames', () => {
    it('passt der erlaubte Text in einen Frame der angegebenen Grösse', () => {
      // 33 Byte Frame-Overhead + 36 Byte JSON-Hülle ohne Text = 69 Byte.
      for (const max of [100, 150, 222, 249, 255]) {
        expect(maxContentBytes(max) + 69).toBeLessThanOrEqual(max);
      }
    });

    it('rechnet die JSON-Escapes mit', () => {
      // Zeilenumbruch wird im JSON zu zwei Zeichen (\n), Anführungszeichen zu zwei (\").
      expect(contentBytes('a\nb')).toBe(4);
      expect(contentBytes('a"b')).toBe(4);
    });
  });

  describe('Signal-Level ist monoton in der Feldstärke', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    const seenAt = '2026-01-15T11:55:00.000Z';

    it('steigt mit stärkerem Signal nie ab', () => {
      let previous = signalLevel(-140, seenAt, now);

      for (let rssi = -139; rssi <= -40; rssi++) {
        const level = signalLevel(rssi, seenAt, now);
        expect(level).toBeGreaterThanOrEqual(previous);
        previous = level;
      }
    });

    it('fällt nach 15 Minuten auf 0', () => {
      const stale = new Date(now.getTime() - 15 * 60 * 1000 - 1).toISOString();

      expect(signalLevel(-60, seenAt, now)).toBe(4);
      expect(signalLevel(-60, stale, now)).toBe(0);
    });
  });
});
