# Änderungen

Neuester Eintrag oben.

## T03 – Zeitformate, Krypto-Basis, Schlüssel-Muster, Signal-Level
*2026-10-22*

- Zeitformate in `src/app/core/format/time.ts`: Uhrzeit, Listenzeit („Gestern“, „Mo.“), letzter Empfang
  („zuletzt 14:32“, „noch nie empfangen“) und Tagestrenner („HEUTE“, „GESTERN“), alle in der Zeitzone
  `Europe/Zurich` und im Schweizer Format.
- Funktexte in `src/app/core/format/radio.ts`: Frequenz in MHz ohne Nachkommastellen.
- Krypto-Basis in `src/app/core/crypto/`: Schlüssel als 32 Hex-Zeichen, AES-GCM 128 mit 12-Byte-IV und
  Authentifizierungs-Tag, Tag aus den ersten 4 Byte SHA-256, Hex- und Base64-Umrechnung. Nur WebCrypto, keine Pakete.
- Schlüssel-Muster als Profilbild: 5 × 5 spiegelsymmetrisches Raster aus SHA-256 über die sortierten Schlüsselpaare,
  nie fast leer; zeigt in der Kontaktliste das Muster zumgegenüber, ohne Schlüssel abzutippen.
- Signalstärke je Kontakt: 0 bis 4 Balken aus dem RSSI, nach 15 Minuten ohne Kontakt wieder „Ausser Reichweite“,
  mit Klartexten für Screenreader.
- Textlängen: maximale Länge einer Nachricht im Frame (180 Byte, je nach Antennenlimit) und Prüfung von
  Anzeigenamen (höchstens 40 Zeichen und 60 Byte).
- Acht neue Testdateien mit 64 neuen Tests; zusammen mit T00 sind es 11 Testdateien und 72 Tests.

## T21 – CI-Checks und Doku-Grundgerüst (MkDocs, GitHub Pages)
*2026-10-22*

- Neuer Befehl `npm run check`: `lint` + `test:ci` + `build` in einem Lauf.
- GitHub Actions läuft bei jedem PR gegen `main` und bei jedem Push: Job `app-checks` (Lint, Tests, Build) und
  Job `docs-check` (MkDocs mit `--strict`).
- Neuer Workflow „Doku veröffentlichen“: baut die Doku und legt sie bei jedem Merge auf `main` auf GitHub Pages ab.
- Doku-Grundgerüst mit MkDocs Material im Ordner `doku/`: alle Seiten aus der Struktur sind angelegt, noch nicht
  gebaute Teile stehen als Hinweis „Geplant“ mit Ticket-Nummer.
- `npm run docs:screens` erzeugt Handy-Screenshots der gebauten Screens (Playwright).

## T00 – Projekt-Setup und Theme
*2026-10-22*

- Ionic-Starter mit Angular 22 (Standalone Components, Signals, zoneless) und Ionic 9 im Modus `md`.
- Design-Tokens in `src/theme/tokens.scss`: Farben, Radien, Abstände, Grössen; Schriften offline eingebunden
  (Schibsted Grotesk Variable, Geist Mono).
- Ordnerstruktur für `core/`, `ui/` und `features/` angelegt, Routen für alle Seiten, alle Seiten noch leer.
- Testlauf (Vitest + jsdom) mit echtem WebCrypto über `src/test-setup.ts`.
- Android-Gerüst mit Capacitor 8.