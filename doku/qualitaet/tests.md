# Tests

Stand: **nach T01, T03**. Der Test-Runner ist Vitest mit jsdom über den Angular-Builder. Einmal, headless:
`npm run test:ci`. WebCrypto kommt aus dem Node-Modul `node:crypto` und wird in `src/test-setup.ts` bereitgestellt.

Jede Testdatei (`*.spec.ts`) liegt neben dem Code, den sie prüft.

| Testdatei | Prüft |
|---|---|
| `src/app/app.component.spec.ts` | Die App-Komponente wird erstellt (T00). |
| `src/app/ui/index.spec.ts` | die og-Grundkomponenten: der Barrel `src/app/ui/index.ts` exportiert alle 13 Komponenten, `og-button` rendert ein `<button>` und meldet Klicks, `og-link-button` ein `<a>` mit `routerLink`, `og-icon-button` je nach Route ein `<button>` oder ein `<a>`, `og-switch` die Rolle `switch` mit `aria-checked`, `og-segmented` eine `tablist` mit `aria-selected`, `og-text-field` die Zwei-Wege-Bindung des Werts und `og-icon` die Standardgrösse des gewählten Namens (T01) |
| `src/app/core/format/time.spec.ts` | `formatTime`, `formatListTime`, `formatLastSeen`, `formatDay`: 24-Stunden-Format, „Gestern“, kurzer Wochentag, Datum, Sommerzeit, Zeitumstellung im Frühling und Herbst und der Kalendertag in `Europe/Zurich` statt UTC. |
| `src/app/core/format/radio.spec.ts` | `formatMHz`: `868100000` → „868“ und Abrunden nach unten. |
| `src/app/core/crypto/hex.spec.ts` | `toHex` und `fromHex`: Hin- und Rückweg ohne Verlust, leere Eingabe, Hex in Kleinbuchstaben, Fehler bei ungültigem Hex. |
| `src/app/core/crypto/base64.spec.ts` | `toBase64` und `fromBase64`: Hin- und Rückweg ohne Verlust, leere Eingabe. |
| `src/app/core/crypto/crypto.service.spec.ts` | `CryptoService`: Schlüssellänge und -format, `randomHex`, Verschlüsseln und Entschlüsseln, neuer IV je Verschlüsselung, Fehler bei falschem Schlüssel und bei falschem AAD, der Tag aus SHA-256 und sein Cache. |
| `src/app/core/crypto/key-pattern.service.spec.ts` | `KeyPatternService`: 25 Zellen, Spiegelsymmetrie, gleiches Muster bei vertauschten Schlüsseln, anderes Muster bei anderen Schlüsseln, Auffüllen bei fast leerem Muster, gleiche `install_id` → gleiches Muster. |
| `src/app/core/messaging/limits.spec.ts` | `contentBytes` (UTF-8-Bytes, Umlaute, ohne JSON-Escapes), `maxContentBytes` (83-Byte-Gerätelimit und 33-Byte-Frame-Overhead) und `isValidDisplayName` (1–24 UTF-8-Bytes, Trimmen). |
| `src/app/core/messaging/signal.spec.ts` | `signalLevel` (Schwellen, fehlende Kontaktdaten, 15-Minuten-Frist) und `signalLabel` (die fünf Texte). |

Die Spec-Dateien prüfen die reinen Funktionen und Services ohne Oberfläche. Tests für die Seiten kommen mit den
Tickets, die die Screens bauen (T09 bis T13).
