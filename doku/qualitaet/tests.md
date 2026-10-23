# Tests

Die Tests laufen mit Vitest und jsdom über den Angular-Builder `@angular/build:unit-test` (`npm run test:ci`).
WebCrypto kommt aus dem Node-Modul `node:crypto` und wird in `src/test-setup.ts` bereitgestellt.

Jede Testdatei (`*.spec.ts`) liegt neben dem Code, den sie prüft.

| Testdatei | Prüft |
|---|---|
| `src/app/app.component.spec.ts` | Die App-Komponente wird erstellt (T00). |
| `src/app/core/format/time.spec.ts` | `formatTime`, `formatListTime`, `formatLastSeen`, `formatDay`: 24-Stunden-Format, „Gestern“, kurzer Wochentag, Datum, Sommerzeit, Zeitumstellung im Frühling und Herbst und der Kalendertag in `Europe/Zurich` statt UTC. |
| `src/app/core/format/radio.spec.ts` | `formatMHz`: `868100000` → „868“ und Abrunden nach unten. |
| `src/app/core/crypto/hex.spec.ts` | `toHex` und `fromHex`: Hin- und Rückweg ohne Verlust, leere Eingabe, Hex in Kleinbuchstaben, Fehler bei ungültigem Hex. |
| `src/app/core/crypto/base64.spec.ts` | `toBase64` und `fromBase64`: Hin- und Rückweg ohne Verlust, leere Eingabe. |
| `src/app/core/crypto/crypto.service.spec.ts` | `CryptoService`: Schlüssellänge und -format, `randomHex`, Verschlüsseln und Entschlüsseln, neuer IV je Verschlüsselung, Fehler bei falschem Schlüssel und bei falschem AAD, der Tag aus SHA-256 und sein Cache. |
| `src/app/core/crypto/key-pattern.service.spec.ts` | `KeyPatternService`: 25 Zellen, Spiegelsymmetrie, gleiches Muster bei vertauschten Schlüsseln, anderes Muster bei anderen Schlüsseln, Auffüllen bei fast leerem Muster, gleiche `install_id` → gleiches Muster. |
| `src/app/core/messaging/limits.spec.ts` | `contentBytes` (Umlaute und JSON-Escapes), `maxContentBytes` (222, 255 und kleinere Frames) und `isValidDisplayName` (Länge, Bytes, Trimmen). |
| `src/app/core/messaging/signal.spec.ts` | `signalLevel` (Schwellen, fehlende Kontaktdaten, 15-Minuten-Frist) und `signalLabel` (die fünf Texte). |
| `src/testing/verify-t03.spec.ts` | Zusatzprüfungen quer über mehrere Module: Spiegelsymmetrie über 100 Eingaben, Rahmenbedingungen für die Frame-Länge, monoton steigender Signal-Level. |

Die Spec-Dateien prüfen die reinen Funktionen und Services ohne Oberfläche. Tests für die Seiten kommen mit den
Tickets, die die Screens bauen (T09 bis T13).
