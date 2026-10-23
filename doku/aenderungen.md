# Änderungen

## T03 – Zeitformate, Krypto-Basis, Schlüssel-Muster, Signal-Level
*2026-10-23*

- Alle Zeiten der App werden in der Zeitzone `Europe/Zurich` formatiert: Uhrzeit, „Gestern“, Wochentag, Datum für die
  Tagestrenner im Chat und „zuletzt …“ in der Kontaktliste.
- Die Frequenz der Antenne erscheint als MHz-Text (z. B. „868 MHz“).
- `CryptoService` erzeugt Schlüssel, berechnet Tags (SHA-256) und verschlüsselt mit AES-GCM 128 – nur WebCrypto, ohne
  zusätzliche Pakete.
- `KeyPatternService` erzeugt aus den Schlüsseln eines Kontakts ein spiegelsymmetrisches 5×5-Muster, damit zwei
  Personen auf beiden Handys prüfen können, ob der Schlüsselaustausch geklappt hat.
- Die Signalstärke wird aus Feldstärke und letztem Kontakt zu fünf Leveln; ein Signal älter als 15 Minuten zählt als
  „Ausser Reichweite“.
- Die Länge von Texten und Anzeigenamen wird in Bytes gerechnet, damit eine Nachricht in einen Frame passt.

## T21 – CI-Checks (lokal + GitHub Actions) und Doku-Grundgerüst (MkDocs → GitHub Pages)
*2026-10-23*

- `npm run check` führt Lint, Tests und Build in einem Durchgang aus – derselbe Ablauf wie in der CI.
- GitHub Actions prüft jeden PR gegen `main` mit den Checks `app-checks` und `docs-check`.
- Nach jedem Merge auf `main` wird die Doku-Website auf GitHub Pages veröffentlicht.
- Die Doku liegt in `doku/` (MkDocs Material) mit Befehlen `npm run docs:install`, `docs:build`, `docs:serve` und
  `docs:screens`.
- Playwright ist als Entwicklungs-Abhängigkeit installiert und erzeugt die Screenshots der Screens für die Doku.

## T00 – Projekt-Setup und Theme
*2026-10-23*

- Leeres, lauffähiges Ionic-Angular-Capacitor-Projekt (Angular 22, Ionic 9, Capacitor 8) für Android, zoneless und
  mit Signalen.
- Dunkles OffGrid-Theme: die Design-Tokens in `src/theme/tokens.scss` sind die Quelle der Wahrheit für Farben,
  Radien, Abstände und Grössen.
- Alle Seiten und Routen der App sind als Stubs angelegt, ohne Texte und ohne Guard.
- Die Typen für Kontakt, Nachricht, Handshake, Antenne, Settings und Fehlercodes liegen in `src/app/core/models/`.
- Die drei Prüfbefehle `npm run lint`, `npm run test:ci` und `npm run build` laufen fehlerfrei.
