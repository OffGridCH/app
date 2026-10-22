# CI

Die gleichen Prüfungen laufen **lokal** und bei jedem **Pull Request** gegen `main`. Erst wenn alle Checks grün sind,
darf gemerged werden.

## Lokal

```bash
npm run docs:install    # einmalig: legt .venv-docs/ an und lädt MkDocs Material
npm run check           # lint + test:ci + build
npm run docs:build      # mkdocs build --strict
```

| Befehl | Prüft |
|---|---|
| `npm run lint` | `ng lint` über `src/**/*.ts` und `src/**/*.html` |
| `npm run test:ci` | `ng test --configuration=ci --watch=false` (Vitest + jsdom) |
| `npm run build` | Produktions-Build |
| `npm run check` | die drei obigen hintereinander |
| `npm run docs:build` | Doku-Website mit `--strict`: keine toten Links, keine fehlenden Seiten |

`npm run docs:serve` zeigt die Doku lokal auf Port 8000.

## GitHub Actions

### `app-checks` (`.github/workflows/ci.yml`)

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: npm
- run: npm ci
- run: npm run lint
- run: npm run test:ci
- run: npm run build
```

Läuft auf `ubuntu-latest` bei jedem Pull Request gegen `main` und bei jedem Push auf `main`. Node 24 passt zur
Vorgabe im Projekt (≥ 24.15), `cache: npm` nutzt den Dependency-Cache.

### `docs-check` (`.github/workflows/ci.yml`)

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
- run: pip install -r requirements-docs.txt
- run: mkdocs build --strict
```

Baut die Doku ohne den lokalen `.venv-docs`-Ordner. Der Ordner und `site/` stehen in `.gitignore`.

### `Doku veröffentlichen` (`.github/workflows/pages.yml`)

Läuft bei jedem Push auf `main` (auch manuell über `workflow_dispatch`). Der Job `build` baut die Doku mit
`mkdocs build --strict`, `actions/upload-pages-artifact@v3` legt den Ordner `site` als Artefakt ab. Der Job `deploy`
braucht `build` und veröffentlicht mit `actions/deploy-pages@v4` in die Umgebung `github-pages`.

## Einmalig auf GitHub

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Rules/Branches* → Regel für `main` ergänzen: **Require status checks to pass** mit `app-checks` und
   `docs-check`. Die Checks erscheinen in der Liste, sobald der erste PR nach T21 gelaufen ist.
3. Beim ersten Lauf von „Doku veröffentlichen“ ggf. unter *Settings → Environments → github-pages* erlauben, dass
   `main` deployen darf.

Die Doku ist danach unter `https://offgridch.github.io/app/` erreichbar.