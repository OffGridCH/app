# T07 – MessagingService

**Abhängig von:** T05
**Skills:** `offgrid-antenna-protocol` (§5–7), `offgrid-architecture` (§4), `offgrid-data`, `offgrid-crypto-handshake` (§1, §2), `offgrid-testing`
**Dateien:** `src/app/core/messaging/messaging.service.ts`, `src/app/core/messaging/handshake-frame-handler.ts` (Token), `src/testing/**` (nur Tester)

## Umfang
`MessagingService` mit allen Signals/Methoden laut Architektur §4 und Verhalten laut Protokoll §6:
Senden, Warteschlange, Flush bei `ready`, `txdone`-Zuordnung, Empfang `msg`/`ack`, Duplikate, `updateSignal`,
`maxContentBytes` (computed aus `info.max`), `markRead`, Weiterleitung `hs`/`hsa` an `HandshakeService.onFrame`
über das Token `HANDSHAKE_FRAME_HANDLER` (in `handshake-frame-handler.ts`, `providedIn: 'root'`-Factory = no-op; T08 überschreibt es).
`counts`, `renameContact`, `deleteContact`, `deleteAll`, `reload`, Neuladen per `effect` auf `DataChangedService.version`.
`signalLevel` für `ContactListItem` aus `core/messaging/signal.ts`.
`messages()` liefert `MessageView[]` (mit `location` aus `CoordinateRepository.latestForMessages`; bis T17 immer `null`).
Nachrichten speichern immer `kind: 'text'` (Standort folgt in T17).
Vibration bei eingehender Nachricht ist **nicht** Teil dieses Tickets (kommt in T13).

## Akzeptanzkriterien
- [ ] Status-Übergänge exakt: Queued → Sent (txdone ok) → Delivered (ack); txdone !ok → Failed; retry → Queued.
- [ ] Signals aktualisieren sich nach jedem Ereignis ohne Neuladen.
- [ ] Alle Fälle aus dem Pflichttest grün (UI folgt in T12).
- [ ] Prüfbefehle grün.

## Tests
`messaging.service.spec.ts` laut Skill `offgrid-testing` (alle dort genannten Fälle).
