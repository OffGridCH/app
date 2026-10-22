# Änderungen

Neuester Eintrag oben.

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