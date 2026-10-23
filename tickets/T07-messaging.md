# T07 – MessagingService (ersetzt durch T23)

**Status: Kern erledigt durch T23 (PR #12). Nicht starten.**

Senden, Warteschlange, Status aus `msg.status`, Empfang aus `msg.received`, Duplikate, Splitting an 83 Bytes, `retry`, `cancel`, Reaktionen und
`sendLocation` gibt es in `core/messaging/messaging.service.ts` (siehe T23 und Skill `offgrid-antenna-protocol` §9).

Was aus diesem Ticket **noch fehlt**, geht an die Seiten-Tickets (Skill `offgrid-architecture` §4):

| Rest | Ticket |
|---|---|
| `contacts: Signal<ContactListItem[]>`, `unreadCount(contactId)`, `signalLevel` pro Kontakt, Neuladen per `effect` auf `DataChangedService.version` | T10 |
| `messages(contactId): Signal<MessageView[]>` (mit `location` aus `CoordinateRepository.latestForMessages`, bis T17 immer `null`) | T12 |
| `counts`, `deleteAll()`, Vibration bei eingehender Nachricht | T13 |

Die Weiterleitung `hs`/`hsa` an den `HandshakeService` entfällt (das Pairing macht die Antenne).
