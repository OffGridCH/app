# Änderungen

## T04 – Datenbank, Repositories, Settings, App-Start
*2026-10-24*

- Auf Android speichert die App Kontakte, Nachrichten, Koordinaten, Handshakes und Einstellungen in der SQLite-Datenbank
  `offgrid`. Migration 1 legt das Schema fest; `PRAGMA user_version` steuert spätere Migrationen.
- Im Browser arbeiten dieselben Repositories auf Daten im Arbeitsspeicher. Die Plattform-Weiche in `app.config.ts`
  wählt SQLite oder Memory und stellt für jede Variante dieselbe Instanz bereit.
- Kontakte, Nachrichten, Koordinaten, Handshakes und Einstellungen haben jeweils ein abstraktes Repository sowie eine
  SQLite- und eine Memory-Implementierung. Das Löschen eines Kontakts entfernt in beiden Varianten seine Nachrichten
  und Koordinaten.
- Der Browser startet mit drei Demo-Kontakten, sechs Nachrichten und dem offenen Handshake „Jonas Keller“. Mit
  `localStorage og.noseed = '1'` startet er leer. `DataChangedService` meldet Datenänderungen über eine Version.
- `SettingsService` stellt Anzeigename, Install-Id, Hintergrundempfang, Vibration und Onboarding-Status bereit. Die
  Install-Id wird beim ersten Start erzeugt und danach weiterverwendet.
- Der App-Start öffnet die Datenbank, lädt die Einstellungen und bereitet auf Android Statusleiste und Splashscreen
  vor. Der Antennenstart folgt mit T05.

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
- Die Länge von Texten und Anzeigenamen wird in UTF-8-Bytes ohne JSON-Escapes gerechnet. Der Gerätevertrag
  „OffGrid Link“ setzt maximal 83 Bytes für Textinhalte (§7.5) und 24 Bytes für Anzeigenamen (§7.2/§7.3); der
  Frame-Overhead beträgt 33 Bytes.

## T01 – UI-Basis 1: Grundkomponenten
*2026-10-23*

- 13 `og-`-Grundkomponenten liegen unter `src/app/ui/`: Icon, Button, Link-Button, Icon-Button, Topbar,
  Abschnittstitel, Karte, Info-Zeile, Statuspunkt, Badge, Eingabefeld, Schalter und Segmentumschalter.
- Alle Komponenten sind Standalone, nutzen OnPush und kommen ohne Services aus; `src/app/ui/index.ts` exportiert
  sie alle.
- Farben, Radien und Grössen kommen ausschliesslich aus den Design-Tokens, die Schriften aus den
  Typografie-Mixins in `src/theme/typography.scss`.
- `og-button` rendert ein `<button>`, `og-link-button` und `og-icon-button` mit Route ein `<a>`.
- `og-switch` trägt die Rolle `switch`, `og-segmented` die Rolle `tablist` – beide mit den passenden
  ARIA-Attributen.
- Die Zustandskomponenten (Avatar, Signalbalken, Banner, Schrittliste, Nachrichtenblase, Composer, QR)
  folgen mit T02.

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
