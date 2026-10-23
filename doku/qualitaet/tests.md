# Tests

Stand: **nach T01, T03, T04**. Der Test-Runner ist Vitest mit jsdom über den Angular-Builder. Einmal, headless:
`npm run test:ci`. WebCrypto kommt aus dem Node-Modul `node:crypto` und wird in `src/test-setup.ts` bereitgestellt.

Jede Testdatei (`*.spec.ts`) liegt neben dem Code, den sie prüft.

| Testdatei | Prüft |
|---|---|
| `src/app/app.component.spec.ts` | Die App-Komponente wird mit den Datenbank- und Repository-Providern aus `app.config.ts` erstellt. |
| `src/app/ui/index.spec.ts` | die og-Grundkomponenten: der Barrel `src/app/ui/index.ts` exportiert alle 13 Komponenten, `og-button` rendert ein `<button>` und meldet Klicks, `og-link-button` ein `<a>` mit `routerLink`, `og-icon-button` je nach Route ein `<button>` oder ein `<a>`, `og-switch` die Rolle `switch` mit `aria-checked`, `og-segmented` eine `tablist` mit `aria-selected`, `og-text-field` die Zwei-Wege-Bindung des Werts und `og-icon` die Standardgrösse des gewählten Namens (T01) |
| `src/app/core/format/time.spec.ts` | `formatTime`, `formatListTime`, `formatLastSeen`, `formatDay`: 24-Stunden-Format, „Gestern“, kurzer Wochentag, Datum, Sommerzeit, Zeitumstellung im Frühling und Herbst und der Kalendertag in `Europe/Zurich` statt UTC. |
| `src/app/core/format/radio.spec.ts` | `formatMHz`: `868100000` → „868“ und Abrunden nach unten. |
| `src/app/core/crypto/hex.spec.ts` | `toHex` und `fromHex`: Hin- und Rückweg ohne Verlust, leere Eingabe, Hex in Kleinbuchstaben, Fehler bei ungültigem Hex. |
| `src/app/core/crypto/base64.spec.ts` | `toBase64` und `fromBase64`: Hin- und Rückweg ohne Verlust, leere Eingabe. |
| `src/app/core/crypto/crypto.service.spec.ts` | `CryptoService`: Schlüssellänge und -format, `randomHex`, Verschlüsseln und Entschlüsseln, neuer IV je Verschlüsselung, Fehler bei falschem Schlüssel und bei falschem AAD, der Tag aus SHA-256 und sein Cache. |
| `src/app/core/crypto/key-pattern.service.spec.ts` | `KeyPatternService`: 25 Zellen, Spiegelsymmetrie, gleiches Muster bei vertauschten Schlüsseln, anderes Muster bei anderen Schlüsseln, Auffüllen bei fast leerem Muster, gleiche `install_id` → gleiches Muster. |
| `src/app/core/messaging/limits.spec.ts` | `contentBytes` (UTF-8-Bytes, Umlaute, ohne JSON-Escapes), `maxContentBytes` (83-Byte-Gerätelimit und 33-Byte-Frame-Overhead) und `isValidDisplayName` (1–24 UTF-8-Bytes, Trimmen). |
| `src/app/core/messaging/signal.spec.ts` | `signalLevel` (Schwellen, fehlende Kontaktdaten, 15-Minuten-Frist) und `signalLabel` (die fünf Texte). |
| `src/app/core/app-start.service.spec.ts` | `AppStartService`: Der Demo-Seed läuft vor dem Laden der Einstellungen; die Seed-Einstellungen und drei Kontakte sowie sechs Nachrichten werden übernommen; mit `og.noseed = '1'` startet die App leer und erhält nur eine neue Install-Id. |
| `src/app/core/data/migrations.spec.ts` | Die Migrationen sind aufsteigend und eindeutig versioniert. Migration 1 enthält die Spalten, Indizes, Fremdschlüssel-Kaskaden und Wertebereiche der Tabellen `contacts`, `messages`, `coordinates`, `handshakes` und `settings`. Laufzeitwerte werden als Parameter gebunden, und die INSERT-Statements haben passende Parameteranzahlen. |
| `src/app/core/data/memory/memory-database.service.spec.ts` | `MemoryDatabaseService`: leere Startwerte und fehlerfreies Öffnen; das Löschen eines Kontakts entfernt wie in SQLite dessen Nachrichten und Koordinaten; `seedDemo()` erzeugt drei Kontakte, sechs Nachrichten, eine ungelesene Nachricht, den offenen Handshake „Jonas Keller“ und keine Standortdaten; `deleteAllUserData()` lässt die Einstellungen stehen. |
| `src/app/core/settings/settings.service.spec.ts` | `SettingsService`: Erzeugen und Beibehalten der Install-Id, Standardwerte, Übernahme gespeicherter Werte, Speichern von Anzeigename, Hintergrundempfang und Vibration sowie das Abschliessen des Onboardings. |

Die Spec-Dateien prüfen die reinen Funktionen und Services ohne Oberfläche. Die Migrationen werden dabei statisch anhand
ihrer DDL und Parameter geprüft; das Verhalten der Repositories wird im Browser über die Memory-Implementierungen
getestet. Tests für die Seiten kommen mit den Tickets, die die Screens bauen (T09 bis T13).
