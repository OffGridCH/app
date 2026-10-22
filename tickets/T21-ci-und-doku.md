# T21 – CI-Checks (lokal + GitHub Actions) und Doku-Grundgerüst (MkDocs → GitHub Pages)

**Abhängig von:** T00
**Skills:** `offgrid-docs`, `offgrid-architecture`, `offgrid-testing`
**Dateien:** `package.json` (nur `scripts` und devDependency `playwright`), `.gitignore` (anhängen), `requirements-docs.txt`, `mkdocs.yml`, `doku/**`,
`.github/workflows/ci.yml`, `.github/workflows/pages.yml`

## Ziel
Dieselben Prüfungen laufen lokal (`npm run check`, `npm run docs:build`) und automatisch bei jedem PR gegen `main`.
Die Doku-Website wird bei jedem Merge auf `main` auf GitHub Pages veröffentlicht.

## Umfang (Inhalte exakt so)

1. `package.json` → `scripts` ergänzen (bestehende behalten):
   ```json
   "check": "npm run lint && npm run test:ci && npm run build",
   "docs:install": "python3 -m venv .venv-docs && .venv-docs/bin/pip install -r requirements-docs.txt",
   "docs:build": ".venv-docs/bin/mkdocs build --strict",
   "docs:serve": ".venv-docs/bin/mkdocs serve -a 0.0.0.0:8000",
   "docs:screens": "node tools/screens.mjs"
   ```
   Dazu `npm install -D playwright` und `npx playwright install chromium` (falls der Browser auf der VM noch fehlt).
   `tools/screens.mjs` liegt bereits im Repo und wird **nicht** verändert.
2. `.gitignore` anhängen: `.venv-docs/` und `site/`.
3. `requirements-docs.txt`:
   ```
   mkdocs-material>=9.6,<10
   ```
4. `mkdocs.yml`:
   ```yaml
   site_name: OffGrid – Frontend-Dokumentation
   site_description: Offline-Chat über LoRa – Ionic/Angular/Capacitor-App
   docs_dir: doku
   site_dir: site
   theme:
     name: material
     language: de
     logo: assets/logo.svg
     favicon: assets/logo.svg
     palette:
       scheme: slate
       primary: custom
       accent: custom
     font: false
     features:
       - navigation.sections
       - navigation.top
       - navigation.footer
       - search.highlight
       - content.code.copy
       - toc.follow
   extra_css:
     - stylesheets/extra.css
   markdown_extensions:
     - admonition
     - attr_list
     - tables
     - toc:
         permalink: true
     - pymdownx.details
     - pymdownx.highlight
     - pymdownx.inlinehilite
     - pymdownx.superfences:
         custom_fences:
           - name: mermaid
             class: mermaid
             format: !!python/name:pymdownx.superfences.fence_code_format
   nav:
     - Start: index.md
     - Erste Schritte: erste-schritte.md
     - Architektur:
         - Überblick: architektur/ueberblick.md
         - Datenmodell: architektur/datenmodell.md
         - Services: architektur/services.md
     - Funktionen:
         - Antenne: funktionen/antenne.md
         - Nachrichten: funktionen/nachrichten.md
         - Kontakte & Handshake: funktionen/kontakte-handshake.md
         - Standort: funktionen/standort.md
         - Backup: funktionen/backup.md
     - Oberfläche:
         - Design-System: oberflaeche/design-system.md
         - Screens: oberflaeche/screens.md
     - Protokoll:
         - Serial (App ↔ Antenne): protokoll/serial.md
         - Funk-Frames: protokoll/funk-frames.md
     - Qualität:
         - Tests: qualitaet/tests.md
         - CI: qualitaet/ci.md
     - Änderungen: aenderungen.md
   ```
5. `doku/stylesheets/extra.css`:
   ```css
   [data-md-color-scheme="slate"] {
     --md-default-bg-color: #0F1115;
     --md-default-fg-color: #EEF0F5;
     --md-default-fg-color--light: #C5CAD6;
     --md-primary-fg-color: #13161B;
     --md-primary-bg-color: #EEF0F5;
     --md-accent-fg-color: #9DB4FF;
     --md-typeset-a-color: #9DB4FF;
     --md-code-bg-color: #1A1D24;
   }
   ```
   `doku/assets/logo.svg` = Kopie von `docs/design/logo/offgrid-mark.svg`.
6. Alle Seiten aus `offgrid-docs` §2 anlegen. Inhalt jetzt: Titel `# …` plus `!!! info "Geplant"` mit dem Ticket, das die
   Seite füllt (Tabelle §4). **Ausnahmen, die jetzt schon echt befüllt werden:** `index.md` (Was ist OffGrid + Tabelle
   „Stand der Funktionen“), `erste-schritte.md`, `architektur/ueberblick.md` (Stand nach T00), `qualitaet/ci.md`,
   `aenderungen.md` (Einträge für T00 und T21).
7. `.github/workflows/ci.yml`:
   ```yaml
   name: CI
   on:
     pull_request:
       branches: [main]
     push:
       branches: [main]
   jobs:
     app-checks:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '24'
             cache: npm
         - run: npm ci
         - run: npm run lint
         - run: npm run test:ci
         - run: npm run build
     docs-check:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: '3.12'
         - run: pip install -r requirements-docs.txt
         - run: mkdocs build --strict
   ```
8. `.github/workflows/pages.yml`:
   ```yaml
   name: Doku veröffentlichen
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: true
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: '3.12'
         - run: pip install -r requirements-docs.txt
         - run: mkdocs build --strict
         - uses: actions/upload-pages-artifact@v3
           with:
             path: site
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
9. `npm run docs:install` (einmalig), dann `npm run check`, `npm run docs:screens` (Screens, die es schon gibt) und `npm run docs:build`.

## Akzeptanzkriterien
- [ ] `npm run check` und `npm run docs:build` laufen lokal fehlerfrei.
- [ ] Workflow-Dateien exakt wie oben.
- [ ] Alle Seiten aus `offgrid-docs` §2 existieren; `nav` entspricht der Struktur.
- [ ] Keine Änderung an `docs/` (Vorgaben-Ordner).

## Hinweis für den Planner
Dieses Ticket ist die Ausnahme zur Regel „`.github/**` nie ändern“. Der documenter-Schritt beginnt erst **nach** dem Merge
von T21; T21 selbst dokumentiert der Coder (Punkt 6).
