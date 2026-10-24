# Änderungen

## T02 – UI-Basis 2: Zustandskomponenten
*2026-10-24*

- Neun Zustandskomponenten liegen unter `src/app/ui/`: `og-avatar`, `og-signal-bars`, `og-banner` mit Aktion und Hinweis,
  `og-step-list`, `og-message-bubble`, `og-composer` und `og-qr`. Der Barrel `src/app/ui/index.ts` exportiert sie zusammen mit ihren Typen.
- `og-avatar` zeigt ein 5 × 5-Schlüsselraster in fünf Grössen und im Zustand `pending`. `avatarPattern(seed)` erzeugt
  deterministisch 25 spiegelsymmetrische Zellwerte mit mindestens fünf aktiven Zellen.
- `og-signal-bars` zeigt die Stufen 0 bis 4 in den Grössen `md` und `sm`. `og-step-list` unterstützt die Zustände
  `done`, `active` und `todo` mit Puls oder Spinner; bei reduzierter Bewegung sind die Animationen ausgeschaltet.
- `og-message-bubble` bildet eingehende und ausgehende Nachrichten in den Zuständen `queued`, `sent`, `delivered` und
  `failed` ab. Der fehlgeschlagene Zustand bietet „Erneut senden“ und löst `retry` aus.
- `og-composer` zählt Bytes ausschliesslich über den Input `countBytes`, sperrt leere oder zu lange Texte standardmässig
  und sendet mit Enter. Mit `blockOverLimit=false` bleibt das Senden bei einer Überschreitung möglich.
- `og-qr` erzeugt aus `data` ein SVG-Raster mit dem Paket `qrcode` und den Typen aus `@types/qrcode`. Die benötigten
  Farbwerte sind als einzige Hex-Ausnahme in `ui/qr/qr-colors.ts` ausgelagert.

## T23 – Protokoll auf Offgrid Link v1 umgestellt
*2026-10-24*

- Die Antenne (Heltec V3) besitzt jetzt Identität, Kontaktschlüssel, Verschlüsselung, Zähler und Kontaktliste. Die App ist Oberfläche und Verlaufsspeicher und spricht
  die Host-API „Offgrid Link v1“ (JSON Lines über USB-Serial). Verbindliche Quelle sind die Spezifikationen des Firmware-Teams; `docs/esp-schnittstelle.md` verweist darauf.
- Neu: `SerialClient` (Zeilen, `id`s, höchstens 4 Anfragen in Flight, Zeitlimits 2 s und 5 s, `sys.hello` alle 500 ms, Heartbeat alle 5 s), `AntennaPort` mit den
  Zuständen `disconnected`, `unprovisioned`, `locked` und `unlocked` sowie das Mock-Gerät `MockDevice`, das für den Browser dieselben Befehle, Antworten und Ereignisse liefert.
- Neu: `KeystoreService` hält das Entsperr-Geheimnis (Android Keystore bzw. Arbeitsspeicher im Browser). Das Token wird mit X25519, HKDF und AES-256-GCM zu 60 Bytes verpackt und
  stimmt mit dem Testvektor der Spezifikation überein. Das native Plugin folgt mit T06.
- Nachrichten gehen als Klartext über `msg.send`; längere Texte als 83 Bytes teilt die App in mehrere Nachrichten. Der Status kommt aus `msg.status`, eingehende Nachrichten
  aus `msg.received`. `maxContentBytes` gibt das gemeldete Limit unverändert zurück.
- Das Pairing macht die Antenne: `pair.begin` liefert den QR-Text, `pair.complete` den Kontakt samt Fingerabdruck. Der Fingerabdruck ersetzt das frühere Vergleichsbild.
- Die Datenbank hat kein Schlüssel-Feld mehr: `contacts` spiegelt die Kontakte der Antenne, `messages` hat `ctr` und `msg_ref` statt der Funk-Id, die Tabelle `handshakes` entfällt.
  Migration 1 wurde dafür einmalig umgeschrieben (noch keine veröffentlichte App).
- Entfernt: die App-seitige Verschlüsselung von Nachrichten und das Vergleichsbild aus Schlüsseln. Skills und Doku wurden auf den neuen Vertrag umgestellt.

## T04 – Datenbank, Repositories, Settings, App-Start
*2026-10-24*

- Auf Android speichert die App Kontakte, Nachrichten, Koordinaten, Handshakes und Einstellungen in der SQLite-Datenbank
  `offgrid`. (Die Tabelle für Handshakes entfiel mit T23.) Migration 1 legt das Schema fest; `PRAGMA user_version` steuert spätere Migrationen.
- Im Browser arbeiten dieselben Repositories auf Daten im Arbeitsspeicher. Die Plattform-Weiche in `app.config.ts`
  wählt SQLite oder Memory und stellt für jede Variante dieselbe Instanz bereit.
- Kontakte, Nachrichten, Koordinaten, Handshakes und Einstellungen haben jeweils ein abstraktes Repository sowie eine
  SQLite- und eine Memory-Implementierung. Das Löschen eines Kontakts entfernt in beiden Varianten seine Nachrichten
  und Koordinaten.
- Der Browser startet mit Demo-Kontakten und sechs Nachrichten (mit T23: vier Kontakte, „Jonas Keller“ ist ausstehend). Mit
  `localStorage og.noseed = '1'` startet er leer. `DataChangedService` meldet Datenänderungen über eine Version.
- `SettingsService` stellt Anzeigename, Install-Id, Hintergrundempfang, Vibration und Onboarding-Status bereit. Die
  Install-Id wird beim ersten Start erzeugt und danach weiterverwendet.
- Der App-Start öffnet die Datenbank, lädt die Einstellungen und bereitet auf Android Statusleiste und Splashscreen
  vor. Der Antennenstart kam mit T23 dazu.

## T03 – Zeitformate, Hex/Base64, Signal-Level
*2026-10-23*

- Alle Zeiten der App werden in der Zeitzone `Europe/Zurich` formatiert: Uhrzeit, „Gestern“, Wochentag, Datum für die
  Tagestrenner im Chat und „zuletzt …“ in der Kontaktliste.
- Die Frequenz der Antenne erscheint als MHz-Text (z. B. „868 MHz“).
- Hex- und Base64-Hilfen für Bytes. (Die ursprünglich gebauten Dienste für Schlüssel und Vergleichsbild entfielen mit T23, weil die Antenne
  Schlüssel und Verschlüsselung übernimmt.)
- Die Signalstärke wird aus Feldstärke und letztem Kontakt zu fünf Leveln; ein Signal älter als 15 Minuten zählt als
  „Ausser Reichweite“.
- Die Länge von Texten und Anzeigenamen wird in UTF-8-Bytes ohne JSON-Escapes gerechnet. Der Gerätevertrag
  „OffGrid Link“ setzt maximal 83 Bytes für Textinhalte (§7.5) und 24 Bytes für Anzeigenamen (§7.2/§7.3).

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
