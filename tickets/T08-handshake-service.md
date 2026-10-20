# T08 – HandshakeService

**Abhängig von:** T07
**Skills:** `offgrid-crypto-handshake` (§3, §4), `offgrid-antenna-protocol` (§5), `offgrid-data`, `offgrid-testing`
**Dateien:** `src/app/core/handshake/handshake.service.ts`, `src/app/core/handshake/scanner.ts` (nur Browser-Variante
mit `window.prompt`; nativ folgt in T11), `src/app/app.config.ts` (Token `HANDSHAKE_FRAME_HANDLER` → `useExisting: HandshakeService`),
`src/testing/**` (nur Tester)

## Umfang
Ablauf Schritt 1–4 für beide Rollen inkl. erneutem `hsa`, `current`-Signal (`HandshakeView`), `completedContactId`,
`clearCompleted()`, `cancel()`, `scan()`, `pending`, erneutes Senden des `hs`-Frames bei Wechsel auf `ready`
(nur Handshakes dieser Sitzung), `onFrame(bytes, rssi)`, `DataChangedService.notify()` nach neuem Kontakt.
HandshakeService injiziert **nicht** den MessagingService.

## Akzeptanzkriterien
- [ ] QR-Text exakt `{"v":1,"k":"…","n":"…"}`.
- [ ] Nach dem Ablauf haben beide Seiten gekreuzte Schlüssel (siehe Skill „Ergebnis“).
- [ ] Der Demo-Handshake „Jonas Keller“ wird beim Start **nicht** gesendet und bleibt ausstehend.
- [ ] Alle Fälle aus dem Pflichttest grün (UI folgt in T11).
- [ ] Prüfbefehle grün.

## Tests
`handshake.service.spec.ts` laut Skill `offgrid-testing`.
