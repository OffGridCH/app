# Änderungen

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
