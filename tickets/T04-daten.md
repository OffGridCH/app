# T04 – Datenbank, Repositories, Settings, App-Start

**Abhängig von:** T03
**Skills:** `offgrid-data`, `offgrid-architecture`, `offgrid-screens` (nur §6 Demo-Verlauf)
**Dateien:** `src/app/core/data/**`, `src/app/core/settings/`, `src/app/core/app-start.service.ts`,
`src/app/app.config.ts`, `src/app/app.component.ts`, `package.json` (nur `@capacitor-community/sqlite`)

## Umfang
1. `npm install @capacitor-community/sqlite`, danach `npx cap sync android`.
2. Abstrakte `DatabaseService` + `SqliteDatabaseService` (`open()` mit Verbindung `offgrid`, Migration v1,
   `PRAGMA foreign_keys = ON`; `replaceAll`; `deleteAllUserData`) + `MemoryDatabaseService` (inkl. `seedDemo()`).
   `DataChangedService` laut Architektur §4.
3. Abstrakte Repositories (inkl. `CoordinateRepository`) + SQLite-Implementierungen + Memory-Implementierungen laut Skill.
   Migrations-Mechanismus mit `PRAGMA user_version` laut Daten-Skill §0.
4. `memory/seed.ts` mit den Demo-Daten laut `offgrid-screens` §6 und Daten-Skill §4.
5. `SettingsService` laut Architektur §4 (Defaults laut Daten-Skill §2).
6. `AppStartService.init()` Schritte 1, 2, 4, 5, 6 (Antenne kommt in T05). In `AppComponent` aufrufen.
7. Plattform-Weiche für `DatabaseService` und Repositories in `app.config.ts`.

## Akzeptanzkriterien
- [ ] SQL exakt wie im Skill; nur parametrisierte Statements.
- [ ] Im Browser startet die App mit Demo-Daten (Memory), ohne Fehler in der Konsole; mit `localStorage og.noseed = '1'` leer.
- [ ] Memory-Repositories sind ohne `seedDemo()` leer.
- [ ] `install_id` wird beim ersten Start erzeugt und bleibt danach gleich (nativ).
- [ ] Prüfbefehle grün.

## Tests
Keine Pflichttests (Repos werden in T07/T08 indirekt über Memory getestet).
