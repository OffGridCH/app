# T14 – Backup: Export und Import

**Abhängig von:** T13
**Skills:** `offgrid-crypto-handshake` (§2, §5), `offgrid-screens` (§0, §8, §9), `offgrid-data`, `offgrid-design-system`, `offgrid-testing`
**Dateien:** `src/app/core/backup/`, `src/app/features/einstellungen/export.page.*`, `import.page.*`,
`package.json` (nur `@capacitor/filesystem`, `@capacitor/share`, `@capawesome/capacitor-file-picker`)
**Referenz:** `docs/design/screens/Export.dc.html`, `Import.dc.html`

## Umfang
1. Pakete installieren, `npx cap sync android`.
2. `BackupService` mit internen, testbaren Funktionen `seal(data, password)` / `open(fileText, password)` und den
   öffentlichen Methoden laut Architektur §4; Datei-Ein-/Ausgabe (nativ + Browser) in `core/backup/file-io.ts` laut
   Krypto-Skill §5.
3. Seiten Export und Import laut Skill.

## Hinweis (T23)
Die Kontakte werden **ohne Schlüssel** gesichert (die Schlüssel liegen auf der Antenne). Ein Backup stellt Verlauf und Kontaktanzeige wieder her, nicht die Fähigkeit,
mit den Kontakten zu schreiben; dafür braucht es dieselbe Antenne, die sich nur mit dem Keystore-Schlüssel desselben Handys entsperren lässt. Die Texte in `offgrid-screens`
§8/§9 („Kontakte und Schlüssel“, „enthält deine Schlüssel“) stimmen so nicht mehr und sind vom Menschen zu bestätigen, bevor das Ticket gebaut wird. Nach dem Import
gleicht `HandshakeService.syncContacts()` beim nächsten Entsperren mit der Antenne ab; ein Platz mit anderem Schlüssel löscht den importierten Verlauf dieses Platzes.

## Akzeptanzkriterien
- [ ] Dateiformat exakt laut Skill §5.
- [ ] Export → Import auf demselben Handy stellt alle Kontakte (ohne Schlüssel) und Nachrichten wieder her.
- [ ] Die Export-Datei enthält keinen Schlüssel (kein `sending_key`, `receiving_key`, `public_key` genügt als Anzeige).
- [ ] Falsches Passwort → Text „Falsches Passwort oder beschädigte Datei.“
- [ ] Prüfbefehle grün.

## Tests
`backup.service.spec.ts` laut Skill `offgrid-testing`.
