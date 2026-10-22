# 00 – Projekt, Stack, Befehle

## Stack (fix, nicht ändern)

- **Angular 22** (Standalone Components, Signals, Control Flow `@if/@for`, **zoneless**), TypeScript 6, `strict: true`
- **Ionic 9** (Imports aus `@ionic/angular` – **nicht** mehr `@ionic/angular/standalone`), Mode immer `md`
- **Capacitor 8**, Zielplattform **nur Android**
- Test-Runner: **Vitest + jsdom** über den Angular-Builder `@angular/build:unit-test` (so erzeugt es der Starter).
- **Node ≥ 24.15** (Angular 22 verlangt `^22.22.3 || ^24.15.0 || ^26`). `node -v` prüfen, sonst stoppen.
- Versionen: genau die, die `ionic start` bei T00 erzeugt hat (stehen in `package.json`). Keine Major-Upgrades,
  kein `ng update`, kein `npx @ionic/migrate`.

## Umgebung

- Code, Agents, Lint/Test/Web-Build laufen auf der **Linux-Entwicklungs-VM** (VS Code Remote-SSH).
- Die Android-App baut und installiert der **Mensch unter Windows in Android Studio** (siehe `LIES-MICH.md`).
  Agents führen `./gradlew` nur aus, wenn `ANDROID_HOME` gesetzt ist; sonst überspringen und im Ergebnis vermerken.

## Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server im Browser (läuft immer mit Mock-Antenne + Memory-DB) | `npm start` |
| Lint | `npm run lint` |
| Tests einmal, headless | `npm run test:ci` |
| Produktions-Build | `npm run build` |
| Alle App-Checks (wie CI) | `npm run check` |
| Doku einmalig einrichten | `npm run docs:install` |
| Doku bauen (wie CI) / ansehen | `npm run docs:build` / `npm run docs:serve` (Port 8000) |
| Android synchronisieren | `npx cap sync android` |

## Ordner (Kurzfassung – Details im Skill `offgrid-architecture`)

```
src/app/
  core/        Services ohne UI: antenna/, crypto/, data/, messaging/, handshake/, backup/, settings/, models/
  ui/          Wiederverwendbare Design-Komponenten (Präfix og-), nur Darstellung, keine Services
  features/    Eine Seite pro Ordner: verbinden/, name/, kontakte/, handshake/, chat/, einstellungen/
src/theme/     tokens.scss (Design-Tokens) und global.scss
docs/          Referenz, nur lesen
tickets/       Aufgaben + STATUS.md (fix) + STATUS.local.md (lokal, Live-Status)
scripts/       android.ps1 (Windows-Hilfsskript für den Menschen, nicht ändern)
```

## Dateinamen

- kebab-case: `signal-bars.component.ts`, `contact.repository.ts`, `chat.page.ts`
- Seiten enden auf `.page.ts`, Komponenten auf `.component.ts`, Services auf `.service.ts`
- Jede Komponente: Template und Styles **inline** in der `.ts`-Datei, solange das Template unter 80 Zeilen bleibt;
  sonst `.html` und `.scss` daneben.
