# CI

Dieselben Prüfungen laufen lokal und automatisch bei jedem PR gegen `main`.

## Lokal

| Befehl | Prüft |
|---|---|
| `npm run lint` | ESLint über `src/**/*.ts` und `src/**/*.html` |
| `npm run test:ci` | Tests einmal und headless (Vitest + jsdom, kein Browser nötig) |
| `npm run build` | Produktions-Build der App |
| `npm run check` | Lint, Tests und Build in einem Durchgang |
| `npm run docs:build` | Doku bauen: `mkdocs build --strict` |

`npm run check` ist der Befehl, den die CI ausführt. `npm run docs:build` braucht das virtuelle Python-Umfeld aus
`npm run docs:install` (`.venv-docs/`).

## GitHub Actions

| Datei | Job | Was | Wann |
|---|---|---|---|
| `.github/workflows/ci.yml` | `app-checks` | `npm ci`, Lint, Tests, Build | bei jedem PR gegen `main` und bei jedem Push auf `main` |
| `.github/workflows/ci.yml` | `docs-check` | `pip install -r requirements-docs.txt`, `mkdocs build --strict` | bei jedem PR gegen `main` und bei jedem Push auf `main` |
| `.github/workflows/pages.yml` | `build` | Doku bauen und als Artefakt hochladen | bei jedem Push auf `main` (auch manuell startbar) |
| `.github/workflows/pages.yml` | `deploy` | Artefakt auf GitHub Pages veröffentlichen | nach dem Job `build` |

Die Jobs laufen auf `ubuntu-latest`. `app-checks` braucht Node 24, `docs-check` und `build` Python 3.12.

## Einrichtung auf GitHub

Einmalig, von Hand im Repository:

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Rules/Branches → Regel für `main`:* **Require status checks to pass** mit den Checks `app-checks`
   und `docs-check`.
3. Beim ersten Lauf von „Doku veröffentlichen“ ggf. unter *Settings → Environments → github-pages* erlauben, dass
   `main` deployen darf.

## Regeln für die Doku

- `mkdocs build --strict` schlägt bei Warnungen fehl. Keine toten Links, keine fehlenden Seiten.
- Seiten, die noch nicht gebaut sind, tragen den Hinweis **„Geplant“** mit dem Ticket, das sie füllt.
- Jedes Ticket ergänzt seine Seiten in `doku/` und einen Eintrag in den [Änderungen](../aenderungen.md) – im selben
  Branch und PR wie der Code.
