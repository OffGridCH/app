# T20 – (Optional, ganz am Schluss) Gruppenchat

**Abhängig von:** T15
**Status-Hinweis:** Optional und als **letztes** Ticket. Startet erst, wenn der Mensch es freigibt
(in `STATUS.local.md` auf `offen` setzen).
**Offene Entscheidung vor dem Start:** Die Spezifikationen stellen Gruppenchats „out of scope“ für v1; der Skill `offgrid-groups` ist **veraltet** (Funkmodem-Entwurf).
Zuerst klären, ob Gruppen aus Einzelnachrichten entstehen oder das Ticket entfällt; dann Skill und Ticket neu schreiben.
**Skills:** `offgrid-groups`, `offgrid-antenna-protocol` (§5, §6), `offgrid-data`, `offgrid-crypto-handshake` (§5), `offgrid-design-system`, `offgrid-screens` (§0, §3, §6),
`offgrid-architecture`, `offgrid-testing`
**Dateien:** `src/app/core/groups/`, `src/app/core/data/**` (Migration v2, Group-Repositories), `src/app/core/models/`
(`group.ts`, `FrameType` + `'gki' | 'gmsg'`, `GroupErrorCode`), `src/app/core/messaging/group-frame-handler.ts`, `src/app/core/messaging/frame.ts`,
`src/app/core/messaging/messaging.service.ts` (nur Weiterleitung `gki`/`gmsg`), `src/app/core/messaging/limits.ts`,
`src/app/core/backup/` (Gruppen im Backup), `src/app/features/gruppe/`, `src/app/features/kontakte/`, `src/app/ui/**`
(`og-check-row`, Icon `users`, quadratische Avatar-Variante), `src/app/app.routes.ts`, `src/app/app.config.ts`, `src/testing/**` (nur Tester)
**Referenz:** `docs/design/screens/GruppeErstellen.dc.html`, `GruppenChat.dc.html`

## Umfang
Alles aus Skill `offgrid-groups` §1–§5.

## Akzeptanzkriterien
- [ ] Migration v2 läuft auf bestehender v1-Datenbank ohne Datenverlust (`PRAGMA user_version` = 2).
- [ ] Gruppe mit 1–8 Mitgliedern erstellbar; jedes Mitglied bekommt ein `gki`.
- [ ] Eine Gruppen-Nachricht = genau ein `gmsg`-Frame.
- [ ] Gruppen erscheinen in der Kontaktliste mit quadratischem Avatar und ohne Signalbalken.
- [ ] Prüfbefehle grün.

## Tests
`group.service.spec.ts` laut Skill `offgrid-groups` §6.
