# T00 – Projekt-Setup und Theme

**Abhängig von:** –
**Skills:** `offgrid-architecture`, `offgrid-design-system`, `offgrid-testing`
**Dateien:** Projekt-Root (Konfiguration), `src/` komplett neu, `android/`

## Ziel
Lauffähiges, leeres Ionic-Angular-Capacitor-Projekt mit OffGrid-Theme, Ordnerstruktur, Routen-Stubs und den drei Prüfbefehlen.

## Umfang (genau in dieser Reihenfolge)
0. `node -v` muss ≥ 24.15 sein. Sonst **stoppen** und unter OFFENE FRAGEN melden. Es muss einen ersten Commit geben
   (`git log` zeigt etwas); sonst stoppen und melden.
1. Im Repo-Root ausführen:
   `npx @ionic/cli@latest start offgrid-tmp blank --type=angular-standalone --capacitor --package-id=ch.offgrid.app --no-git --no-interactive`
2. Gesamten Inhalt von `offgrid-tmp/` (inkl. Dotfiles, ohne `.git`) in den Repo-Root verschieben. Bestehende Dateien
   (`AGENTS.md`, `kilo.jsonc`, `.kilo/`, `docs/`, `tickets/`, `scripts/`, `LIES-MICH.md`, `.gitignore`) **nicht** überschreiben.
   Danach `offgrid-tmp/` löschen. `.gitignore`: Zeilen des Starters an die bestehende `.gitignore` **anhängen**
   (bestehende Zeilen behalten, z. B. `tickets/STATUS.local.md`). Erwartet: Angular 22, Ionic 9, Vitest – so lassen.
3. `npm install`
4. `npm install @capacitor/android @capacitor/status-bar @capacitor/splash-screen @capacitor/app @fontsource-variable/schibsted-grotesk @fontsource/geist-mono`
   und `npm install -D prettier`.
5. `capacitor.config.ts`: `appId: 'ch.offgrid.app'`, `appName: 'OffGrid'`, `webDir` wie vom Starter.
   Dann `npx cap add android`.
6. Lint: Falls `npm run lint` nicht existiert/fehlschlägt: `npx ng add angular-eslint --skip-confirmation`.
7. `package.json` Scripts: `"test:ci"` laut Skill `offgrid-testing`. `"build": "ng build"`.
   `src/test-setup.ts`: WebCrypto-Zeilen laut Skill `offgrid-testing` oben einfügen (Rest des Starters behalten).
   `.prettierrc`: `{ "singleQuote": true, "printWidth": 120 }`.
8. Theme:
   - `.kilo/skills/offgrid-design-system/tokens.scss` unverändert nach `src/theme/tokens.scss` kopieren.
   - `src/theme/typography.scss`: je Stil aus Skill-Tabelle §2 ein Mixin `og-type-<stil>`.
   - `src/theme/global.scss`: importiert `tokens.scss`; setzt `--ion-background-color: var(--og-bg)`,
     `--ion-text-color: var(--og-text)`, `--ion-font-family: var(--og-font)`, `body { background: var(--og-bg); color: var(--og-text); font-family: var(--og-font); }`,
     `ion-content { --background: var(--og-bg); }`, `ion-header, ion-footer { background: var(--og-bg); }`,
     Utility-Klasse `.og-sr-only` (visuell versteckt, für Screenreader sichtbar).
   - Ionic-Standard-CSS des Starters (`@ionic/angular/css/...`) bleibt eingebunden, aber **ohne** `palettes/dark.*`
     (z. B. `dark.system.css` entfernen – die App ist nur dunkel).
   - Schriften in `angular.json` → `styles` laut Skill §2 **vor** `global.scss`.
9. `src/app/app.config.ts`: `provideIonicAngular({ mode: 'md' })` (Import aus `@ionic/angular`), Router mit
   `withComponentInputBinding()`. Zoneless lassen.
9b. `src/index.html`: `<html lang="de">`, `<title>OffGrid</title>`, `<meta name="color-scheme" content="dark">`,
   `<meta name="theme-color" content="#0F1115">` (einzige erlaubte Hex-Stelle ausser Tokens/platform.ts/qr-colors.ts).
10. Ordnerstruktur laut `offgrid-architecture` §2 anlegen. Starter-Seite `home/` löschen.
11. Für jede Seite aus §5 eine Stub-Komponente (`<ion-content></ion-content>`, keine Texte) und alle Routen eintragen
    (lazy `loadComponent`). Noch **kein** Guard.
12. `core/log.ts`, `core/platform.ts` (`isNative()`, Konstante `STATUS_BAR_COLOR = '#0F1115'` mit Kommentar),
    `core/models/*.ts` exakt laut `offgrid-architecture` §7 plus `antenna.ts` (Typen aus `offgrid-antenna-protocol` §2/§4),
    `handshake.ts` (Typen aus `offgrid-crypto-handshake` §3), `errors.ts` (alle Fehlercode-Typen aus den Skills).
13. `npm run lint`, `npm run test:ci`, `npm run build`, `npx cap sync android` ausführen.

## Akzeptanzkriterien
- [ ] Alle drei Prüfbefehle laufen fehlerfrei; `npx cap sync android` läuft fehlerfrei.
- [ ] `npm start` zeigt eine dunkle, leere Seite (`--og-bg`) unter `/kontakte`.
- [ ] `src/theme/tokens.scss` ist byte-gleich mit der Skill-Datei.
- [ ] Ordner und Modelle wie im Skill; keine Starter-Reste (`home/`).
- [ ] Keine Pakete ausser den hier genannten.

## Tests
Nur der vom Starter erzeugte App-Test, angepasst, damit er grün ist (prüft, dass `AppComponent` erstellt wird).

## Nicht im Umfang
Komponenten, Services, Texte, Guards.
