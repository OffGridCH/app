# T14 – Backup: Export und Import

**Abhängig von:** T13
**Skills:** `offgrid-crypto-handshake` (§5), `offgrid-screens` (§0, §8, §9), `offgrid-data`, `offgrid-design-system`, `offgrid-testing`
**Dateien:** `src/app/core/backup/`, `src/app/features/einstellungen/export.page.*`, `import.page.*`,
`package.json` (nur `@capacitor/filesystem`, `@capacitor/share`, `@capawesome/capacitor-file-picker`)
**Referenz:** `docs/design/screens/Export.dc.html`, `Import.dc.html`

## Umfang
1. Pakete installieren, `npx cap sync android`.
2. `BackupService` mit internen, testbaren Funktionen `seal(data, password)` / `open(fileText, password)` und den
   öffentlichen Methoden laut Architektur §4; Datei-Ein-/Ausgabe (nativ + Browser) in `core/backup/file-io.ts` laut
   Krypto-Skill §5.
3. Seiten Export und Import laut Skill.

## Akzeptanzkriterien
- [ ] Dateiformat exakt laut Skill §5.
- [ ] Export → Import auf demselben Gerät stellt alle Kontakte und Nachrichten wieder her.
- [ ] Falsches Passwort → Text „Falsches Passwort oder beschädigte Datei.“
- [ ] Prüfbefehle grün.

## Tests
`backup.service.spec.ts` laut Skill `offgrid-testing`.
