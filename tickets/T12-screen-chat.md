# T12 – Screen Chat

**Abhängig von:** T10, T23
**Skills:** `offgrid-screens` (§0, §6), `offgrid-design-system`
**Dateien:** `src/app/features/chat/`, `src/app/core/messaging/messaging.service.ts` (nur `messages(contactId)`)
**Referenz:** `docs/design/screens/Main.dc.html`, `ChatGetrennt.dc.html`

## Umfang
Seite laut Skill §6: Header mit Signal, Banner bei getrennter Antenne, Tagestrenner, Bubbles mit allen Status,
Retry, Leerzustand, Composer mit Byte-Limit, Auto-Scroll ans Ende, `markRead`.
Das Ticket ergänzt im `MessagingService` (Rest aus dem früheren T07): `messages(contactId): Signal<MessageView[]>` (aufsteigend nach `sentAt`, mit `location` aus
`CoordinateRepository.latestForMessages`; bis T17 `null`), neu geladen per `effect` auf `DataChangedService.version`.
Der Composer wird mit `blockOverLimit = false` benutzt: Texte über `maxContentBytes()` (83 Bytes) werden von `MessagingService.sendText` in mehrere Nachrichten geteilt.
Noch **ohne** Standort-Button und Standort-Bubbles (kommen in T18); `og-composer` mit `showLocation` false.

## Akzeptanzkriterien
- [ ] Demo-Chat mit Anna: Aufbau und Masse wie Referenz `Main.dc.html`, Texte und Daten laut Skill §6.
- [ ] Senden zeigt sofort eine Bubble (queued → sent → zugestellt).
- [ ] `window.ogMock.drop()` → Banner + Placeholder „Wird später gesendet“; neue Nachricht bleibt „in Warteschlange“;
      „Verbinden“ im Banner → `/verbinden` → „Erneut suchen“ → die Nachricht wird gesendet.
- [ ] `window.ogMock.failNext()` + Senden → „Nicht gesendet“ + „Erneut senden“ funktioniert.
- [ ] Ein Text mit mehr als 83 Bytes erscheint als mehrere Bubbles; der Zähler im Composer wird rot, das Senden bleibt möglich.
- [ ] `window.ogMock.reboot()` oder `window.ogMock.lock()`: die App entsperrt die Antenne wieder, Nachrichten, die noch beim Gerät warteten, zeigen „Nicht gesendet“ (nur bei Neustart).
- [ ] Beim Öffnen wird der Ungelesen-Zähler in der Kontaktliste 0.
- [ ] Prüfbefehle grün.
